/**
 * `aspectcode init` — create an `aspectcode.json` config file.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import {
  CONFIG_FILE_NAME,
  type AspectCodeConfig,
  configPath,
  defaultConfig,
  loadConfig,
} from '../config';
import type { CliFlags, CommandContext, CommandResult } from '../cli';
import { ExitCode } from '../cli';
import { fmt } from '../logger';
import { printAspectCodeBanner } from './settings';
import { runWatch } from './watch';

type UpdateRate = NonNullable<AspectCodeConfig['updateRate']>;

interface InitDeps {
  runWatchFn?: typeof runWatch;
}

export async function runInit(
  ctx: CommandContext,
  deps: InitDeps = {},
): Promise<CommandResult> {
  const { root, flags, log } = ctx;
  printAspectCodeBanner(log);

  const dest = configPath(root);

  // Guard: config already exists
  const existing = loadConfig(root);
  if (existing && !flags.force) {
    log.warn(
      `${CONFIG_FILE_NAME} already exists. Use ${fmt.bold('--force')} to overwrite.`,
    );
    return { exitCode: ExitCode.OK };
  }

  const config = await resolveInitConfig(flags);
  const content = JSON.stringify(config, null, 2) + '\n';

  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, content, 'utf-8');

  log.success(`Created ${fmt.cyan(CONFIG_FILE_NAME)}`);
  log.info('');
  log.info(`  Next step: run ${fmt.bold('aspectcode generate')} to build the knowledge base.`);
  log.info(`  Edit ${fmt.cyan(CONFIG_FILE_NAME)} to customise output and exclusions.`);

  if (!flags.quiet && isInteractiveTty()) {
    const startWatchNow = await askYesNo('Start watch now?', false);
    if (startWatchNow) {
      const watchRunner = deps.runWatchFn ?? runWatch;
      return await watchRunner({ root, flags, config, log, positionals: [] });
    }
  }

  return { exitCode: ExitCode.OK };
}

async function resolveInitConfig(flags: CliFlags): Promise<AspectCodeConfig> {
  const defaults = defaultConfig();

  if (flags.quiet || !isInteractiveTty()) {
    return defaults;
  }

  const updateRate = await selectUpdateRate(defaults.updateRate ?? 'onChange');

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  try {
    const outDirAnswer = (
      await ask(
        rl,
        'Where should generated files be written? (leave blank for workspace root): ',
      )
    ).trim();
    const outDir = outDirAnswer || undefined;

    const excludeAnswer = await ask(
      rl,
      'Any paths to exclude from analysis? (comma-separated, leave blank for none): ',
    );
    const exclude = parseExcludeList(excludeAnswer);

    return {
      ...defaults,
      updateRate,
      ...(outDir ? { outDir } : {}),
      ...(exclude.length > 0 ? { exclude } : {}),
    };
  } finally {
    rl.close();
  }
}

function ask(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer));
  });
}

async function askYesNo(question: string, defaultValue: boolean): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const defaultHint = defaultValue ? '[Y/n]' : '[y/N]';
  try {
    const answer = (await ask(rl, `${question} ${defaultHint} `)).trim().toLowerCase();
    if (!answer) {
      return defaultValue;
    }
    return answer === 'y' || answer === 'yes';
  } finally {
    rl.close();
  }
}

async function selectUpdateRate(
  defaultRate: AspectCodeConfig['updateRate'],
): Promise<UpdateRate> {
  const options: UpdateRate[] = ['onChange', 'idle', 'manual'];
  const fallback: UpdateRate =
    defaultRate === 'manual' || defaultRate === 'idle' || defaultRate === 'onChange'
      ? defaultRate
      : 'onChange';
  const selected = await selectWithArrowKeys(
    'Update rate (arrow keys + Enter):',
    options,
    options.indexOf(fallback) >= 0 ? options.indexOf(fallback) : 0,
  );
  return selected;
}

async function selectWithArrowKeys<T extends string>(
  prompt: string,
  options: readonly T[],
  initialIndex: number,
): Promise<T> {
  if (options.length === 0) {
    throw new Error('selectWithArrowKeys requires at least one option');
  }

  if (!isInteractiveTty()) {
    const boundedIndex = Math.min(Math.max(initialIndex, 0), options.length - 1);
    return options[boundedIndex];
  }

  const input = process.stdin;
  const output = process.stdout;
  let index = Math.min(Math.max(initialIndex, 0), options.length - 1);
  let renderedLines = 0;

  const render = () => {
    if (renderedLines > 0) {
      readline.moveCursor(output, 0, -renderedLines);
      readline.cursorTo(output, 0);
      readline.clearScreenDown(output);
    }

    const lines = [
      `${prompt} ${fmt.dim('(↑/↓ then Enter)')}`,
      ...options.map((option, optionIndex) => {
        const marker = optionIndex === index ? fmt.cyan('❯') : ' ';
        return `${marker} ${option}`;
      }),
    ];

    output.write(lines.join('\n') + '\n');
    renderedLines = lines.length;
  };

  return await new Promise<T>((resolve, reject) => {
    const previousRawMode = (input as NodeJS.ReadStream & { isRaw?: boolean }).isRaw === true;

    const cleanup = () => {
      input.off('keypress', onKeypress);
      if (typeof input.setRawMode === 'function') {
        input.setRawMode(previousRawMode);
      }
      input.pause();
      readline.cursorTo(output, 0);
      readline.clearScreenDown(output);
      output.write(`${prompt} ${fmt.cyan(options[index])}\n`);
    };

    const onKeypress = (_str: string, key: readline.Key) => {
      if (key.name === 'up') {
        index = index > 0 ? index - 1 : options.length - 1;
        render();
        return;
      }
      if (key.name === 'down') {
        index = index < options.length - 1 ? index + 1 : 0;
        render();
        return;
      }
      if (key.name === 'return' || key.name === 'enter') {
        cleanup();
        resolve(options[index]);
        return;
      }
      if (key.ctrl && key.name === 'c') {
        cleanup();
        reject(new Error('Cancelled by user'));
      }
    };

    readline.emitKeypressEvents(input);
    if (typeof input.setRawMode === 'function') {
      input.setRawMode(true);
    }
    input.resume();
    input.on('keypress', onKeypress);

    render();
  });
}

function isInteractiveTty(): boolean {
  return process.stdin.isTTY === true && process.stdout.isTTY === true;
}

function parseExcludeList(input: string): string[] {
  return input
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}
