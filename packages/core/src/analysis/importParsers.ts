/**
 * Regex-based import parsing for dependency analysis.
 *
 * These parsers operate on single lines of source code and produce
 * ImportStatement records. They are intentionally regex-based (not
 * tree-sitter) because DependencyAnalyzer processes every file with
 * minimal overhead — tree-sitter extraction is used separately for
 * richer symbol data.
 *
 * Supports: Python, JavaScript/TypeScript, Java, C#, Go.
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

// ── File-level analysis ──────────────────────────────────────

/**
 * Analyze imports in a single file by dispatching to the correct
 * per-language parser based on file extension.
 */
export function analyzeFileImports(
  filePath: string,
  content: string,
): ImportStatement[] {
  const extension = path.extname(filePath).toLowerCase();
  const lines = content.split('\n');
  const imports: ImportStatement[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const lineNum = i + 1;

    if (extension === '.py') {
      imports.push(...parsePythonImports(line, lineNum));
    } else if (['.ts', '.tsx', '.js', '.jsx', '.mjs'].includes(extension)) {
      imports.push(...parseJavaScriptImports(line, lineNum));
    } else if (extension === '.java') {
      imports.push(...parseJavaImports(line, lineNum));
    } else if (extension === '.cs') {
      imports.push(...parseCSharpImports(line, lineNum));
    } else if (extension === '.go') {
      imports.push(...parseGoImports(line, lineNum));
    }
  }

  return imports;
}

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
export function isLikelyExternalCall(
  callExpr: string,
  _fileExtension: string,
): boolean {
  if (callExpr.startsWith('this.') || callExpr.startsWith('self.')) {
    return false;
  }
  return /^\w+\.\w+/.test(callExpr);
}

// ── Python ───────────────────────────────────────────────────

export function parsePythonImports(
  line: string,
  lineNum: number,
): ImportStatement[] {
  const imports: ImportStatement[] = [];

  const cleanSymbol = (raw: string): string => {
    let s = raw.trim();
    const hashIndex = s.indexOf('#');
    if (hashIndex >= 0) s = s.slice(0, hashIndex).trim();
    s = s.split(' as ')[0].trim();
    s = s
      .replace(/^[({\[]+/, '')
      .replace(/[)}\]]+$/, '')
      .trim();
    s = s.replace(/,+$/, '').trim();
    return s;
  };

  const cleanSymbolsList = (symbolsStr: string): string[] => {
    return symbolsStr
      .split(',')
      .map(cleanSymbol)
      .filter((s) => s.length > 0)
      .filter(
        (s) => s !== '(' && s !== ')' && s !== '[' && s !== ']' && s !== '{' && s !== '}',
      );
  };

  const fromImportMatch = line.match(/from\s+(\.{0,3}[\w.]*?)\s+import\s+(.+)/);
  if (fromImportMatch) {
    const module = fromImportMatch[1];
    if (!module || module === '') return imports;

    const symbolsStr = fromImportMatch[2];
    const symbols = cleanSymbolsList(symbolsStr);

    if (module.includes('.')) {
      const parts = module.split('.');
      imports.push({ module, symbols, isDefault: false, line: lineNum, raw: line });
      const lastPart = parts[parts.length - 1];
      if (lastPart !== module) {
        imports.push({
          module: lastPart,
          symbols,
          isDefault: false,
          line: lineNum,
          raw: line,
        });
      }
    } else {
      imports.push({ module, symbols, isDefault: false, line: lineNum, raw: line });
    }
    return imports;
  }

  if (!line.startsWith('from ')) {
    const importMatch = line.match(/^import\s+(.+)$/);
    if (importMatch) {
      const modules = cleanSymbolsList(importMatch[1]);
      for (const module of modules) {
        if (module.includes('.')) {
          const parts = module.split('.');
          const lastPart = parts[parts.length - 1];
          imports.push({
            module,
            symbols: [module],
            isDefault: true,
            line: lineNum,
            raw: line,
          });
          if (lastPart !== module) {
            imports.push({
              module: lastPart,
              symbols: [lastPart],
              isDefault: true,
              line: lineNum,
              raw: line,
            });
          }
        } else {
          imports.push({
            module,
            symbols: [module],
            isDefault: true,
            line: lineNum,
            raw: line,
          });
        }
      }
    }
  }

  return imports;
}

