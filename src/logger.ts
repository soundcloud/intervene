import * as events from 'events';

const allEvents = new events.EventEmitter();

export interface Logger {
  name: string;
  log(message: LogMessage);
}

export interface LogEvent {
  tags: string[];
  code?: string;
  message?: string;
  data?: any;
}

export interface LogMessage {
  tags: {
    [tag: string]: boolean;
  };
  code?: string;
  message?: string;
  data?: any;
}

interface LoggerCollection {
  [tag: string]: Logger[];
}

const tagInheritence = {
  debug: ['info', 'warn', 'error'],
  info: ['warn', 'error'],
  warn: ['error']
};

const loggers: LoggerCollection = {};

export function expandTags(tags: string[]) {
  return tags
    .map((t) => (tagInheritence[t] ? [t].concat(tagInheritence[t]) : [t]))
    .reduce((a, t) => a.concat(t), []);
}

export function useLogger(logger: Logger, filterTags: string[]) {
  filterTags.forEach((tag) => {
    const tagLoggers = (loggers[tag] = loggers[tag] || []);
    tagLoggers.push(logger);
  });
}

/**
 * Only used for testing - removes all configured loggers
 */
export function clearLoggers() {
  Object.keys(loggers).forEach((tag) => {
    delete loggers[tag];
  });
}

type RawLogFunction = (event: LogEvent) => void;

interface LogFunction extends RawLogFunction {
  debug: (message: string, data?: any) => void;
  info: (message: string, data?: any) => void;
  warn: (message: string, data?: any) => void;
  error: (message: string, data?: any) => void;
}

const rawLog: RawLogFunction = function log(event: LogEvent): void {
  const tagLoggers: Set<Logger> = new Set(
    Array.prototype.concat
      .apply([], event.tags.map((tag) => loggers[tag]))
      .filter((l) => l)
  );

  const logMessage: LogMessage = {
    ...event,
    tags: event.tags.reduce((a, t) => {
      a[t] = true;
      return a;
    }, {})
  };
  tagLoggers.forEach((logger) => {
    try {
      logger.log(logMessage);
    } catch (e) {
      if (event.tags.indexOf('log-error') === -1) {
        log({
          tags: ['internal', 'log-error', 'error'],
          message: `Error logging to ${logger.name}: ${e}`,
          data: e
        });
      }
    }
  });
};

export const log: LogFunction = Object.assign(rawLog, {
  debug: (message: string, data?: any) =>
    log({ tags: ['app', 'debug'], message, data }),
  info: (message: string, data?: any) =>
    log({ tags: ['app', 'info'], message, data }),
  warn: (message: string, data?: any) =>
    log({ tags: ['app', 'warn'], message, data }),
  error: (message: string, data?: any) =>
    log({ tags: ['app', 'error'], message, data })
});
