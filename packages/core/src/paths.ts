/**
 * Posix-path normalization — the single source of truth for path format
 * at the model boundary.
 *
 * Every path stored in AnalysisModel (relativePath, graph node ids, edge
 * source/target, hub file, FileSymbols.file) MUST pass through `toPosix()`
 * before being written into the model. This prevents platform-dependent
 * backslash paths from leaking into JSON output.
 */

/**
 * Convert any path to forward-slash (posix) form.
 *
 * - Replaces all backslashes with forward slashes
 * - Strips leading `./`
 * - Collapses consecutive slashes
 *
 * Safe to call on paths that are already posix — idempotent.
 */
export function toPosix(p: string): string {
  return p
    .replace(/\\/g, '/')
    .replace(/\/\/+/g, '/')
    .replace(/^\.\//, '');
}

/**
 * Convert an absolute path to a workspace-relative posix path.
 *
 * If the path starts with `workspaceRoot` the prefix is stripped; otherwise
 * the filename (basename) is returned as a fallback.
 */
export function makeRelativePath(absPath: string, workspaceRoot: string): string {
  const normalizedAbs = toPosix(absPath);
  const normalizedRoot = toPosix(workspaceRoot).replace(/\/$/, '');
  if (normalizedAbs.startsWith(normalizedRoot)) {
    return normalizedAbs.substring(normalizedRoot.length).replace(/^\//, '');
  }
  // Fallback: return the basename
  const parts = normalizedAbs.split('/');
  return parts[parts.length - 1];
}
