/**
 * @aspectcode/cli — shared types and interfaces.
 */

import type { EmitReport } from '@aspectcode/emitters';

/** Parsed CLI arguments. */
export interface CliArgs {
  command: string;
  flags: CliFlags;
  positionals: string[];
}

/** Named flags extracted from argv. */
export interface CliFlags {
  help: boolean;
  version: boolean;
  verbose: boolean;
  quiet: boolean;

  /** --root / -r : workspace root override (defaults to cwd). */
  root?: string;

  /** --out / -o : output directory override. */
  out?: string;

  /** --list-connections: print dependency connections in text form. */
  listConnections: boolean;

  /** --json: machine-readable output. */
  json: boolean;

  /** --file <path>: filter dependency output to one workspace file. */
  file?: string;

  /** --force / -f : overwrite existing config during init. */
  force: boolean;

  /** --mode: watch mode override. */
  mode?: 'manual' | 'onChange' | 'idle';

  /** --kb-only: generate KB artifacts only, skip instruction files. */
  kbOnly: boolean;

  /** --copilot: enable Copilot instruction file. */
  copilot: boolean;
  /** --cursor: enable Cursor instruction file. */
  cursor: boolean;
  /** --claude: enable Claude instruction file. */
  claude: boolean;
  /** --other: enable AGENTS.md instruction file. */
  other: boolean;

  /** --instructions-mode: instruction generation mode. */
  instructionsMode?: 'safe' | 'permissive' | 'off';
}

/** Exit codes. */
export const ExitCode = {
  OK: 0,
  ERROR: 1,
  USAGE: 2,
} as const;

export type ExitCodeValue = (typeof ExitCode)[keyof typeof ExitCode];

/** Result returned by every command handler. */
export interface CommandResult {
  exitCode: ExitCodeValue;
  report?: EmitReport;
}
