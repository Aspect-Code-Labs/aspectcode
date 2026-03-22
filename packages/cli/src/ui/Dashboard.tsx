/**
 * Dashboard — ink-based CLI dashboard with real-time change assessments.
 *
 * v2 layout:
 *   Banner → Setup → Status → Eval progress → Summary →
 *   Assessment display → Status line (persistent)
 */

import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import type { Key } from 'ink';
import { COLORS, getBannerText } from './theme';
import { store } from './store';
import type { DashboardState, PipelinePhase, EvalPhase } from './store';

// ── Spinner ──────────────────────────────────────────────────

const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

function useSpinner(active: boolean): string {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setFrame((f) => (f + 1) % FRAMES.length), 80);
    return () => clearInterval(id);
  }, [active]);
  return FRAMES[frame];
}

// ── Live elapsed timer ───────────────────────────────────────

function useElapsedTimer(startMs: number, finalElapsed: string, isWorking: boolean): string {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!isWorking || startMs === 0) return;
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [isWorking, startMs]);

  if (finalElapsed) return finalElapsed;
  if (startMs === 0 || !isWorking) return '';
  return `${((now - startMs) / 1000).toFixed(1)}s`;
}

// ── Auto-clear learned message ───────────────────────────────

function useLearnedMessage(msg: string): string {
  const [visible, setVisible] = useState(msg);
  useEffect(() => {
    if (!msg) { setVisible(''); return; }
    setVisible(msg);
    const id = setTimeout(() => {
      setVisible('');
      store.setLearnedMessage('');
    }, 4000);
    return () => clearTimeout(id);
  }, [msg]);
  return visible;
}

// ── Phase labels ─────────────────────────────────────────────

const PHASE_TEXT: Record<PipelinePhase, string> = {
  idle:          'Starting…',
  discovering:   'Discovering files…',
  analyzing:     'Analyzing…',
  'building-kb': 'Building knowledge base…',
  optimizing:    'Generating…',
  evaluating:    'Evaluating…',
  writing:       'Writing…',
  watching:      'Watching',
  done:          'Done',
  error:         'Error',
};

const WORKING = new Set<PipelinePhase>([
  'idle', 'discovering', 'analyzing', 'building-kb', 'optimizing', 'evaluating', 'writing',
]);

// ── Helpers ──────────────────────────────────────────────────

function statsText(s: DashboardState, liveElapsed: string): string {
  const parts: string[] = [];
  if (s.fileCount > 0) parts.push(`${s.fileCount} files`);
  if (s.edgeCount > 0) parts.push(`${s.edgeCount} edges`);
  if (s.provider)       parts.push(s.provider);
  const elapsed = liveElapsed || s.elapsed;
  if (elapsed)          parts.push(elapsed);
  return parts.length > 0 ? parts.join(' · ') : '';
}

function evalText(phase: EvalPhase, s: DashboardState['evalStatus']): string | null {
  switch (phase) {
    case 'idle': return null;
    case 'probing':
      return s.probesPassed !== undefined && s.probesTotal !== undefined
        ? `Probes: ${s.probesPassed}/${s.probesTotal} passed`
        : 'Probing…';
    case 'diagnosing':
      return 'Refining…';
    case 'done':
      if (s.probesPassed !== undefined && s.probesTotal !== undefined) {
        const parts = [`${s.probesPassed}/${s.probesTotal} probes passed`];
        if (s.diagnosisEdits && s.diagnosisEdits > 0) {
          parts.push(`${s.diagnosisEdits} fix${s.diagnosisEdits === 1 ? '' : 'es'} applied`);
        }
        return parts.join(' · ');
      }
      return null;
  }
}