// ── JavaScript / TypeScript ──────────────────────────────────

export function parseJavaScriptImports(
  line: string,
  lineNum: number,
): ImportStatement[] {
  const imports: ImportStatement[] = [];

  const cleanSymbols = (symbolsStr: string): string[] => {
    return symbolsStr
      .split(',')
      .map((s) => s.trim())
      .map((s) => s.replace(/^type\s+/, ''))
      .map((s) => s.split(/\s+as\s+/)[0].trim())
      .filter((s) => s.length > 0 && s !== 'type');
  };

  // Side-effect import
  const sideEffectMatch = line.match(/^\s*import\s+['"]([^'"]+)['"]\s*;?\s*$/);
  if (sideEffectMatch) {
    imports.push({
      module: sideEffectMatch[1],
      symbols: ['*'],
      isDefault: false,
      line: lineNum,
      raw: line,
    });
    return imports;
  }

  // Re-exports: export { x } from 'module'
  const reExportNamedMatch = line.match(
    /^\s*export\s*\{\s*([^}]+)\s*\}\s*from\s*['"]([^'"]+)['"]/,
  );
  if (reExportNamedMatch) {
    imports.push({
      module: reExportNamedMatch[2],
      symbols: cleanSymbols(reExportNamedMatch[1]),
      isDefault: false,
      line: lineNum,
      raw: line,
    });
    return imports;
  }

  // Re-export all: export * from 'module'
  const reExportAllMatch = line.match(
    /^\s*export\s*\*\s*(?:as\s+\w+\s*)?from\s*['"]([^'"]+)['"]/,
  );
  if (reExportAllMatch) {
    imports.push({
      module: reExportAllMatch[1],
      symbols: ['*'],
      isDefault: false,
      line: lineNum,
      raw: line,
    });
    return imports;
  }

  // Combined: import Default, { named } from 'module'
  const combinedMatch = line.match(
    /^\s*import\s+(?:type\s+)?(\w+)\s*,\s*(?:\{\s*([^}]+)\s*\}|\*\s*as\s+(\w+))\s*from\s*['"]([^'"]+)['"]/,
  );
  if (combinedMatch) {
    const defaultSymbol = combinedMatch[1];
    const namedSymbols = combinedMatch[2] ? cleanSymbols(combinedMatch[2]) : [];
    const namespaceSymbol = combinedMatch[3];
    const module = combinedMatch[4];
    const allSymbols = [defaultSymbol, ...namedSymbols];
    if (namespaceSymbol) allSymbols.push(namespaceSymbol);
    imports.push({
      module,
      symbols: allSymbols,
      isDefault: true,
      line: lineNum,
      raw: line,
    });
    return imports;
  }

  // Namespace: import * as name from 'module'
  const namespaceMatch = line.match(
    /^\s*import\s+(?:type\s+)?\*\s*as\s+(\w+)\s*from\s*['"]([^'"]+)['"]/,
  );
  if (namespaceMatch) {
    imports.push({
      module: namespaceMatch[2],
      symbols: [namespaceMatch[1]],
      isDefault: true,
      line: lineNum,
      raw: line,
    });
    return imports;
  }

  // Named: import { a, b } from 'module'
  const namedImportMatch = line.match(
    /^\s*import\s+(?:type\s+)?\{\s*([^}]+)\s*\}\s*from\s*['"]([^'"]+)['"]/,
  );
  if (namedImportMatch) {
    imports.push({
      module: namedImportMatch[2],
      symbols: cleanSymbols(namedImportMatch[1]),
      isDefault: false,
      line: lineNum,
      raw: line,
    });
    return imports;
  }

  // Default: import name from 'module'
  const defaultImportMatch = line.match(
    /^\s*import\s+(?:type\s+)?(\w+)\s+from\s*['"]([^'"]+)['"]/,
  );
  if (defaultImportMatch) {
    imports.push({
      module: defaultImportMatch[2],
      symbols: [defaultImportMatch[1]],
      isDefault: true,
      line: lineNum,
      raw: line,
    });
    return imports;
  }

  // require()
  const requireMatch = line.match(
    /(?:const|let|var)\s+(?:\{\s*([^}]+)\s*\}|(\w+))\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/,
  );
  if (requireMatch) {
    const symbols = requireMatch[1]
      ? cleanSymbols(requireMatch[1])
      : [requireMatch[2]];
    imports.push({
      module: requireMatch[3],
      symbols,
      isDefault: !requireMatch[1],
      line: lineNum,
      raw: line,
    });
    return imports;
  }

  // Dynamic import
  const dynamicImportMatch = line.match(/import\s*\(\s*['"]([^'"]+)['"]\s*\)/);
  if (dynamicImportMatch) {
    imports.push({
      module: dynamicImportMatch[1],
      symbols: ['*'],
      isDefault: false,
      line: lineNum,
      raw: line,
    });
  }

  return imports;
}

