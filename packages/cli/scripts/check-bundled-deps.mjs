/**
 * check-bundled-deps.mjs — verify every runtime @aspectcode/* import in
 * packages/cli/src is listed in bundledDependencies in package.json.
 *
 * Run:  node packages/cli/scripts/check-bundled-deps.mjs
 *
 * This catches the scenario where a developer adds a new `@aspectcode/*`
 * import to the CLI source but forgets to add it to `bundledDependencies`.
 * Without this check the CLI would work locally (workspace symlinks resolve
 * the import) but fail after `npm install -g` (the package is missing from
 * the published tarball).
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const cliDir    = join(__dirname, '..');
const srcDir    = join(cliDir, 'src');

/* ---------- load declared bundledDependencies ---------- */
const cliPkg   = JSON.parse(readFileSync(join(cliDir, 'package.json'), 'utf8'));
const SCOPE    = '@aspectcode/';
const bundled  = new Set(
  (cliPkg.bundledDependencies ?? []).filter(d => d.startsWith(SCOPE))
);

/* ---------- collect .ts source files recursively ---------- */
function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...walk(full));
    } else if (extname(full) === '.ts' || extname(full) === '.tsx') {
      files.push(full);
    }
  }
  return files;
}

/* ---------- scan for runtime @aspectcode/* imports ---------- */
// Match:  import ... from '@aspectcode/...'   (including multiline)
//         require('@aspectcode/...')
// Skip:   import type ... from '@aspectcode/...'
//
// Strategy: match every `from '@aspectcode/...'` token, then exclude lines
// that are pure `import type` statements.  Also match require() calls.
const FROM_RE    = /from\s+['"](@aspectcode\/[^'"\/]+)['"]/g;
const REQUIRE_RE = /require\(\s*['"](@aspectcode\/[^'"\/]+)['"]\s*\)/g;

// Detects `import type {` or `import type Foo` (pure type-only imports).
// We look backwards from the `from` keyword for the opening `import` keyword.
function isTypeOnlyImport(code, matchIndex) {
  // Walk backwards to find the `import` keyword for this statement
  const before = code.slice(Math.max(0, matchIndex - 300), matchIndex);
  // Find the last `import` keyword before the `from`
  const importMatch = before.match(/import\s+(type\s)/s);
  if (!importMatch) return false;
  // Make sure there is no `{` between `import type` and `from` that would
  // indicate `import { type Foo } from ...` (which is NOT type-only).
  // Actually the simpler check: does the statement start with `import type `?
  const stmtStart = before.lastIndexOf('import');
  if (stmtStart === -1) return false;
  const snippet = before.slice(stmtStart);
  return /^import\s+type\s/s.test(snippet);
}

const sourceFiles = walk(srcDir);
const imported = new Set();

for (const file of sourceFiles) {
  const code = readFileSync(file, 'utf8');

  // `from '@aspectcode/...'` — skip type-only imports
  FROM_RE.lastIndex = 0;
  let m;
  while ((m = FROM_RE.exec(code)) !== null) {
    if (!isTypeOnlyImport(code, m.index)) {
      imported.add(m[1]);
    }
  }

  // require('@aspectcode/...')
  REQUIRE_RE.lastIndex = 0;
  while ((m = REQUIRE_RE.exec(code)) !== null) {
    imported.add(m[1]);
  }
}

/* ---------- check for missing bundled deps ---------- */
const missing = [...imported].filter(dep => !bundled.has(dep)).sort();

if (missing.length) {
  console.error(
    `✗ The following @aspectcode/* packages are imported at runtime but NOT\n` +
    `  listed in bundledDependencies in packages/cli/package.json:\n\n` +
    missing.map(d => `    ${d}`).join('\n') + '\n\n' +
    `  Add them to "bundledDependencies" so they are included in the npm tarball.\n`
  );
  process.exit(1);
}

/* ---------- check for stale bundled deps ---------- */
const stale = [...bundled].filter(dep => !imported.has(dep)).sort();

if (stale.length) {
  console.warn(
    `⚠ The following bundledDependencies are not imported by any CLI source file:\n\n` +
    stale.map(d => `    ${d}`).join('\n') + '\n\n' +
    `  Consider removing them from "bundledDependencies" if they are no longer needed.\n`
  );
  // Warn only — not a hard failure (transitive deps may still be needed)
}

console.log(`✓ All ${imported.size} runtime @aspectcode/* imports are in bundledDependencies`);