function fmtTokens(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

// ── Component ────────────────────────────────────────────────

const FIRST_RUN_VISIBLE = new Set<PipelinePhase>(['idle', 'discovering', 'analyzing']);

const Dashboard: React.FC = () => {
  const [s, setS] = useState<DashboardState>({ ...store.state });
  useEffect(() => {
    const fn = () => setS({ ...store.state });
    store.on('change', fn);
    return () => { store.removeListener('change', fn); };
  }, []);

  // ── Keyboard handling ──────────────────────────────────────
  useInput((input: string, _key: Key) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (store as any)._onAssessmentAction as ((a: any) => void) | undefined;
    if (!handler) return;

    const current = store.state.currentAssessment;

    // Global keys
    if (input === 'r') {
      handler({ type: 'probe-and-refine' });
      return;
    }

    // Assessment keys (only when an assessment is shown)
    if (!current) return;

    if (input === 'n') {
      handler({ type: 'dismiss', assessment: current });
    } else if (input === 'y') {
      // Print suggestion prominently
      if (current.suggestion) {
        process.stderr.write(`\n  Suggestion:\n  ${current.suggestion}\n\n`);
      }
      handler({ type: 'confirm', assessment: current });
    } else if (input === 's') {
      handler({ type: 'skip', assessment: current });
    }
  });

  const compact = s.compact;
  const working = WORKING.has(s.phase);
  const spinner = useSpinner(working);
  const liveElapsed = useElapsedTimer(s.runStartMs, s.elapsed, working);
  const stats = statsText(s, liveElapsed);
  const detail = s.phaseDetail ? ` (${s.phaseDetail})` : '';
  const setup = s.setupNotes.length > 0 ? s.setupNotes.join(' · ') : '';
  const evalLabel = evalText(s.evalStatus.phase, s.evalStatus);
  const evalDone = s.evalStatus.phase === 'done';
  const evalActive = s.evalStatus.phase !== 'idle';
  const allPassed = s.evalStatus.probesPassed === s.evalStatus.probesTotal;
  const hasProbes = (s.evalStatus.probesTotal ?? 0) > 0;
  const isDone = s.phase === 'done' || s.phase === 'watching';
  const learnedMsg = useLearnedMessage(s.learnedMessage);

  const current = s.currentAssessment;
  const queueLen = s.pendingAssessments.length;
  const aStats = s.assessmentStats;

  return (
    <Box flexDirection="column">
      {/* ── Banner ──────────────────────────────── */}
      {!compact && (
        <Box marginBottom={0}>
          <Text color={COLORS.primary} bold>{getBannerText()}</Text>
        </Box>
      )}

      {/* ── First-run ────────────────────────────── */}
      {s.isFirstRun && FIRST_RUN_VISIBLE.has(s.phase) && (
        <Box marginBottom={0}>
          <Text color={COLORS.gray}>
            {'  Analyzing your codebase to generate AGENTS.md — the coding\n  guidelines AI assistants follow in this project.'}
          </Text>
        </Box>
      )}

      {/* ── Setup notes ──────────────────────────── */}
      {setup !== '' && !(compact && !s.warning) && (
        <Box marginTop={1}>
          <Text color={COLORS.gray}>{`  ${setup}`}</Text>
        </Box>
      )}

      {/* ── Status line ──────────────────────────── */}
      <Box>
        {working && (
          <Text color={COLORS.primary}>{`  ${spinner} ${PHASE_TEXT[s.phase]}${detail}`}</Text>
        )}
        {s.phase === 'watching' && !current && (
          <Text color={COLORS.green}>{'  * Watching'}</Text>
        )}
        {s.phase === 'done' && s.outputs.length > 0 && (
          <Text color={COLORS.green}>{`  ✔ ${s.outputs.join(', ')}`}</Text>
        )}
        {s.phase === 'done' && s.outputs.length === 0 && (
          <Text color={COLORS.green}>{'  ✔ Done'}</Text>
        )}
        {s.phase === 'error' && (
          <Text color={COLORS.red}>{'  ✖ Error'}</Text>
        )}
        {stats !== '' && !working && isDone && !current && (
          <Text color={COLORS.gray}>{`  ${stats}`}</Text>
        )}
      </Box>

      {/* ── Evaluator progress ────────────────────── */}
      {evalActive && evalLabel && !(evalDone && !hasProbes) && (
        <Text color={evalDone && allPassed ? COLORS.green : evalDone ? COLORS.yellow : COLORS.primaryDim}>
          {`  ${evalLabel}`}
        </Text>
      )}

      {/* ── Token usage ──────────────────────────── */}
      {s.tokenUsage && isDone && !current && (
        <Text color={COLORS.gray}>
          {`  ${fmtTokens(s.tokenUsage.inputTokens)} in · ${fmtTokens(s.tokenUsage.outputTokens)} out`}
        </Text>
      )}

      {/* ── Content summary ──────────────────────── */}
      {s.summary && isDone && !current && (
        <Box flexDirection="column">
          <Text color={COLORS.gray}>
            {`  ├ ${s.summary.sections} sections · ${s.summary.rules} rules` +
              (s.summary.filePaths.length > 0 ? ` · ${s.summary.filePaths.length} file-specific guidelines` : '')}
          </Text>
          {s.summary.filePaths.length > 0 && (
            <Text color={COLORS.gray}>
              {`  └ covers: ${s.summary.filePaths.slice(0, 3).join(', ')}` +
                (s.summary.filePaths.length > 3 ? `, +${s.summary.filePaths.length - 3} more` : '')}
            </Text>
          )}
        </Box>
      )}

      {/* ── Diff summary ─────────────────────────── */}
      {s.diffSummary && s.diffSummary.changed && isDone && !current && (
        <Text color={COLORS.gray}>
          {`  ↳ AGENTS.md: ` +
            (s.diffSummary.added > 0 ? `+${s.diffSummary.added} lines` : '') +
            (s.diffSummary.added > 0 && s.diffSummary.removed > 0 ? ', ' : '') +
            (s.diffSummary.removed > 0 ? `-${s.diffSummary.removed} lines` : '')}
        </Text>
      )}

      {/* ── Warning ──────────────────────────────── */}
      {s.warning !== '' && (
        <Box marginTop={0}>
          <Text color={COLORS.yellow}>{`  ! ${s.warning}`}</Text>
        </Box>
      )}

      {/* ══ v2: Current assessment ═══════════════════ */}
      {current && current.type === 'warning' && (
        <Box flexDirection="column" marginTop={1}>
          <Text color={COLORS.yellow} bold>
            {`  ⚠ ${current.file}`}
            {queueLen > 0 ? ` (1 of ${queueLen + 1})` : ''}
          </Text>
          <Text color={COLORS.yellow}>{`    ${current.message}`}</Text>
          {current.details && (
            <Text color={COLORS.gray}>{`    ${current.details}`}</Text>
          )}
          <Text color={COLORS.gray}>
            {'    [y] confirm  [n] dismiss (learn)  [s] skip'}
          </Text>
        </Box>
      )}

      {current && current.type === 'violation' && (
        <Box flexDirection="column" marginTop={1}>
          <Text color={COLORS.red} bold>
            {`  ✖ ${current.file}`}
            {queueLen > 0 ? ` (1 of ${queueLen + 1})` : ''}
          </Text>
          <Text color={COLORS.red}>{`    ${current.message}`}</Text>
          {current.details && (
            <Text color={COLORS.gray}>{`    ${current.details}`}</Text>
          )}
          {current.suggestion && (
            <Text color={COLORS.gray}>{`    → ${current.suggestion}`}</Text>
          )}
          <Text color={COLORS.gray}>
            {'    [y] confirm  [n] dismiss (learn)  [s] skip'}
          </Text>
        </Box>
      )}

      {/* ── Learned message (auto-clears) ─────────── */}
      {learnedMsg !== '' && (
        <Text color={COLORS.green}>{`  ✔ ${learnedMsg}`}</Text>
      )}

      {/* ══ v2: Persistent status line ════════════════ */}
      {isDone && s.phase === 'watching' && (
        <Box marginTop={1}>
          <Text color={COLORS.gray}>
            {`  aspect ● watching` +
              ` · ${aStats.changes} changes` +
              (aStats.warnings > 0 ? ` · ${aStats.warnings} warnings` : '') +
              (s.preferenceCount > 0 ? ` · ${s.preferenceCount} learned` : '') +
              ` · [r] probe and refine`}
          </Text>
        </Box>
      )}
    </Box>
  );
};

export default Dashboard;
