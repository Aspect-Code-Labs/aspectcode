/**
 * Grammar loading for tree-sitter WASM runtime.
 *
 * Delegates WASM path resolution to the CoreHost so the same loading
 * logic works in VS Code (extension-bundled WASMs), tests (repo-local
 * WASMs), and future CLI usage.
 */

import Parser from 'web-tree-sitter';
import type { CoreHost } from '../host';

// ── Types ────────────────────────────────────────────────────

export type LoadedGrammars = {
  python?: Parser.Language;
  typescript?: Parser.Language;
  tsx?: Parser.Language;
  javascript?: Parser.Language;
  java?: Parser.Language;
  csharp?: Parser.Language;
};

export type GrammarSummary = {
  python: boolean;
  typescript: boolean;
  tsx: boolean;
  javascript: boolean;
  java: boolean;
  csharp: boolean;
  initFailed: boolean;
};

/** Optional logging callback used during grammar loading. */
export type LogFn = (message: string) => void;

// ── Public API ───────────────────────────────────────────────

/**
 * Initialize the tree-sitter WASM runtime and load all available
 * language grammars listed in `host.wasmPaths.grammars`.
 *
 * Each grammar is loaded individually with error isolation — one
 * failure does not prevent the others from loading.
 *
 * This function does NOT memoize; callers should cache the result
 * if repeated calls are expected (the extension uses a singleton
 * pattern for this).
 */
export async function loadGrammars(
  host: CoreHost,
  log?: LogFn,
): Promise<{ grammars: LoadedGrammars; summary: GrammarSummary }> {
  const summary: GrammarSummary = {
    python: false,
    typescript: false,
    tsx: false,
    javascript: false,
    java: false,
    csharp: false,
    initFailed: false,
  };

  try {
    log?.('Tree-sitter: initializing WASM runtime...');

    const wasmPath = host.wasmPaths.treeSitter;
    log?.(`Tree-sitter: WASM path: ${wasmPath}`);

    await Parser.init({
      locateFile(scriptName: string, scriptDirectory: string) {
        log?.(`Tree-sitter: locateFile called: ${scriptName} in ${scriptDirectory}`);
        if (scriptName === 'tree-sitter.wasm') {
          return wasmPath;
        }
        return scriptDirectory + scriptName;
      },
    });

    log?.('Tree-sitter: WASM runtime initialized successfully');
  } catch (error) {
    log?.(`Tree-sitter: initialization failed: ${error}`);
    summary.initFailed = true;
    return { grammars: {}, summary };
  }

  const grammars: LoadedGrammars = {};
  const langKeys: (keyof LoadedGrammars)[] = [
    'python',
    'typescript',
    'tsx',
    'javascript',
    'java',
    'csharp',
  ];

  for (const lang of langKeys) {
    const grammarPath = host.wasmPaths.grammars[lang];
    if (!grammarPath) {
      log?.(`Tree-sitter: no grammar path for ${lang}, skipping`);
      continue;
    }

    try {
      log?.(`Loading ${lang} grammar from ${grammarPath}...`);
      grammars[lang] = await Parser.Language.load(grammarPath);
      summary[lang] = true;
      log?.(`Tree-sitter: ${lang} grammar loaded ✓`);
    } catch (error) {
      log?.(`Tree-sitter: ${lang} grammar failed: ${error}`);
    }
  }

  log?.('Tree-sitter: initialization complete');
  return { grammars, summary };
}
