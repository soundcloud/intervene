jest.mock('../adminRequests');
jest.mock('../getCertPath');
jest.mock('../getProxyResponse');
jest.mock('../cleanupQueue');
jest.mock('get-port', function() {
  return { default: jest.fn().mockReturnValue(50001) };
});
jest.mock('../getCertForHost', function() {
  return {
    preloadCertForHost: jest.fn()
  };
});
jest.mock('../logger', function() {
  const logger: any = {
    log: jest.fn()
  };
  logger.log.debug = jest.fn();
  logger.log.info = jest.fn();
  logger.log.warn = jest.fn();
  logger.log.error = jest.fn();
  return logger;
});
import {
  applyConfigDefaults,
  ProxyConfigWithDefaults
} from '../applyConfigDefaults';
import { createProxy } from '../createProxy';
import * as unexpected from 'unexpected';
import { ProxyConfig, WrappedRequest, ProxyResponse } from '../ProxyConfig';
import { getProxyResponse as getProxyResponseMock } from '../getProxyResponse';
import * as adminRequestsMock from '../adminRequests';
import * as cloneDeep from 'lodash/cloneDeep';
import { registerCleanup as registerCleanupMock } from '../cleanupQueue';
import { log as logMock } from '../logger';

interface AdminRequests {
  addHostEntry: (certFilename: string) => Promise<any>;
  removeHostEntry: (certFilename: string) => Promise<any>;
  portProxy: (target: string, localPort: number) => Promise<any>;
}

const adminRequests = (adminRequestsMock as any) as jest.Mocked<AdminRequests>;
const registerCleanup = (registerCleanupMock as any) as jest.Mock;

// Can't find a way to type this properly (mock of a function with function properties that are also mocked)
const log: any = logMock;

const expect = unexpected.clone();
const getProxyResponse = getProxyResponseMock as jest.Mock;

const defaultProxyConfig: ProxyConfig = {
  target: 'http://foo:8000',
  targetHeaders: {
    'X-override-header': 'foo'
  },
  routes: {
    '/bar': { proxyDirect: true },
    'POST /bar': { postMessage: true },
    '/func': (req, h, proxy) => {
      const res = h.response({ func: true });
      res.header('x-foo', 'bar');
      return res;
    },
    '/proxy/direct': (req, h, proxy) => {
      return proxy();
    },
    '/proxy/urledit': (req, h, proxy) => {
      req.url.pathname = '/url-is-changed';
      return proxy();
    },
    '/proxy/reqheader': (req, h, proxy) => {
      req.headers['x-foo'] = 'added';
      return proxy();
    },
    '/proxy/resheader': async (req, h, proxy) => {
      const res = await proxy();
      res.headers['x-response-foo'] = 'added';
      return res;
    },
    'POST /proxy/editpost': async (req, h, proxy) => {
      req.payload.altered = true;
      return await proxy();
    },
    '/proxy/editoverride': (req, h, proxy) => {
      req.overrideHeaders['x-override-header'] = 'bar';
      return proxy();
    },
    '/proxy/edittarget': (req, h, proxy) => {
      req.url.host = 'changed.test';
      return proxy();
    },

    '/proxy/url/{urlparam}': (req, h, proxy) => {
      return {
        param: req.params.urlparam
      };
    },
    'POST /proxy/error': (req, h, proxy) => {
      throw new Error('some handler error');
    },

    'POST /proxy/reject': (req, h, proxy) => {
      return new Promise((resolve, reject) => {
        reject(new Error('some handler rejected promise'));
      });
    }
  }
};

let proxyConfig: ProxyConfig;

function makeConfig(proxyConfig: ProxyConfig): ProxyConfigWithDefaults {
  return applyConfigDefaults(proxyConfig, '/tmp');
}

expect.addAssertion('<object> to provide response <object>', function(
  expect,
  request,
  expected
) {
  if (!proxyConfig) {
    throw new Error('No config setup');
  }
  return createProxy(makeConfig(proxyConfig))
    .then((proxy) => {
      return proxy.inject(request);
    })
    .then((res) => {
      let json: any;
      try {
        json = JSON.parse(res.payload);
      } catch {
        json = undefined;
      }
      const wrappedResponse = {
        statusCode: res.statusCode,
        statusMessage: res.statusMessage,
        json: json,
        payload: res.payload,
        rawPayload: res.rawPayload,
        headers: res.headers
      };
      expect(wrappedResponse, 'to satisfy', expected);
    });
});

expect.addAssertion('<object> to provide result <any>', function(
  expect,
  request,
  expected
) {
  return expect(request, 'to provide response', { json: expected });
});

