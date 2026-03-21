# System Architecture

> Source-of-truth for layering, package responsibilities, and data flow.

---

## Overview

Aspect Code generates a project-local knowledge base and `AGENTS.md`
instruction file that helps AI coding assistants understand a codebase
before making changes. It produces KB content (opt-in via `--kb` flag),
an `AGENTS.md` instruction file, and optionally optimizes `AGENTS.md`
via LLM generation with probe-based evaluation.

**Everything runs offline** by default. There are no network calls, no telemetry,
no phone-home checks. WASM grammars ship in-repo; all analysis is local.
The only network usage is the opt-in LLM optimizer (requires API key).

---

## Package Map

```
aspectcode/                         ← npm workspaces root
├── packages/
│   ├── core/       @aspectcode/core        Static analysis engine
│   ├── emitters/   @aspectcode/emitters    Artifact generation
│   ├── evaluator/  @aspectcode/evaluator   Evidence-based evaluation
│   ├── optimizer/  @aspectcode/optimizer   LLM-based optimization
│   └── cli/        aspectcode              CLI entry point (npm package)
└── docs/                                   This file, guides
```

### Dependency Graph

```
  ┌─────────────┐
  │     cli      │──uses──▶ @aspectcode/core
  │  (Node.js)   │──uses──▶ @aspectcode/emitters
  │              │──uses──▶ @aspectcode/evaluator
  │              │──uses──▶ @aspectcode/optimizer
  └─────────────┘
        │
        ▼
  ┌─────────────┐     ┌────────────────┐     ┌────────────────┐     ┌────────────────┐
  │    core      │◀────│    emitters     │     │   evaluator    │────▶│   optimizer    │
  │              │     └────────────────┘     │                │     └────────────────┘
  │              │◀───────────────────────────│                │
  └─────────────┘                             └────────────────┘
```

**Rule:** `core` has zero knowledge of `emitters`, `evaluator`, `optimizer`,
or `cli`. `emitters` depends on `core` only. `evaluator` depends on `core`
+ `optimizer`. `cli` depends on all four.

---

## Package Details

### @aspectcode/core

Pure TypeScript analysis engine. Target: ES2020 / CommonJS.

| Export | Purpose |
|--------|---------|
| `analyzeRepo(root, files)` | Build an `AnalysisModel` from source files |
| `analyzeRepoWithDependencies(root, files, host)` | `analyzeRepo` + `DependencyAnalyzer` graph/hubs |
| `discoverFiles(root, opts?)` | Recursive walk → sorted absolute paths |
| `computeModelStats(model, topN)` | Summary stats from a model |
| `DependencyAnalyzer` | Full import/export/call graph builder |
| `createNodeHost(wasmDir)` | Node fs-backed `CoreHost` for tree-sitter grammars |
| `loadGrammars(host, log?)` | Initialize tree-sitter parsers from WASM |
| `toPosix(path)` | Normalize to forward slashes |

Key types: `AnalysisModel`, `AnalyzedFile`, `GraphEdge`, `HubMetric`,
`ModelStats`, `CoreHost`.

### @aspectcode/emitters

Artifact generation. Depends on `@aspectcode/core` for model types and
stats. Target: ES2020 / CommonJS.

| Export | Purpose |
|--------|---------|
| `runEmitters(model, host, opts)` | Orchestrate all emitters → `EmitReport` |
| `createNodeEmitterHost()` | Node fs-backed `EmitterHost` |
| `createKBEmitter()` | KB content builder (architecture/map/context) |
| `createInstructionsEmitter()` | AGENTS.md instruction file emitter |
| `GenerationTransaction` | Atomic writes — temp files → rename, manifest last |

Key types: `EmitterHost`, `EmitOptions`, `EmitReport`, `Emitter`,
`InstructionsMode`.

### @aspectcode/optimizer

LLM-based generation for AGENTS.md content.

| Export | Purpose |
|--------|---------|
| `runGenerateAgent(opts)` | Single-pass LLM generation from KB |
| `runComplaintAgent(opts)` | Apply user complaints to AGENTS.md |
| `resolveProvider(env, opts)` | Resolve OpenAI or Anthropic provider |

Key types: `LlmProvider`, `OptimizeOptions`, `OptimizeResult`.

### @aspectcode/evaluator

Evidence-based evaluation for generated content. Harvests real prompts
from local AI tool logs (Claude Code, Cline, Aider, Copilot),
runs probe-based micro-tests against generated content, and diagnoses
failures with targeted fixes.

