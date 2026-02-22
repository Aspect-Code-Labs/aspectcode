/**
 * Registry-backed dependency extraction adapters.
 *
 * This layer centralizes language dispatch for dependency extraction,
 * so analyzers do not hardcode per-extension switches.
 *
 * Current adapters use existing parser functions. The interface is
 * intentionally tree-sitter-ready for phased migration.
 */

import * as path from 'path';
import type { CallSite, ImportStatement } from './importParsers';
import {
  analyzeFileCalls,
} from './importParsers';
import type { LoadedGrammars } from '../parsers/grammarLoader';
import { extractPythonImports } from '../parsers/pythonExtractors';
import { extractTSJSImports } from '../parsers/tsJsExtractors';
import { extractJavaImports } from '../parsers/javaExtractors';
import { extractCSharpImports } from '../parsers/csharpExtractors';

export type DependencyWarningKind =
  | 'grammar-missing'
  | 'tree-sitter-extract-failed';

export type DependencyWarningLogger = (
  kind: DependencyWarningKind,
  language: string,
  filePath: string,
  message: string,
) => void;

export interface DependencyLanguageAdapter {
  id: string;
  extensions: readonly string[];
  extractImports(
    filePath: string,
    content: string,
    ctx: AdapterContext,
  ): ImportStatement[];
  extractCalls(filePath: string, content: string): CallSite[];
}

interface AdapterContext {
  grammars: LoadedGrammars;
  warn?: DependencyWarningLogger;
}

function createTreeSitterPreferredAdapter(
  id: string,
  extensions: readonly string[],
  selectGrammar: (filePath: string, grammars: LoadedGrammars) => LoadedGrammars[keyof LoadedGrammars] | undefined,
  extractWithTreeSitter: (grammar: NonNullable<LoadedGrammars[keyof LoadedGrammars]>, code: string) => string[],
): DependencyLanguageAdapter {
  return {
    id,
    extensions,
    extractImports: (filePath, content, ctx) => {
      const grammar = selectGrammar(filePath, ctx.grammars);

      if (grammar) {
        try {
          const modules = extractWithTreeSitter(grammar, content);
          return modules.map((module) => ({
            module,
            symbols: [module],
            isDefault: true,
            line: 1,
            raw: `tree-sitter:${module}`,
          }));
        } catch (error) {
          ctx.warn?.(
            'tree-sitter-extract-failed',
            id,
            filePath,
            `Tree-sitter import extraction failed; skipping imports (${String(error)})`,
          );
          return [];
        }
      } else {
        ctx.warn?.(
          'grammar-missing',
          id,
          filePath,
          'No grammar loaded for language; skipping imports',
        );
        return [];
      }
    },
    extractCalls: (filePath, content) => analyzeFileCalls(filePath, content),
  };
}

const ADAPTERS: readonly DependencyLanguageAdapter[] = [
  createTreeSitterPreferredAdapter(
    'python',
    ['.py'],
    (_filePath, grammars) => grammars.python,
    extractPythonImports,
  ),
  createTreeSitterPreferredAdapter(
    'javascript',
    ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'],
    (filePath, grammars) => {
      const ext = path.extname(filePath).toLowerCase();
      if (ext === '.tsx') return grammars.tsx ?? grammars.typescript;
      if (ext === '.js' || ext === '.jsx' || ext === '.mjs' || ext === '.cjs') {
        return grammars.javascript ?? grammars.typescript;
      }
      return grammars.typescript ?? grammars.javascript;
    },
    extractTSJSImports,
  ),
  createTreeSitterPreferredAdapter(
    'java',
    ['.java'],
    (_filePath, grammars) => grammars.java,
    extractJavaImports,
  ),
  createTreeSitterPreferredAdapter(
    'csharp',
    ['.cs'],
    (_filePath, grammars) => grammars.csharp,
    extractCSharpImports,
  ),
];

const adapterByExtension = new Map<string, DependencyLanguageAdapter>();
for (const adapter of ADAPTERS) {
  for (const ext of adapter.extensions) {
    adapterByExtension.set(ext, adapter);
  }
}

let activeGrammars: LoadedGrammars = {};

export function setDependencyAdapterGrammars(grammars: LoadedGrammars): void {
  activeGrammars = grammars;
}

export function getDependencyAdapterForFile(
  filePath: string,
): DependencyLanguageAdapter | undefined {
  const ext = path.extname(filePath).toLowerCase();
  return adapterByExtension.get(ext);
}

export function analyzeDependenciesForFile(
  filePath: string,
  content: string,
  warn?: DependencyWarningLogger,
): { imports: ImportStatement[]; calls: CallSite[] } {
  const adapter = getDependencyAdapterForFile(filePath);
  const ctx: AdapterContext = {
    grammars: activeGrammars,
    warn,
  };

  if (!adapter) {
    return {
      imports: [],
      calls: analyzeFileCalls(filePath, content),
    };
  }

  return {
    imports: adapter.extractImports(filePath, content, ctx),
    calls: adapter.extractCalls(filePath, content),
  };
}

export function getRegisteredDependencyAdapters(): readonly DependencyLanguageAdapter[] {
  return ADAPTERS;
}
