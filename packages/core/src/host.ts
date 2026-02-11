/**
 * CoreHost — abstraction layer for environment-specific I/O.
 *
 * The extension provides a vscode-backed host; tests and CLI callers
 * use the Node.js host created by `createNodeHost()`.
 */

import * as fs from 'fs';
import * as path from 'path';

/** I/O host that core delegates to for file reads and WASM paths. */
export interface CoreHost {
  /** Read a file by absolute path, returning its UTF-8 content. */
  readFile(absolutePath: string): Promise<string>;

  /** Absolute paths to the WASM runtime and per-language grammars. */
  wasmPaths: WasmPaths;
}

export interface WasmPaths {
  /** Path to the core tree-sitter.wasm runtime */
  treeSitter: string;
  /** Map of language id → absolute path to its .wasm grammar */
  grammars: Record<string, string>;
}

/**
 * Standard language ids and their grammar filenames.
 * Used by `createNodeHost` to auto-discover grammars.
 */
const GRAMMAR_FILES: Record<string, string> = {
  python: 'python.wasm',
  typescript: 'typescript.wasm',
  tsx: 'tsx.wasm',
  javascript: 'javascript.wasm',
  java: 'java.wasm',
  csharp: 'c_sharp.wasm',
};

/**
 * Create a CoreHost backed by Node.js `fs` APIs.
 *
 * @param wasmDir  Directory containing tree-sitter.wasm and language grammars
 */
export function createNodeHost(wasmDir: string): CoreHost {
  const grammars: Record<string, string> = {};
  for (const [lang, filename] of Object.entries(GRAMMAR_FILES)) {
    const p = path.join(wasmDir, filename);
    if (fs.existsSync(p)) {
      grammars[lang] = p;
    }
  }

  return {
    readFile: (absolutePath: string) => fs.promises.readFile(absolutePath, 'utf-8'),
    wasmPaths: {
      treeSitter: path.join(wasmDir, 'tree-sitter.wasm'),
      grammars,
    },
  };
}
