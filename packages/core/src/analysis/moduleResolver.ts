/**
 * Fast module resolution using pre-built file indexes.
 *
 * Provides O(1) average-case lookups for resolving import specifiers
 * to concrete file paths within the workspace.
 */

import * as path from 'path';

// ── Types ────────────────────────────────────────────────────

/**
 * Pre-built indexes for fast module resolution.
 * Built once per analysis run; lookups are O(1) average.
 */
export interface FileIndex {
  /** basename (no ext) -> list of full paths */
  byBasename: Map<string, string[]>;
  /** normalized lowercase path -> original path */
  byNormalizedPath: Map<string, string>;
  /** Set of all normalized lowercase paths for O(1) existence check */
  normalizedPathSet: Set<string>;
  /** For package-style imports: "pkg/subpkg/module" -> full path */
  byPackagePath: Map<string, string[]>;
}

// ── Index construction ───────────────────────────────────────

/**
 * Build indexes for fast lookups. O(N) once, then O(1) per lookup.
 */
export function buildFileIndex(files: string[]): FileIndex {
  const byBasename = new Map<string, string[]>();
  const byNormalizedPath = new Map<string, string>();
  const normalizedPathSet = new Set<string>();
  const byPackagePath = new Map<string, string[]>();

  for (const file of files) {
    const normalized = path.normalize(file);
    const normalizedLower = normalized.toLowerCase();
    const basename = path.basename(file, path.extname(file));

    // Index by basename
    const basenameKey = basename.toLowerCase();
    if (!byBasename.has(basenameKey)) {
      byBasename.set(basenameKey, []);
    }
    byBasename.get(basenameKey)!.push(file);

    // Index by normalized path
    byNormalizedPath.set(normalizedLower, file);
    normalizedPathSet.add(normalizedLower);

    // Index by package-style path segments
    const parts = normalized.replace(/\\/g, '/').split('/');
    const basenameNoExt = path.basename(file, path.extname(file));
    for (let i = 0; i < parts.length - 1; i++) {
      const pkgPath = parts.slice(i, -1).join('/') + '/' + basenameNoExt;
      const pkgKey = pkgPath.toLowerCase();
      if (!byPackagePath.has(pkgKey)) {
        byPackagePath.set(pkgKey, []);
      }
      byPackagePath.get(pkgKey)!.push(file);
    }
  }

  return { byBasename, byNormalizedPath, normalizedPathSet, byPackagePath };
}

// ── Module resolution ────────────────────────────────────────

/**
 * Fast module path resolution using pre-built indexes.
 * O(1) average per lookup instead of O(N).
 */
