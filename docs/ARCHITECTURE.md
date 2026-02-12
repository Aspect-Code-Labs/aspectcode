# Architecture

> Extension-specific layering rules, file size limits, and conventions.
> For the full system architecture (all packages), see
> [SYSTEM-ARCHITECTURE.md](SYSTEM-ARCHITECTURE.md).

## Current State

Aspect Code is a multi-package TypeScript monorepo. Pure analysis and
generation logic lives in `packages/core` and `packages/emitters`. The
CLI (`packages/cli`) and VS Code extension (`extension/`) consume them.

The extension still contains legacy code (large files, inline UI) that
is being incrementally extracted. This document covers the **extension**
layering rules. Extension-specific code lives under `extension/src/`:

```
extension/src/
├── extension.ts            – VS Code activate/deactivate, wiring
├── commandHandlers.ts      – Command palette handlers
├── state.ts                – Shared mutable state (AspectCodeState)
├── tsParser.ts             – Tree-sitter grammar loading
├── importExtractors.ts     – Language-specific import extraction
├── newCommandsIntegration.ts
├── assistants/
│   ├── kb.ts               – Knowledge-base generation (architecture, map, context)
│   ├── instructions.ts     – AI-assistant instruction file generation
│   └── detection.ts        – Detect installed AI assistants
├── panel/
│   └── PanelProvider.ts    – Webview panel (graph, UI, message handling)
├── services/
│   ├── DependencyAnalyzer.ts
│   ├── FileDiscoveryService.ts
│   ├── WorkspaceFingerprint.ts
│   ├── aspectSettings.ts
│   ├── DirectoryExclusion.ts
│   ├── gitignoreService.ts
│   └── enablementCancellation.ts
├── test/
│   └── kb.test.ts
└── types/                  – (empty; reserved for shared type definitions)
```

### Known Issues

| Issue | Severity | Status |
|-------|----------|--------|
| `PanelProvider.ts` is 5,300+ LOC with inline HTML, CSS, JS | Critical | **Phase 4: remove entirely** |
| `kb.ts` is 4,000+ LOC mixing analysis and generation | Critical | Partially delegated to emitters |
| `state.ts` is a mutable singleton bag; hard to test | Medium | Open |
| Legacy instruction/detection code duplicated with emitters | Low | Emitters are now canonical |

## Current Architecture (multi-package)

```
┌─────────────────────────────────┐
│  extension/  (VS Code adapter:  │──▶ @aspectcode/core
│  commands, lifecycle, panel)     │──▶ @aspectcode/emitters
├─────────────────────────────────┤
│  packages/cli/                  │──▶ @aspectcode/core
│  (Node CLI entry point)         │──▶ @aspectcode/emitters
├─────────────────────────────────┤
│  packages/emitters/             │──▶ @aspectcode/core
│  (KB, instructions, manifest)   │
├─────────────────────────────────┤
│  packages/core/                 │   (zero external deps)
│  (analysis, discovery, stats)   │
└─────────────────────────────────┘
```

Packages that now exist and are functional:
- **`@aspectcode/core`** — `analyzeRepo()`, `discoverFiles()`, `DependencyAnalyzer`, tree-sitter grammars
- **`@aspectcode/emitters`** — `runEmitters()`, KB emitter, instructions emitter, manifest, transactions
- **`@aspectcode/cli`** — `aspectcode init`, `aspectcode generate`

### Phase 4 Target

The extension will shell out to `aspectcode generate --json` and render
the result. `PanelProvider.ts` (webview) will be removed entirely. The
extension becomes a thin wrapper: lifecycle, commands, status bar.

## Layering Rules (enforced in CI)

These rules are checked by `npm run check:boundaries`:

1. **`services/`** is the lowest layer in the current structure.
   - `services/` must NOT import from `panel/`, `assistants/`,
     `commandHandlers`, or `extension.ts`.
   - `services/` MAY import from other `services/` files.

