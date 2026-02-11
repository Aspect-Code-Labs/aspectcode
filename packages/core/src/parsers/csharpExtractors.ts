/**
 * C# symbol extraction using tree-sitter AST.
 *
 * Pure functions — no vscode dependency, only web-tree-sitter.
 */

import Parser from 'web-tree-sitter';
import type { ExtractedSymbol } from '../model';
import { textFor } from './utils';

// ── Symbol extraction ────────────────────────────────────────

/**
 * Extract symbols from C# code: classes, interfaces, records, structs,
 * enums, public methods, and public properties.
 */
export function extractCSharpSymbols(lang: Parser.Language, code: string): ExtractedSymbol[] {
  const parser = new Parser();
  parser.setLanguage(lang);
  const tree = parser.parse(code);
  const root = tree.rootNode;
  const symbols: ExtractedSymbol[] = [];

  const walk = (n: Parser.SyntaxNode, inClass: boolean = false) => {
    if (n.type === 'class_declaration') {
      const nameNode = n.namedChildren.find((ch) => ch.type === 'identifier');
      const baseListNode = n.namedChildren.find((ch) => ch.type === 'base_list');
      const modifiersNode = n.children.find((ch) => ch.type === 'modifier');

      const modText = modifiersNode ? getAllModifiers(n, code) : '';
      const isPublic = modText.includes('public') || modText.includes('internal');

      if (nameNode) {
        const name = textFor(code, nameNode);
        let inherits: string | undefined;

        if (baseListNode) {
          const firstBase = baseListNode.namedChildren.find(
            (ch) =>
              ch.type === 'identifier' ||
              ch.type === 'generic_name' ||
              ch.type === 'qualified_name',
          );
          if (firstBase) {
            inherits = textFor(code, firstBase);
          }
        }

        symbols.push({
          name,
          kind: 'class',
          signature: inherits ? `class ${name} : ${inherits}` : `class ${name}`,
          inherits,
          exported: isPublic,
        });

        const bodyNode = n.namedChildren.find((ch) => ch.type === 'declaration_list');
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
      const baseListNode = n.namedChildren.find((ch) => ch.type === 'base_list');

      const modText = getAllModifiers(n, code);
      const isPublic = modText.includes('public') || modText.includes('internal');

      if (nameNode) {
        const name = textFor(code, nameNode);
        let inherits: string | undefined;

        if (baseListNode) {
          const firstBase = baseListNode.namedChildren.find(
            (ch) => ch.type === 'identifier' || ch.type === 'generic_name',
          );
          if (firstBase) {
            inherits = textFor(code, firstBase);
          }
        }

        symbols.push({
          name,
          kind: 'interface',
          signature: inherits ? `interface ${name} : ${inherits}` : `interface ${name}`,
          inherits,
          exported: isPublic,
        });
      }
    }

    if (n.type === 'record_declaration') {
      const nameNode = n.namedChildren.find((ch) => ch.type === 'identifier');

      const modText = getAllModifiers(n, code);
      const isPublic = modText.includes('public') || modText.includes('internal');

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

    if (n.type === 'struct_declaration') {
      const nameNode = n.namedChildren.find((ch) => ch.type === 'identifier');

      const modText = getAllModifiers(n, code);
      const isPublic = modText.includes('public') || modText.includes('internal');

      if (nameNode) {
        const name = textFor(code, nameNode);
        symbols.push({
          name,
          kind: 'struct',
          signature: `struct ${name}`,
          exported: isPublic,
        });
      }
    }

    if (n.type === 'enum_declaration') {
      const nameNode = n.namedChildren.find((ch) => ch.type === 'identifier');

      const modText = getAllModifiers(n, code);
      const isPublic = modText.includes('public') || modText.includes('internal');

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

    if (n.type === 'method_declaration' && inClass) {
      const nameNode = n.namedChildren.find((ch) => ch.type === 'identifier');
      const paramsNode = n.namedChildren.find((ch) => ch.type === 'parameter_list');
      const returnTypeNode = n.namedChildren.find(
        (ch) =>
          ch.type === 'predefined_type' ||
          ch.type === 'identifier' ||
          ch.type === 'generic_name' ||
          ch.type === 'nullable_type' ||
          ch.type === 'array_type',
      );

      const modText = getAllModifiers(n, code);
      const isPublic =
        modText.includes('public') || modText.includes('protected') || modText.includes('internal');

      if (nameNode && isPublic) {
        const name = textFor(code, nameNode);
        const returnType = returnTypeNode ? textFor(code, returnTypeNode) : 'void';
        const params = paramsNode ? extractCSharpParams(code, paramsNode) : [];

        symbols.push({
          name,
          kind: 'method',
          signature: `${returnType} ${name}(${params.join(', ')})`,
          exported: true,
        });
      }
    }

    if (n.type === 'property_declaration' && inClass) {
      const nameNode = n.namedChildren.find((ch) => ch.type === 'identifier');
      const typeNode = n.namedChildren.find(
        (ch) =>
          ch.type === 'predefined_type' ||
          ch.type === 'identifier' ||
          ch.type === 'generic_name' ||
          ch.type === 'nullable_type',
      );

      const modText = getAllModifiers(n, code);
      const isPublic = modText.includes('public') || modText.includes('internal');

      if (nameNode && isPublic) {
        const name = textFor(code, nameNode);
        const type = typeNode ? textFor(code, typeNode) : 'object';

        symbols.push({
          name,
          kind: 'property',
          signature: `${type} ${name}`,
          exported: true,
        });
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

function getAllModifiers(n: Parser.SyntaxNode, code: string): string {
  const mods: string[] = [];
  for (const ch of n.children) {
    if (ch.type === 'modifier') {
      mods.push(textFor(code, ch));
    }
  }
  return mods.join(' ');
}

function extractCSharpParams(code: string, paramsNode: Parser.SyntaxNode): string[] {
  const params: string[] = [];
  for (const ch of paramsNode.namedChildren) {
    if (ch.type === 'parameter') {
      const nameNode = ch.namedChildren.find((c) => c.type === 'identifier');
      if (nameNode) {
        params.push(textFor(code, nameNode));
      }
    }
  }
  return params.slice(0, 4);
}
