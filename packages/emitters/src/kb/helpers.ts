/**
 * Small, reusable helpers shared across KB emitter modules.
 *
 * All functions are pure (no I/O, no vscode).
 */

import { makeRelativePath } from '@aspectcode/core';
import { splitLines, truncationFooter } from './policy';

// Re-export makeRelativePath so internal consumers don't need to change.
export { makeRelativePath };

/**
 * Trim content to stay within a line budget, preserving structure.
 * Truncation tries to land on a section boundary (## or ---).
 */
export function enforceLineBudget(
  content: string,
  maxLines: number,
  _fileName: string,
  generatedAt: string,
): string {
  const lines = splitLines(content);
  if (lines.length <= maxLines) return lines.join('\n');

  let truncateAt = maxLines - 3;
  for (let i = maxLines - 3; i > maxLines - 20 && i > 0; i--) {
    if (lines[i].startsWith('##') || lines[i].startsWith('---')) {
      truncateAt = i;
      break;
    }
  }

  const truncated = lines.slice(0, truncateAt);
  truncated.push(...truncationFooter(maxLines, lines.length - truncateAt, generatedAt));
  return truncated.join('\n');
}

/**
 * Deduplicate an array, optionally by a key function.
 * Preserves the first occurrence.
 */
export function dedupe<T>(items: T[], keyFn?: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = keyFn ? keyFn(item) : String(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Standard finding shape used by KB enrichment detectors. */
export interface KBEnrichingFinding {
  file: string;
  message: string;
}

/**
 * Deduplicate and sort a list of findings by file then message.
 */
export function dedupeFindings(results: KBEnrichingFinding[]): KBEnrichingFinding[] {
  const seen = new Set<string>();
  return results
    .filter((r) => {
      const key = `${r.file}|${r.message}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.file.localeCompare(b.file) || a.message.localeCompare(b.message));
}
