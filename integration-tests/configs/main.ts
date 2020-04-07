import { ProxyConfig } from '../../src/ProxyConfig';

const config: ProxyConfig = {
  localUrl: 'http://localhost:5199',
  target: 'http://localhost:5123',
  routes: {
    '/-/health': 'OK',
    '/proxy/static': {
      fixed: true,
      jsonResponse: true
    },

    '/fixedresponse': 'plain text response',

    '/edit/request': async (req, h, proxy) => {
      req.headers['x-edited'] = 'via-proxy';
      return await proxy();
    },

    '/change/jsonstring': async (req, h, proxy) => {
      const res = await proxy();
      res.body = 'changed';
      return res;
    },

    '/add/requestheader': async (req, h, proxy) => {
      req.headers['x-test'] = 'added';
      return await proxy();
    },

    '/mapped/url': async (req, h, proxy) => {
      req.url.pathname = '/newlocation';
      return await proxy();
    },

    '/mapped/query': async (req, h, proxy) => {
      req.url.query.foo = 'changed';
      return await proxy();
    },
    '/add/responseheader': async (req, h, proxy) => {
      const res = await proxy();
      res.headers['x-added-test'] = 'response-header';
      return res;
    }

    /*
    '/stream': async (req, h, proxy) => {
      // Call the target
      const realResponse = await proxy();

      // Mutate the response
      if (realResponse.body && realResponse.body.collection) {
        // Strip everything but the first item in the collection
        realResponse.body.collection.splice(1, realResponse.body.collection.length)
        realResponse.body.next_href = null;
      }

      // And return it
      return realResponse;
    }

    '/api/{path*}': async (req, h, proxy) => {
      // Edit the request headers before proxying
      req.headers('X-Replaced-Header', 'new or updated value');
      const res = await proxy();
      // Edit the response headers after proxying
      res.header('X-Response-Header', 'new or updated value');
      return res;
    },

    '/api/mockme': (req, h, proxy) => {
      // Return a custom response with a custom status code and headers

      // assuming called with `?arg=xxxx`
      const result = { some: { json: 4, queryArg: req.query.arg } };

      // The `h` variable is the Hapi response toolkit
      h.header('x-response-header', 'new value');
      h.statusCode = 202;
      return result;
    }
    */
  }
};

export default config;
