/**
 * AnalysisModel v0 — the canonical output type for @aspectcode/core.
 *
 * This is a pure-data, JSON-serializable structure with no vscode coupling.
 * Every field must survive JSON.parse(JSON.stringify(model)).
 */

// ── Top-level model ──────────────────────────────────────────

export interface AnalysisModel {
  /** Schema version — bump when shape changes */
  schemaVersion: '0.1';

  /** ISO-8601 timestamp of when the model was generated */
  generatedAt: string;

  /** Workspace / repository metadata */
  repo: RepoMeta;

  /** Per-file analysis results */
  files: AnalyzedFile[];

  /** Extracted symbols across all files */
  symbols: FileSymbols[];

  /** Dependency graph */
  graph: Graph;

  /** Computed metrics */
  metrics: Metrics;
}

// ── Repo ─────────────────────────────────────────────────────

export interface RepoMeta {
  /** Absolute path to the workspace root */
  root: string;
}

// ── Files ────────────────────────────────────────────────────

export interface AnalyzedFile {
  /** Workspace-relative path (forward-slash separated) */
  relativePath: string;
  /** Detected language id */
  language: string;
  /** Line count */
  lineCount: number;
  /** Exported symbol names (functions, classes, types) */
  exports: string[];
  /** Imported module specifiers */
  imports: string[];
}

// ── Symbols ──────────────────────────────────────────────────

/** All symbols extracted from a single file */
export interface FileSymbols {
  /** Workspace-relative path of the source file */
  file: string;
  /** Symbols found in this file */
  symbols: ExtractedSymbol[];
}

/** A single extracted symbol */
export interface ExtractedSymbol {
  name: string;
  kind: string;
  signature: string;
  inherits?: string;
  exported: boolean;
}

// ── Graph ────────────────────────────────────────────────────

export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface GraphNode {
  /** Unique id — workspace-relative path */
  id: string;
  /** Workspace-relative path (same as id) */
  path: string;
  /** Detected language */
  language: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: 'import' | 'export' | 'call' | 'inherit' | 'circular';
  strength: number;
  symbols: string[];
  lines: number[];
  bidirectional: boolean;
}

/**
 * Legacy alias — the extension's existing DependencyLink shape
 * maps directly to GraphEdge.
 */
export type DependencyLink = GraphEdge;

// ── Metrics ──────────────────────────────────────────────────

export interface Metrics {
  /** Files ranked by connectivity (in+out degree) */
  hubs: HubMetric[];
}

export interface HubMetric {
  /** Workspace-relative file path */
  file: string;
  inDegree: number;
  outDegree: number;
}
