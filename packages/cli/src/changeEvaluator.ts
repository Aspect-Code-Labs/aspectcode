/**
 * Change evaluator — real-time assessment of file changes against the
 * current AnalysisModel and learned preferences.
 *
 * All checks are pure functions. No LLM calls, no file reads beyond
 * what's already in RuntimeState, no tree-sitter. Fast enough to run
 * on every file save.
 */

import * as path from 'path';
import type { AnalysisModel } from '@aspectcode/core';
import type { PreferencesStore } from './preferences';
import { checkPreference } from './preferences';

// ── Types ────────────────────────────────────────────────────

export interface TimestampedChange {
  type: 'add' | 'change' | 'unlink';
  path: string;
  timestamp: number;
}

export interface ChangeAssessment {
  file: string;
  type: 'ok' | 'warning' | 'violation';
  rule: string;
  message: string;
  details?: string;
  suggestion?: string;
  dismissable: boolean;
}

export interface ChangeContext {
  model: AnalysisModel;
  agentsContent: string;
  preferences: PreferencesStore;
  recentChanges: TimestampedChange[];
  fileContents?: ReadonlyMap<string, string>;
}

// ── Burst tracker ────────────────────────────────────────────

const BURST_WINDOW_MS = 60_000;
const recentChanges: TimestampedChange[] = [];

export function trackChange(event: { type: string; path: string }): void {
  recentChanges.push({
    type: event.type as TimestampedChange['type'],
    path: event.path,
    timestamp: Date.now(),
  });
  const cutoff = Date.now() - BURST_WINDOW_MS;
  while (recentChanges.length > 0 && recentChanges[0].timestamp < cutoff) {
    recentChanges.shift();
  }
}

export function getRecentChanges(): TimestampedChange[] {
  const cutoff = Date.now() - BURST_WINDOW_MS;
  while (recentChanges.length > 0 && recentChanges[0].timestamp < cutoff) {
    recentChanges.shift();
  }
  return [...recentChanges];
}

export function clearRecentChanges(): void {
  recentChanges.length = 0;
}

// ── Main evaluator ───────────────────────────────────────────

export function evaluateChange(
  event: { type: string; path: string },
  ctx: ChangeContext,
): ChangeAssessment[] {
  const assessments: ChangeAssessment[] = [];

  // Deleted files don't need convention/naming checks
  if (event.type !== 'unlink') {
    assessments.push(...checkHubSafety(event.path, ctx));

    if (event.type === 'add') {
      assessments.push(...checkDirectoryConvention(event.path, ctx));
      assessments.push(...checkNamingConvention(event.path, ctx));
    }

    if (event.type === 'change') {
      assessments.push(...checkImportPattern(event.path, ctx));
    }
  }

  // Apply preference overrides
  return applyPreferences(assessments, ctx.preferences);
}

// ── Check 1: Hub safety ──────────────────────────────────────

function checkHubSafety(file: string, ctx: ChangeContext): ChangeAssessment[] {
  const hub = ctx.model.metrics.hubs.find((h) => h.file === file);
  if (!hub) return [];

  // Find all files that depend on this hub (import from it)
  const dependents = new Set<string>();
  for (const edge of ctx.model.graph.edges) {
    if (edge.type === 'import' || edge.type === 'call') {
      if (edge.target === file && edge.source !== file) {
        dependents.add(edge.source);
      }
      if (edge.bidirectional && edge.source === file && edge.target !== file) {
        dependents.add(edge.target);
      }
    }
  }

  if (dependents.size === 0) return [];

  // Check which dependents have been changed recently
  const recentPaths = new Set(ctx.recentChanges.map((c) => c.path));
  const updatedDependents = [...dependents].filter((d) => recentPaths.has(d));
  const missingDependents = [...dependents].filter((d) => !recentPaths.has(d));

  if (missingDependents.length === 0) {
    return [{
      file,
      type: 'ok',
      rule: 'hub-safety',
      message: `All ${dependents.size} dependents updated`,
      dismissable: false,
    }];
  }

  const shown = missingDependents.slice(0, 3);
  const moreCount = missingDependents.length - shown.length;
  const fileList = shown.join(', ') + (moreCount > 0 ? `, +${moreCount} more` : '');

  return [{
    file,
    type: 'warning',
    rule: 'hub-safety',
    message: `High-risk hub — ${dependents.size} dependents, ${updatedDependents.length} updated`,
    details: `Not yet updated: ${fileList}`,
    suggestion: `You modified ${file} which has ${dependents.size} dependents. Please verify and update: ${missingDependents.join(', ')}`,
    dismissable: true,
  }];
}

