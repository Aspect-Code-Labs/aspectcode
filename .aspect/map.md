# Map

_Symbol index with signatures and conventions. Use to find types, functions, and coding patterns._

## Data Models

_Core data structures. Check these before modifying data handling._

### TypeScript Interfaces & Types

**`extension/src/assistants/instructions.ts`**: `export interface AssistantsOverride { copilot?: boolean; cursor?: boolean; claude?: boolean; ... }`

**`extension/src/assistants/kb.ts`**: Interface: RegenerateResult

**`extension/src/assistants/kb.ts`**: Type Alias: ImpactSummary

**`extension/src/commandHandlers.ts`**: Interface: AssistantPickItem

**`extension/src/importExtractors.ts`**: Type Alias: ImportEdge

**`extension/src/services/aspectSettings.ts`**: `export interface UpdateAspectSettingsOptions { createIfMissing?: boolean }`

**`extension/src/services/aspectSettings.ts`**: `export interface UpdateAspectSettingsOptions { createIfMissing?: boolean }`

**`extension/src/services/aspectSettings.ts`**: `export interface UpdateAspectSettingsOptions { createIfMissing?: boolean }`

**`extension/src/services/CliAdapter.ts`**: `export interface ImpactJsonPayload { file: string; dependents_count: number; top_dependents: Array<{ file: string; ... }`

**`extension/src/services/CliAdapter.ts`**: `export interface ImpactJsonPayload { file: string; dependents_count: number; top_dependents: Array<{ file: string; ... }`

**`extension/src/services/CliAdapter.ts`**: `export interface ImpactJsonPayload { file: string; dependents_count: number; top_dependents: Array<{ file: string; ... }`

**`extension/src/services/CliAdapter.ts`**: `export interface ImpactJsonPayload { file: string; dependents_count: number; top_dependents: Array<{ file: string; ... }`

**`extension/src/services/DirectoryExclusion.ts`**: `export interface ExclusionSettings { always?: string[]; never?: string[]; _computed?: {; ... }`

**`extension/src/services/DirectoryExclusion.ts`**: `export interface ExclusionSettings { always?: string[]; never?: string[]; _computed?: {; ... }`

**`extension/src/services/FileDiscoveryService.ts`**: `export interface ComputedExclusions { excludeGlob: string; excludedDirs: string[]; computedAt: number; ... }`

## Symbol Index

_Functions, classes, and exports with call relationships._

### `extension/src/assistants/kb.ts`

| Symbol | Kind | Signature | Used In (files) |
|--------|------|-----------|----------------|
| `RegenerateResult` | interface | `interface RegenerateResult` | `assistants/instructions.ts`, `src/commandHandlers.ts` |
| `ImpactSummary` | type | `type ImpactSummary` | `assistants/instructions.ts`, `src/commandHandlers.ts` |

### `extension/src/services/aspectSettings.ts`

| Symbol | Kind | Signature | Used In (files) |
|--------|------|-----------|----------------|
| `InstructionsMode` | type | `type InstructionsMode` | `(+2 more)`, `assistants/instructions.ts` |
| `UpdateRateMode` | type | `type UpdateRateMode` | `(+2 more)`, `assistants/instructions.ts` |
| `AutoRegenerateKbMode` | type | `type AutoRegenerateKbMode` | `(+2 more)`, `assistants/instructions.ts` |
| `AssistantsSettings` | interface | `interface AssistantsSettings` | `(+2 more)`, `assistants/instructions.ts` |
| `GitignoreTarget` | type | `type GitignoreTarget` | `(+2 more)`, `assistants/instructions.ts` |
| `ALL_GITIGNORE_TARGETS` | const | — | `(+2 more)`, `assistants/instructions.ts` |
| `AspectSettings` | interface | `interface AspectSettings` | `(+2 more)`, `assistants/instructions.ts` |
| `aspectDirExists` | function | `function aspectDirExists(workspaceRoot)` | `(+2 more)`, `assistants/instructions.ts` |
| `readAspectSettings` | function | `function readAspectSettings(workspaceRoot)` | `(+2 more)`, `assistants/instructions.ts` |
| `UpdateAspectSettingsOptions` | interface | `interface UpdateAspectSettingsOptions` | `(+2 more)`, `assistants/instructions.ts` |
| `getExtensionEnabledSetting` | function | `function getExtensionEnabledSetting(workspaceRoot)` | `(+2 more)`, `assistants/instructions.ts` |
| `getTargetDescription` | function | `function getTargetDescription(target)` | `(+2 more)`, `assistants/instructions.ts` |

_+2 more symbols_

### `extension/src/services/FileDiscoveryService.ts`

