import type { CommandContext, CommandResult } from '../cli';
import { ExitCode } from '../cli';
import { fmt } from '../logger';
import {
  collectConnections,
  filterConnectionsByFile,
} from '../connections';

export async function runDepsList(ctx: CommandContext): Promise<CommandResult> {
  const { root, flags, config, log } = ctx;
  const allConnections = await collectConnections(root, config, log);
  const filtered = filterConnectionsByFile(allConnections, root, flags.file);
  const connections = filtered.connections;

  if (filtered.error) {
    log.error(filtered.error);
    return { exitCode: ExitCode.USAGE };
  }

  if (filtered.fileFilter && connections.length === 0) {
    log.info(`No dependency connections found for ${fmt.cyan(filtered.fileFilter)}.`);
    return { exitCode: ExitCode.OK };
  }

  if (filtered.fileFilter) {
    log.info(`Filtering by file: ${fmt.cyan(filtered.fileFilter)}`);
  }

  if (connections.length === 0) {
    log.info('No dependency connections found.');
    return { exitCode: ExitCode.OK };
  }

  log.info(fmt.bold('Dependency connections:'));
  for (const row of connections) {
    const symbols = row.symbols.length > 0 ? ` [${row.symbols.join(', ')}]` : '';
    const lineInfo = row.lines.length > 0 ? ` @${row.lines.join(',')}` : '';
    const bidi = row.bidirectional ? ' <->' : '';
    log.info(
      `${fmt.cyan(row.source)} -> ${fmt.cyan(row.target)} ` +
        `(${row.type})${bidi}${symbols}${lineInfo}`,
    );
  }

  log.blank();
  log.info(`${connections.length} connections listed`);
  return { exitCode: ExitCode.OK };
}