// ── Check 2: Directory convention ────────────────────────────

function checkDirectoryConvention(file: string, ctx: ChangeContext): ChangeAssessment[] {
  const dir = path.dirname(file);
  if (dir === '.') return []; // root-level file, no convention to check

  // Check if this directory already has files in the model
  const existingInDir = ctx.model.files.filter(
    (f) => path.dirname(f.relativePath) === dir,
  );
  if (existingInDir.length > 0) return []; // known directory

  // New directory — check if the file type matches where similar files live
  const basename = path.basename(file).toLowerCase();
  const assessments: ChangeAssessment[] = [];

  // Check test file placement
  if (isTestFile(basename)) {
    const testDirs = findDirsMatching(ctx.model, isTestFile);
    if (testDirs.length > 0 && !testDirs.includes(dir)) {
      assessments.push({
        file,
        type: 'warning',
        rule: 'directory-convention',
        message: `Test file in unexpected directory`,
        details: `Tests usually live in: ${testDirs.slice(0, 3).join(', ')}`,
        suggestion: `This test file was created in ${dir}/ but existing tests are in ${testDirs[0]}/. Consider moving it.`,
        dismissable: true,
      });
    }
  }

  // Check route/controller/api file placement
  if (isRouteFile(basename)) {
    const routeDirs = findDirsMatching(ctx.model, isRouteFile);
    if (routeDirs.length > 0 && !routeDirs.includes(dir)) {
      assessments.push({
        file,
        type: 'warning',
        rule: 'directory-convention',
        message: `Route/API file in unexpected directory`,
        details: `Route files usually live in: ${routeDirs.slice(0, 3).join(', ')}`,
        suggestion: `This route file was created in ${dir}/ but existing routes are in ${routeDirs[0]}/. Consider moving it.`,
        dismissable: true,
      });
    }
  }

  return assessments;
}

function isTestFile(name: string): boolean {
  return /\.(test|spec)\.[^.]+$/.test(name) || /^test_/.test(name) || /_test\.[^.]+$/.test(name);
}

function isRouteFile(name: string): boolean {
  return /route|controller|endpoint|handler|api/i.test(name);
}

/** Find directories that contain files matching a predicate. */
function findDirsMatching(
  model: AnalysisModel,
  predicate: (basename: string) => boolean,
): string[] {
  const dirs = new Map<string, number>();
  for (const f of model.files) {
    if (predicate(path.basename(f.relativePath).toLowerCase())) {
      const d = path.dirname(f.relativePath);
      dirs.set(d, (dirs.get(d) ?? 0) + 1);
    }
  }
  // Sort by count descending
  return [...dirs.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([d]) => d);
}

// ── Check 3: Naming convention ───────────────────────────────

function checkNamingConvention(file: string, ctx: ChangeContext): ChangeAssessment[] {
  const dir = path.dirname(file);
  const basename = path.basename(file);
  const nameOnly = basename.replace(/\.[^.]+$/, ''); // strip extension

  // Find siblings in the same directory
  const siblings = ctx.model.files
    .filter((f) => path.dirname(f.relativePath) === dir)
    .map((f) => path.basename(f.relativePath).replace(/\.[^.]+$/, ''));

  if (siblings.length < 2) return []; // not enough data to detect a pattern

  const dominant = detectNamingPattern(siblings);
  if (!dominant) return [];

  const filePattern = classifyName(nameOnly);
  if (!filePattern || filePattern === dominant) return [];

  return [{
    file,
    type: 'warning',
    rule: 'naming-convention',
    message: `Naming doesn't match directory convention`,
    details: `"${basename}" is ${filePattern} but ${dir}/ uses ${dominant}`,
    dismissable: true,
  }];
}