2. **`assistants/`** may import from `services/` but NOT from `panel/`.

3. **`panel/`** may import from `services/` and `assistants/` (read-only
   data), but should not contain domain logic.

4. **`extension.ts`** and **`commandHandlers.ts`** are the wiring layer.
   They may import from anywhere.

5. **No file** may import from `dist/`.

6. **Test files** are exempt from boundary rules.

### Cross-package Rules (enforced structurally)

- `packages/core/` has no `vscode` dependency — cannot import it.
- `packages/emitters/` depends only on `core` — no `vscode`.
- `packages/cli/` depends on `core` + `emitters` — no `vscode`.
- `extension/` imports from `@aspectcode/core` and `@aspectcode/emitters`.

### Soft Rules (warn only, future ratchets)

These are logged as warnings by `npm run check:boundaries` but do not
fail CI yet:

- `panel/` should not import from `commandHandlers` or `extension.ts`
- `assistants/` should not import from `panel/`

## Naming Conventions

| Item | Convention | Example |
|------|-----------|---------|
| Files | PascalCase for classes, camelCase for modules | `DependencyAnalyzer.ts`, `importExtractors.ts` |
| Classes | PascalCase | `AspectCodeState` |
| Interfaces/Types | PascalCase, no `I` prefix | `DependencyLink` |
| Functions | camelCase | `generateKnowledgeBase()` |
| Constants | UPPER_SNAKE_CASE | `DEFAULT_MAX_LINES` |
| Test files | `*.test.ts` | `kb.test.ts` |

## File Size Limits

Enforced by `npm run check:filesize`:

- **New files:** 400 lines max.
- **Grandfathered files:** capped at their current size (rounded up).
  Every refactor PR should reduce the grandfathered cap.
- The goal is for every file to be under 400 lines by the end of
  the refactor.

## Where New Code Should Go

| You're adding… | Put it in… |
|----------------|-----------|
| Pure analysis logic (no vscode) | `packages/core/src/` |
| Artifact generation / content builders | `packages/emitters/src/` |
| A new CLI command | `packages/cli/src/commands/` |
| A new VS Code command handler | `extension/src/commandHandlers.ts` |
| A new service (file I/O, workspace scanning) | `extension/src/services/` |
| Shared TypeScript types | `packages/core/src/` or `extension/src/types/` |

## Testing

All tests run offline. No network access required.

| Package | Runner | Tests | Notes |
|---------|--------|-------|-------|
| `@aspectcode/core` | mocha + ts-node | 10 | Snapshot tests against fixture repo |
| `@aspectcode/emitters` | mocha + ts-node | 78 | KB, instructions, manifest, transaction |
| `@aspectcode/cli` | mocha + ts-node | 27 | parseArgs, config, init, generate e2e |
| Extension | VS Code test harness | 1+ | `kb.test.ts` |

Run all: `npm test --workspaces`

### Fixture repo

`extension/test/fixtures/mini-repo/` contains a small, deterministic
project (4 TS files + 1 Python file) used for snapshot testing. Do not
modify it casually — changes will require updating the expected snapshot.

### Snapshot tests

`packages/core/test/snapshot.test.ts` runs `analyzeRepo()` against the
fixture repo and compares the JSON output to a committed snapshot at
`packages/core/test/fixtures/mini-repo-expected.json`.

- **To run:** `cd packages/core && npm test`
- **To update the snapshot after intentional model changes:**
  delete the expected JSON and re-run, or pass `--update`.

## How to Add a Feature (checklist)

1. Open an issue describing the feature.
2. Create a branch from `main`.
3. Write the implementation. Keep each new file under 400 lines.
4. Add or update tests in `src/test/`.
5. Run `npm run check:all` locally — fix any failures.
6. Open a PR. CI will run lint, typecheck, format, size, and boundary checks.
7. Get a review and merge.
