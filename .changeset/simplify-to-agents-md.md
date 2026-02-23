---
"@aspectcode/emitters": patch
"aspectcode": patch
---

Simplify instruction output to AGENTS.md only; trim CLI surface

Removed all multi-assistant generation infrastructure. The CLI and extension now
produce a single `AGENTS.md` instruction file unconditionally — there are no
assistant-selection flags, no quickpick UI, and no per-assistant content
generators.

Additionally, the CLI surface was trimmed:
- **Removed `init` command** — settings commands auto-create `aspectcode.json` when needed.
- **Removed `outDir` persistence** — `set-out-dir` / `clear-out-dir` commands deleted; `outDir` config key removed. Use `--out` flag at runtime instead.
- **Consolidated `impact` → `deps impact`** — impact analysis is now a subcommand of `deps` alongside `deps list`.

### What changed

**Removed CLI flags:** `--copilot`, `--cursor`, `--claude`, `--other`, `--force` / `-f`
**Removed CLI commands:** `init`, `impact` (standalone), `set-out-dir`, `clear-out-dir`
**Removed extension command:** `aspectcode.configureAssistants`
**Removed types:** `AssistantFlags`, `AssistantsSettings`, `AssistantsOverride`
**Removed config key:** `outDir`
**Removed functions:** `getAssistantsSettings()`, `handleConfigureAssistants()`,
`generateCopilotContent()`, `generateCursorContent()`, `generateClaudeContent()`,
`detectAssistants()`, `runInit()`, `runSetOutDir()`, `runClearOutDir()`,
`printAspectCodeBanner()`
**Removed output files:** `.github/copilot-instructions.md`,
`.cursor/rules/aspectcode.mdc`, `CLAUDE.md`
**Consolidated:** `runImpact()` → `runDepsImpact()` (now in `deps.ts`)

### CLI commands (current state)

```
aspectcode <command> [options]
```

#### Commands

| Command | Aliases | Description |
|---------|---------|-------------|
| `generate` | `gen`, `g` | Discover, analyze, and emit KB + AGENTS.md |
| `watch` | | Watch source files and regenerate on changes |
| `deps list` | | List dependency connections |
| `deps impact` | | Compute dependency impact for a single file |
| `show-config` | | Print current `aspectcode.json` values |
| `set-update-rate <mode>` | | Set updateRate (`manual` / `onChange` / `idle`) |
| `add-exclude <path>` | | Add a path to the exclude list |
| `remove-exclude <path>` | | Remove a path from the exclude list |

#### Global flags

| Flag | Short | Description |
|------|-------|-------------|
| `--help` | `-h` | Show help text |
| `--version` | `-V` | Print version |
| `--verbose` | `-v` | Show debug output |
| `--quiet` | `-q` | Suppress non-error output |
| `--root <path>` | `-r` | Workspace root (default: cwd) |
| `--json` | | Machine-readable JSON output |
| `--no-color` | | Disable ANSI color output |

#### `generate` flags

| Flag | Short | Description |
|------|-------|-------------|
| `--out <path>` | `-o` | Output directory override |
| `--kb` | | Generate `kb.md` knowledge base file |
| `--kb-only` | | Generate KB only, skip AGENTS.md |
| `--instructions-mode <mode>` | | `safe` (default) / `permissive` / `off` |
| `--list-connections` | | Print dependency connections |
| `--file <path>` | | Filter connections to one file |

#### `watch` flags

| Flag | Description |
|------|-------------|
| `--mode <mode>` | Watch mode: `manual` / `onChange` / `idle` |

#### `deps impact` flags

| Flag | Description |
|------|-------------|
| `--file <path>` | Target file (required) |
| `--json` | Machine-readable JSON output |

#### `deps list` flags

| Flag | Description |
|------|-------------|
| `--file <path>` | Filter connections to one file |
| `--list-connections` | Include connection details |

#### Output files

| File | When produced |
|------|---------------|
| `AGENTS.md` | Always (unless `--kb-only` or `--instructions-mode off`) |
| `kb.md` | When `--kb`, `--kb-only`, or `generateKb: true` in config |

#### Examples

```sh
aspectcode init
aspectcode generate
aspectcode generate --kb
aspectcode g --json
aspectcode generate --kb-only
aspectcode generate --instructions-mode permissive
aspectcode generate --list-connections --file src/app.ts
aspectcode impact --file src/app.ts
aspectcode deps list --file src/app.ts
aspectcode watch --mode idle
aspectcode show-config --json
aspectcode set-update-rate onChange
aspectcode set-out-dir ./output
aspectcode clear-out-dir
aspectcode add-exclude vendor
aspectcode remove-exclude vendor
```
