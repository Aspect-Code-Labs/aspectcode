/**
 * Provider resolution — loads API keys from environment / .env file
 * and returns the appropriate LlmProvider implementation.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { LlmProvider, ProviderName, ProviderOptions } from '../types';
import { PROVIDER_ENV_KEYS, LLM_PROVIDER_ENV } from '../types';
import { createOpenAiProvider } from './openai';
import { createAnthropicProvider } from './anthropic';

/**
 * Parse a `.env` file into key=value pairs.
 * Handles comments, blank lines, and optional quoting.
 */
export function parseDotenv(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    // Strip surrounding quotes
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

/**
 * Load environment variables from a `.env` file at the workspace root,
 * merged with `process.env` (process.env wins on conflicts).
 */
export function loadEnvFile(root: string): Record<string, string> {
  const envPath = path.join(root, '.env');
  const env: Record<string, string> = {};

  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    Object.assign(env, parseDotenv(content));
  }

  // process.env values take precedence
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) {
      env[key] = value;
    }
  }

  return env;
}

/**
 * Build the provider name → factory mapping.
 */
const PROVIDER_FACTORIES: Record<
  ProviderName,
  (apiKey: string, options?: ProviderOptions) => LlmProvider
> = {
  openai: createOpenAiProvider,
  anthropic: createAnthropicProvider,
};

/**
 * Read an API key from `env` and strip surrounding whitespace.
 *
 * Keys copy-pasted into `aspectcode.json` or a `.env` file routinely pick up
 * a stray leading/trailing space or newline. The provider APIs reject those
 * verbatim with a 401, which looks exactly like an invalid key — so trim here.
 */
function readKey(env: Record<string, string>, name: string): string | undefined {
  const raw = env[name];
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * True when the environment carries a usable personal API key — i.e. the user
 * is in BYOK mode. Checks `ASPECTCODE_LLM_KEY` and the standard provider env
 * vars (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`). This is the single source of
 * truth for "is this BYOK?" — keep it in sync with `resolveProvider` below.
 */
export function byokKeyPresent(env: Record<string, string>): boolean {
  if (readKey(env, 'ASPECTCODE_LLM_KEY')) return true;
  for (const envKey of Object.values(PROVIDER_ENV_KEYS)) {
    if (readKey(env, envKey)) return true;
  }
  return false;
}

/**
 * Resolve an LlmProvider from environment variables.
 *
 * Resolution order — a personal API key always wins over the hosted proxy,
 * so BYOK is the default whenever a key is present (in `.env`, the
 * environment, or injected from `aspectcode.json`):
 * 1. ASPECTCODE_LLM_KEY — explicit personal key
 * 2. LLM_PROVIDER explicitly set + matching standard API key
 * 3. Standard provider env vars (OPENAI_API_KEY / ANTHROPIC_API_KEY)
 * 4. Logged in → hosted proxy
 *
 * @param env - Merged environment (from .env + process.env)
 * @param providerOptions - Optional model/temperature/maxTokens overrides
 */
export function resolveProvider(
  env: Record<string, string>,
  providerOptions?: ProviderOptions,
): LlmProvider {
  const model = providerOptions?.model ?? env['LLM_MODEL'];
  const opts: ProviderOptions = {
    ...providerOptions,
    model,
  };

  // 1. Explicit personal key: ASPECTCODE_LLM_KEY
  const explicitKey = readKey(env, 'ASPECTCODE_LLM_KEY');
  if (explicitKey) {
    const forcedProvider = env[LLM_PROVIDER_ENV] as ProviderName | undefined;
    // Auto-detect provider from key format if not explicitly set
    const provider = forcedProvider
      ?? (explicitKey.startsWith('sk-ant-') ? 'anthropic' : 'openai');
    return PROVIDER_FACTORIES[provider](explicitKey, opts);
  }

  // 2. LLM_PROVIDER explicitly set with matching standard key
  const forcedProvider = env[LLM_PROVIDER_ENV] as ProviderName | undefined;
  if (forcedProvider) {
    const envKey = PROVIDER_ENV_KEYS[forcedProvider];
    if (!envKey) {
      throw new Error(
        `Unknown LLM_PROVIDER "${forcedProvider}". Supported: ${Object.keys(PROVIDER_ENV_KEYS).join(', ')}`,
      );
    }
    const apiKey = readKey(env, envKey);
    if (!apiKey) {
      throw new Error(
        `LLM_PROVIDER is set to "${forcedProvider}" but ${envKey} is not defined.\n` +
        `Add ${envKey}=sk-... or ASPECTCODE_LLM_KEY=sk-... to your .env file.`,
      );
    }
    return PROVIDER_FACTORIES[forcedProvider](apiKey, opts);
  }

  // 3. Standard provider env vars — a personal key takes precedence over the
  //    hosted proxy, so a key in `.env` is always honored even when logged in.
  const providerOrder: ProviderName[] = ['openai', 'anthropic'];
  for (const name of providerOrder) {
    const apiKey = readKey(env, PROVIDER_ENV_KEYS[name]);
    if (apiKey) {
      return PROVIDER_FACTORIES[name](apiKey, opts);
    }
  }

  // 4. Logged in → hosted proxy (used only when no personal key is present)
  const cliToken = env['ASPECTCODE_CLI_TOKEN'];
  if (cliToken) {
    const { createAspectCodeProvider } = require('./aspectcode');
    return createAspectCodeProvider(cliToken, opts) as LlmProvider;
  }

  throw new Error(
    'No LLM available. Log in with `aspectcode login` or set ASPECTCODE_LLM_KEY in your .env file.',
  );
}
