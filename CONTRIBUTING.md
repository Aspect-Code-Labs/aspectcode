# Contributing

Thanks for your interest in contributing to Aspect Code!

## Quick Start

```bash
# From repo root — installs all workspace packages
npm install

# Build all packages (core → emitters → cli → extension)
npm run build --workspaces
cd extension && npm run build && cd ..

# Run all tests
npm test --workspaces
```

Open the repo root in VS Code, press **F5** to launch the Extension
Development Host.

For offline development, see [docs/OFFLINE-EDITING.md](docs/OFFLINE-EDITING.md).

## Repository Structure

```
packages/core/        @aspectcode/core      Pure analysis (no vscode)
packages/emitters/    @aspectcode/emitters   Artifact generation
packages/cli/         @aspectcode/cli        CLI entry point
extension/                                   VS Code extension
docs/                                        Architecture & guides
```

Full architecture: [docs/SYSTEM-ARCHITECTURE.md](docs/SYSTEM-ARCHITECTURE.md)

## Development Scripts

### Root (all packages)

| Command | What it does |
|---------|-------------|
| `npm install` | Install all workspace dependencies |
| `npm run build --workspaces` | Build core → emitters → cli |
| `npm test --workspaces` | Run all package tests |

### Extension (`cd extension`)

| Command | What it does |
|---------|-------------|
| `npm run build` | Build the extension with esbuild |
| `npm run watch` | Rebuild on file changes |
| `npm run typecheck` | Run `tsc --noEmit` |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Run ESLint with auto-fix |
| `npm run format` | Format all source files with Prettier |
| `npm run format:check` | Check formatting (CI uses this) |
| `npm run check:filesize` | Check file size limits |
| `npm run check:boundaries` | Check dependency boundary rules |
| `npm run check:all` | Run all checks (lint + format + filesize + boundaries) |

### Any package (`cd packages/core`, etc.)

| Command | What it does |
|---------|-------------|
| `npm run build` | Build with tsc |
| `npm run typecheck` | Type-check only |
| `npm test` | Run mocha tests |

## What to Work On

- Bug fixes and reliability improvements
- Testing — adding tests for existing code
- Reducing the size of grandfathered large files (see `docs/ARCHITECTURE.md`)
- Moving logic from extension into `packages/core` or `packages/emitters`
- CLI enhancements

If you're unsure, open an issue describing what you want to change.

## Architecture Rules

Read **[docs/SYSTEM-ARCHITECTURE.md](docs/SYSTEM-ARCHITECTURE.md)** and
**[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** before making changes.
Key rules:

1. **Package boundaries:** `core` has no `vscode` import. `emitters` depends
   only on `core`. `cli` depends on both. Extension depends on both.
2. **File size limit:** New files must be ≤ 400 lines. Grandfathered files
   must not grow beyond their current cap.
3. **Layering (extension):** `services/` must not import from `panel/`,
   `assistants/`, `commandHandlers`, or `extension.ts`.
4. **Formatting:** All code is formatted with Prettier. Run `npm run format`
   before committing.
5. **Linting:** All code must pass ESLint. Run `npm run lint` before
   committing.
6. **Types:** Shared types go in `src/types/` or the appropriate package.
   Prefer explicit types over `any`.

## Pull Requests

- Keep PRs small and focused (one feature/fix per PR).
- Prefer simple implementations over heavy abstractions.
- Add/update tests when there's a clear place to do so.
- Avoid reformatting unrelated code (Prettier handles formatting; don't
  mix style changes with logic changes).
- Run `npm run check:all` before pushing.
- CI must pass before merge.

## Development Notes

- The extension should not write any workspace files until the user
  explicitly triggers setup (e.g., via the **+** button).
- When changing packaging/bundling, verify the VSIX contains required
  runtime files (notably the Tree-sitter WASM grammars in `parsers/`).
- The `types/` directory is reserved for shared type definitions. Use it
  for interfaces and types that cross module boundaries.

## License

By contributing, you agree that your contributions will be licensed under
this repository's license (see LICENSE.md).