// ── Java ─────────────────────────────────────────────────────

export function parseJavaImports(
  line: string,
  lineNum: number,
): ImportStatement[] {
  const imports: ImportStatement[] = [];

  const importMatch = line.match(/import\s+(?:static\s+)?([\w.]+)(?:\.\*)?;/);
  if (importMatch) {
    const module = importMatch[1];
    const isWildcard = line.includes('.*');
    imports.push({
      module,
      symbols: isWildcard ? ['*'] : [module.split('.').pop() || module],
      isDefault: !isWildcard,
      line: lineNum,
      raw: line,
    });
  }

  return imports;
}

// ── C# ───────────────────────────────────────────────────────

export function parseCSharpImports(
  line: string,
  lineNum: number,
): ImportStatement[] {
  const imports: ImportStatement[] = [];

  // using Alias = Namespace.Type;
  const aliasMatch = line.match(/^\s*using\s+(\w+)\s*=\s*([\w.]+)\s*;/);
  if (aliasMatch) {
    imports.push({
      module: aliasMatch[2],
      symbols: [aliasMatch[1]],
      isDefault: true,
      line: lineNum,
      raw: line,
    });
    return imports;
  }

  // using static Namespace.Type;
  const staticMatch = line.match(/^\s*using\s+static\s+([\w.]+)\s*;/);
  if (staticMatch) {
    imports.push({
      module: staticMatch[1],
      symbols: ['*'],
      isDefault: false,
      line: lineNum,
      raw: line,
    });
    return imports;
  }

  // using Namespace;
  const usingMatch = line.match(/^\s*using\s+([\w.]+)\s*;/);
  if (usingMatch) {
    imports.push({
      module: usingMatch[1],
      symbols: [usingMatch[1].split('.').pop() || usingMatch[1]],
      isDefault: true,
      line: lineNum,
      raw: line,
    });
  }

  return imports;
}

// ── Go ───────────────────────────────────────────────────────

export function parseGoImports(
  line: string,
  lineNum: number,
): ImportStatement[] {
  const imports: ImportStatement[] = [];

  // Single import: import "pkg" or import alias "pkg"
  const singleImportMatch = line.match(/^\s*import\s+(?:([\w._]+)\s+)?"([^"]+)"/);
  if (singleImportMatch) {
    const alias = singleImportMatch[1] || '';
    const module = singleImportMatch[2];
    const pkgName = module.split('/').pop() || module;
    imports.push({
      module,
      symbols: alias === '.' ? ['*'] : alias === '_' ? [] : [alias || pkgName],
      isDefault: alias !== '.' && alias !== '_',
      line: lineNum,
      raw: line,
    });
    return imports;
  }

  // Line inside import block
  const blockLineMatch = line.match(/^\s*(?:([\w._]+)\s+)?"([^"]+)"\s*$/);
  if (blockLineMatch) {
    const alias = blockLineMatch[1] || '';
    const module = blockLineMatch[2];
    const pkgName = module.split('/').pop() || module;
    imports.push({
      module,
      symbols: alias === '.' ? ['*'] : alias === '_' ? [] : [alias || pkgName],
      isDefault: alias !== '.' && alias !== '_',
      line: lineNum,
      raw: line,
    });
  }

  return imports;
}
