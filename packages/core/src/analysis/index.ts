/**
 * Analysis module — dependency analysis with no vscode coupling.
 */

// Import parsers
export type { ImportStatement, CallSite } from './importParsers';
export {
  calculateImportStrength,
  analyzeFileCalls,
} from './importParsers';

// Module resolver
export type { FileIndex } from './moduleResolver';
export {
  buildFileIndex,
  resolveModulePathFast,
  resolveCallTargetFast,
} from './moduleResolver';

// Analyzer
export type { DependencyProgressCallback, DependencyWarningCallback } from './analyzer';
export { DependencyAnalyzer } from './analyzer';

// Dependency adapter registry
export type { DependencyLanguageAdapter } from './dependencyAdapters';
export {
  analyzeDependenciesForFile,
  getDependencyAdapterForFile,
  getRegisteredDependencyAdapters,
} from './dependencyAdapters';
