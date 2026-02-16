/**
 * `aspectcode generate` — discover, analyze, and emit artifacts.
 *
 * Pipeline: discoverFiles → readAll → analyzeRepo → runEmitters → report
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  discoverFiles,
  analyzeRepo,
} from '@aspectcode/core';
import {
  createNodeEmitterHost,
  runEmitters,
} from '@aspectcode/emitters';
import type { EmitOptions, AssistantFlags } from '@aspectcode/emitters';
import type { CliFlags, CommandResult } from '../cli';
import { ExitCode } from '../cli';
import type { AspectCodeConfig } from '../config';
import type { Logger } from '../logger';
import { fmt, createSpinner } from '../logger';
import { collectConnections, filterConnectionsByFile } from './deps';

export async function runGenerate(
  root: string,
  flags: CliFlags,
  config: AspectCodeConfig | undefined,
  log: Logger,
): Promise<CommandResult> {
  const startMs = Date.now();

  // ── 1. Resolve options ────────────────────────────────────
  const outDir = flags.out ?? config?.outDir ?? undefined;
  const resolvedOut = outDir ? path.resolve(root, outDir) : root;
  const exclude = config?.exclude;

  if (!flags.json) {
    log.info(`Workspace: ${fmt.cyan(root)}`);
    if (outDir) log.info(`Output:    ${fmt.cyan(resolvedOut)}`);
    log.blank();
  }

  // ── 2. Discover files ─────────────────────────────────────
  const spin = createSpinner('Discovering files…', { quiet: flags.quiet });
  const discoveredPaths = await discoverFiles(root, exclude ? { exclude } : undefined);

  if (discoveredPaths.length === 0) {
    spin.fail('No source files found');
    log.warn('Check your exclude patterns.');
    return { exitCode: ExitCode.ERROR };
  }
  spin.stop(`Discovered ${discoveredPaths.length} files`);

  // ── 3. Read file contents ─────────────────────────────────
  const spinRead = createSpinner(`Reading ${discoveredPaths.length} files…`, { quiet: flags.quiet });
  const fileContents = new Map<string, string>();
  for (const abs of discoveredPaths) {
    const rel = path.relative(root, abs).replace(/\\/g, '/');
    try {
      const content = fs.readFileSync(abs, 'utf-8');
      fileContents.set(rel, content);
    } catch {
      log.debug(`  skip (unreadable): ${rel}`);
    }
  }
  spinRead.stop(`Read ${fileContents.size} files`);

  // ── 4. Analyze ────────────────────────────────────────────
  const spinAnalyze = createSpinner('Analyzing…', { quiet: flags.quiet });
  const model = analyzeRepo(root, fileContents);
  spinAnalyze.stop(
    `Analyzed ${model.files.length} files, ${model.graph.edges.length} edges`,
  );

  // ── 5. Resolve instruction target ─────────────────────────
  const host = createNodeEmitterHost();

  // Determine assistant selection: explicit flags override default.
  const hasExplicitAssistants = flags.copilot || flags.cursor || flags.claude || flags.other;
  const assistants: AssistantFlags = flags.kbOnly
    ? {}
    : hasExplicitAssistants
      ? {
          copilot: flags.copilot || undefined,
          cursor: flags.cursor || undefined,
          claude: flags.claude || undefined,
          other: flags.other || undefined,
        }
      : { other: true };

  const instructionsMode = flags.kbOnly
    ? 'off'
    : (flags.instructionsMode ?? 'safe');

  if (!flags.kbOnly && !flags.json) {
    const targets = Object.entries(assistants)
      .filter(([, v]) => v)
      .map(([k]) => k);
    log.info(`Instructions: ${fmt.cyan(targets.join(', ') || '(none)')}`);
  }

  // ── 6. Emit artifacts ─────────────────────────────────────
  const spinEmit = createSpinner('Writing artifacts…', { quiet: flags.quiet });

  const emitOpts: EmitOptions = {
    workspaceRoot: root,
    outDir: resolvedOut,
    assistants,
    instructionsMode,
    fileContents,
  };

  const report = await runEmitters(model, host, emitOpts);
  spinEmit.stop(`Wrote ${report.wrote.length} files`);

  let connections: Awaited<ReturnType<typeof collectConnections>> | undefined;
  if (flags.listConnections || flags.json) {
    const spinDeps = createSpinner('Computing dependencies…', { quiet: flags.quiet });
    const allConnections = await collectConnections(root, config, log);
    const filtered = filterConnectionsByFile(allConnections, root, flags.file);

    if (filtered.error) {
      spinDeps.fail('Dependency error');
      log.error(filtered.error);
      return { exitCode: ExitCode.USAGE };
    }

    connections = filtered.connections;
    spinDeps.stop(`Found ${connections.length} connections`);

    if (filtered.fileFilter && !flags.json) {
      log.info(`Filtered by: ${fmt.cyan(filtered.fileFilter)}`);
    }
  }

  // ── 7. Report ─────────────────────────────────────────────
  const elapsedMs = Date.now() - startMs;

  if (flags.json) {
    const payload = {
      schemaVersion: report.schemaVersion,
      wrote: report.wrote.map((w) => ({
        path: path.relative(root, w.path).replace(/\\/g, '/'),
        bytes: w.bytes,
      })),
      skipped: report.skipped,
      stats: report.stats,
      connections,
    };
    console.log(JSON.stringify(payload, null, 2));
  } else {
    log.blank();
    for (const w of report.wrote) {
      const rel = path.relative(root, w.path).replace(/\\/g, '/');
      log.success(`${rel} (${formatBytes(w.bytes)})`);
    }
  }

  if (report.skipped) {
    for (const s of report.skipped) {
      log.debug(`  skipped: ${s.id} — ${s.reason}`);
    }
  }

  if (flags.listConnections && !flags.json) {
    log.blank();
    log.info(fmt.bold('Dependency connections:'));
    for (const row of connections ?? []) {
      const symbols = row.symbols.length > 0 ? ` [${row.symbols.join(', ')}]` : '';
      const lineInfo = row.lines.length > 0 ? ` @${row.lines.join(',')}` : '';
      const bidi = row.bidirectional ? ' <->' : '';
      log.info(
        `${fmt.cyan(row.source)} -> ${fmt.cyan(row.target)} ` +
          `(${row.type})${bidi}${symbols}${lineInfo}`,
      );
    }
  }

  if (!flags.json) {
    log.blank();
    log.info(
      fmt.dim(`Done in ${(elapsedMs / 1000).toFixed(1)}s — `) +
        `${report.wrote.length} files written`,
    );
  }

  return { exitCode: ExitCode.OK, report };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}
