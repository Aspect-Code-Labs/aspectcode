/**
 * Python import and symbol extraction using tree-sitter AST.
 *
 * Pure functions — no vscode dependency, only web-tree-sitter.
 */

import Parser from 'web-tree-sitter';
import type { ExtractedSymbol } from '../model';
import { textFor } from './utils';

// ── Import extraction ────────────────────────────────────────

/**
 * Extract Python import module specifiers from source code.
 *
 * Handles `import X`, `import X as Y`, `from pkg.mod import Z`.
 */
export function extractPythonImports(lang: Parser.Language, code: string): string[] {
  const parser = new Parser();
  parser.setLanguage(lang);
  const tree = parser.parse(code);
  const root = tree.rootNode;
  const out: string[] = [];

  const walk = (n: Parser.SyntaxNode) => {
    if (n.type === 'import_statement') {
      const aliasList = n.namedChildren.find((ch) => ch.type === 'import_list') || n;
      for (const ch of aliasList.namedChildren) {
        if (ch.type === 'dotted_name') {
          out.push(textFor(code, ch));
        }
      }
    } else if (n.type === 'import_from_statement') {
      const moduleNode =
        n.namedChildren.find((ch) => ch.type === 'dotted_name' || ch.type === 'relative_import') ||
        null;
      if (moduleNode) {
        out.push(textFor(code, moduleNode));
      }
    }

    for (const ch of n.namedChildren) {
      walk(ch);
    }
  };

  walk(root);
  tree.delete();
  return out;
}

// ── Symbol extraction ────────────────────────────────────────

/**
 * Extract symbols (functions, classes, methods) from Python code.
 */
export function extractPythonSymbols(lang: Parser.Language, code: string): ExtractedSymbol[] {
  const parser = new Parser();
  parser.setLanguage(lang);
  const tree = parser.parse(code);
  const root = tree.rootNode;
  const symbols: ExtractedSymbol[] = [];

  const walk = (n: Parser.SyntaxNode, inClass: boolean = false) => {
    if (n.type === 'function_definition') {
      const nameNode = n.namedChildren.find((ch) => ch.type === 'identifier');
      const paramsNode = n.namedChildren.find((ch) => ch.type === 'parameters');

      if (nameNode) {
        const name = textFor(code, nameNode);
        if (!name.startsWith('_') || name === '__init__') {
          const params = paramsNode ? extractPythonParams(code, paramsNode) : [];
          const paramStr = params.join(', ');
          symbols.push({
            name,
            kind: inClass ? 'method' : 'function',
            signature: `def ${name}(${paramStr})`,
            exported: !name.startsWith('_'),
          });
        }
      }
    }

    if (n.type === 'class_definition') {
      const nameNode = n.namedChildren.find((ch) => ch.type === 'identifier');
      const argListNode = n.namedChildren.find((ch) => ch.type === 'argument_list');

      if (nameNode) {
        const name = textFor(code, nameNode);
        let inherits: string | undefined;

        if (argListNode) {
          const firstArg = argListNode.namedChildren.find(
            (ch) => ch.type === 'identifier' || ch.type === 'attribute',
          );
          if (firstArg) {
            inherits = textFor(code, firstArg);
          }
        }

        symbols.push({
          name,
          kind: 'class',
          signature: inherits ? `class ${name}(${inherits})` : `class ${name}`,
          inherits,
          exported: !name.startsWith('_'),
        });

        const bodyNode = n.namedChildren.find((ch) => ch.type === 'block');
        if (bodyNode) {
          for (const ch of bodyNode.namedChildren) {
            walk(ch, true);
          }
          return;
        }
      }
    }

    for (const ch of n.namedChildren) {
      walk(ch, inClass);
    }
  };

  walk(root);
  tree.delete();
  return symbols;
}

// ── Helpers ──────────────────────────────────────────────────

function extractPythonParams(code: string, paramsNode: Parser.SyntaxNode): string[] {
  const params: string[] = [];
  for (const ch of paramsNode.namedChildren) {
    if (ch.type === 'identifier') {
      const name = textFor(code, ch);
      if (name !== 'self' && name !== 'cls') {
        params.push(name);
      }
    } else if (
      ch.type === 'typed_parameter' ||
      ch.type === 'default_parameter' ||
      ch.type === 'typed_default_parameter'
    ) {
      const idNode = ch.namedChildren.find((c) => c.type === 'identifier');
      if (idNode) {
        const name = textFor(code, idNode);
        if (name !== 'self' && name !== 'cls') {
          params.push(name);
        }
      }
    }
  }
  return params.slice(0, 4);
}