type NamingPattern = 'camelCase' | 'PascalCase' | 'snake_case' | 'kebab-case';

function classifyName(name: string): NamingPattern | null {
  if (/^[a-z][a-zA-Z0-9]*$/.test(name) && /[A-Z]/.test(name)) return 'camelCase';
  if (/^[A-Z][a-zA-Z0-9]*$/.test(name)) return 'PascalCase';
  if (/^[a-z][a-z0-9]*(_[a-z0-9]+)+$/.test(name)) return 'snake_case';
  if (/^[a-z][a-z0-9]*(-[a-z0-9]+)+$/.test(name)) return 'kebab-case';
  return null;
}

function detectNamingPattern(names: string[]): NamingPattern | null {
  const counts: Record<string, number> = {};
  for (const name of names) {
    const pattern = classifyName(name);
    if (pattern) counts[pattern] = (counts[pattern] ?? 0) + 1;
  }

  const entries = Object.entries(counts);
  if (entries.length === 0) return null;

  entries.sort((a, b) => b[1] - a[1]);
  const [topPattern, topCount] = entries[0];

  // Require >50% dominance
  const total = entries.reduce((sum, [, c]) => sum + c, 0);
  if (topCount / total <= 0.5) return null;

  return topPattern as NamingPattern;
}

// ── Check 4: Import pattern ──────────────────────────────────

function checkImportPattern(file: string, ctx: ChangeContext): ChangeAssessment[] {
  if (!ctx.fileContents) return [];

  const content = ctx.fileContents.get(file);
  if (!content) return [];

  // Simple regex-based import extraction
  const currentImports = extractImports(content);
  const hubFiles = new Set(ctx.model.metrics.hubs.map((h) => h.file));

  // Get previous imports from the model
  const modelFile = ctx.model.files.find((f) => f.relativePath === file);
  const previousImports = new Set(modelFile?.imports ?? []);

  const assessments: ChangeAssessment[] = [];

  for (const imp of currentImports) {
    if (previousImports.has(imp)) continue; // not new

    // Resolve relative imports to check against hub paths
    const resolved = resolveRelativeImport(file, imp);
    if (resolved && hubFiles.has(resolved)) {
      const hub = ctx.model.metrics.hubs.find((h) => h.file === resolved);
      assessments.push({
        file,
        type: 'warning',
        rule: 'import-hub',
        message: `New import from high-risk hub`,
        details: `${resolved} (${hub?.inDegree ?? 0} dependents)`,
        dismissable: true,
      });
    }
  }

  return assessments;
}

const IMPORT_PATTERNS = [
  /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g,     // ES import
  /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,         // CommonJS
  /from\s+(\S+)\s+import/g,                         // Python
  /^import\s+(\S+)/gm,                              // Python bare import
];

function extractImports(content: string): string[] {
  const imports = new Set<string>();
  for (const pattern of IMPORT_PATTERNS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(content)) !== null) {
      imports.add(match[1]);
    }
  }
  return [...imports];
}

function resolveRelativeImport(fromFile: string, specifier: string): string | null {
  if (!specifier.startsWith('.')) return null;
  const dir = path.dirname(fromFile);
  let resolved = path.posix.join(dir, specifier);
  // Try common extensions
  for (const ext of ['', '.ts', '.tsx', '.js', '.jsx', '.py', '/index.ts', '/index.js']) {
    const candidate = resolved + ext;
    if (candidate === resolved && !resolved.includes('.')) continue;
    // We can't check if file exists, but return the posix-normalized path
    if (ext === '' && resolved.includes('.')) return resolved;
  }
  // Return with .ts as best guess for relative imports
  if (!resolved.includes('.')) {
    return resolved + '.ts';
  }
  return resolved;
}

// ── Preference override ──────────────────────────────────────

function applyPreferences(
  assessments: ChangeAssessment[],
  preferences: PreferencesStore,
): ChangeAssessment[] {
  return assessments.filter((a) => {
    const dir = path.dirname(a.file) + '/';
    const disposition = checkPreference(preferences, a.rule, a.file, dir);

    if (disposition === 'allow') return false; // suppress
    if (disposition === 'deny') {
      a.type = 'violation'; // upgrade to violation
    }
    return true;
  });
}
