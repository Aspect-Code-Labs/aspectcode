# Context

_Data flow and co-location context. Use to understand which files work together._

## Module Clusters

_Files commonly imported together. Editing one likely requires editing the others._

### Services #1

_Co-imported by: `extension/src/assistants/instructions.ts`, `extension/src/assistants/kb.ts`, `extension/src/commandHandlers.ts` (+1 more)_

- `extension/src/services/aspectSettings.ts`
- `extension/src/services/gitignoreService.ts`
- `extension/src/services/vscodeEmitterHost.ts`
- `extension/src/state.ts`
- `extension/src/tsParser.ts`

### Assistants

_Co-imported by: `extension/src/assistants/instructions.ts`, `extension/src/commandHandlers.ts`, `extension/src/extension.ts`_

- `extension/src/assistants/kb.ts`
- `extension/src/services/aspectSettings.ts`
- `extension/src/services/gitignoreService.ts`
- `extension/src/state.ts`

### Services #2

_Co-imported by: `extension/src/assistants/kb.ts`, `extension/src/commandHandlers.ts`_

- `extension/src/services/CliAdapter.ts`
- `extension/src/services/aspectSettings.ts`
- `extension/src/services/gitignoreService.ts`
- `extension/src/services/vscodeEmitterHost.ts`
- `extension/src/state.ts`

### Services #3

_Co-imported by: `extension/src/assistants/kb.ts`, `extension/src/extension.ts`, `extension/src/services/WorkspaceFingerprint.ts`_

- `extension/src/services/FileDiscoveryService.ts`
- `extension/src/services/aspectSettings.ts`
- `extension/src/state.ts`
- `extension/src/tsParser.ts`

### Services #4

_Co-imported by: `extension/src/assistants/kb.ts`, `extension/src/services/WorkspaceFingerprint.ts`_

- `extension/src/services/DirectoryExclusion.ts`
- `extension/src/services/FileDiscoveryService.ts`
- `extension/src/services/aspectSettings.ts`

## Critical Flows

_Most central modules by connectivity. Changes here propagate widely._

| Module | Callers | Dependencies |
|--------|---------|--------------|
| `extension/src/assistants/kb.ts` | 3 | 10 |
| `extension/src/services/aspectSettings.ts` | 7 | 1 |
| `extension/src/commandHandlers.ts` | 1 | 9 |
| `extension/src/services/FileDiscoveryService.ts` | 4 | 1 |
| `extension/src/state.ts` | 4 | 0 |
| `extension/src/extension.ts` | 0 | 7 |
| `extension/src/services/DirectoryExclusion.ts` | 3 | 1 |
| `extension/src/services/gitignoreService.ts` | 3 | 1 |

## Dependency Chains

_Top data/call flow paths. Shows how changes propagate through the codebase._

**Chain 1** (4 modules):
```
extension/src/services/gitignoreService.ts → extension/src/services/aspectSettings.ts → extension/src/services/DirectoryExclusion.ts → extension/src/services/FileDiscoveryService.ts
```

**Chain 2** (3 modules):
```
extension/src/services/aspectSettings.ts → extension/src/services/DirectoryExclusion.ts → extension/src/services/FileDiscoveryService.ts
```

**Chain 3** (3 modules):
```
extension/src/services/DirectoryExclusion.ts → extension/src/services/FileDiscoveryService.ts → extension/src/services/aspectSettings.ts
```

**Chain 4** (3 modules):
```
extension/src/services/FileDiscoveryService.ts → extension/src/services/aspectSettings.ts → extension/src/services/DirectoryExclusion.ts
```

---

## Quick Reference

**"What files work together for feature X?"**
→ Check Module Clusters above.

**"Where does data flow from this endpoint?"**
→ Check Critical Flows and Dependency Chains.

**"Where are external connections?"**
→ Check External Integrations.


_Generated: 2026-02-16T20:18:01.220Z_
