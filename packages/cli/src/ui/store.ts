/**
 * Dashboard state — shared between the ink UI and the pipeline.
 *
 * The pipeline pushes events via the DashboardStore; the ink Dashboard
 * component re-renders whenever the state changes.
 */

import { EventEmitter } from 'events';
import type { ChangeAssessment } from '../changeEvaluator';

export type PipelinePhase =
  | 'idle'
  | 'discovering'
  | 'analyzing'
  | 'building-kb'
  | 'optimizing'
  | 'evaluating'
  | 'writing'
  | 'watching'
  | 'done'
  | 'error';

/** Evaluator sub-phase for transparent progress reporting. */
export type EvalPhase = 'idle' | 'harvesting' | 'probing' | 'diagnosing' | 'done';

/** Evaluator status shown in the dashboard. */
export interface EvalStatus {
  phase: EvalPhase;
  harvestCount?: number;
  probesPassed?: number;
  probesTotal?: number;
  diagnosisEdits?: number;
}

/** Summary of generated AGENTS.md content. */
export interface ContentSummary {
  sections: number;
  rules: number;
  filePaths: string[];
}

/** Summary of line-level changes between two versions. */
export interface DiffSummary {
  added: number;
  removed: number;
  changed: boolean;
}

export interface DashboardState {
  phase: PipelinePhase;
  /** Human-readable label for the current sub-step (e.g. "iteration 2/3"). */
  phaseDetail: string;
  fileCount: number;
  edgeCount: number;
  provider: string;
  lastChange: string;
  elapsed: string;
  /** Warning text (e.g. no API key). */
  warning: string;
  /** Files written this run (e.g. ["AGENTS.md updated", "kb.md written"]). */
  outputs: string[];
  /** Optimization reasoning lines from the agent (score + feedback per iteration). */
  reasoning: string[];
  /** Brief setup notifications (config, API key, tool files). */
  setupNotes: string[];
  /** Evaluator pipeline progress. */
  evalStatus: EvalStatus;
  /** Epoch ms when the current run started (0 when idle). */
  runStartMs: number;
  /** Token usage from the LLM generation call. */
  tokenUsage?: { inputTokens: number; outputTokens: number };
  /** Summary of generated AGENTS.md content. */
  summary?: ContentSummary;
  /** True on the first run (no AGENTS.md or config existed). */
  isFirstRun: boolean;
  /** Diff summary when AGENTS.md is regenerated (watch mode). */
  diffSummary?: DiffSummary;
  /** Compact dashboard mode (no banner, tighter layout). */
  compact: boolean;

  // ── v2: Real-time assessment state ─────────────────────────
  /** Queue of assessments waiting for user input. */
  pendingAssessments: ChangeAssessment[];
  /** The assessment currently shown to the user (null if none). */
  currentAssessment: ChangeAssessment | null;
  /** Running counts. */
  assessmentStats: {
    ok: number;
    warnings: number;
    violations: number;
    dismissed: number;
    confirmed: number;
    changes: number;
  };
  /** Number of consecutive OK-only changes (used to suppress output). */
  consecutiveOk: number;
  /** Learned preference count (from preferences.json). */
  preferenceCount: number;
  /** Transient "Learned: ..." message, auto-clears. */
  learnedMessage: string;
}

/**
 * Mutable singleton store. The ink component subscribes via onChange.
 */
class DashboardStore extends EventEmitter {
  state: DashboardState = {
    phase: 'idle',
    phaseDetail: '',
    fileCount: 0,
    edgeCount: 0,
    provider: '',
    lastChange: '',
    elapsed: '',
    warning: '',
    outputs: [],
    reasoning: [],
    setupNotes: [],
    evalStatus: { phase: 'idle' },
    runStartMs: 0,
    tokenUsage: undefined,
    summary: undefined,
    isFirstRun: false,
    diffSummary: undefined,
    compact: false,
    pendingAssessments: [],
    currentAssessment: null,
    assessmentStats: { ok: 0, warnings: 0, violations: 0, dismissed: 0, confirmed: 0, changes: 0 },
    consecutiveOk: 0,
    preferenceCount: 0,
    learnedMessage: '',
  };

