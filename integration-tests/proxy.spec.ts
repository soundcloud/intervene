jest.dontMock('axios');
import axios from 'axios';
import * as Bluebird from 'bluebird';
import { spawn } from 'child_process';
import { Server } from '@hapi/hapi';
import * as http from 'http';
import * as path from 'path';
import { createServer } from './sampleServer';
import * as unexpected from 'unexpected';
import * as url from 'url';
import * as fs from 'fs';

const expect = unexpected.clone();

const copyFile = Bluebird.promisify<void, string, string>(fs.copyFile);

/** Localhost port numbers for each config */
const configPorts: { [config: string]: number } = {
  main: 5199,
  'temp.gen': 5199
};

let baseUrl = 'http://localhost';

interface ResponseInfo {
  rawResponse: Buffer;
  text: string;
  data?: any;
  headers: { [name: string]: string | string[] };
  statusCode: number;
  statusMessage?: string;
}

expect.addAssertion('<string> to provide response <object>', function(
  expect,
  path,
  expected
) {
  return expect({ method: 'GET', path }, 'to provide response', expected);
});

expect.addAssertion('<object> to provide response <object>', function(
  expect,
  request,
  expected
) {
  const parsedUrl = url.parse(baseUrl + request.path);
  return expect
    .promise((resolve, reject) => {
      const req = http.request(
        {
          method: request.method || 'GET',
          hostname: parsedUrl.hostname,
          port: parsedUrl.port || 80,
          path: parsedUrl.path,
          headers: request.headers
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk) => {
            if (typeof chunk === 'string') {
              chunks.push(Buffer.from(chunk, 'utf-8'));
            } else {
              chunks.push(chunk);
            }
          });

          res.on('error', (e) => {
            reject(e);
          });

          res.on('end', () => {
            const rawResponse = Buffer.concat(chunks);
            // Assuming UTF-8 for everything - we're not supporting everything here
            const text = rawResponse.toString('utf-8');
            // Ignore undefined headers
            const headers: {
              [name: string]: string | string[];
            } = res.headers as any;

            const isJson =
              headers['content-type'] &&
              typeof headers['content-type'] === 'string' &&
              (headers['content-type'] as string).split(';')[0] ===
                'application/json';
            let data = undefined;
            if (isJson) {
              try {
                data = JSON.parse(text);
              } catch {}
            }

            const responseInfo: ResponseInfo = {
              rawResponse,
              text,
              data,
              headers,
              statusCode: res.statusCode || 0,
              statusMessage: res.statusMessage || ''
            };

            resolve(responseInfo);
          });
        }
      );

      req.end();
    })
    .then((responseInfo) => {
      expect(responseInfo, 'to satisfy', expected);
    });
});

function getConfigPath(configName) {
  if (path.isAbsolute(configName)) {
    return configName;
  }
  return path.join(__dirname, 'configs', configName + '.ts');
}
function poll(localPort: number) {
  return axios.get('http://localhost:' + localPort + '/-/health');
}

function startProxy(
  configName: string,
  ...args: string[]
): Promise<() => Promise<void>> {
  const proxyProcess = spawn(
    process.argv[0],
    ['dist/src/cli.js', 'start', getConfigPath(configName), ...args],
    { cwd: process.cwd() }
  );
  if (process.env.DEBUG_PROXY) {
    proxyProcess.stdout.on('data', (chunk) => {
      console.log('[PROXY:stdout]', chunk.toString());
    });
    proxyProcess.stderr.on('data', (chunk) => {
      console.log('[PROXY:stderr]', chunk.toString());
    });
  }
  baseUrl = `http://localhost:${configPorts[configName]}`;
  const shutdownProxy: () => Promise<void> = () =>
    new Promise((resolve, reject) => {
      proxyProcess.on('close', () => {
        // Wait 1s for the process to properly tidy itself up after finishing
        // This shouldn't be necessary, but it seems that we get the 'close' event before everything is properly cleaned up
        setTimeout(resolve, 1000);
      });
      proxyProcess.kill('SIGINT');
    });
  return new Promise((resolve, reject) => {
    function checkIfStarted() {
      poll(configPorts[configName])
        .then(() => resolve(shutdownProxy))
        .catch(() => {
          setTimeout(checkIfStarted, 100);
        });
    }
    checkIfStarted();
  });
}

