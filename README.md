<div align="center">

# Aspect Code

**Give your AI coding assistant a map before it writes a single line.**

[![npm](https://img.shields.io/npm/v/aspectcode)](https://www.npmjs.com/package/aspectcode)
[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/aspectcode.aspectcode)](https://marketplace.visualstudio.com/items?itemName=aspectcode.aspectcode)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE.md)

Aspect Code is a static-analysis tool that generates a **knowledge base** and
**instruction file** (`AGENTS.md`) so AI coding assistants understand your
codebase *before* they make changes — fewer hallucinations, better diffs.

[Install](#install) · [How It Works](#how-it-works) · [CLI Usage](#cli-usage) · [Contributing](#contributing)

</div>

---

## Why

AI assistants work best when they know the architecture, naming conventions,
and high-risk areas of a project. Aspect Code extracts that context
automatically and keeps it up to date — no manual prompt engineering required.

**Everything runs offline.** Zero telemetry, zero network calls. The only
optional network usage is the opt-in LLM optimizer (requires API key).

## Install

### CLI (recommended)

```bash
npm install -g aspectcode
```

### VS Code Extension

Install from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=aspectcode.aspectcode), or download the `.vsix` from a [GitHub Release](https://github.com/asashepard/aspectcode/releases) and install via *Extensions → Install from VSIX…*

Both produce identical output.

## How It Works

```
your-project/
├── .aspect/
│   ├── architecture.md   ← high-risk hubs, directory layout, entry points
│   ├── map.md            ← data models, symbol index, naming conventions
│   ├── context.md        ← module clusters, integrations, data flow
│   └── manifest.json     ← schema version, stats
└── AGENTS.md             ← instruction file for AI coding assistants
```

1. **Discover & parse** — tree-sitter grammars extract imports, exports, classes, and calls.
2. **Analyze** — build a dependency graph, detect architectural hubs, cluster co-edited modules.
3. **Emit** — write the knowledge base (`.aspect/`) and `AGENTS.md`.
4. **Evaluate** *(opt-in)* — harvest real prompts from local AI tool logs, run probe micro-tests, diagnose and fix gaps.
5. **Optimize** *(opt-in)* — agentic LLM loop: evaluate → improve → accept.
6. **Watch** — re-run on file changes (default mode).

### Supported Languages

Python · TypeScript · JavaScript · Java · C#

## CLI Usage

```bash
aspectcode                              # watch mode — auto-update on changes
aspectcode --once                       # run once, then exit
aspectcode --once --kb                  # also write kb.md
aspectcode --once --dry-run             # preview without writing files
aspectcode --provider anthropic         # LLM provider for optimizer
aspectcode --model claude-sonnet-4-20250514    # model override
aspectcode --max-iterations 5           # optimizer iterations (default: 3)
aspectcode --verbose                    # debug output
aspectcode --root ./my-project          # explicit workspace root
aspectcode --no-color                   # plain text output
```

Run `aspectcode --help` for the full flag reference.

---

## Repository Structure

```
aspectcode/
├── packages/
│   ├── core/        @aspectcode/core        Static analysis engine
│   ├── emitters/    @aspectcode/emitters     Artifact generation
│   ├── evaluator/   @aspectcode/evaluator    Evidence-based evaluation
│   ├── optimizer/   @aspectcode/optimizer    LLM-based optimization
│   └── cli/         aspectcode               CLI entry point
├── extension/                                VS Code extension (thin launcher)
└── docs/                                     Architecture & guides
```

## Development

```bash
npm install                     # install all workspace deps
npm run build --workspaces      # build core → emitters → evaluator → optimizer → cli
npm test --workspaces           # run all tests
```

**Extension:** `cd extension && npm run build`, then press **F5** in VS Code.

### CI

| Tier | Trigger | What it checks |
|------|---------|----------------|
| **Main** | push to `main`, every PR | Build + test all packages, bundled-dep check, extension lint/typecheck/format/boundaries |
| **PR** | every PR | Windows sandbox CLI smoke tests |
| **Nightly** | scheduled | Multi-repo cross-language CLI matrix |

```bash
npm run test:ci:pr        # reproduce PR CI locally
npm run test:ci:repos     # reproduce nightly CI locally
```

## Documentation

| Document | Purpose |
|----------|---------|
| [docs/SYSTEM-ARCHITECTURE.md](docs/SYSTEM-ARCHITECTURE.md) | Full system architecture, package APIs, data flow |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Extension layering rules, file-size limits, conventions |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Development workflow, testing, releasing, PR process |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Releases are automated via [changesets](https://github.com/changesets/changesets).

## License

[MIT](LICENSE.md)
