/**
 * prepack.mjs — materialise workspace deps so `bundledDependencies` works.
 *
 * npm workspaces hoist everything into the repo root `node_modules/` via
 * symlinks, which `npm pack` refuses to follow for bundled deps.
 * This script copies the built output of each scoped workspace package into
 * `packages/cli/node_modules/@aspectcode/<pkg>` so the tarball includes them.
 *
 * The list of packages is derived from `bundledDependencies` in package.json
 * so there is a single source of truth — no separate array to keep in sync.
 */

import { cpSync, mkdirSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const cliDir    = join(__dirname, '..');
const pkgsDir   = join(cliDir, '..');

/* ---------- derive BUNDLED from package.json ---------- */
const cliPkg  = JSON.parse(readFileSync(join(cliDir, 'package.json'), 'utf8'));
const SCOPE   = '@aspectcode/';
const BUNDLED = (cliPkg.bundledDependencies ?? [])
  .filter(d => d.startsWith(SCOPE))
  .map(d => d.slice(SCOPE.length));

if (BUNDLED.length === 0) {
  console.error('✗ No @aspectcode/* bundledDependencies found in package.json');
  process.exit(1);
}

const errors = [];

for (const name of BUNDLED) {
  const src  = join(pkgsDir, name);
  const dest = join(cliDir, 'node_modules', '@aspectcode', name);

  // Clean any stale copy
  if (existsSync(dest)) rmSync(dest, { recursive: true });
  mkdirSync(dest, { recursive: true });

  // package.json (required for Node resolution)
  cpSync(join(src, 'package.json'), join(dest, 'package.json'));

  // Compiled output
  if (existsSync(join(src, 'dist'))) {
    cpSync(join(src, 'dist'), join(dest, 'dist'), { recursive: true });
  }

  // .wasm grammars shipped by @aspectcode/core
  if (existsSync(join(src, 'parsers'))) {
    cpSync(join(src, 'parsers'), join(dest, 'parsers'), { recursive: true });
  }
}

/* ---------- validate materialised packages ---------- */
for (const name of BUNDLED) {
  const dest = join(cliDir, 'node_modules', '@aspectcode', name);
  if (!existsSync(join(dest, 'package.json'))) {
    errors.push(`${SCOPE}${name}: missing package.json in ${dest}`);
  }
  if (!existsSync(join(dest, 'dist'))) {
    errors.push(`${SCOPE}${name}: missing dist/ in ${dest} — was the package built?`);
  }
}

if (errors.length) {
  console.error('✗ Prepack validation failed:\n  ' + errors.join('\n  '));
  process.exit(1);
}

console.log(`✓ Workspace deps materialised for bundling (${BUNDLED.join(', ')})`);
