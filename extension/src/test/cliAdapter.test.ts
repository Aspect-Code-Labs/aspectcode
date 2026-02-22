declare function suite(name: string, fn: () => void): void;
declare function test(name: string, fn: () => void | Promise<void>): void;

import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { ChildProcess } from 'node:child_process';

import type * as vscode from 'vscode';
import { cliWatch, runCli } from '../services/CliAdapter';

class TestOutputChannel implements vscode.OutputChannel {
  name = 'test-output';
  lines: string[] = [];

  append(value: string): void {
    this.lines.push(value);
  }

  appendLine(value: string): void {
    this.lines.push(value);
  }

  replace(value: string): void {
    this.lines = [value];
  }

  clear(): void {
    this.lines = [];
  }

  show(): void {}

  hide(): void {}

  dispose(): void {}
}

class TestCancellationToken implements vscode.CancellationToken {
  isCancellationRequested = false;
  private listeners: Array<(value: unknown) => void> = [];

  onCancellationRequested(
    listener: (value: unknown) => void,
    thisArgs?: unknown,
    disposables?: vscode.Disposable[],
  ): vscode.Disposable {
    const bound = thisArgs ? listener.bind(thisArgs) : listener;
    this.listeners.push(bound);
    const disposable: vscode.Disposable = {
      dispose: () => {
        this.listeners = this.listeners.filter((l) => l !== bound);
      },
    };
    disposables?.push(disposable);
    return disposable;
  }

  cancel(): void {
    this.isCancellationRequested = true;
    for (const listener of [...this.listeners]) {
      listener(undefined);
    }
  }
}

function createFakeCliWorkspace(): {
  root: string;
  cleanup: () => void;
} {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ac-cli-adapter-'));
  const cliBinDir = path.join(root, 'packages', 'cli', 'bin');
  fs.mkdirSync(cliBinDir, { recursive: true });

  const scriptPath = path.join(cliBinDir, 'aspectcode.js');
  fs.writeFileSync(
    scriptPath,
    `#!/usr/bin/env node
const args = process.argv.slice(2);
if (args.includes('watch')) {
  console.log('watch ready');
  setInterval(() => {}, 1000);
  process.on('SIGTERM', () => process.exit(0));
  process.on('SIGINT', () => process.exit(0));
  return;
}
if (args.includes('--sleep')) {
  setTimeout(() => {
    console.log(JSON.stringify({ ok: true, waited: true }));
  }, 10000);
  return;
}
if (args.includes('--json')) {
  console.log(JSON.stringify({ ok: true, args }));
  return;
}
if (args.includes('--stderr')) {
  console.error('simulated stderr line');
}
console.log('plain-output');
`,
    'utf-8',
  );

  return {
    root,
    cleanup: () => fs.rmSync(root, { recursive: true, force: true }),
  };
}

function waitForExit(proc: ChildProcess, timeoutMs: number): Promise<void> {
  if (proc.exitCode !== null) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out waiting for process exit after ${timeoutMs}ms`));
    }, timeoutMs);

    const onExit = () => {
      cleanup();
      resolve();
    };

    const cleanup = () => {
      clearTimeout(timer);
      proc.off('exit', onExit);
    };

    proc.on('exit', onExit);
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

suite('CliAdapter integration', () => {
  test('runCli parses JSON payload and forwards --root', async () => {
    const ws = createFakeCliWorkspace();
    try {
      const output = new TestOutputChannel();
      const result = await runCli<{ ok: boolean; args: string[] }>({
        root: ws.root,
        args: ['generate', '--json'],
        outputChannel: output,
        timeoutMs: 5000,
      });

      assert.equal(result.exitCode, 0);
      assert.equal(result.data?.ok, true);
      assert.ok(result.data?.args.includes('--root'));
      assert.ok(result.data?.args.includes(ws.root));
      assert.ok(output.lines.some((line) => line.includes('[CLI] Spawning:')));
    } finally {
      ws.cleanup();
    }
  });

  test('runCli captures stderr and leaves data undefined for plain stdout', async () => {
    const ws = createFakeCliWorkspace();
    try {
      const output = new TestOutputChannel();
      const result = await runCli({
        root: ws.root,
        args: ['generate', '--stderr'],
        outputChannel: output,
        timeoutMs: 5000,
      });

      assert.equal(result.exitCode, 0);
      assert.equal(result.data, undefined);
      assert.ok(result.stdout.includes('plain-output'));
      assert.ok(result.stderr.includes('simulated stderr line'));
      assert.ok(output.lines.some((line) => line.includes('[CLI:err] simulated stderr line')));
    } finally {
      ws.cleanup();
    }
  });

  test('runCli supports cancellation token', async () => {
    const ws = createFakeCliWorkspace();
    try {
      const token = new TestCancellationToken();
      const runPromise = runCli({
        root: ws.root,
        args: ['generate', '--sleep'],
        token,
        timeoutMs: 15000,
      });

      await sleep(200);
      token.cancel();

      const result = await runPromise;
      assert.notEqual(result.exitCode, 0);
    } finally {
      ws.cleanup();
    }
  });

  test('runCli enforces timeout', async () => {
    const ws = createFakeCliWorkspace();
    try {
      const result = await runCli({
        root: ws.root,
        args: ['generate', '--sleep'],
        timeoutMs: 200,
      });

      assert.notEqual(result.exitCode, 0);
    } finally {
      ws.cleanup();
    }
  });

  test('cliWatch spawns watch process and streams output', async () => {
    const ws = createFakeCliWorkspace();
    try {
      const output = new TestOutputChannel();
      const proc = cliWatch(ws.root, {
        mode: 'onChange',
        outputChannel: output,
      });

      await sleep(400);
      assert.ok(output.lines.some((line) => line.includes('[CLI] Spawning watch:')));
      assert.ok(output.lines.some((line) => line.includes('[CLI:watch] watch ready')));

      proc.kill('SIGTERM');
      await waitForExit(proc, 5000);
    } finally {
      ws.cleanup();
    }
  });
});
