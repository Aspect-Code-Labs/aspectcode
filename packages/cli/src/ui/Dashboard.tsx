/**
 * Dashboard — ink-based self-updating CLI dashboard.
 *
 * Layout:
 * ┌─────────────────────────────────────────┐
 * │  ASCII banner (purple)                  │
 * │  Status line: phase + stats             │
 * │                                         │
 * │  Activity log (last ~10 entries)        │
 * └─────────────────────────────────────────┘
 */

import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { COLORS, getBannerText } from './theme';
import { store } from './store';
import type { DashboardState, ActivityEntry, PipelinePhase } from './store';

// ── Phase display ────────────────────────────────────────────

const PHASE_LABELS: Record<PipelinePhase, { icon: string; label: string; color: string }> = {
  idle:          { icon: '○', label: 'Idle',           color: COLORS.gray },
  discovering:   { icon: '…', label: 'Discovering',    color: COLORS.primary },
  analyzing:     { icon: '…', label: 'Analyzing',      color: COLORS.primary },
  'building-kb': { icon: '…', label: 'Building KB',    color: COLORS.primary },
  optimizing:    { icon: '◈', label: 'Optimizing',     color: COLORS.yellow },
  writing:       { icon: '…', label: 'Writing',        color: COLORS.primary },
  watching:      { icon: '●', label: 'Watching',       color: COLORS.green },
  error:         { icon: '✖', label: 'Error',          color: COLORS.red },
};

// ── Activity entry colors ────────────────────────────────────

const LEVEL_COLORS: Record<ActivityEntry['level'], string> = {
  info:    COLORS.white,
  success: COLORS.green,
  warn:    COLORS.yellow,
  error:   COLORS.red,
  debug:   COLORS.gray,
};

// ── Main component ───────────────────────────────────────────

const Dashboard: React.FC = () => {
  const [state, setState] = useState<DashboardState>({ ...store.state });

  useEffect(() => {
    const onUpdate = () => setState({ ...store.state });
    store.on('change', onUpdate);
    return () => { store.removeListener('change', onUpdate); };
  }, []);

  const phaseInfo = PHASE_LABELS[state.phase];

  return (
    <Box flexDirection="column">
      {/* Banner */}
      <Box marginBottom={1}>
        <Text color={COLORS.primary} bold>{getBannerText()}</Text>
      </Box>

      {/* Status line */}
      <Box>
        <Text color={phaseInfo.color}>{phaseInfo.icon} {phaseInfo.label}</Text>
        {state.fileCount > 0 && (
          <Text color={COLORS.gray}>{'  '}| {state.fileCount} files, {state.edgeCount} edges</Text>
        )}
        {state.provider !== '' && (
          <Text color={COLORS.gray}>{'  '}| {state.provider}</Text>
        )}
        {state.elapsed !== '' && (
          <Text color={COLORS.gray}>{'  '}| {state.elapsed}</Text>
        )}
      </Box>

      {/* Last change */}
      {state.lastChange !== '' && (
        <Box>
          <Text color={COLORS.gray} dimColor>  ↳ {state.lastChange}</Text>
        </Box>
      )}

      {/* Activity log */}
      {state.activity.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Text color={COLORS.primaryDim} bold>{'─'.repeat(50)}</Text>
          {state.activity.map((entry, i) => (
            <Box key={i}>
              <Text color={COLORS.gray} dimColor>{entry.time} </Text>
              <Text color={LEVEL_COLORS[entry.level]}>{entry.text}</Text>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
};

export default Dashboard;
