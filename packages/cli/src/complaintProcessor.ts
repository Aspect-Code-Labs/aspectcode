/**
 * Complaint processor — takes queued user complaints, calls the
 * complaint agent to update AGENTS.md, and reports changes via the store.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  resolveProvider,
  loadEnvFile,
  runComplaintAgent,
} from '@aspectcode/optimizer';
import type { ProviderOptions } from '@aspectcode/optimizer';
import { createNodeEmitterHost } from '@aspectcode/emitters';
import type { RunContext } from './cli';
import type { AspectCodeConfig } from './config';
import { loadConfig } from './config';
import { writeAgentsMd } from './writer';
import type { OwnershipMode } from './writer';
import { store } from './ui/store';

/**
 * Drain the complaint queue and apply each batch of complaints to AGENTS.md.
 *
 * Reads the current AGENTS.md, sends complaints + KB context to the LLM,
 * writes the updated file, and surfaces changes in the dashboard.
 *
 * @returns true if at least one complaint was processed, false otherwise.
 */
export async function processComplaints(
  ctx: RunContext,
  ownership: OwnershipMode,
  kbContent: string,
): Promise<boolean> {
  const { root, flags, log } = ctx;

  // ── Collect all queued complaints ─────────────────────────
  const complaints: string[] = [];
  let next: string | undefined;
  while ((next = store.shiftComplaint()) !== undefined) {
    complaints.push(next);
  }
  if (complaints.length === 0) return false;

  // ── Resolve LLM provider ─────────────────────────────────
  const config: AspectCodeConfig | undefined = loadConfig(root);
  const optConfig = config?.optimize;

  const model = flags.model ?? optConfig?.model;
  const providerName = flags.provider ?? optConfig?.provider;
  const maxTokens = optConfig?.maxTokens;
  const temperature = flags.temperature ?? optConfig?.temperature;

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
    store.setWarning('No API key — cannot process complaints.');
    return false;
  }

  // ── Read current AGENTS.md ────────────────────────────────
  let currentInstructions: string;
  try {
    const agentsPath = path.join(root, 'AGENTS.md');
    currentInstructions = fs.readFileSync(agentsPath, 'utf-8');
  } catch {
    store.setWarning('AGENTS.md not found — run the pipeline first.');
    return false;
  }

  // ── Run complaint agent ───────────────────────────────────
  store.setProcessingComplaint(true);
  store.clearComplaintChanges();
  log.info(`Processing ${complaints.length} complaint${complaints.length === 1 ? '' : 's'}…`);

  const result = await runComplaintAgent({
    currentInstructions,
    kb: kbContent,
    complaints,
    provider,
    log: flags.quiet ? undefined : {
      info:  (msg: string) => log.info(msg),
      warn:  (msg: string) => log.warn(msg),
      error: (msg: string) => log.error(msg),
      debug: (msg: string) => log.debug(msg),
    },
  });

  // ── Write updated AGENTS.md ───────────────────────────────
  if (!flags.dryRun) {
    const host = createNodeEmitterHost();
    await writeAgentsMd(host, root, result.optimizedInstructions, ownership);
    log.success('AGENTS.md updated from complaints');
  }

  store.setComplaintChanges(result.changes);
  store.setProcessingComplaint(false);

  return true;
}