describe('createProxy', () => {
  beforeEach(() => {
    proxyConfig = cloneDeep(defaultProxyConfig);
    adminRequests.addHostEntry.mockClear();
    adminRequests.removeHostEntry.mockClear();
    adminRequests.portProxy.mockClear();
    registerCleanup.mockClear();
    log.mockClear();
    log.debug.mockClear();
    log.info.mockClear();
    log.warn.mockClear();
    log.error.mockClear();
  });

  it('replies to a plain JSON response', () => {
    return expect({ method: 'GET', url: '/bar' }, 'to provide result', {
      proxyDirect: true
    });
  });

  it('proxies a plain JSON response', () => {
    return expect(
      { method: 'GET', url: '/proxythrough' },
      'to provide result',
      { json: true, mocked: true }
    );
  });

  it('responds to a POST', () => {
    return expect({ method: 'POST', url: '/bar' }, 'to provide result', {
      postMessage: true
    });
  });

  it('uses a function route without calling proxy', () => {
    getProxyResponse.mockClear();
    return expect({ method: 'GET', url: '/func' }, 'to provide response', {
      headers: { 'x-foo': 'bar' },
      json: { func: true }
    }).then(() => {
      expect(getProxyResponse.mock.calls.length, 'to be', 0);
    });
  });

  it('can override the default route for all methods', () => {
    if (!proxyConfig.routes) {
      throw new Error(
        'routes not set - will never happen but keeps typescript happy for the test'
      );
    }
    proxyConfig.routes['* /{path*}'] = async (req, h, proxy) => {
      const res = await proxy();
      res.headers['x-additional'] = 'foo';
      return res;
    };

    return expect(
      { method: 'PUT', url: '/some/random/url' },
      'to provide response',
      {
        headers: { 'x-additional': 'foo' }
      }
    );
  });

  it('doesn`t add host for localhost', () => {
    proxyConfig.localUrl = 'http://localhost:5000';
    return expect({ method: 'GET', url: '/bar' }, 'to provide result', {
      proxyDirect: true
    }).then(() => {
      expect(adminRequests.addHostEntry.mock.calls, 'to have length', 0);
    });
  });

  it('registers a shutdown function to call', () => {
    const shutdownHandler = () => {};
    proxyConfig.onShutdown = shutdownHandler;
    return expect({ method: 'GET', url: '/bar' }, 'to provide result', {
      proxyDirect: true
    }).then(() => {
      // Expect that the last registered cleanup is the shutdownHandler
      expect(
        registerCleanup.mock.calls[registerCleanup.mock.calls.length - 1],
        'to satisfy',
        [shutdownHandler]
      );
    });
  });

  it('starts a port proxy when using a privileged port', () => {
    proxyConfig.target = 'http://foo';
    adminRequests.portProxy.mockResolvedValue({ data: { success: true } });
    return createProxy(makeConfig(proxyConfig)).then((proxy) => {
      expect(adminRequests.portProxy.mock.calls, 'to satisfy', [
        [
          'http://foo/',
          50001,
          '/home/user/.dev-ssl-certs',
          { credentials: true, maxAge: 60 }
        ]
      ]);
    });
  });

  it('listens on the free port when using originally using a privileged port', () => {
    proxyConfig.target = 'http://foo';
    adminRequests.portProxy.mockResolvedValue({ data: { success: true } });
    return createProxy(makeConfig(proxyConfig)).then((proxy) => {
      expect(proxy.settings.port, 'to equal', 50001);
    });
  });

  it('starts a TLS port proxy when using a privileged port', () => {
    proxyConfig.target = 'https://foo';
    adminRequests.portProxy.mockResolvedValue({ data: { success: true } });

    return createProxy(makeConfig(proxyConfig)).then((proxy) => {
      expect(adminRequests.portProxy.mock.calls, 'to satisfy', [
        [
          'https://foo/',
          50001,
          '/home/user/.dev-ssl-certs',
          { credentials: true, maxAge: 60 }
        ]
      ]);
    });
  });

  it('listens on the free port when using originally using a privileged port', () => {
    proxyConfig.target = 'http://foo';
    adminRequests.portProxy.mockResolvedValue({ data: { success: true } });
    return createProxy(makeConfig(proxyConfig)).then((proxy) => {
      expect(proxy.settings.port, 'to equal', 50001);
    });
  });

  it('fails and throws an error if the privileged port proxying fails', () => {
    proxyConfig.target = 'http://foo';
    adminRequests.portProxy.mockResolvedValue({
      data: { success: false, code: 'EADDRINUSE' }
    });
    return expect(
      createProxy(makeConfig(proxyConfig)),
      'to be rejected with',
      /Error starting admin server/
    );
  });

  it('fails CORS requests without Origin and Access-Control-Request-Method headers', () => {
    return expect(
      {
        method: 'OPTIONS',
        url: '/foo',
        headers: {}
      },
      'to provide response',
      {
        statusCode: 404,
        json: {
          message: 'CORS error: Missing Access-Control-Request-Method header'
        }
      }
    );
  });

  it('responds with CORS headers when Origin and Access-Control-Request-Method headers are set', () => {
    return expect(
      {
        method: 'OPTIONS',
        url: '/foo',
        headers: {
          Origin: 'https://example.com',
          'Access-Control-Request-Method': 'POST'
        }
      },
      'to provide response',
      {
        statusCode: 200,
        headers: {
          'access-control-allow-origin': 'https://example.com',
          'access-control-allow-methods': 'POST',
          'access-control-allow-headers':
            'Accept,Authorization,Content-Type,If-None-Match',
          'access-control-expose-headers':
            'WWW-Authenticate,Server-Authorization',
          'access-control-max-age': 60,
          'access-control-allow-credentials': 'true'
        }
      }
    );
  });

  it('responds with CORS headers when config has a catch-all-route', () => {
    // @ts-ignore
    proxyConfig.routes['* /{path*}'] = 'hello';

    return expect(
      {
        method: 'OPTIONS',
        url: '/foo',
        headers: {
          origin: 'http://example.com',
          'access-control-request-method': 'POST'
        }
      },
      'to provide response',
      {
        headers: {
          'access-control-allow-origin': 'http://example.com',
          'access-control-allow-methods': 'POST',
          'access-control-allow-headers':
            'Accept,Authorization,Content-Type,If-None-Match',
          'access-control-expose-headers':
            'WWW-Authenticate,Server-Authorization',
          'access-control-max-age': 60,
          'access-control-allow-credentials': 'true'
        }
      }
    );
  });

  it('can override the default CORS handling', () => {
    proxyConfig.cors = {
      origin: ['http://some.origin'],
      additionalHeaders: ['X-Foo-Bar', 'X-Additional-Header'],
      additionalExposedHeaders: ['Some-Exposed-Header'],
      maxAge: 1234,
      credentials: true
    };

    return expect(
      {
        method: 'OPTIONS',
        url: '/foo',
        headers: {
          origin: 'http://some.origin',
          'access-control-request-method': 'PUT',
          'access-control-request-headers': 'X-Foo-Bar, X-Additional-Header'
        }
      },
      'to provide response',
      {
        headers: {
          'access-control-allow-origin': 'http://some.origin',
          'access-control-allow-methods': 'PUT',
          'access-control-allow-headers':
            'Accept,Authorization,Content-Type,If-None-Match,X-Foo-Bar,X-Additional-Header',
          'access-control-expose-headers':
            'WWW-Authenticate,Server-Authorization,Some-Exposed-Header',
          'access-control-max-age': 1234,
          'access-control-allow-credentials': 'true'
        }
      }
    );
  });

  describe('proxy functions', () => {
    beforeEach(() => getProxyResponse.mockClear());

    it('calls the proxy and responds', () => {
      return expect(
        { method: 'GET', url: '/proxy/direct' },
        'to provide result',
        {
          json: true,
          mocked: true
        }
      );
    });

    it('can edit the URL before proxying', () => {
      return expect(
        { method: 'GET', url: '/proxy/urledit' },
        'to provide result',
        {
          json: true,
          mocked: true
        }
      ).then(() => {
        expect(getProxyResponse.mock.calls[0], 'to satisfy', [
          {},
          { url: { pathname: '/url-is-changed' } }
        ]);
      });
    });

    it('can edit request headers before proxying', () => {
      return expect(
        { method: 'GET', url: '/proxy/reqheader' },
        'to provide result',
        {
          json: true,
          mocked: true
        }
      ).then(() => {
        expect(getProxyResponse.mock.calls[0], 'to satisfy', [
          {},
          { headers: { 'x-foo': 'added' } }
        ]);
      });
    });

    it('can edit response headers after proxying', () => {
      return expect(
        { method: 'GET', url: '/proxy/resheader' },
        'to provide response',
        {
          headers: { 'x-response-foo': 'added' }
        }
      );
    });

    it('can edit POST payload before proxying', () => {
      return expect(
        {
          method: 'POST',
          url: '/proxy/editpost',
          payload: { stuff: 'foo', altered: false }
        },
        'to provide result',
        {
          json: true,
          mocked: true
        }
      ).then(() => {
        expect(getProxyResponse.mock.calls, 'to satisfy', [
          [{}, { payload: { altered: true } }]
        ]);
      });
    });

    it('can edit the override headers before proxying a request', () => {
      return expect(
        {
          method: 'GET',
          url: '/proxy/editoverride'
        },
        'to provide result',
        {
          json: true,
          mocked: true
        }
      ).then(() => {
        expect(getProxyResponse.mock.calls, 'to satisfy', [
          [
            {},
            {
              overrideHeaders: expect.it('to equal', {
                'x-override-header': 'bar'
              })
            }
          ]
        ]);
      });
    });

    it('can edit the host', () => {
      return expect(
        {
          method: 'GET',
          url: '/proxy/edittarget'
        },
        'to provide result',
        {
          json: true,
          mocked: true
        }
      ).then(() => {
        expect(getProxyResponse.mock.calls, 'to satisfy', [
          [
            {},
            {
              url: { host: 'changed.test', pathname: '/proxy/edittarget' }
            }
          ]
        ]);
      });
    });

    it('can access URL parameters', () => {
      return expect(
        { method: 'GET', url: '/proxy/url/foo' },
        'to provide result',
        { param: 'foo' }
      );
    });

    it('returns a 500 and logs if an error is thrown in the handler', () => {
      (log.error as any).mockReset();
      return expect(
        { method: 'POST', url: '/proxy/error' },
        'to provide response',
        {
          statusCode: 500,
          json: {
            statusCode: 500,
            message:
              'Error in intervene handler function for route POST /proxy/error',
            error: 'Error: some handler error'
          }
        }
      ).then(() => {
        expect((log.error as any).mock.calls, 'to satisfy', [
          [
            'Error in handler for route POST /proxy/error: Error: some handler error',
            expect.it('to have message', /some handler error/)
          ]
        ]);
      });
    });

    it('returns a 500 and logs if a handler returns a rejected promise', () => {
      (log.error as any).mockReset();
      return expect(
        { method: 'POST', url: '/proxy/reject' },
        'to provide response',
        {
          statusCode: 500,
          json: {
            statusCode: 500,
            message:
              'Error in intervene handler function for route POST /proxy/reject',
            error: 'Error: some handler rejected promise'
          }
        }
      ).then(() => {
        expect((log.error as any).mock.calls, 'to satisfy', [
          [
            'Error in handler for route POST /proxy/reject: Error: some handler rejected promise',
            expect.it('to have message', /some handler rejected promise/)
          ]
        ]);
      });
    });

    it('returns a 500 if the proxy call rejects', () => {
      const e: any = new Error('connect ECONNREFUSED 10.10.10.10:55555');
      e.code = 'ECONNREFUSED';
      getProxyResponse.mockRejectedValue(e);
      return expect(
        { method: 'GET', url: '/proxy/direct' },
        'to provide response',
        {
          statusCode: 500,
          json: {
            message: 'Proxy call to target failed for route GET /proxy/direct',
            error: 'Error: connect ECONNREFUSED 10.10.10.10:55555'
          }
        }
      ).then(() => {
        expect((log.error as any).mock.calls, 'to satisfy', [
          [
            'Proxy call to target failed for route GET /proxy/direct: Error: connect ECONNREFUSED 10.10.10.10:55555',
            expect.it(
              'to have message',
              'connect ECONNREFUSED 10.10.10.10:55555'
            )
          ]
        ]);
      });
    });

    it('returns a 500 if the catch-all route proxy call rejects', () => {
      const e: any = new Error('connect ECONNREFUSED 10.10.10.10:55555');
      e.code = 'ECONNREFUSED';
      getProxyResponse.mockRejectedValue(e);
      return expect(
        { method: 'GET', url: '/passthrough/to/catchall' },
        'to provide response',
        {
          statusCode: 500,
          json: {
            message: 'Proxy call to target failed in catch-all route',
            error: 'Error: connect ECONNREFUSED 10.10.10.10:55555'
          }
        }
      ).then(() => {
        expect((log.error as any).mock.calls, 'to satisfy', [
          [
            'Proxy call to target failed in catch-all route: Error: connect ECONNREFUSED 10.10.10.10:55555',
            expect.it(
              'to have message',
              'connect ECONNREFUSED 10.10.10.10:55555'
            )
          ]
        ]);
      });
    });
  });
});
