/**
 * Shared dependency-connection utilities for CLI commands.
 *
 * Extracted from deps.ts so that both `deps` and `generate` can use
 * them without a command→command import dependency.
 */

import * as path from 'path';
import {
  DependencyAnalyzer,
} from '@aspectcode/core';
import type { AspectCodeConfig } from './config';
import type { Logger } from './logger';
import { fmt } from './logger';
import { loadWorkspaceFiles } from './workspace';

export interface DependencyConnection {
  source: string;
  target: string;
  type: string;
  symbols: string[];
  lines: number[];
  bidirectional: boolean;
}

export interface FilteredConnectionsResult {
  connections: DependencyConnection[];
  fileFilter?: string;
  error?: string;
}

function normalizeWorkspacePath(candidate: string, root: string): string | undefined {
  const abs = path.resolve(root, candidate);
  const rel = path.relative(root, abs);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    return undefined;
  }
  return rel.replace(/\\/g, '/');
}

export function filterConnectionsByFile(
  connections: DependencyConnection[],
  root: string,
  file?: string,
): FilteredConnectionsResult {
  if (!file) {
    return { connections };
  }

  const fileRel = normalizeWorkspacePath(file, root);
  if (!fileRel) {
    return {
      connections: [],
      error: `--file must point to a file inside the workspace: ${fmt.bold(file)}`,
    };
  }

  return {
    connections: connections.filter(
      (row) => row.source === fileRel || row.target === fileRel,
    ),
    fileFilter: fileRel,
  };
}

export async function collectConnections(
  root: string,
  config: AspectCodeConfig | undefined,
  log: Logger,
): Promise<DependencyConnection[]> {
  const workspace = await loadWorkspaceFiles(root, config, log, { quiet: true });
  if (workspace.discoveredPaths.length === 0) {
    return [];
  }

  const analyzer = new DependencyAnalyzer();
  analyzer.setFileContentsCache(workspace.absoluteFiles);
  const edges = await analyzer.analyzeDependencies(workspace.discoveredPaths, workspace.host);

  return edges.map((edge) => ({
    source: path.relative(root, edge.source).replace(/\\/g, '/'),
    target: path.relative(root, edge.target).replace(/\\/g, '/'),
    type: edge.type,
    symbols: edge.symbols,
    lines: edge.lines,
    bidirectional: edge.bidirectional,
  }));
}
