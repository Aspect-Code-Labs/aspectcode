# Architecture

_Read this first. Describes the project layout and "Do Not Break" zones._

**Files:** 27 | **Dependencies:** 40 | **Cycles:** 1

## ⚠️ High-Risk Architectural Hubs

> **These files are architectural load-bearing walls.**
> Modify with extreme caution. Do not change signatures without checking `map.md`.

| Rank | File | Imports | Imported By | Risk |
|------|------|---------|-------------|------|
| 1 | `extension/src/assistants/kb.ts` | 10 | 3 | 🟢 Low |
| 2 | `extension/src/commandHandlers.ts` | 9 | 1 | 🟢 Low |
| 3 | `extension/src/services/aspectSettings.ts` | 1 | 7 | 🟡 Medium |
| 4 | `extension/src/extension.ts` | 7 | 0 | 🟢 Low |
| 5 | `extension/src/assistants/instructions.ts` | 4 | 1 | 🟢 Low |
| 6 | `extension/src/services/FileDiscoveryService.ts` | 1 | 4 | 🟢 Low |
| 7 | `extension/src/services/DirectoryExclusion.ts` | 1 | 3 | 🟢 Low |
| 8 | `extension/src/services/gitignoreService.ts` | 1 | 3 | 🟢 Low |
| 9 | `extension/src/services/WorkspaceFingerprint.ts` | 3 | 1 | 🟢 Low |
| 10 | `extension/src/state.ts` | 0 | 4 | 🟢 Low |

### Hub Details & Blast Radius

_Blast radius = direct dependents + their dependents (2 levels)._

**1. `extension/src/assistants/kb.ts`** — Blast radius: 5 files
   - Direct dependents: 3
   - Indirect dependents: ~2

   Imported by (3 files):
   - `extension/src/assistants/instructions.ts`
   - `extension/src/commandHandlers.ts`
   - `extension/src/extension.ts`

**2. `extension/src/commandHandlers.ts`** — Blast radius: 1 files
   - Direct dependents: 1
   - Indirect dependents: ~0

   Imported by (1 files):
   - `extension/src/extension.ts`

**3. `extension/src/services/aspectSettings.ts`** — Blast radius: 12 files
   - Direct dependents: 7
   - Indirect dependents: ~5

   Imported by (7 files):
   - `extension/src/assistants/instructions.ts`
   - `extension/src/assistants/kb.ts`
   - `extension/src/commandHandlers.ts`
   - `extension/src/extension.ts`
   - `extension/src/services/FileDiscoveryService.ts`
   - _...and 2 more_

## Entry Points

_Where code execution begins. Categorized by type with detection confidence._

### Runnable Scripts / Tooling

_CLI tools, build scripts, standalone utilities._

- 🟢 `extension/eslint.config.mjs`: Config/Build tool

## Directory Layout

| Directory | Files | Purpose |
|-----------|-------|--------|
| `extension/src/services/` | 9 | Services |
| `extension/src/` | 5 | Source code |
| `extension/src/assistants/` | 4 | General |
| `extension/scripts/` | 2 | General |

## ⚠️ Circular Dependencies

_Bidirectional imports that create tight coupling._

- `extension/src/services/DirectoryExclusion.ts` ↔ `extension/src/services/FileDiscoveryService.ts`

## Tests

**Test files:** 1 | **Dirs:** extension/src/test


_Generated: 2026-02-16T20:18:01.220Z_
