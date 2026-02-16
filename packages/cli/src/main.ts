/**
 * @aspectcode/cli — main entry point.
 *
 * Hand-rolled argv parser (no external deps). Routes to command handlers.
 */

import * as path from 'path';
import type { CliArgs, CliFlags, CommandResult } from './cli';
import { ExitCode } from './cli';
import { loadConfig } from './config';
import { createLogger, disableColor, fmt } from './logger';
import { getVersion } from './version';
import { runInit } from './commands/init';
import { runGenerate } from './commands/generate';
import { runDepsList } from './commands/deps';
import { runWatch } from './commands/watch';
import { runImpact } from './commands/impact';
import {
  runAddExclude,
  runClearOutDir,
  runRemoveExclude,
  runSetOutDir,
  runSetUpdateRate,
  runShowConfig,
} from './commands/settings';

// ── Argv parsing ─────────────────────────────────────────────

export function parseArgs(argv: string[]): CliArgs {
  const flags: CliFlags = {
    help: false,
    version: false,
    verbose: false,
    quiet: false,
    listConnections: false,
    json: false,
    force: false,
    kbOnly: false,
    copilot: false,
    cursor: false,
    claude: false,
    other: false,
    noColor: false,
  };
  const positionals: string[] = [];
  let command = '';

  const args = argv.slice(2); // skip node + script
  let i = 0;

  while (i < args.length) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      flags.help = true;
    } else if (arg === '--version' || arg === '-V') {
      flags.version = true;
    } else if (arg === '--verbose' || arg === '-v') {
      flags.verbose = true;
    } else if (arg === '--quiet' || arg === '-q') {
      flags.quiet = true;
    } else if (arg === '--force' || arg === '-f') {
      flags.force = true;
    } else if (arg === '--root' || arg === '-r') {
      flags.root = args[++i];
    } else if (arg.startsWith('--root=')) {
      flags.root = arg.slice('--root='.length);
    } else if (arg === '--out' || arg === '-o') {
      flags.out = args[++i];
    } else if (arg.startsWith('--out=')) {
      flags.out = arg.slice('--out='.length);
    } else if (arg === '--list-connections') {
      flags.listConnections = true;
    } else if (arg === '--json') {
      flags.json = true;
    } else if (arg === '--file') {
      flags.file = args[++i];
    } else if (arg.startsWith('--file=')) {
      flags.file = arg.slice('--file='.length);
    } else if (arg === '--mode') {
      const v = args[++i];
      if (v === 'manual' || v === 'onChange' || v === 'idle') {
        flags.mode = v;
      }
    } else if (arg.startsWith('--mode=')) {
      const v = arg.slice('--mode='.length);
      if (v === 'manual' || v === 'onChange' || v === 'idle') {
        flags.mode = v;
      }
    } else if (arg === '--kb-only') {
      flags.kbOnly = true;
    } else if (arg === '--copilot') {
      flags.copilot = true;
    } else if (arg === '--cursor') {
      flags.cursor = true;
    } else if (arg === '--claude') {
      flags.claude = true;
    } else if (arg === '--other') {
      flags.other = true;
    } else if (arg === '--instructions-mode') {
      const v = args[++i];
      if (v === 'safe' || v === 'permissive' || v === 'off') {
        flags.instructionsMode = v;
      }
    } else if (arg.startsWith('--instructions-mode=')) {
      const v = arg.slice('--instructions-mode='.length);
      if (v === 'safe' || v === 'permissive' || v === 'off') {
        flags.instructionsMode = v;
      }
    } else if (arg === '--no-color') {
      flags.noColor = true;
    } else if (arg.startsWith('-')) {
      // Unknown flag — warn but keep going for forward compat
      const stderr = process.stderr;
      if (stderr && typeof stderr.write === 'function') {
        stderr.write(`Warning: unknown flag ${arg}\n`);
      }
    } else if (!command) {
      command = arg;
    } else {
      positionals.push(arg);
    }

    i++;
  }

  return { command, flags, positionals };
}

// ── Help text ────────────────────────────────────────────────

