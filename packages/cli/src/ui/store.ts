/**
 * Dashboard state — shared between the ink UI and the pipeline.
 *
 * The pipeline pushes events via the DashboardStore; the ink Dashboard
 * component re-renders whenever the state changes.
 */

import { EventEmitter } from 'events';

export type PipelinePhase =
  | 'idle'
  | 'discovering'
  | 'analyzing'
  | 'building-kb'
  | 'optimizing'
  | 'writing'
  | 'watching'
  | 'done'
  | 'error';

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
  /** Current complaint text being typed by the user. */
  complaintInput: string;
  /** Queued complaints awaiting processing. */
  complaintQueue: string[];
  /** Human-readable change descriptions from the last complaint processing. */
  complaintChanges: string[];
  /** True while the complaint processor is running. */
  processingComplaint: boolean;
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
    complaintInput: '',
    complaintQueue: [],
    complaintChanges: [],
    processingComplaint: false,
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

  // ── Complaint methods ───────────────────────────────────

  setComplaintInput(text: string): void {
    this.update({ complaintInput: text });
  }

  queueComplaint(complaint: string): void {
    this.update({
      complaintQueue: [...this.state.complaintQueue, complaint],
      complaintInput: '',
    });
  }

  /** Remove and return the next queued complaint (or undefined). */
  shiftComplaint(): string | undefined {
    const [next, ...rest] = this.state.complaintQueue;
    if (next !== undefined) {
      this.update({ complaintQueue: rest });
    }
    return next;
  }

  setProcessingComplaint(processing: boolean): void {
    this.update({ processingComplaint: processing });
  }

  setComplaintChanges(changes: string[]): void {
    this.update({ complaintChanges: changes });
  }

  clearComplaintChanges(): void {
    this.update({ complaintChanges: [] });
  }

  /** Reset per-run state for a fresh pipeline run. */
  resetRun(): void {
    this.update({
      warning: '',
      outputs: [],
      reasoning: [],
      elapsed: '',
      provider: '',
      phaseDetail: '',
      // Note: complaintQueue, complaintInput, complaintChanges are preserved
    });
  }
}

/** Singleton — created once, shared across pipeline + UI. */
export const store = new DashboardStore();
