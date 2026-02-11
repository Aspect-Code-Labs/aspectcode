/**
 * Analysis module — dependency analysis with no vscode coupling.
 */

// Import parsers
export type { ImportStatement, CallSite } from './importParsers';
export {
  analyzeFileImports,
  analyzeFileCalls,
  calculateImportStrength,
  isLikelyExternalCall,
  parsePythonImports,
  parseJavaScriptImports,
  parseJavaImports,
  parseCSharpImports,
  parseGoImports,
} from './importParsers';

// Module resolver
export type { FileIndex } from './moduleResolver';
export {
  buildFileIndex,
  resolveModulePathFast,
  resolveCallTargetFast,
} from './moduleResolver';

// Analyzer
export type { DependencyProgressCallback } from './analyzer';
export { DependencyAnalyzer } from './analyzer';