function printHelp(): void {
  console.log(`
${fmt.bold('aspectcode')} — generate AI-assistant knowledge bases from your codebase

${fmt.bold('USAGE')}
  aspectcode <command> [options]

${fmt.bold('COMMANDS')}
  init                     Create an ${fmt.cyan('aspectcode.json')} config file
  generate  ${fmt.dim('(gen, g)')}       Discover, analyze, and emit KB artifacts
  watch                    Watch source files and regenerate on changes
  impact                   Compute impact analysis for a file
  deps list                List dependency connections
  show-config              Show current ${fmt.cyan('aspectcode.json')} values
  set-update-rate <mode>   Set updateRate to manual|onChange|idle
  set-out-dir <path>       Set outDir
  clear-out-dir            Remove outDir
  add-exclude <path>       Add an exclude path
  remove-exclude <path>    Remove an exclude path

${fmt.bold('OPTIONS')}
  -r, --root <path>          Workspace root (default: cwd)
  -o, --out <path>           Output directory override
      --list-connections     Print dependency connections
      --json                 Print JSON output (for automation)
      --file <path>          Filter by file path
      --mode <mode>          Watch mode: manual|onChange|idle
      --kb-only              Generate KB artifacts only (skip instruction files)
      --copilot              Enable Copilot instruction file
      --cursor               Enable Cursor instruction file
      --claude               Enable Claude instruction file
      --other                Enable AGENTS.md instruction file
      --instructions-mode <m>  Instruction mode: safe|permissive|off
      --no-color             Disable colored output
  -f, --force                Overwrite existing config (init)
  -v, --verbose              Show debug output
  -q, --quiet                Suppress non-error output
  -h, --help                 Show this help
  -V, --version              Print version

${fmt.bold('EXAMPLES')}
  aspectcode init
  aspectcode generate
  aspectcode gen --copilot --cursor
  aspectcode g --json
  aspectcode impact --file src/app.ts
  aspectcode deps list --file src/app.ts
  aspectcode watch --mode idle
`.trimStart());
}

// ── Main ─────────────────────────────────────────────────────

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv);
  const { command, flags } = parsed;

  // Global flags that exit early
  if (flags.version) {
    console.log(getVersion());
    process.exitCode = ExitCode.OK;
    return;
  }

  if (flags.help) {
    printHelp();
    process.exitCode = ExitCode.OK;
    return;
  }

  if (!command) {
    printHelp();
    process.exitCode = ExitCode.USAGE;
    return;
  }

  // Apply --no-color before any output
  if (flags.noColor) {
    disableColor();
  }

  const log = createLogger({ verbose: flags.verbose, quiet: flags.quiet });
  const root = path.resolve(flags.root ?? process.cwd());

  let result: CommandResult;

  switch (command) {
    case 'init':
      result = await runInit(root, flags, log);
      break;

    case 'generate':
    case 'gen':
    case 'g': {
      const config = loadConfig(root);
      result = await runGenerate(root, flags, config, log);
      break;
    }

    case 'deps': {
      const config = loadConfig(root);
      const sub = parsed.positionals[0] ?? 'list';
      if (sub !== 'list') {
        log.error(`Unknown deps subcommand: ${fmt.bold(sub)}`);
        result = { exitCode: ExitCode.USAGE };
        break;
      }
      result = await runDepsList(root, flags, config, log);
      break;
    }

    case 'watch': {
      const config = loadConfig(root);
      result = await runWatch(root, flags, config, log);
      break;
    }

    case 'impact': {
      const config = loadConfig(root);
      result = await runImpact(root, flags, config, log);
      break;
    }

    case 'show-config': {
      result = await runShowConfig(root, flags, log);
      break;
    }

    case 'set-update-rate': {
      const value = parsed.positionals[0] ?? '';
      result = await runSetUpdateRate(root, flags, log, value);
      break;
    }

    case 'set-out-dir': {
      const value = parsed.positionals[0] ?? '';
      result = await runSetOutDir(root, flags, log, value);
      break;
    }

    case 'clear-out-dir': {
      result = await runClearOutDir(root, flags, log);
      break;
    }

    case 'add-exclude': {
      const value = parsed.positionals[0] ?? '';
      result = await runAddExclude(root, flags, log, value);
      break;
    }

    case 'remove-exclude': {
      const value = parsed.positionals[0] ?? '';
      result = await runRemoveExclude(root, flags, log, value);
      break;
    }

    default:
      log.error(`Unknown command: ${fmt.bold(command)}`);
      log.info(`Run ${fmt.bold('aspectcode --help')} for usage.`);
      result = { exitCode: ExitCode.USAGE };
  }

  process.exitCode = result.exitCode;
}

/** Entry point — called from bin/aspectcode.js. */
export function run(): void {
  main().catch((err: Error) => {
    console.error(err.message);
    process.exitCode = ExitCode.ERROR;
  });
}
