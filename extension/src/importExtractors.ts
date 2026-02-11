/**
 * Thin re-export layer -- all extraction logic now lives in @aspectcode/core.
 *
 * Extension call-sites continue to import from './importExtractors' unchanged.
 */

export type { ExtractedSymbol } from '@aspectcode/core';
export { extractPythonImports, extractTSJSImports } from '@aspectcode/core';
export { extractPythonSymbols, extractTSJSSymbols } from '@aspectcode/core';
export { extractJavaSymbols, extractCSharpSymbols } from '@aspectcode/core';

export type ImportEdge = { srcMod: string; dstMod: string };