| Symbol | Kind | Signature | Used In (files) |
|--------|------|-----------|----------------|
| `FileDiscoveryResult` | interface | `interface FileDiscoveryResult` | `assistants/kb.ts`, `services/WorkspaceFingerprint.ts` |
| `ComputedExclusions` | interface | `interface ComputedExclusions` | `assistants/kb.ts`, `services/WorkspaceFingerprint.ts` |
| `FileDiscoveryService` | class | `class FileDiscoveryService` | `assistants/kb.ts`, `services/WorkspaceFingerprint.ts` |
| `getFileDiscoveryService` | function | `function getFileDiscoveryService()` | `assistants/kb.ts`, `services/WorkspaceFingerprint.ts` |
| `disposeFileDiscoveryService` | function | `function disposeFileDiscoveryService()` | `assistants/kb.ts`, `services/WorkspaceFingerprint.ts` |

### `extension/src/state.ts`

| Symbol | Kind | Signature | Used In (files) |
|--------|------|-----------|----------------|
| `ExtensionState` | type | `type ExtensionState` | `assistants/instructions.ts`, `assistants/kb.ts` |
| `AspectCodeState` | class | `class AspectCodeState` | `assistants/instructions.ts`, `assistants/kb.ts` |

### `extension/src/services/DirectoryExclusion.ts`

| Symbol | Kind | Signature | Used In (files) |
|--------|------|-----------|----------------|
| `ExclusionSettings` | interface | `interface ExclusionSettings` | `assistants/kb.ts`, `services/WorkspaceFingerprint.ts` |
| `ExclusionResult` | interface | `interface ExclusionResult` | `assistants/kb.ts`, `services/WorkspaceFingerprint.ts` |
| `DirectoryExclusionService` | class | `class DirectoryExclusionService` | `assistants/kb.ts`, `services/WorkspaceFingerprint.ts` |
| `getDefaultExcludeGlob` | function | `function getDefaultExcludeGlob()` | `assistants/kb.ts`, `services/WorkspaceFingerprint.ts` |

### `extension/src/services/gitignoreService.ts`

| Symbol | Kind | Signature | Used In (files) |
|--------|------|-----------|----------------|
| `GitignoreMode` | type | `type GitignoreMode` | `assistants/instructions.ts`, `assistants/kb.ts` |
| `getGitignoreMode` | function | `function getGitignoreMode()` | `assistants/instructions.ts`, `assistants/kb.ts` |
| `EnsureGitignoreResult` | interface | `interface EnsureGitignoreResult` | `assistants/instructions.ts`, `assistants/kb.ts` |
| `EnsureGitignoreForTargetResult` | interface | `interface EnsureGitignoreForTargetResult` | `assistants/instructions.ts`, `assistants/kb.ts` |
| `showGitignoreNotification` | function | `function showGitignoreNotification(context)` | `assistants/instructions.ts`, `assistants/kb.ts` |

### `extension/src/assistants/instructions.ts`

| Symbol | Kind | Signature | Used In (files) |
|--------|------|-----------|----------------|
| `AssistantsOverride` | interface | `interface AssistantsOverride` | `src/commandHandlers.ts` |

### `extension/src/services/WorkspaceFingerprint.ts`

| Symbol | Kind | Signature | Used In (files) |
|--------|------|-----------|----------------|
| `WorkspaceFingerprint` | class | `class WorkspaceFingerprint` | `src/extension.ts` |

### `extension/src/services/CliAdapter.ts`

| Symbol | Kind | Signature | Used In (files) |
|--------|------|-----------|----------------|
| `CliResult` | interface | `interface CliResult` | `assistants/kb.ts`, `src/commandHandlers.ts` |
| `GenerateJsonPayload` | interface | `interface GenerateJsonPayload` | `assistants/kb.ts`, `src/commandHandlers.ts` |
| `ImpactJsonPayload` | interface | `interface ImpactJsonPayload` | `assistants/kb.ts`, `src/commandHandlers.ts` |
| `CliRunOptions` | interface | `interface CliRunOptions` | `assistants/kb.ts`, `src/commandHandlers.ts` |
| `runCli` | function | `function runCli(opts)` | `assistants/kb.ts`, `src/commandHandlers.ts` |

### `extension/src/extension.ts`

| Symbol | Kind | Signature | Used In (files) |
|--------|------|-----------|----------------|
| `getWorkspaceFingerprint` | function | `function getWorkspaceFingerprint()` | — |
| `activate` | function | `function activate(context)` | — |
| `deactivate` | function | `function deactivate()` | — |

### `extension/src/services/vscodeEmitterHost.ts`

