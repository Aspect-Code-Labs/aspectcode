# Offline Editing Guide

> How to work on Aspect Code with no internet connection, including
> using a local LLM (e.g. Qwen 2.5 Coder) as your AI assistant.

---

## Prerequisites (do once while online)

```bash
# 1. Clone the repo
git clone <repo-url> && cd aspectcode

# 2. Install all workspace dependencies (populates npm cache)
npm install

# 3. Build every package so dist/ declarations exist
npm run build --workspaces

# 4. Verify everything passes
npm test --workspaces
cd extension && npm run check:all && cd ..
```

After this, your local npm cache (`~/.npm` on Unix, `%APPDATA%\npm-cache`
on Windows) has every dependency. Future installs work offline:

```bash
npm ci --prefer-offline
```

---

## What Works Offline

| Task | Command | Notes |
|------|---------|-------|
| Build all packages | `npm run build --workspaces` | `tsc` only, no downloads |
| Build extension | `cd extension && npm run build` | `esbuild`, local |
| Type-check any package | `npm run typecheck --workspace=packages/core` | `tsc --noEmit` |
| Run all tests | `npm test --workspaces` | mocha, all local |
| Run CLI | `node packages/cli/bin/aspectcode.js generate` | No network |
| Lint | `cd extension && npm run lint` | ESLint, local |
| Format | `cd extension && npm run format` | Prettier, local |
| Package VSIX | `cd extension && npx @vscode/vsce package` | Local (use `--pre-release`) |
| Launch extension | F5 in VS Code | Extension Dev Host, local |

**Nothing in the build/test/run pipeline touches the network.**

---

## Working with a Local LLM

### Setup

1. Install your local model server (Ollama, LM Studio, llama.cpp, etc.)
2. Load a coding model — recommended: **Qwen 2.5 Coder 32B** or similar
3. Point your editor's AI extension at the local endpoint:
   - **Continue** (VS Code): set `"apiBase"` in `~/.continue/config.json`
   - **Ollama**: runs on `http://localhost:11434` by default
   - **LM Studio**: runs on `http://localhost:1234/v1` by default

### What the Model Needs to Know

Feed the model these files for context (in priority order):

| File | Why |
|------|-----|
| `docs/SYSTEM-ARCHITECTURE.md` | Full system architecture, package map, data flow |
| `docs/ARCHITECTURE.md` | Layering rules, file size limits, conventions |
| `CONTRIBUTING.md` | Dev workflow, PR process |
| `packages/cli/src/main.ts` | CLI entry point and argv parser |
| `packages/core/src/index.ts` | Core public API surface |
| `packages/emitters/src/index.ts` | Emitters public API + `runEmitters()` |

### Typical Editing Session

```bash
# 1. Build once to ensure dist/ is fresh
npm run build --workspaces

# 2. Make your changes (tests, cleanup, refactoring)
#    ... edit files with your local LLM ...

# 3. Type-check the package you changed
cd packages/core && npx tsc --noEmit

# 4. Run its tests
npm test

# 5. If you changed core or emitters, rebuild and re-test downstream
cd ../.. && npm run build --workspaces && npm test --workspaces

# 6. If you changed extension code
cd extension && npm run typecheck && npm run build
```

---

## Package Build Order

Packages must be built in dependency order because TypeScript project
references read `dist/*.d.ts` files:

```
1. @aspectcode/core        (no deps)
2. @aspectcode/emitters    (depends on core)
3. @aspectcode/cli         (depends on core + emitters)
4. extension               (depends on core + emitters)
```

`npm run build --workspaces` handles this automatically (npm runs
workspaces in declaration order from `package.json`).

If you get "cannot find module" errors after changing a package's
public API, rebuild that package first so its `dist/` declarations
are regenerated.

---

## Running Tests

### All at once

```bash
npm test --workspaces
```

### Per package

```bash
cd packages/core     && npm test    # 10 tests
cd packages/emitters && npm test    # 78 tests
cd packages/cli      && npm test    # 27 tests
```

### Extension tests

```bash
cd extension && npm run test:e2e
```

Or press F5 in VS Code to launch the Extension Development Host, then
run tests from the command palette.

---

## Common Tasks

### Add a new CLI command

1. Create `packages/cli/src/commands/yourcommand.ts`
2. Export an `async function runYourCommand(...)` following the pattern
   in `init.ts` or `generate.ts`
3. Add a `case` in `packages/cli/src/main.ts` switch block
4. Add tests in `packages/cli/test/yourcommand.test.ts`
5. Rebuild: `cd packages/cli && npm run build`

### Move logic from extension to core/emitters

1. Extract the pure function (no `vscode` imports)
2. Add it to the appropriate package under `src/`
3. Export it from `src/index.ts`
4. Rebuild: `npm run build --workspace=packages/core`
5. Update the extension to import from `@aspectcode/core`
6. Run both sets of tests

### Remove the panel webview (Phase 4)

1. Delete `extension/src/panel/PanelProvider.ts`
2. Remove `PanelProvider` registration from `extension.ts`
3. Remove the `viewsContainers` / `views` contributions from
   `extension/package.json`
4. Add `--json` flag to CLI: `aspectcode generate --json` → stdout
5. Extension spawns CLI, parses JSON result, shows summary

---

## Troubleshooting

### "Cannot find module '@aspectcode/core'"

```bash
# Rebuild from root
npm run build --workspaces
```

### Tests fail with stale snapshot

```bash
cd packages/core
rm test/fixtures/mini-repo-expected.json
npm test   # regenerates snapshot
```

### "npm warn workspaces" on install

Safe to ignore. Sub-package `package-lock.json` files are vestigial;
only the root lock file matters for workspace installs.

### VSIX missing parsers

Check `.vscodeignore` in `extension/` — `parsers/` must NOT be excluded.
Verify after packaging:

```bash
cd extension
npx @vscode/vsce package --pre-release
npx @vscode/vsce ls   # should list parsers/*.wasm
```

---

## Git Workflow (Offline)

You can commit and branch locally without network access. Push when
you're back online:

```bash
git checkout -b my-feature
# ... make changes ...
git add -A && git commit -m "description"

# Later, when online:
git push origin my-feature
```
