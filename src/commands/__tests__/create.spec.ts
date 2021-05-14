jest.mock('../../promiseFs');
jest.mock('../start', () => {
  return {
    handler: jest.fn().mockResolvedValue({})
  };
});
jest.mock('path', () => {
  return {
    resolve: (dirname, ...dirs) => 'DIRNAME/' + dirs.join('/'),
    join: (...dirs) => dirs.join('/')
  };
});
import { handler } from '../create';
import * as startMock from '../start';
import promiseFsMock, { PromisifiedFs } from '../../promiseFs';

import * as unexpected from 'unexpected';

const promiseFs = (promiseFsMock as any) as jest.Mocked<PromisifiedFs>;
const start = (startMock as any) as jest.Mocked<{
  handler: (options: any) => Promise<void>;
}>;

const expect = unexpected.clone();

describe('command-create', () => {
  beforeEach(() => {
    promiseFs.readFileAsync.mockReset();
    promiseFs.writeFileAsync.mockReset();
    promiseFs.accessAsync.mockReset();
    promiseFs.readFileAsync.mockResolvedValue(
      Buffer.from('test file contents\nTarget is $$TARGET$$', 'utf-8')
    );
    promiseFs.accessAsync.mockRejectedValue({});
    promiseFs.writeFileAsync.mockResolvedValue({} as any);
    start.handler.mockClear();
  });

  it('calls the start with the config file named after the target', async () => {
    await handler({ target: 'https://foo.test' });

    expect(start.handler.mock.calls, 'to satisfy', [
      [{ configFilename: 'DIRNAME/foo.test.ts' }]
    ]);
  });

  it('creates a config file with the contents of the sample and target replaced', async () => {
    await handler({ target: 'https://foo.test' });
    expect(promiseFs.writeFileAsync.mock.calls, 'to satisfy', [
      [
        'DIRNAME/foo.test.ts',
        expect.it(
          'when decoded as',
          'utf-8',
          'to equal',
          `import { ProxyConfig, routeBuilder } from 'DIRNAME/..';\n\ntest file contents\nTarget is https://foo.test`
        )
      ]
    ]);
  });

  it('names the file with a -<n> suffix if the file exists', async () => {
    let callCount = 0;
    promiseFs.accessAsync.mockImplementation(() => {
      callCount++;
      if (callCount >= 3) {
        return Promise.reject(new Error('not exists'));
      }
      return Promise.resolve();
    });
    await handler({ target: 'https://foo.test' });
    expect(start.handler.mock.calls, 'to satisfy', [
      [{ configFilename: 'DIRNAME/foo.test-2.ts' }]
    ]);
  });
});
