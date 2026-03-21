# Contributing

Thanks for your interest in contributing to Aspect Code!

## Quick Start

```bash
# From repo root — installs all workspace packages
npm install

# Build all packages (core → emitters → optimizer → evaluator → cli)
npm run build --workspaces

# Run all tests
npm test --workspaces
```

## Repository Structure

```
packages/core/        @aspectcode/core        Static analysis engine
packages/emitters/    @aspectcode/emitters    Artifact generation
packages/evaluator/   @aspectcode/evaluator   Evidence-based evaluation
packages/optimizer/   @aspectcode/optimizer   LLM-based optimization
packages/cli/         aspectcode              CLI entry point
docs/                                         Architecture & guides
```

Full architecture: [docs/SYSTEM-ARCHITECTURE.md](docs/SYSTEM-ARCHITECTURE.md)

## Development Scripts

### Root (all packages)

| Command | What it does |
|---------|-------------|
| `npm install` | Install all workspace dependencies |
| `npm run build --workspaces` | Build core → emitters → optimizer → evaluator → cli |
| `npm test --workspaces` | Run all package tests |

### Any package (`cd packages/core`, etc.)

| Command | What it does |
|---------|-------------|
| `npm run build` | Build with tsc |
| `npm run typecheck` | Type-check only |
| `npm test` | Run mocha tests |

## CLI Testing (Safe Sandbox)

When manually exercising the CLI during development, **always use the
sandbox test runner** to avoid writing `AGENTS.md` into the repo root:

```bash
# Full run: build all packages, then test CLI in temp sandbox
npm run test:cli

# Fast run: skip build (assumes packages are already compiled)
npm run test:cli:fast
```

You can also run the script directly for extra options:

```powershell
# Keep sandbox for manual inspection after the run
.\scripts\test-cli-sandbox.ps1 -SkipBuild -SkipCleanup
```

The sandbox script copies a fixture repo into a
temp directory and runs CLI commands (`--once`, `--once --kb`,
`--once --dry-run`, `--no-color`, etc.) with explicit `--root` flags
pointing there. It verifies the repo root stays clean.

**For agents / AI coding assistants:** When testing the CLI, always
pass `--root <path>` pointing to a temp copy of the fixture repo.
Never run `aspectcode` from the repo root without explicit flags.

### Multi-Repo Testing

For comprehensive cross-language validation, the multi-repo test runner
clones real open-source repos and runs CLI commands against each one:

```bash
# Full run: build + clone repos + test
npm run test:cli:repos

# Fast run: skip build
npm run test:cli:repos:fast
```

The list of repos is defined in `scripts/test-repos.json`. You can
filter to a single repo:

```powershell
.\scripts\test-cli-repos.ps1 -SkipBuild -RepoFilter flask
```

The test matrix per repo covers:
- `--once` (basic analysis + AGENTS.md)
- `--once --kb` (also write KB)
- `--once --dry-run` (preview mode)
- `--no-color` and `--verbose` flags
- Repo-root pollution checks

All cloned repos are deleted after testing. Use `-SkipCleanup` to keep
them for inspection.

## CI Test Tiers

Aspect Code uses three CI tiers:

- **Main CI (`.github/workflows/ci.yml`)** — runs on every push to `main` and every PR
  - Builds and tests all packages (core, emitters, evaluator, optimizer, cli)
  - Bundled-dependency check for CLI (`check:bundled`)
- **PR CI (`.github/workflows/ci-pr.yml`)**
  - Windows: sandbox CLI smoke tests (`test:cli:fast`)
- **Nightly CI (`.github/workflows/nightly-cli-repos.yml`)**
  - Windows: multi-repo matrix (`test:cli:repos:fast`)

To reproduce PR CI locally:

```bash
npm run test:ci:pr
```

To reproduce nightly multi-repo CI locally:

```bash
npm run test:ci:repos
```

## Releasing

### npm packages (`@aspectcode/core`, `@aspectcode/emitters`, `@aspectcode/evaluator`, `@aspectcode/optimizer`, `aspectcode`)

Versioning and publishing is automated via [changesets](https://github.com/changesets/changesets):

1. On your feature branch, run `npm run changeset`. Select the affected
   packages, choose a bump type (patch / minor / major), and write a
   short summary. This creates a `.changeset/*.md` file — commit it with
   your PR.
2. When the PR merges to `main`, the Release workflow detects pending
   changesets and opens a **"chore: version packages"** PR that bumps
   versions, updates `CHANGELOG.md` files, and syncs internal dependency
   versions.
3. A maintainer reviews and merges that PR.
4. The Release workflow runs again, sees new versions with no pending
   changesets, and publishes to npm. GitHub Releases are created
   automatically.

To check the current changeset status: `npm run changeset:status`

### Parser WASM files

Tree-sitter WASM files are shipped in `packages/core/parsers/` inside
the npm package.

## What to Work On

- Bug fixes and reliability improvements
- Testing — adding tests for existing code
- CLI enhancements
- Optimizer improvements (new providers, better prompts)
- Additional language support

If you're unsure, open an issue describing what you want to change.

## Architecture Rules

Read **[docs/SYSTEM-ARCHITECTURE.md](docs/SYSTEM-ARCHITECTURE.md)** and
**[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** before making changes.
Key rules:

1. **Package boundaries:** `core` has no external runtime deps beyond tree-sitter.
   `emitters` depends only on `core`. `optimizer` has LLM SDKs.
   `evaluator` depends on `core` + `optimizer`. `cli` depends on all four.
2. **File size limit:** New files must be ≤ 400 lines.
3. **Formatting:** All code is formatted with Prettier. Run `npm run format`
   before committing.
4. **Linting:** All code must pass ESLint. Run `npm run lint` before
   committing.
5. **Types:** Shared types go in the appropriate package (`packages/core/src/`
   or `packages/emitters/src/`). Prefer explicit types over `any`.

## Pull Requests

- Keep PRs small and focused (one feature/fix per PR).
- Prefer simple implementations over heavy abstractions.
- Add/update tests when there's a clear place to do so.
- Avoid reformatting unrelated code (Prettier handles formatting; don't
  mix style changes with logic changes).
- CI must pass before merge.

## License

By contributing, you agree that your contributions will be licensed under
this repository's license (see LICENSE.md).