| Export | Purpose |
|--------|---------|
| `evaluate(opts)` | Run full evaluation pipeline |
| `harvestPrompts(root)` | Collect prompts from local AI tool logs |
| `generateProbes(opts)` | Generate probe micro-tests from KB |
| `runProbes(content, probes, provider)` | Execute probes against content |
| `diagnose(failures, content, provider)` | Analyze failures and propose fixes |
| `applyDiagnosisEdits(content, diagnosis)` | Apply diagnostic fixes to content |

Key types: `Probe`, `ProbeResult`, `HarvestedPrompt`, `Diagnosis`.

### aspectcode (CLI)

Node.js command-line interface. Depends on all four packages.
No subcommands — single command with flags.

**Usage:** `aspectcode [options]`

The pipeline: discover files → analyze → build KB in memory →
optimize AGENTS.md (if API key available) → watch for changes.

| Flag | Short | Purpose |
|------|-------|---------|
| `--help` | `-h` | Show help |
| `--version` | `-V` | Print version |
| `--verbose` | `-v` | Show debug output |
| `--quiet` | `-q` | Suppress non-error output |
| `--root <path>` | `-r` | Workspace root (default: cwd) |
| `--kb` | | Also write kb.md to disk |
| `--dry-run` | | Print output without writing |
| `--once` | | Run once then exit (no watch) |
| `--no-color` | | Disable colored output |
| `--provider <name>` | `-p` | LLM provider: `openai` or `anthropic` |
| `--model <name>` | `-m` | LLM model override |
| `--temperature <n>` | | Sampling temperature (0–2) |
| `--compact` | | Compact dashboard (no banner) |

Config file: `aspectcode.json`.

---

## Data Flow

### CLI Pipeline (`aspectcode --once`)

```
aspectcode --once
  │
  ├─ 1. discoverFiles(root)              @aspectcode/core
  ├─ 2. read file contents               Node built-in
  ├─ 3. analyzeRepo(root, fileMap)        @aspectcode/core
  ├─ 4. build KB content in memory        @aspectcode/emitters
  ├─ 5. evaluator (when enabled)          @aspectcode/evaluator
  │    └─ harvest prompts → run probes → diagnose → apply fixes
  └─ 6. optimizer (when API key present)  @aspectcode/optimizer
       └─ single-pass LLM generation from KB
```

### CLI Pipeline (watch mode, default)

```
aspectcode
  │
  ├─ 1. run pipeline (same as --once)
  ├─ 2. start filesystem watchers
  └─ 3. re-run pipeline on file changes
       └─ keep process alive until SIGINT/SIGTERM
```

---

## File Outputs

| File | Source | Content |
|------|--------|---------|
| `AGENTS.md` | Instructions emitter | AI agent instructions |
| `kb.md` | KB emitter (--kb flag) | Architecture, map, context |

`AGENTS.md` supports two ownership modes: `full` (overwrite entire file)
and `section` (preserve user content outside markers).

---

## Transaction Safety

`runEmitters` uses `GenerationTransaction`:

1. Each write goes to a temp file (`.tmp-aspect-*`)
2. On commit: rename temp → final, manifest file written last
3. On error: roll back (delete temps, restore backups)

This prevents partial/corrupt output if a write fails mid-generation.

---

## Offline Guarantees

| Concern | How it's handled |
|---------|-----------------|
| Tree-sitter WASM | `.wasm` files committed in `packages/core/parsers/` |
| NPM packages | root `package-lock.json`; `npm ci --prefer-offline` works |
| Build tools | `tsc`, `mocha` — all local binaries |
| Telemetry | None. Zero network calls (except opt-in optimizer) |

---

## Testing

| Package | Runner | Notes |
|---------|--------|-------|
| `@aspectcode/core` | mocha + ts-node | Snapshot tests against fixture repo |
| `@aspectcode/emitters` | mocha + ts-node | KB, instructions, manifest, transaction |
| `@aspectcode/optimizer` | mocha + ts-node | Agent, prompt, provider |
| `@aspectcode/evaluator` | mocha + ts-node | Evaluator probes and diagnosis |
| `aspectcode` | mocha + ts-node | parseArgs, config; `check:bundled` CI script |

All tests are offline. Temp directories via `os.tmpdir()`, fixed
timestamps for determinism.

Run all package tests:

```bash
npm test --workspaces
```

---

## Conventions

| Item | Rule |
|------|------|
| File size | ≤ 400 lines (CI-enforced for new files) |
| File names | PascalCase for classes, camelCase for modules |
| Types | PascalCase, no `I` prefix |
| Test files | `*.test.ts`, mocha + `node:assert/strict` |
| JSON output | `stableStringify()` for determinism |
| Path handling | `toPosix()` everywhere; no raw backslashes in output |
