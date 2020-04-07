jest.mock('dns');
import * as dnsMock from 'dns';
import { getIPForHost, clearDnsCache } from '../dnsLookup';
import * as unexpected from 'unexpected';

const expect = unexpected.clone();
const resolve4: jest.Mock = (dnsMock.resolve4 as unknown) as jest.Mock;

describe('getIPForHost', () => {
  beforeEach(() => {
    clearDnsCache();
    resolve4.mockClear();
  });
  it('performs a real DNS lookup initially', async () => {
    resolve4.mockImplementation((name, options, callback) => {
      callback(null, [{ address: '10.11.12.13', ttl: 600 }]);
    });

    const result = await getIPForHost('foo.test');
    expect(result, 'to equal', ['10.11.12.13']);
  });

  it('returns the cached result for the second lookup', async () => {
    resolve4.mockImplementation((name, options, callback) => {
      callback(null, [{ address: '10.11.12.13', ttl: 600 }]);
    });

    const result1 = await getIPForHost('foo.test');
    resolve4.mockClear();

    const result2 = await getIPForHost('foo.test');
    expect(result2, 'to equal', ['10.11.12.13']);
    expect(resolve4.mock.calls, 'to satisfy', []);
  });

  it('does the lookup again when the cache has timed out', async () => {
    resolve4.mockImplementation((name, options, callback) => {
      callback(null, [{ address: '10.11.12.13', ttl: 1 }]);
    });

    await getIPForHost('foo.test');
    resolve4.mockReset();
    resolve4.mockImplementation((name, options, callback) => {
      callback(null, [{ address: '14.15.16.17', ttl: 1 }]);
    });
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const result2 = await getIPForHost('foo.test');
    expect(result2, 'to equal', ['14.15.16.17']);
  });
});
