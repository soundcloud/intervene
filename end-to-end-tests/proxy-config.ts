import { ProxyConfig, routeBuilder, log } from '../dist/src';

const config: ProxyConfig = {
  target: process.env.LOCAL_TEST
    ? 'http://localhost:5959'
    : 'https://intervene-test.bruderstein.now.sh',
  localUrl: 'https://intervene-test.bruderstein.now.sh',
  skipEtcHosts: process.env.LOCAL_TEST ? false : true,
  routes: {
    '/proxyhealth': {
      ok: true
    },
    '/api/simple': async (req, h, proxy) => {
      const res = await proxy();
      res.body.extra = 'added by proxy';
      return res;
    },
    '/api/change-url': async (req, h, proxy) => {
      req.url.pathname = '/api/simple';
      return proxy();
    },
    '/api/simple2': async (req, h, proxy) => {
      req.url.pathname = '/api/simple';
      const res = await proxy();
      res.text = '{ "different":"json","number": ' + res.body.number + '}';
      return res;
    },
    '/api/simple401': async (req, h, proxy) => {
      req.url.pathname = '/api/simple';
      const res = await proxy();
      res.statusCode = 401;
      return res;
    },
    '/api/only401': (req, h, proxy) => {
      const res = h.response({ from: 'proxy' });
      res.code(401);
      return res;
    },
    '/api/directjson': {
      no: 'method',
      just: 'json'
    },

    '/api/querymodify': (req, h, proxy) => {
      req.url.query.q = 'changed';
      return proxy();
    },
    '/images/tinydirect.png': (req, h, proxy) => {
      const res = h.response(
        Buffer.from(
          `iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAACXBIWXMAAAsTAAALEwEAmpwYAAAA
      B3RJTUUH4wUCFAIHiZB4+gAAAB1pVFh0Q29tbWVudAAAAAAAQ3JlYXRlZCB3aXRoIEdJTVBkLmUH
      AAAAJUlEQVQI12Pcz8nJwMDgNMmIgYGBiQEJMDLOtmZgYNiXdw5dBgCO/ASvOrzGcwAAAABJRU5E
      rkJggg==`,
          'base64'
        )
      );
      res.type('image/png');
      return res;
    },

    '/images/tiny-overwritten.png': async (req, h, proxy) => {
      req.url.pathname = '/images/tiny.png';
      const res = await proxy();
      res.rawResponse = Buffer.from(
        `iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAACXBIWXMAAAsTAAALEwEAmpwYAAAA
      B3RJTUUH4wUCFAIHiZB4+gAAAB1pVFh0Q29tbWVudAAAAAAAQ3JlYXRlZCB3aXRoIEdJTVBkLmUH
      AAAAJUlEQVQI12Pcz8nJwMDgNMmIgYGBiQEJMDLOtmZgYNiXdw5dBgCO/ASvOrzGcwAAAABJRU5E
      rkJggg==`,
        'base64'
      );
      res.contentType = 'image/png';
      return res;
    },

    '/api/proxy-add-header': (req, h, proxy) => {
      req.headers['x-added-by-proxy'] = 'foobar';
      return proxy();
    },
    '/api/proxy-add-response-header': async (req, h, proxy) => {
      const res = await proxy();
      res.headers['x-added-by-proxy'] = 'foo-response-header';
      res.headers['access-control-expose-headers'] = 'x-added-by-proxy';
      return res;
    },

    'POST /api/post-modify': (req, h, proxy) => {
      req.payload.has = 'data changed by the proxy';
      return proxy();
    },
    '/change-target': (req, h, proxy) => {
      req.url.host = 'placekitten.com';
      req.url.pathname = '/50/50';
      return proxy();
    }
  }
};

export default config;
