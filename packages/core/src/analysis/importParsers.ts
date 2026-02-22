/**
 * Lightweight call-site and import-strength helpers.
 *
 * Tree-sitter-based import extraction now lives in the per-language
 * extractors (pythonExtractors, tsJsExtractors, javaExtractors,
 * csharpExtractors) and is wired through dependencyAdapters.ts.
 * This module retains only the call-site scanner and the
 * import-strength heuristic used by DependencyAnalyzer.
 */

import * as path from 'path';

// ── Types ────────────────────────────────────────────────────

export interface ImportStatement {
  module: string;
  symbols: string[];
  isDefault: boolean;
  line: number;
  raw: string;
}

export interface CallSite {
  callee: string;
  line: number;
  isExternal: boolean;
}

// ── Call-site analysis ───────────────────────────────────────

/**
 * Analyze function/method calls in a single file.
 */
export function analyzeFileCalls(
  filePath: string,
  content: string,
): CallSite[] {
  const extension = path.extname(filePath).toLowerCase();
  const lines = content.split('\n');
  const calls: CallSite[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    const callPattern = /(\w+\.)*(\w+)\s*\(/g;
    let match;

    while ((match = callPattern.exec(line)) !== null) {
      const fullCall = match[0];
      const callee = match[2];

      if (isLikelyExternalCall(fullCall, extension)) {
        calls.push({ callee, line: lineNum, isExternal: true });
      }
    }
  }

  return calls;
}

// ── Helpers ──────────────────────────────────────────────────

/**
 * Calculate import strength based on number of symbols and pattern.
 */
export function calculateImportStrength(imp: ImportStatement): number {
  let strength = 0.7;
  strength += Math.min(0.2, imp.symbols.length * 0.05);
  if (imp.isDefault) {
    strength += 0.1;
  }
  return Math.min(1.0, strength);
}

/**
 * Detect if a function call is likely external (module-qualified).
 */
function isLikelyExternalCall(
  callExpr: string,
  _fileExtension: string,
): boolean {
  if (callExpr.startsWith('this.') || callExpr.startsWith('self.')) {
    return false;
  }
  return /^\w+\.\w+/.test(callExpr);
}
