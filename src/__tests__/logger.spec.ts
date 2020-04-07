import {
  log,
  useLogger,
  LogEvent,
  Logger,
  clearLoggers,
  expandTags
} from '../logger';
import * as unexpected from 'unexpected';

const expect = unexpected.clone();

interface TestLogger extends Logger {
  log: jest.Mock;
}

describe('logger', () => {
  let logger: TestLogger;
  let logger2: TestLogger;

  beforeEach(() => {
    clearLoggers();
    logger = {
      name: 'test',
      log: jest.fn()
    };
    logger2 = {
      name: 'test2',
      log: jest.fn()
    };
  });

  it('logs a single `info` tag logger', () => {
    const event: LogEvent = {
      tags: ['info'],
      message: 'foo'
    };
    useLogger(logger, ['info']);
    log(event);
    expect(logger.log.mock.calls, 'to satisfy', [
      [{ message: 'foo', tags: { info: true } }]
    ]);
  });

  it('only logs to the registered logger', () => {
    const event: LogEvent = {
      tags: ['info'],
      message: 'foo'
    };
    useLogger(logger, ['info']);
    useLogger(logger2, ['error']);
    log(event);
    expect(logger.log.mock.calls, 'to satisfy', [
      [{ message: 'foo', tags: { info: true } }]
    ]);
    expect(logger2.log.mock.calls, 'to satisfy', []);
  });

  it('does not log twice when two tags are included', () => {
    const event: LogEvent = {
      tags: ['info', 'app'],
      message: 'foo'
    };
    useLogger(logger, ['app', 'info']);
    log(event);
    expect(logger.log.mock.calls, 'to satisfy', [
      [{ message: 'foo', tags: { info: true, app: true } }]
    ]);
  });

  it('ignores events when no logger is present for the tag', () => {
    const event: LogEvent = {
      tags: ['info', 'app'],
      message: 'foo'
    };
    useLogger(logger, ['error', 'internal']);
    log(event);
    expect(logger.log.mock.calls, 'to satisfy', []);
  });

  it('logs a log-error when a logger throws', () => {
    logger.log.mockImplementation(() => {
      throw new Error('unit test log error');
    });
    useLogger(logger, ['app', 'info', 'error']);
    useLogger(logger2, ['info', 'error']);
    log({ tags: ['info'], message: 'initial message' });
    expect(logger.log.mock.calls, 'to satisfy', [
      [{ message: 'initial message' }],
      [{ tags: { internal: true, 'log-error': true, error: true } }]
    ]);
    expect(logger2.log.mock.calls, 'to satisfy', [
      [
        {
          tags: { internal: true, 'log-error': true, error: true },
          message: /Error logging to test:/
        }
      ],
      [{ message: 'initial message' }]
    ]);
  });

  describe('helper methods', () => {
    beforeEach(() => {
      useLogger(logger, ['debug', 'warn', 'info', 'error']);
    });
    it('has log.debug', () => {
      log.debug('test debug');
      expect(logger.log.mock.calls, 'to satisfy', [
        [{ tags: { app: true, debug: true }, message: 'test debug' }]
      ]);
    });

    it('has log.info', () => {
      log.info('test info');
      expect(logger.log.mock.calls, 'to satisfy', [
        [{ tags: { app: true, info: true }, message: 'test info' }]
      ]);
    });

    it('has log.warn', () => {
      log.warn('test warn');
      expect(logger.log.mock.calls, 'to satisfy', [
        [{ tags: { app: true, warn: true }, message: 'test warn' }]
      ]);
    });

    it('has log.error', () => {
      log.error('test error');
      expect(logger.log.mock.calls, 'to satisfy', [
        [{ tags: { app: true, error: true }, message: 'test error' }]
      ]);
    });
  });

  describe('inheriting tags', () => {
    it('debug inherits info, warn, error', () => {
      const tags = expandTags(['debug']);
      expect(tags, 'to satisfy', ['debug', 'info', 'warn', 'error']);
    });

    it('info inherits warn, error', () => {
      const tags = expandTags(['info']);
      expect(tags, 'to satisfy', ['info', 'warn', 'error']);
    });

    it('warn inherits error', () => {
      const tags = expandTags(['warn']);
      expect(tags, 'to satisfy', ['warn', 'error']);
    });
  });
});
