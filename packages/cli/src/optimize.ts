/**
 * Optimize wrapper — tries LLM optimization, falls back to static content.
 *
 * - If an API key is available → run the generation agent
 * - If probeAndRefine=true → single-pass generate then probe & diagnose
 * - If no API key → warn and write static AGENTS.md content
 */

import {
  resolveProvider,
  loadEnvFile,
  runGenerateAgent,
} from '@aspectcode/optimizer';
import type { ProviderOptions, OptimizeStep, ChatUsage } from '@aspectcode/optimizer';
import {
  generateProbes,
  runProbes,
  diagnose,
  applyDiagnosisEdits,
} from '@aspectcode/evaluator';
import type { ProbeProgressCallback } from '@aspectcode/evaluator';
import { generateCanonicalContentForMode, generateKbCustomContent } from '@aspectcode/emitters';
import type { RunContext } from './cli';
import type { AspectCodeConfig } from './config';
import { fmt } from './logger';
import { store } from './ui/store';

/** Result of the optimization attempt. */
export interface OptimizeOutput {
  content: string;
  reasoning: string[];
  tokenUsage?: ChatUsage;
}

/**
 * Try to generate AGENTS.md content via LLM using static analysis as context.
 * Falls back to static instruction content when no API key is available.
 *
 * @param probeAndRefine  When true, run probe-based evaluation after generation
 *                        and auto-fix failures. Only used on first run or manual rerun.
 */
export async function tryOptimize(
  ctx: RunContext,
  kbContent: string,
  toolInstructions: Map<string, string>,
  config: AspectCodeConfig | undefined,
  baseContent: string,
  probeAndRefine = false,
): Promise<OptimizeOutput> {
  const { flags, log, root } = ctx;
  const optConfig = config?.optimize;
  const evalConfig = config?.evaluate;
  const evaluatorEnabled = probeAndRefine && evalConfig?.enabled !== false;

  // ── Resolve settings ──────────────────────────────────────

  const temperature = flags.temperature ?? optConfig?.temperature;
  const model = flags.model ?? optConfig?.model;
  const providerName = flags.provider ?? optConfig?.provider;
  const maxTokens = optConfig?.maxTokens;

  // ── Load .env and try to resolve a provider ───────────────
  let env: Record<string, string>;
  try {
    env = loadEnvFile(root);
  } catch {
    env = {};
  }

  if (providerName && !env['LLM_PROVIDER']) {
    env['LLM_PROVIDER'] = providerName;
  }

  const providerOptions: ProviderOptions = {};
  if (model) providerOptions.model = model;
  if (temperature !== undefined) providerOptions.temperature = temperature;
  if (maxTokens !== undefined) providerOptions.maxTokens = maxTokens;

  let provider;
  try {
    provider = resolveProvider(env, providerOptions);
  } catch {
    store.addSetupNote('no API key — static mode');
    log.warn(
      'No LLM API key found. Set OPENAI_API_KEY or ANTHROPIC_API_KEY in .env for optimization.',
    );
    const content = kbContent.length > 0
      ? generateKbCustomContent(kbContent, 'safe')
      : generateCanonicalContentForMode('safe', false);
    return { content, reasoning: [] };
  }

  const providerLabel = model ? `${provider.name} (${model})` : provider.name;
  store.addSetupNote('API key found');
  if (evaluatorEnabled) {
    store.addSetupNote('probe and refine');
  }
  log.info(`Generating with ${fmt.cyan(provider.name)}${model ? ` (${fmt.cyan(model)})` : ''}…`);
  store.setProvider(providerLabel);

  const fallbackContent = baseContent;

  // ── Build tool instructions context string ────────────────
  let toolContext = '';
  if (toolInstructions.size > 0) {
    const parts: string[] = [];
    for (const [tool, content] of toolInstructions) {
      parts.push(`### ${tool}\n${content}`);
    }
    toolContext = parts.join('\n\n');
  }

  // ── Progress callbacks ────────────────────────────────────
  const onProgress = (step: OptimizeStep): void => {
    if (step.kind === 'generating') {
      store.setPhase('optimizing', 'generating AGENTS.md…');
    } else if (step.kind === 'done') {
      store.setPhase('optimizing', 'generation complete');
    }
  };

  const optLog = flags.quiet ? undefined : {
    info(msg: string)  { log.info(msg); },
    warn(msg: string)  { log.warn(msg); },
    error(msg: string) { log.error(msg); },
    debug(msg: string) { log.debug(msg); },
  };

  // ── Generate ──────────────────────────────────────────────

  const result = await runGenerateAgent({
    currentInstructions: fallbackContent,
    kb: kbContent,
    toolInstructions: toolContext || undefined,
    provider,
    log: optLog,
    onProgress,
  });

  if (result.usage) {
    store.setTokenUsage(result.usage);
  }

  // ── Probe and refine (only when explicitly requested) ─────
  let finalContent = result.optimizedInstructions;

  if (evaluatorEnabled) {
    try {
      store.setPhase('evaluating');
      store.setEvalStatus({ phase: 'probing' });

      const maxProbes = evalConfig?.maxProbes ?? 10;
      const probes = generateProbes({ kb: kbContent, maxProbes });

      const onProbeProgress: ProbeProgressCallback = (info) => {
        if (info.phase === 'starting') {
          store.setEvalStatus({ phase: 'probing', probesTotal: info.total });
          store.setPhase('evaluating', `probe ${info.probeIndex + 1}/${info.total}: ${info.probeId}`);
        } else {
          store.setPhase('evaluating', `probe ${info.probeIndex + 1}/${info.total} ${info.passed ? '✔' : '✖'}`);
        }
      };

      const probeResults = await runProbes(
        finalContent, probes, provider,
        undefined, optLog, undefined, onProbeProgress,
      );

      const failures = probeResults.filter((r) => !r.passed);
      const passCount = probeResults.length - failures.length;

      store.setEvalStatus({ phase: 'probing', probesPassed: passCount, probesTotal: probeResults.length });

      if (failures.length > 0) {
        store.setEvalStatus({ phase: 'diagnosing' });
        store.setPhase('evaluating', 'refining…');

        const diagnosis = await diagnose(failures, finalContent, provider, optLog);

        if (diagnosis && diagnosis.edits.length > 0) {
          store.setPhase('evaluating', 'applying fixes');
          const fixed = await applyDiagnosisEdits(finalContent, diagnosis, provider, optLog);
          finalContent = fixed.content;
        }

        store.setEvalStatus({
          phase: 'done',
          probesPassed: passCount,
          probesTotal: probeResults.length,
          diagnosisEdits: diagnosis?.edits.length ?? 0,
        });
      } else {
        store.setEvalStatus({ phase: 'done', probesPassed: passCount, probesTotal: probeResults.length, diagnosisEdits: 0 });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.warn(`Probe and refine failed (non-fatal): ${msg}`);
    }
  }

  store.setReasoning(result.reasoning);
  return { content: finalContent, reasoning: result.reasoning, tokenUsage: result.usage };
}
