/**
 * postpack.mjs — remove the materialised workspace deps created by prepack.
 */

import { rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const target    = join(__dirname, '..', 'node_modules', '@aspectcode');

if (existsSync(target)) {
  rmSync(target, { recursive: true });
  console.log('✓ Cleaned up materialised workspace deps');
}
