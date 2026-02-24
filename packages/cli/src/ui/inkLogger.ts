/**
 * Ink logger adapter — implements Logger + Spinner interfaces via the
 * DashboardStore, so all pipeline output flows through the ink dashboard
 * instead of raw console writes.
 */

import type { Logger, Spinner } from '../logger';
import { store } from './store';
import type { PipelinePhase } from './store';

/**
 * Create a Logger that pushes all messages to the dashboard store
 * instead of writing to stdout/stderr.
 */
export function createDashboardLogger(): Logger {
  return {
    info(msg: string)    { store.pushActivity(msg, 'info');    },
    success(msg: string) { store.pushActivity(msg, 'success'); },
    warn(msg: string)    { store.pushActivity(msg, 'warn');    },
    error(msg: string)   { store.pushActivity(msg, 'error');   },
    debug(msg: string)   { store.pushActivity(msg, 'debug');   },
    blank()              { /* no-op — dashboard handles spacing */ },
  };
}

/**
 * Create a Spinner that updates the dashboard phase instead of writing
 * animated frames to stderr.
 */
export function createDashboardSpinner(phase: PipelinePhase, _initialMsg: string): Spinner {
  store.setPhase(phase);
  return {
    update(msg: string) {
      store.pushActivity(msg, 'info');
    },
    stop(msg: string) {
      store.pushActivity(msg, 'success');
    },
    fail(msg: string) {
      store.setPhase('error');
      store.pushActivity(msg, 'error');
    },
  };
}
