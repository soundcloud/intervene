jest.dontMock('node-forge');
import { httpRequest } from '../src/httpRequest';
import createCertificate from '../src/createCert';
import { Server, ServerRoute } from '@hapi/hapi';
import * as unexpected from 'unexpected';

import getPort from 'get-port';
const HOUR_IN_MS = 1000 * 60 * 60;

const expect = unexpected.clone();

describe('httpRequest', () => {
  let dummyHttpServerPort: number;
  let dummyHttpsServerPort: number;
  let dummyHttpServer: Server;
  let dummyHttpsServer: Server;

  beforeAll(async () => {
    const cert = await createCertificate({
      notBefore: new Date(Date.now() - HOUR_IN_MS),
      notAfter: new Date(Date.now() + HOUR_IN_MS),
      CN: 'localhost'
    });
    dummyHttpServerPort = await getPort();
    dummyHttpsServerPort = await getPort();

    dummyHttpServer = new Server({
      port: dummyHttpServerPort
    });

    dummyHttpsServer = new Server({
      port: dummyHttpsServerPort,
      tls: cert
    });

    const routeConfigs: Array<ServerRoute> = [
      {
        method: 'GET',
        path: '/foo',
        handler(req, h) {
          return { success: true, path: '/foo', headers: req.headers };
        }
      },
      {
        method: 'POST',
        path: '/foo',
        handler(req, h) {
          return {
            success: true,
            path: '/foo',
            headers: req.headers,
            postPayload: req.payload
          };
        }
      },
      {
        method: 'GET',
        path: '/simplejson',
        handler(req, h) {
          return { simple: 'json' };
        }
      },
      {
        method: 'GET',
        path: '/cookies',
        handler(req, h) {
          const res = h.response({ requestHeaders: req.headers });
          res.header('set-cookie', 'foo=yyy; Path=/', { append: true });
          res.header('set-cookie', 'bar=xxx; Path=/', { append: true });
          return res;
        }
      }
    ];

    dummyHttpServer.route(routeConfigs);
    dummyHttpsServer.route(routeConfigs);
    await Promise.all([dummyHttpServer.start(), dummyHttpsServer.start()]);
  });

  afterAll(async () => {
    await Promise.all([dummyHttpServer.stop(), dummyHttpsServer.stop()]);
  });

  it('makes a simple HTTP request', () => {
    const res = httpRequest({
      method: 'GET',
      url: `http://localhost:${dummyHttpServerPort}/foo`
    });
    return expect(res, 'to be fulfilled with', {
      statusCode: 200,
      body: {
        success: true,
        path: '/foo'
      }
    });
  });

  it('makes a simple HTTPS request', () => {
    const res = httpRequest({
      method: 'GET',
      url: `https://localhost:${dummyHttpsServerPort}/foo`,
      rejectUnauthorized: false
    });
    return expect(res, 'to be fulfilled with', {
      statusCode: 200,
      body: {
        success: true,
        path: '/foo'
      }
    });
  });

  it('returns the text of the response', () => {
    const res = httpRequest({
      method: 'GET',
      url: `https://localhost:${dummyHttpsServerPort}/simplejson`,
      rejectUnauthorized: false
    });
    return expect(res, 'to be fulfilled with', {
      text: JSON.stringify({ simple: 'json' })
    });
  });

  it('returns the raw buffer of the response', () => {
    const res = httpRequest({
      method: 'GET',
      url: `https://localhost:${dummyHttpsServerPort}/simplejson`,
      rejectUnauthorized: false
    });
    return expect(res, 'to be fulfilled with', {
      rawResponse: Buffer.from(JSON.stringify({ simple: 'json' }), 'utf-8')
    });
  });

  it('can post data', () => {
    const res = httpRequest({
      method: 'POST',
      url: `https://localhost:${dummyHttpsServerPort}/foo`,
      payload: Buffer.from(JSON.stringify({ foo: 'bar', baz: 'quz' })),
      rejectUnauthorized: false
    });

    return expect(res, 'to be fulfilled with', {
      body: {
        success: true,
        postPayload: { foo: 'bar', baz: 'quz' }
      }
    });
  });

  it('includes request headers', () => {
    const res = httpRequest({
      method: 'POST',
      url: `https://localhost:${dummyHttpsServerPort}/foo`,
      payload: Buffer.from(JSON.stringify({ foo: 'bar', baz: 'quz' })),
      headers: {
        'x-foo': 'bar'
      },
      rejectUnauthorized: false
    });

    // the /foo endpoint returns the request headers in the response
    return expect(res, 'to be fulfilled with', {
      body: {
        success: true,
        headers: { 'x-foo': 'bar' }
      }
    });
  });

  if (parseInt(process.versions.node.split('.')[0], 10) >= 10) {
    // Multiple headers seem to fail under jest in node 8
    // They work in node 10. It seems to only be under jest,
    // at least, a server with the same configuration works fine
    // The same raw res.setHeader() calls are made, but when running
    // under jest under node 8, when the `value` is an array, it
    // joins them up with a comma, even for set-cookie
    it('returns repeated response headers', () => {
      const res = httpRequest({
        method: 'GET',
        url: `http://localhost:${dummyHttpServerPort}/cookies`,
        rejectUnauthorized: false
      });

      return expect(res, 'to be fulfilled with', {
        headers: {
          'set-cookie': ['foo=yyy; Path=/', 'bar=xxx; Path=/']
        }
      });
    });
  }
});
