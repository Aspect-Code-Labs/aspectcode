/**
 * Shared workspace file-loading utilities for CLI commands.
 *
 * Encapsulates the discover → read → Map pipeline that deps, impact,
 * and generate all need, eliminating repeated boilerplate.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  discoverFiles,
  createNodeHostForWorkspace,
  type CoreHost,
} from '@aspectcode/core';
import type { AspectCodeConfig } from './config';
import type { Logger } from './logger';
import type { SpinnerFactory } from './cli';
import { createSpinner } from './logger';

export interface WorkspaceFiles {
  /** Map of relative (posix) path → file content */
  relativeFiles: Map<string, string>;
  /** Map of absolute path → file content */
  absoluteFiles: Map<string, string>;
  /** Absolute paths returned by discoverFiles */
  discoveredPaths: string[];
  /** Pre-built host for the workspace (undefined when WASM dir cannot be resolved) */
  host: CoreHost | undefined;
}

/**
 * Discover and read all source files in the workspace.
 *
 * Returns both relative-keyed and absolute-keyed maps (the former for
 * `analyzeRepo`, the latter for `DependencyAnalyzer`).
 *
 * @param root    Absolute workspace root
 * @param config  Loaded config (used for exclude patterns)
 * @param log     Logger for debug output
 * @param opts    Options: quiet suppresses spinners
 */
export async function loadWorkspaceFiles(
  root: string,
  config: AspectCodeConfig | undefined,
  log: Logger,
  opts?: { quiet?: boolean; spin?: SpinnerFactory },
): Promise<WorkspaceFiles> {
  const exclude = config?.exclude;
  const makeSpin = opts?.spin ?? ((msg: string) => createSpinner(msg, { quiet: opts?.quiet }));

  const spin = makeSpin('Discovering files…', 'discovering');
  const discoveredPaths = await discoverFiles(root, exclude ? { exclude } : undefined);
  if (discoveredPaths.length === 0) {
    spin.stop('No files found');
    return {
      relativeFiles: new Map(),
      absoluteFiles: new Map(),
      discoveredPaths: [],
      host: createNodeHostForWorkspace(root),
    };
  }
  spin.stop(`Discovered ${discoveredPaths.length} files`);

  const spinRead = makeSpin(`Reading ${discoveredPaths.length} files…`, 'discovering');
  const relativeFiles = new Map<string, string>();
  const absoluteFiles = new Map<string, string>();
  for (const abs of discoveredPaths) {
    const rel = path.relative(root, abs).replace(/\\/g, '/');
    try {
      const content = fs.readFileSync(abs, 'utf-8');
      relativeFiles.set(rel, content);
      absoluteFiles.set(abs, content);
    } catch {
      log.debug(`  skip (unreadable): ${rel}`);
    }
  }
  spinRead.stop(`Read ${relativeFiles.size} files`);

  return {
    relativeFiles,
    absoluteFiles,
    discoveredPaths,
    host: createNodeHostForWorkspace(root),
  };
}