export function resolveModulePathFast(
  module: string,
  sourceFile: string,
  fileIndex: FileIndex,
): string | null {
  const sourceDir = path.dirname(sourceFile);
  const extension = path.extname(sourceFile).toLowerCase();
  const { byBasename, byNormalizedPath, normalizedPathSet, byPackagePath } = fileIndex;

  const allowedTargetExts = allowedExtensionsForSource(extension);
  const filterByExts = (candidates: string[]): string[] => {
    if (allowedTargetExts.size === 0) return candidates;
    return candidates.filter((c) => allowedTargetExts.has(path.extname(c).toLowerCase()));
  };

  // Build module variants
  const moduleVariants = [module];
  if (module.includes('.')) {
    const parts = module.split('.');
    moduleVariants.push(parts[parts.length - 1]);
    moduleVariants.push(parts.join('/'));
  }

  // Try relative path resolution first (O(1) lookup)
  for (const moduleVariant of moduleVariants) {
    const candidates: string[] = [];

    if (extension === '.py') {
      candidates.push(
        path.resolve(sourceDir, moduleVariant + '.py'),
        path.resolve(sourceDir, moduleVariant, '__init__.py'),
      );
    } else if (['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].includes(extension)) {
      candidates.push(
        path.resolve(sourceDir, moduleVariant + '.ts'),
        path.resolve(sourceDir, moduleVariant + '.tsx'),
        path.resolve(sourceDir, moduleVariant + '.js'),
        path.resolve(sourceDir, moduleVariant + '.jsx'),
        path.resolve(sourceDir, moduleVariant + '.mjs'),
        path.resolve(sourceDir, moduleVariant + '.cjs'),
        path.resolve(sourceDir, moduleVariant, 'index.ts'),
        path.resolve(sourceDir, moduleVariant, 'index.tsx'),
        path.resolve(sourceDir, moduleVariant, 'index.js'),
        path.resolve(sourceDir, moduleVariant, 'index.jsx'),
      );
    } else if (extension === '.go') {
      const pkgName = moduleVariant.split('/').pop() || moduleVariant;
      candidates.push(
        path.resolve(sourceDir, moduleVariant + '.go'),
        path.resolve(sourceDir, pkgName + '.go'),
        path.resolve(sourceDir, moduleVariant, pkgName + '.go'),
      );
    } else {
      candidates.push(
        path.resolve(sourceDir, moduleVariant + extension),
        path.resolve(sourceDir, moduleVariant, 'index' + extension),
      );
    }

    for (const candidate of candidates) {
      const normalized = path.normalize(candidate);
      const normalizedLower = normalized.toLowerCase();
      const match = byNormalizedPath.get(normalizedLower);
      if (match) return match;
      if (normalizedPathSet.has(normalizedLower)) {
        return byNormalizedPath.get(normalizedLower) || normalized;
      }
    }
  }

  // Try basename index (O(1) average)
  for (const moduleVariant of moduleVariants) {
    const filesWithBasename = byBasename.get(moduleVariant.toLowerCase());
    if (filesWithBasename && filesWithBasename.length > 0) {
      const chosen = chooseBestCandidate(
        filterByExts(filesWithBasename),
        sourceDir,
        extension,
      );
      if (chosen) return chosen;
    }
  }

  // Try package/path index
  const packageKeys = new Set<string>();
  if (module.includes('.')) {
    packageKeys.add(module.replace(/\./g, '/'));
  }
  for (const variant of moduleVariants) {
    const normalizedVariant = variant.replace(/\\/g, '/');
    if (normalizedVariant.includes('/') && !normalizedVariant.startsWith('.')) {
      packageKeys.add(normalizedVariant);

      if (normalizedVariant.startsWith('@')) {
        packageKeys.add(normalizedVariant.slice(1));
        const segs = normalizedVariant.split('/');
        if (segs.length >= 2) {
          packageKeys.add(segs.slice(1).join('/'));
        }
      }
    }
  }

  for (const key of packageKeys) {
    const keyNoExt = stripKnownExt(key).replace(/^\//, '');
    const keyLower = keyNoExt.toLowerCase();
    const matches = byPackagePath.get(keyLower);
    if (matches && matches.length > 0) {
      const chosen = chooseBestCandidate(filterByExts(matches), sourceDir, extension);
      if (chosen) return chosen;
    }
  }

  return null;
}

/**
 * Fast call target resolution using cached file contents.
 */
export function resolveCallTargetFast(
  callee: string,
  _sourceFile: string,
  fileIndex: FileIndex,
  fileContents: Map<string, string>,
): string | null {
  const parts = callee.split('.');
  if (parts.length < 2) return null;

  const moduleName = parts[0];
  const candidateFiles = fileIndex.byBasename.get(moduleName) || [];

  const patterns = [
    new RegExp(`def\\s+${parts[parts.length - 1]}\\s*\\(`, 'i'),
    new RegExp(`function\\s+${parts[parts.length - 1]}\\s*\\(`, 'i'),
    new RegExp(`${parts[parts.length - 1]}\\s*\\(.*\\)\\s*{`, 'i'),
    new RegExp(`${parts[parts.length - 1]}\\s*=\\s*\\(`, 'i'),
  ];

  for (const file of candidateFiles) {
    const content = fileContents.get(file);
    if (content && patterns.some((pattern) => pattern.test(content))) {
      return file;
    }
  }

  return null;
}

// ── Helpers ──────────────────────────────────────────────────

function allowedExtensionsForSource(sourceExt: string): Set<string> {
  if (sourceExt === '.py') return new Set(['.py']);
  if (['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].includes(sourceExt)) {
    return new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
  }
  if (sourceExt === '.java') return new Set(['.java']);
  if (sourceExt === '.cs') return new Set(['.cs']);
  if (sourceExt === '.go') return new Set(['.go']);
  return new Set();
}

function chooseBestCandidate(
  candidates: string[],
  sourceDir: string,
  extension: string,
): string | null {
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  // Prefer same directory
  for (const candidate of candidates) {
    if (path.dirname(candidate) === sourceDir) return candidate;
  }

  // Prefer matching extension
  const sameExt = candidates.filter(
    (c) => path.extname(c).toLowerCase() === extension,
  );
  if (sameExt.length === 1) return sameExt[0];
  if (sameExt.length > 1) candidates = sameExt;

  // Prefer shortest relative path
  let best = candidates[0];
  let bestScore = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    const rel = path.relative(sourceDir, path.dirname(candidate));
    const score = rel.split(path.sep).filter(Boolean).length;
    if (score < bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best;
}

function stripKnownExt(key: string): string {
  return key.replace(
    /\.(ts|tsx|js|jsx|mjs|cjs|py|java|cs|go|rs|rb|php)$/i,
    '',
  );
}