describe('intervene proxy', () => {
  let server: Server;
  beforeAll(() => {
    server = createServer();
    return server.start();
  });

  afterAll(() => server.stop());

  describe('with simple config', () => {
    let killProxy;
    beforeAll(() => {
      axios.defaults.baseURL = 'http://localhost:5199';
      return startProxy('main').then((shutdown) => (killProxy = shutdown));
    });

    afterAll(() => killProxy());

    it('proxies a simple json call', async () => {
      return expect('/json', 'to provide response', {
        data: { static: 'json' }
      });
    });

    it('returns with a static response direct from proxy', async () => {
      return expect('/proxy/static', 'to provide response', {
        statusCode: 200,
        data: { fixed: true, jsonResponse: true },
        headers: { 'content-type': 'application/json; charset=utf-8' }
      });
    });

    it('returns with a static text response direct from proxy', async () => {
      return expect('/fixedresponse', 'to provide response', {
        statusCode: 200,
        text: 'plain text response',
        headers: { 'content-type': 'text/html; charset=utf-8' }
      });
    });

    it('proxies a JSON string response', async () => {
      return expect('/jsonstring', 'to provide response', {
        statusCode: 200,
        text: '"OK"',
        headers: {
          'content-type': 'application/json; charset=utf-8'
        }
      });
    });

    it('modifies a JSON string response', async () => {
      return expect('/change/jsonstring', 'to provide response', {
        statusCode: 200,
        text: '"changed"',
        data: 'changed',
        headers: {
          'content-type': 'application/json; charset=utf-8'
        }
      });
    });
    it('allows adding a request header', async () => {
      return expect('/add/requestheader', 'to provide response', {
        statusCode: 200,
        data: { testHeader: 'added' }
      });
    });

    it('allows patching the URL before proxying', async () => {
      return expect('/mapped/url', 'to provide response', {
        data: { location: 'new' }
      });
    });

    it('allows patching the querystring before proxying', async () => {
      return expect('/mapped/query?foo=bar', 'to provide response', {
        data: { query: { foo: 'changed' } }
      });
    });

    it('allows adding an extra response header', async () => {
      return expect('/add/responseheader', 'to provide response', {
        headers: {
          'x-added-test': 'response-header'
        }
      });
    });

    it('replies for OPTIONS requests', async () => {
      return expect(
        {
          method: 'OPTIONS',
          path: '/json',
          headers: {
            origin: 'http://example.com',
            'access-control-request-method': 'POST'
          }
        },
        'to provide response',
        {
          headers: {
            'access-control-allow-headers':
              'Accept,Authorization,Content-Type,If-None-Match',
            'access-control-allow-methods': 'POST',
            'access-control-allow-origin': 'http://example.com',
            'access-control-expose-headers':
              'WWW-Authenticate,Server-Authorization',
            'access-control-allow-credentials': 'true',
            'access-control-max-age': '60'
          }
        }
      );
    });

    it('replies with the passed origin for OPTIONS requests', async () => {
      return expect(
        {
          method: 'OPTIONS',
          path: '/json',
          headers: {
            origin: 'http://foo.invalid:5000',
            'access-control-request-method': 'POST'
          }
        },
        'to provide response',
        {
          headers: {
            'access-control-allow-origin': 'http://foo.invalid:5000',
            'access-control-allow-credentials': 'true'
          }
        }
      );
    });

    it('replies for OPTIONS for static intercepted responses', async () => {
      return expect(
        {
          method: 'OPTIONS',
          path: '/proxy/static',
          headers: {
            origin: 'http://example.com',
            'access-control-request-method': 'POST'
          }
        },
        'to provide response',
        {
          headers: {
            'access-control-allow-headers':
              'Accept,Authorization,Content-Type,If-None-Match',
            'access-control-allow-methods': 'POST',
            'access-control-allow-origin': 'http://example.com',
            'access-control-expose-headers':
              'WWW-Authenticate,Server-Authorization',
            'access-control-allow-credentials': 'true',
            'access-control-max-age': '60'
          }
        }
      );
    });
  });

  describe('updating configs', () => {
    it('reloads the config after an update', () => {
      const tmpPath = path.join(__dirname, 'configs', 'temp.gen.ts');
      let shutdownProxy: () => Promise<void>;
      return copyFile(path.join(__dirname, 'configs', 'simple1.ts'), tmpPath)
        .then(() => startProxy('temp.gen'))
        .then((shutdown) => {
          shutdownProxy = shutdown;
          return expect('/foo', 'to provide response', { data: { bar: true } });
        })
        .then(() => {
          return expect('/bar', 'to provide response', {
            statusCode: 404
          });
        })
        .then(() =>
          copyFile(path.join(__dirname, 'configs', 'simple2.ts'), tmpPath)
        )
        .then(() => {
          // the wait time is long to (sadly) improve the reliability on shared CI infrastructure
          return new Promise((resolve, reject) => setTimeout(resolve, 8000));
        })
        .then(() => {
          return expect('/foo', 'to provide response', {
            data: { newConfig: true }
          });
        })
        .then(() => {
          return expect('/bar', 'to provide response', {
            statusCode: 200,
            data: { newRoute: true }
          });
        })
        .then(
          () => {
            return shutdownProxy();
          },
          (e) => {
            return shutdownProxy().then(() => {
              throw e;
            });
          }
        );
    });

    it('reloads the config after multiple updates', () => {
      const tmpPath = path.join(__dirname, 'configs', 'temp.gen.ts');
      let shutdownProxy: () => Promise<void>;
      return copyFile(path.join(__dirname, 'configs', 'simple1.ts'), tmpPath)
        .then(() => startProxy('temp.gen'))
        .then((shutdown) => {
          shutdownProxy = shutdown;
          return expect('/foo', 'to provide response', {
            data: { bar: true }
          });
        })
        .then(() => {
          return expect('/bar', 'to provide response', {
            statusCode: 404
          });
        })
        .then(() => {
          return copyFile(
            path.join(__dirname, 'configs', 'simple2.ts'),
            tmpPath
          );
        })
        .then(() => {
          return new Promise((resolve, reject) => setTimeout(resolve, 8000));
        })
        .then(() => {
          return expect('/foo', 'to provide response', {
            data: { newConfig: true }
          });
        })
        .then(() => {
          return expect('/bar', 'to provide response', {
            statusCode: 200,
            data: { newRoute: true }
          });
        })
        .then(() => {
          // Go back to initial config
          return copyFile(
            path.join(__dirname, 'configs', 'simple1.ts'),
            tmpPath
          );
        })
        .then(() => {
          return new Promise((resolve, reject) => setTimeout(resolve, 8000));
        })
        .then(() => {
          return expect('/foo', 'to provide response', {
            data: { bar: true }
          });
        })
        .then(
          () => {
            return shutdownProxy();
          },
          (e) => {
            return shutdownProxy().then(() => {
              throw e;
            });
          }
        );
    });
  });
});
