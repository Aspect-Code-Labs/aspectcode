/**
 * `aspectcode` settings commands.
 */

import type { CliFlags, CommandResult } from '../cli';
import { ExitCode } from '../cli';
import { loadRawConfig, saveRawConfig, type RawAspectCodeConfig } from '../config';
import type { Logger } from '../logger';
import { fmt } from '../logger';

type UpdateRate = 'manual' | 'onChange' | 'idle';

interface JsonSuccessPayload {
  ok: true;
  command: string;
  config: RawAspectCodeConfig;
  changed?: string[];
}

interface JsonErrorPayload {
  ok: false;
  command: string;
  error: string;
}

export function printAspectCodeBanner(log: Logger): void {
  const lines = [
    '  ___   ____  ____  _____ ____ _____    ____ ___  ____  _____',
    ' / _ \\ / ___||  _ \\| ____/ ___|_   _|  / ___/ _ \\|  _ \\| ____|',
    '| | | |\\___ \\| |_) |  _|| |     | |   | |  | | | | | | |  _|',
    '| |_| | ___) |  __/| |__| |___  | |   | |__| |_| | |_| | |___',
    ' \\___/ |____/|_|   |_____\\____| |_|    \\____\\___/|____/|_____|',
    '                         ASPECT CODE',
  ];

  for (const line of lines) {
    log.info(fmt.blue(line));
  }
  log.blank();
}

export async function runShowConfig(
  root: string,
  flags: CliFlags,
  log: Logger,
): Promise<CommandResult> {
  const command = 'show-config';

  try {
    const current = loadRawConfig(root) ?? {};
    const displayConfig = withCanonicalUpdateRate(current);

    if (flags.json) {
      emitJson({
        ok: true,
        command,
        config: displayConfig,
      });
    } else {
      log.info(JSON.stringify(displayConfig, null, 2));
    }

    return { exitCode: ExitCode.OK };
  } catch (error) {
    return outputError(command, flags, log, error);
  }
}

export async function runSetUpdateRate(
  root: string,
  flags: CliFlags,
  log: Logger,
  value: string,
): Promise<CommandResult> {
  const command = 'set-update-rate';
  const parsed = parseUpdateRate(value);
  if (!parsed) {
    return outputUsageError(
      command,
      flags,
      log,
      `Invalid update rate: ${fmt.bold(value)}. Expected manual|onChange|idle.`,
    );
  }

  try {
    const nextConfig = updateRawConfig(root, (cfg) => {
      cfg.updateRate = parsed;
      delete cfg.autoRegenerateKb;
    });

    return outputSuccess(command, flags, log, nextConfig, ['updateRate', 'autoRegenerateKb']);
  } catch (error) {
    return outputError(command, flags, log, error);
  }
}

export async function runSetOutDir(
  root: string,
  flags: CliFlags,
  log: Logger,
  value: string,
): Promise<CommandResult> {
  const command = 'set-out-dir';
  const outDir = value.trim();
  if (!outDir) {
    return outputUsageError(command, flags, log, `${fmt.bold('set-out-dir')} requires a non-empty path value.`);
  }

  try {
    const nextConfig = updateRawConfig(root, (cfg) => {
      cfg.outDir = outDir;
    });

    return outputSuccess(command, flags, log, nextConfig, ['outDir']);
  } catch (error) {
    return outputError(command, flags, log, error);
  }
}

export async function runClearOutDir(
  root: string,
  flags: CliFlags,
  log: Logger,
): Promise<CommandResult> {
  const command = 'clear-out-dir';

  try {
    const nextConfig = updateRawConfig(root, (cfg) => {
      delete cfg.outDir;
    });

    return outputSuccess(command, flags, log, nextConfig, ['outDir']);
  } catch (error) {
    return outputError(command, flags, log, error);
  }
}

