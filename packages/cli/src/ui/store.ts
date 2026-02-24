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
  | 'error';

export interface ActivityEntry {
  time: string;
  text: string;
  level: 'info' | 'success' | 'warn' | 'error' | 'debug';
}

export interface DashboardState {
  phase: PipelinePhase;
  fileCount: number;
  edgeCount: number;
  provider: string;
  lastChange: string;
  elapsed: string;
  activity: ActivityEntry[];
}

const MAX_ACTIVITY = 12;

function timestamp(): string {
  const d = new Date();
  return d.toLocaleTimeString('en-US', { hour12: false });
}

/**
 * Mutable singleton store. The ink component subscribes via onChange.
 */
class DashboardStore extends EventEmitter {
  state: DashboardState = {
    phase: 'idle',
    fileCount: 0,
    edgeCount: 0,
    provider: '',
    lastChange: '',
    elapsed: '',
    activity: [],
  };

  private update(patch: Partial<DashboardState>): void {
    Object.assign(this.state, patch);
    this.emit('change');
  }

  setPhase(phase: PipelinePhase): void {
    this.update({ phase });
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

  pushActivity(text: string, level: ActivityEntry['level'] = 'info'): void {
    const entry: ActivityEntry = { time: timestamp(), text, level };
    const activity = [...this.state.activity, entry].slice(-MAX_ACTIVITY);
    this.update({ activity });
  }
}

/** Singleton — created once, shared across pipeline + UI. */
export const store = new DashboardStore();
