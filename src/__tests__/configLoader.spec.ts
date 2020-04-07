jest.mock('axios');
import axiosMock from 'axios';
import { loadConfig, replaceImport } from '../configLoader';
import * as path from 'path';
import * as sinon from 'sinon';
import * as unexpected from 'unexpected';

const expect = unexpected.clone();

const axios: jest.Mock = (axiosMock as unknown) as jest.Mock;

function getFixtureConfigName(name) {
  return path.join(__dirname, 'fixtures', name);
}

describe('configLoader', () => {
  beforeEach(() => {
    axios.mockClear();
  });

  describe('import replacement', () => {
    expect.addAssertion('<string> to be replaced with <string>', function(
      expect,
      subject,
      replacement
    ) {
      const result = replaceImport(
        'intervene-test',
        `import ${subject} from '../foo/bar'`
      );
      expect(result, 'to equal', `import ${replacement} from 'intervene-test'`);
    });

    it('replaces a single import of ProxyConfig', () => {
      expect('{ ProxyConfig }', 'to be replaced with', '{ ProxyConfig }');
    });

    it('replaces multiple imports', () => {
      expect(
        '{ routeBuilder, ProxyConfig }',
        'to be replaced with',
        '{ routeBuilder, ProxyConfig }'
      );
    });

    it('replaces multiple imports on multiple lines', () => {
      expect(
        `{ routeBuilder,
        ProxyConfig,
        RouteHandler }`,
        'to be replaced with',
        `{ routeBuilder,
        ProxyConfig,
        RouteHandler }`
      );
    });

    it('doesn`t replace an import without importing ProxyConfig', () => {
      expect(
        replaceImport(
          'intervene-test',
          `import { routeBuilder, log, RouteHandler } from '../foo/bar';`
        ),
        'to equal',
        `import { routeBuilder, log, RouteHandler } from '../foo/bar';`
      );
    });

    it('replaces an old v1 style import', () => {
      expect('ProxyConfig', 'to be replaced with', '{ ProxyConfig }');
    });

    it('replaces an old v1 style import with named imports', () => {
      expect(
        'ProxyConfig , { RouteHandler}',
        'to be replaced with',
        '{ ProxyConfig, RouteHandler }'
      );
    });

    it('replaces a full import', () => {
      // This combination broke in the wild.
      expect(
        `{
          ProxyConfig,
          routeBuilder,
          ProxyResponse,
          WrappedRequest,
          log
        }`,
        'to be replaced with',
        `{ ProxyConfig,
          routeBuilder,
          ProxyResponse,
          WrappedRequest,
          log }`
      );
    });
  });

  it('loads a simple config', async () => {
    const config = await loadConfig(getFixtureConfigName('simple.ts'));
    expect(config, 'to satisfy', { target: 'http://foo.test' });
  });

  it('loads a config importing a native module', async () => {
    const config = await loadConfig(getFixtureConfigName('import-native.ts'));
    expect(config, 'to satisfy', {
      routes: {
        '/foo': {
          joined: 'foo/bar'
        }
      }
    });
  });

  it('loads a remote config file', async () => {
    axios.mockResolvedValue({
      data: `const config = { target: 'http://foo.bar.test' }; export default config;`
    });
    const config = await loadConfig('http://localhost:9999/test.ts');
    expect(config, 'to satisfy', { target: 'http://foo.bar.test' });
  });

  it('allows requiring from a remote config file', async () => {
    axios.mockResolvedValue({
      data: `
      import * as path from 'path';
      const config = {
        target: 'http://foo.bar.test',
        routes: {
          '/foo': {
            joined: path.join('foo', 'bar')
          }
        }
      };
      export default config;`
    });
    const config = await loadConfig('http://localhost:9999/test.ts');
    expect(config, 'to satisfy', { routes: { '/foo': { joined: 'foo/bar' } } });
  });

  it('patches the path for importing the ProxyConfig', async () => {
    axios.mockResolvedValue({
      data: `import { ProxyConfig } from '/foo/bar/this/doesnt/matter/ProxyConfig';
      import * as path from 'path';
      const config: ProxyConfig = {
        target: 'http://foo.bar.test',
        routes: {
          '/foo': {
            joined: path.join('foo', 'bar')
          }
        }
      };
      export default config;`
    });
    const config = await loadConfig('http://localhost:9999/test.ts');
    expect(config, 'to satisfy', { routes: { '/foo': { joined: 'foo/bar' } } });
  });

  it('has process.env available', async () => {
    process.env.FOO = 'test123';
    const config = await loadConfig(getFixtureConfigName('with-env.ts'));
    expect(config, 'to satisfy', { routes: { '/foo': { env: 'test123' } } });
  });

  describe('with timeouts', () => {
    let fakeTimer;
    beforeEach(() => {
      fakeTimer = sinon.useFakeTimers();
    });

    afterEach(() => {
      fakeTimer.restore();
    });

    it('has setTimeout', async () => {
      const config = await loadConfig(
        getFixtureConfigName('with-settimeout.ts')
      );
      const response: any = (config.routes as any)['/timeout']();
      expect(response.isPending(), 'to be true');
      fakeTimer.tick(1000);
      expect(response.isPending(), 'to be false');
      expect(response.isResolved(), 'to be true');
    });
  });
});