export async function runAddExclude(
  root: string,
  flags: CliFlags,
  log: Logger,
  value: string,
): Promise<CommandResult> {
  const command = 'add-exclude';
  const excludePath = value.trim();
  if (!excludePath) {
    return outputUsageError(command, flags, log, `${fmt.bold('add-exclude')} requires a non-empty path value.`);
  }

  try {
    const nextConfig = updateRawConfig(root, (cfg) => {
      const list = normalizeExcludeList(cfg.exclude);
      if (!list.includes(excludePath)) {
        list.push(excludePath);
      }
      cfg.exclude = list;
    });

    return outputSuccess(command, flags, log, nextConfig, ['exclude']);
  } catch (error) {
    return outputError(command, flags, log, error);
  }
}

export async function runRemoveExclude(
  root: string,
  flags: CliFlags,
  log: Logger,
  value: string,
): Promise<CommandResult> {
  const command = 'remove-exclude';
  const excludePath = value.trim();
  if (!excludePath) {
    return outputUsageError(command, flags, log, `${fmt.bold('remove-exclude')} requires a non-empty path value.`);
  }

  try {
    const nextConfig = updateRawConfig(root, (cfg) => {
      const list = normalizeExcludeList(cfg.exclude).filter((entry) => entry !== excludePath);
      if (list.length > 0) {
        cfg.exclude = list;
      } else {
        delete cfg.exclude;
      }
    });

    return outputSuccess(command, flags, log, nextConfig, ['exclude']);
  } catch (error) {
    return outputError(command, flags, log, error);
  }
}

function updateRawConfig(
  root: string,
  apply: (config: RawAspectCodeConfig) => void,
): RawAspectCodeConfig {
  const nextConfig = { ...(loadRawConfig(root) ?? {}) };
  apply(nextConfig);
  saveRawConfig(root, nextConfig);
  return nextConfig;
}

function withCanonicalUpdateRate(config: RawAspectCodeConfig): RawAspectCodeConfig {
  if (config.updateRate || !config.autoRegenerateKb) {
    return { ...config };
  }

  let mapped: UpdateRate | undefined;
  if (config.autoRegenerateKb === 'off') {
    mapped = 'manual';
  } else if (config.autoRegenerateKb === 'onSave') {
    mapped = 'onChange';
  } else if (config.autoRegenerateKb === 'idle') {
    mapped = 'idle';
  }

  if (!mapped) {
    return { ...config };
  }

  return {
    ...config,
    updateRate: mapped,
  };
}

function parseUpdateRate(value: string): UpdateRate | undefined {
  const normalized = value.trim();
  if (normalized === 'manual' || normalized === 'onChange' || normalized === 'idle') {
    return normalized;
  }
  return undefined;
}

function normalizeExcludeList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === 'string');
}

function outputSuccess(
  command: string,
  flags: CliFlags,
  log: Logger,
  config: RawAspectCodeConfig,
  changed?: string[],
): CommandResult {
  if (flags.json) {
    const payload: JsonSuccessPayload = { ok: true, command, config, changed };
    emitJson(payload);
  } else {
    log.success(`Updated ${fmt.cyan('aspectcode.json')} via ${fmt.bold(command)}.`);
  }

  return { exitCode: ExitCode.OK };
}

function outputUsageError(
  command: string,
  flags: CliFlags,
  log: Logger,
  message: string,
): CommandResult {
  if (flags.json) {
    const payload: JsonErrorPayload = { ok: false, command, error: message };
    emitJson(payload);
  } else {
    log.error(message);
  }

  return { exitCode: ExitCode.USAGE };
}

function outputError(
  command: string,
  flags: CliFlags,
  log: Logger,
  error: unknown,
): CommandResult {
  const message = error instanceof Error ? error.message : String(error);
  if (flags.json) {
    const payload: JsonErrorPayload = { ok: false, command, error: message };
    emitJson(payload);
  } else {
    log.error(message);
  }

  return { exitCode: ExitCode.ERROR };
}

function emitJson(payload: JsonSuccessPayload | JsonErrorPayload): void {
  console.log(JSON.stringify(payload, null, 2));
}
