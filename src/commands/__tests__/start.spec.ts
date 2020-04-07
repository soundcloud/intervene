jest.mock('../../promiseFs');
jest.mock('../../configLoader', () => {
  return {
    loadConfig: jest.fn().mockResolvedValue({
      target: 'https://foo.test'
    })
  };
});
jest.mock('../../createProxy', () => {
  return {
    createProxy: jest.fn().mockResolvedValue({
      start: jest.fn(),
      stop: jest.fn(),
      listener: {
        address: () => '127.0.0.1'
      }
    })
  };
});
import promiseFsMock, { PromisifiedFs } from '../../promiseFs';
jest.mock('fs', () => ({ watch: jest.fn() }));
import { handler } from '../start';
import { createProxy as createProxyMock } from '../../createProxy';
import * as unexpected from 'unexpected';
import { runCleanups, removeAllCleanups } from '../../cleanupQueue';

const promiseFs = (promiseFsMock as any) as jest.Mocked<PromisifiedFs>;
const createProxy = (createProxyMock as any) as jest.Mock<
  Promise<{ start: jest.Mock; stop: jest.Mock }>,
  []
>;

const expect = unexpected.clone();

describe('command-create', () => {
  beforeEach(() => {
    promiseFs.readFileAsync.mockReset();
    createProxy().then((v) => {
      v.start.mockReset();
      v.stop.mockReset();
    });
    createProxy.mockClear();
    removeAllCleanups();
  });

  it('calls the createProxy with the config', async () => {
    await handler({ configFilename: 'foo/bar.ts' });

    expect(createProxy.mock.calls, 'to satisfy', [
      [
        {
          target: 'https://foo.test',
          targetParsedUrl: { protocol: 'https:', hostname: 'foo.test' },
          localUrl: 'https://foo.test',
          localParsedUrl: { protocol: 'https:', hostname: 'foo.test' }
        }
      ]
    ]);
  });

  it('calls start on the returned proxy', async () => {
    await handler({ configFilename: 'foo/bar.ts' });
    const proxyMethods = await createProxy();
    expect(proxyMethods.start.mock.calls, 'to satisfy', [[]]);
  });

  it('calls stop when the cleanups are run', async () => {
    await handler({ configFilename: 'foo/bar.ts' });
    const proxyMethods = await createProxy();
    await runCleanups(false);
    expect(proxyMethods.stop.mock.calls, 'to satisfy', [[]]);
  });
});
