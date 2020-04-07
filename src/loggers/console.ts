import chalk from 'chalk';
import { Logger, LogMessage } from '../logger';

const colorMap = {
  ERROR: 'red',
  WARN: 'yellow',
  INFO: 'white',
  DEBUG: 'gray'
};

const consoleLog: Logger = {
  name: 'console',
  log(event: LogMessage) {
    const level = (
      ['error', 'warn', 'info', 'debug'].find((l) => event.tags[l]) || 'UNKNOWN'
    ).toUpperCase();
    console.log(
      chalk[colorMap[level] || 'white'](
        `${new Date().toISOString()} [${level}] ${event.message}`
      )
    );
  }
};

export default consoleLog;