| Symbol | Kind | Signature | Used In (files) |
|--------|------|-----------|----------------|
| `createVsCodeEmitterHost` | function | `function createVsCodeEmitterHost()` | `assistants/kb.ts`, `src/commandHandlers.ts` |

### `extension/src/tsParser.ts`

| Symbol | Kind | Signature | Used In (files) |
|--------|------|-----------|----------------|
| `getLoadedGrammarsSummary` | function | `function getLoadedGrammarsSummary()` | `assistants/kb.ts`, `src/extension.ts` |
| `resetGrammarCache` | function | `function resetGrammarCache()` | `assistants/kb.ts`, `src/extension.ts` |

### `extension/src/assistants/detection.ts`

| Symbol | Kind | Signature | Used In (files) |
|--------|------|-----------|----------------|
| `AssistantId` | type | `type AssistantId` | `src/commandHandlers.ts` |
| `detectAssistants` | function | `function detectAssistants(workspaceRoot)` | `src/commandHandlers.ts` |

### `extension/src/services/DependencyAnalyzer.ts`

| Symbol | Kind | Signature | Used In (files) |
|--------|------|-----------|----------------|
| `DependencyLink` | type | `type DependencyLink` | `assistants/kb.ts` |
| `DependencyProgressCallback` | type | `type DependencyProgressCallback` | `assistants/kb.ts` |
| `DependencyAnalyzer` | class | `class DependencyAnalyzer` | `assistants/kb.ts` |

### `extension/src/services/enablementCancellation.ts`

| Symbol | Kind | Signature | Used In (files) |
|--------|------|-----------|----------------|
| `getEnablementCancellationToken` | function | `function getEnablementCancellationToken()` | `src/commandHandlers.ts` |
| `cancelAllInFlightWork` | function | `function cancelAllInFlightWork()` | `src/commandHandlers.ts` |
| `resetEnablementCancellationToken` | function | `function resetEnablementCancellationToken()` | `src/commandHandlers.ts` |
| `cancelAndResetAllInFlightWork` | function | `function cancelAndResetAllInFlightWork()` | `src/commandHandlers.ts` |

### `extension/test/fixtures/mini-repo/src/app.ts`

| Symbol | Kind | Signature | Used In (files) |
|--------|------|-----------|----------------|
| `App` | class | `class App` | — |

### `extension/test/fixtures/mini-repo/src/services/UserService.ts`

| Symbol | Kind | Signature | Used In (files) |
|--------|------|-----------|----------------|
| `User` | interface | `interface User` | — |
| `UserService` | class | `class UserService` | — |

### `extension/test/fixtures/mini-repo/src/utils/format.ts`

| Symbol | Kind | Signature | Used In (files) |
|--------|------|-----------|----------------|
| `formatDate` | function | `function formatDate(date)` | — |
| `capitalize` | function | `function capitalize(str)` | — |
| `slugify` | function | `function slugify(str)` | — |

### `extension/src/test/kb.test.ts`

| Symbol | Kind | Signature | Used In (files) |
|--------|------|-----------|----------------|
| `KBInvariants` | interface | `interface KBInvariants` | — |
| `KB_SIZE_LIMITS` | const | — | — |
| `validatePathsUseForwardSlashes` | function | `function validatePathsUseForwardSlashes(content)` | — |
| `validateNoDuplicateEntries` | function | `function validateNoDuplicateEntries(content)` | — |
| `validateArchitectureSections` | function | `function validateArchitectureSections(content)` | — |
| `validateMapSections` | function | `function validateMapSections(content)` | — |
| `validateContextSections` | function | `function validateContextSections(content)` | — |
| `validateTimestamp` | function | `function validateTimestamp(content)` | — |
| `main` | const | — | — |
| `util` | const | — | — |
| `a` | const | — | — |
| `SAMPLE_ARCHITECTURE_MD` | const | — | — |

_+6 more symbols_

---

## Conventions

_Naming patterns and styles. Follow these for consistency._

### File Naming

| Pattern | Example | Count |
|---------|---------|-------|
| camelCase | `kbShared.ts` | 7 |
| PascalCase | `CliAdapter.ts` | 5 |
| kebab-case | `check-boundaries.mjs` | 2 |

**Use:** camelCase for new files.

### Function Naming

- `get_*` → `getDetailedDependencyData` (21 occurrences)
- `has_*` → `hasVenvMarker` (6 occurrences)
- `is_*` → `isExtensionEnabled` (5 occurrences)
- `create_*` → `createVscodeHost` (4 occurrences)
- `handle_*` → `handleConfigureAssistants` (4 occurrences)


_Generated: 2026-02-16T20:18:01.220Z_
