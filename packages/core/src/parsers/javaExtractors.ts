/**
 * Java symbol extraction using tree-sitter AST.
 *
 * Pure functions — no vscode dependency, only web-tree-sitter.
 */

import Parser from 'web-tree-sitter';
import type { ExtractedSymbol } from '../model';
import { textFor } from './utils';

// ── Import extraction ───────────────────────────────────────

/**
 * Extract Java import module specifiers from source code.
 */
export function extractJavaImports(lang: Parser.Language, code: string): string[] {
  const parser = new Parser();
  parser.setLanguage(lang);
  const tree = parser.parse(code);
  const root = tree.rootNode;
  const out: string[] = [];

  const walk = (n: Parser.SyntaxNode) => {
    if (n.type === 'import_declaration') {
      const scoped = n.namedChildren.find((ch) => ch.type === 'scoped_identifier');
      const identifier = n.namedChildren.find((ch) => ch.type === 'identifier');
      const moduleNode = scoped ?? identifier;
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
 * Extract symbols from Java code: classes, interfaces, enums,
 * records, and public/protected methods.
 */
export function extractJavaSymbols(lang: Parser.Language, code: string): ExtractedSymbol[] {
  const parser = new Parser();
  parser.setLanguage(lang);
  const tree = parser.parse(code);
  const root = tree.rootNode;
  const symbols: ExtractedSymbol[] = [];

  const walk = (n: Parser.SyntaxNode, inClass: boolean = false) => {
    if (n.type === 'class_declaration') {
      const nameNode = n.namedChildren.find((ch) => ch.type === 'identifier');
      const superclassNode = n.namedChildren.find((ch) => ch.type === 'superclass');
      const modifiersNode = n.namedChildren.find((ch) => ch.type === 'modifiers');

      const isPublic = modifiersNode ? textFor(code, modifiersNode).includes('public') : false;

      if (nameNode) {
        const name = textFor(code, nameNode);
        let inherits: string | undefined;

        if (superclassNode) {
          const typeId = superclassNode.namedChildren.find((ch) => ch.type === 'type_identifier');
          if (typeId) {
            inherits = textFor(code, typeId);
          }
        }

        symbols.push({
          name,
          kind: 'class',
          signature: inherits ? `class ${name} extends ${inherits}` : `class ${name}`,
          inherits,
          exported: isPublic,
        });

        const bodyNode = n.namedChildren.find((ch) => ch.type === 'class_body');
        if (bodyNode) {
          for (const ch of bodyNode.namedChildren) {
            walk(ch, true);
          }
          return;
        }
      }
    }

    if (n.type === 'interface_declaration') {
      const nameNode = n.namedChildren.find((ch) => ch.type === 'identifier');
      const extendsNode = n.namedChildren.find((ch) => ch.type === 'extends_interfaces');
      const modifiersNode = n.namedChildren.find((ch) => ch.type === 'modifiers');

      const isPublic = modifiersNode ? textFor(code, modifiersNode).includes('public') : false;

      if (nameNode) {
        const name = textFor(code, nameNode);
        let inherits: string | undefined;

        if (extendsNode) {
          const typeId = extendsNode.namedChildren.find((ch) => ch.type === 'type_identifier');
          if (typeId) {
            inherits = textFor(code, typeId);
          }
        }

        symbols.push({
          name,
          kind: 'interface',
          signature: inherits ? `interface ${name} extends ${inherits}` : `interface ${name}`,
          inherits,
          exported: isPublic,
        });
      }
    }

    if (n.type === 'enum_declaration') {
      const nameNode = n.namedChildren.find((ch) => ch.type === 'identifier');
      const modifiersNode = n.namedChildren.find((ch) => ch.type === 'modifiers');

      const isPublic = modifiersNode ? textFor(code, modifiersNode).includes('public') : false;

      if (nameNode) {
        const name = textFor(code, nameNode);
        symbols.push({
          name,
          kind: 'enum',
          signature: `enum ${name}`,
          exported: isPublic,
        });
      }
    }

    if (n.type === 'record_declaration') {
      const nameNode = n.namedChildren.find((ch) => ch.type === 'identifier');
      const modifiersNode = n.namedChildren.find((ch) => ch.type === 'modifiers');

      const isPublic = modifiersNode ? textFor(code, modifiersNode).includes('public') : false;

      if (nameNode) {
        const name = textFor(code, nameNode);
        symbols.push({
          name,
          kind: 'record',
          signature: `record ${name}`,
          exported: isPublic,
        });
      }
    }

    if (n.type === 'method_declaration' && inClass) {
      const nameNode = n.namedChildren.find((ch) => ch.type === 'identifier');
      const paramsNode = n.namedChildren.find((ch) => ch.type === 'formal_parameters');
      const returnTypeNode = n.namedChildren.find(
        (ch) =>
          ch.type === 'type_identifier' ||
          ch.type === 'void_type' ||
          ch.type === 'generic_type' ||
          ch.type === 'array_type',
      );
      const modifiersNode = n.namedChildren.find((ch) => ch.type === 'modifiers');

      if (nameNode) {
        const name = textFor(code, nameNode);
        const mods = modifiersNode ? textFor(code, modifiersNode) : '';
        const isPublic = mods.includes('public') || mods.includes('protected');

        if (isPublic && !name.startsWith('_')) {
          const returnType = returnTypeNode ? textFor(code, returnTypeNode) : 'void';
          const params = paramsNode ? extractJavaParams(code, paramsNode) : [];

          symbols.push({
            name,
            kind: 'method',
            signature: `${returnType} ${name}(${params.join(', ')})`,
            exported: true,
          });
        }
      }
    }

    for (const ch of n.namedChildren) {
      if (!inClass) {
        walk(ch, false);
      }
    }
  };

  walk(root);
  tree.delete();
  return symbols;
}

// ── Helpers ──────────────────────────────────────────────────

function extractJavaParams(code: string, paramsNode: Parser.SyntaxNode): string[] {
  const params: string[] = [];
  for (const ch of paramsNode.namedChildren) {
    if (ch.type === 'formal_parameter' || ch.type === 'spread_parameter') {
      const nameNode = ch.namedChildren.find((c) => c.type === 'identifier');
      if (nameNode) {
        params.push(textFor(code, nameNode));
      }
    }
  }
  return params.slice(0, 4);
}