  private update(patch: Partial<DashboardState>): void {
    Object.assign(this.state, patch);
    this.emit('change');
  }

  setPhase(phase: PipelinePhase, detail = ''): void {
    this.update({ phase, phaseDetail: detail });
  }

  setStats(fileCount: number, edgeCount: number): void {
    this.update({ fileCount, edgeCount });
  }

  setProvider(provider: string): void {
    this.update({ provider });
  }

  setLastChange(change: string): void {
    this.update({ lastChange: change });
  }

  setElapsed(elapsed: string): void {
    this.update({ elapsed });
  }

  setWarning(warning: string): void {
    this.update({ warning });
  }

  addOutput(output: string): void {
    this.update({ outputs: [...this.state.outputs, output] });
  }

  setReasoning(reasoning: string[]): void {
    this.update({ reasoning });
  }

  // ── Setup & evaluator methods ───────────────────────────

  addSetupNote(note: string): void {
    this.update({ setupNotes: [...this.state.setupNotes, note] });
  }

  setEvalStatus(status: EvalStatus): void {
    this.update({ evalStatus: status });
  }

  setRunStartMs(ms: number): void {
    this.update({ runStartMs: ms });
  }

  setTokenUsage(usage: { inputTokens: number; outputTokens: number }): void {
    this.update({ tokenUsage: usage });
  }

  setSummary(summary: ContentSummary): void {
    this.update({ summary });
  }

  setFirstRun(isFirstRun: boolean): void {
    this.update({ isFirstRun });
  }

  setDiffSummary(diffSummary: DiffSummary | undefined): void {
    this.update({ diffSummary });
  }

  setCompact(compact: boolean): void {
    this.update({ compact });
  }

  // ── v2: Assessment methods ──────────────────────────────

  /** Push assessments from a file change evaluation. */
  pushAssessments(assessments: ChangeAssessment[]): void {
    const stats = { ...this.state.assessmentStats };
    stats.changes++;
    let hasNonOk = false;
    for (const a of assessments) {
      if (a.type === 'ok') stats.ok++;
      else if (a.type === 'warning') { stats.warnings++; hasNonOk = true; }
      else if (a.type === 'violation') { stats.violations++; hasNonOk = true; }
    }

    const actionable = assessments.filter((a) => a.type !== 'ok');
    const newQueue = [...this.state.pendingAssessments, ...actionable];
    const consecutive = hasNonOk ? 0 : this.state.consecutiveOk + 1;

    this.update({
      assessmentStats: stats,
      pendingAssessments: newQueue,
      consecutiveOk: consecutive,
    });

    // Auto-advance if no current assessment
    if (!this.state.currentAssessment && newQueue.length > 0) {
      this.advanceAssessment();
    }
  }

  /** Move to the next pending assessment. */
  advanceAssessment(): void {
    const queue = [...this.state.pendingAssessments];
    const next = queue.shift() ?? null;
    this.update({ currentAssessment: next, pendingAssessments: queue });
  }

  /** Record a user action on the current assessment and advance. */
  resolveAssessment(action: 'dismiss' | 'confirm'): void {
    const stats = { ...this.state.assessmentStats };
    if (action === 'dismiss') stats.dismissed++;
    else stats.confirmed++;
    this.update({ assessmentStats: stats });
    this.advanceAssessment();
  }

  setPreferenceCount(count: number): void {
    this.update({ preferenceCount: count });
  }

  setLearnedMessage(msg: string): void {
    this.update({ learnedMessage: msg });
  }

  /** Reset per-run state for a fresh pipeline run. */
  resetRun(): void {
    this.update({
      warning: '',
      outputs: [],
      reasoning: [],
      setupNotes: [],
      evalStatus: { phase: 'idle' },
      runStartMs: 0,
      elapsed: '',
      provider: '',
      phaseDetail: '',
      tokenUsage: undefined,
      summary: undefined,
      diffSummary: undefined,
    });
  }
}

/** Singleton — created once, shared across pipeline + UI. */
export const store = new DashboardStore();
