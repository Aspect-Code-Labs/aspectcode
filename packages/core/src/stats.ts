/**
 * Model statistics — derived read-only summaries from an AnalysisModel.
 *
 * Emitters (markdown, HTML, JSON, etc.) should use these helpers instead
 * of re-implementing counting/ranking logic.
 */

import type { AnalysisModel, GraphEdge, HubMetric } from './model';

// ── Types ────────────────────────────────────────────────────

export interface ModelStats {
  /** Total number of analyzed files */
  fileCount: number;
  /** Total lines of code across all files */
  totalLines: number;
  /** Count of files per detected language */
  languageCounts: Record<string, number>;
  /** Number of distinct languages */
  languageCount: number;
  /** Total number of graph edges (dependencies) */
  edgeCount: number;
  /** Number of circular dependency edges */
  circularCount: number;
  /** Number of bidirectional edges */
  bidirectionalCount: number;
  /** Total extracted symbols across all files */
  symbolCount: number;
  /** Top N hub files ranked by total degree (in + out) */
  topHubs: HubMetric[];
}

// ── Public API ───────────────────────────────────────────────

/**
 * Compute summary statistics from an AnalysisModel.
 *
 * @param model  The analysis model to summarize
 * @param topN   How many top hubs to include (default 10)
 */
export function computeModelStats(
  model: AnalysisModel,
  topN = 10,
): ModelStats {
  // Language counts & total lines
  const languageCounts: Record<string, number> = {};
  let totalLines = 0;
  for (const f of model.files) {
    languageCounts[f.language] = (languageCounts[f.language] ?? 0) + 1;
    totalLines += f.lineCount;
  }

  // Edge classification
  let circularCount = 0;
  let bidirectionalCount = 0;
  for (const e of model.graph.edges) {
    if (e.type === 'circular') circularCount++;
    if (e.bidirectional) bidirectionalCount++;
  }

  // Symbol count
  let symbolCount = 0;
  for (const fs of model.symbols) {
    symbolCount += fs.symbols.length;
  }

  // Hubs — use model.metrics.hubs if populated, otherwise derive from edges
  let topHubs: HubMetric[];
  if (model.metrics.hubs.length > 0) {
    topHubs = [...model.metrics.hubs]
      .sort((a, b) => b.inDegree + b.outDegree - (a.inDegree + a.outDegree))
      .slice(0, topN);
  } else {
    topHubs = deriveHubs(model.graph.edges, topN);
  }

  return {
    fileCount: model.files.length,
    totalLines,
    languageCounts,
    languageCount: Object.keys(languageCounts).length,
    edgeCount: model.graph.edges.length,
    circularCount,
    bidirectionalCount,
    symbolCount,
    topHubs,
  };
}

// ── Hub computation ──────────────────────────────────────────

/**
 * Derive top-N hub files from graph edges, ranked by total degree.
 *
 * Also used by analysis/repo.ts when building the initial model.
 */
export function deriveHubs(edges: GraphEdge[], topN = 10): HubMetric[] {
  const inDeg = new Map<string, number>();
  const outDeg = new Map<string, number>();

  for (const e of edges) {
    outDeg.set(e.source, (outDeg.get(e.source) ?? 0) + 1);
    inDeg.set(e.target, (inDeg.get(e.target) ?? 0) + 1);
  }

  const allFiles = new Set([...inDeg.keys(), ...outDeg.keys()]);
  const hubs: HubMetric[] = [];
  for (const file of allFiles) {
    hubs.push({
      file,
      inDegree: inDeg.get(file) ?? 0,
      outDegree: outDeg.get(file) ?? 0,
    });
  }

  return hubs
    .sort((a, b) => b.inDegree + b.outDegree - (a.inDegree + a.outDegree))
    .slice(0, topN);
}
