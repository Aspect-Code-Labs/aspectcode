/**
 * Shared utility functions for tree-sitter AST extractors.
 */

import Parser from 'web-tree-sitter';

/** Extract the source text for a syntax node. */
export function textFor(source: string, node: Parser.SyntaxNode): string {
  return source.slice(node.startIndex, node.endIndex);
}
