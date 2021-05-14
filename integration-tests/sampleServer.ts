import { Server } from '@hapi/hapi';
import * as joi from 'joi';
import * as url from 'url';

export function createServer(): Server {
  // TODO: find free port (npm module)
  const httpServer = new Server({
    port: 5123
  });

  /*
NEED TO ADD HTTPS server so we can validate proxying to https
const httpsServer = new Server({
  tls: true
})
*/

  httpServer.validator(joi);
  httpServer.route([
    {
      method: 'GET',
      path: '/-/health',
      handler(request, h) {
        return 'OK';
      }
    },
    {
      method: 'GET',
      path: '/json',
      handler(request, h) {
        return { static: 'json' };
      }
    },
    {
      method: 'GET',
      path: '/text',
      handler(request, h) {
        return 'some text';
      }
    },
    {
      method: 'GET',
      path: '/with/{param}',
      handler(request, h) {
        return { json: true, from: 'param', arg: request.params.param };
      }
    },
    {
      method: 'POST',
      path: '/respond202',
      handler(request, h) {
        const res = h.response({
          json: true,
          from: 'param',
          arg: request.params.param
        });
        res.code(202);
        return res;
      }
    },
    {
      method: 'POST',
      path: '/respond201',
      options: {
        validate: {
          payload: {
            dummyHost: joi.string()
          }
        },
        handler(request, h) {
          const { dummyHost } = request.payload as any;
          const res = h.response({
            json: true,
            from: 'param',
            arg: request.params.param
          });
          res.code(201);
          res.location(`http://${dummyHost}/newlocation`);
          return res;
        }
      }
    },
    {
      method: 'GET',
      path: '/newlocation',
      handler(request, h) {
        return { location: 'new' };
      }
    },
    {
      method: 'GET',
      path: '/jsonstring',
      handler(request, h) {
        const response = h.response('"OK"');
        response.type('application/json');
        return response;
      }
    },
    {
      method: 'GET',
      path: '/change/jsonstring',
      handler(request, h) {
        const response = h.response('"OK"');
        response.type('application/json');
        return response;
      }
    },
    {
      method: 'GET',
      path: '/add/requestheader',
      handler(request, h) {
        return { testHeader: request.headers['x-test'] };
      }
    },
    {
      method: 'GET',
      path: '/mapped/url',
      handler(request, h) {
        return { mapped: 'url', shouldnot: 'gethere' };
      }
    },
    {
      method: 'GET',
      path: '/mapped/query',
      handler(request, h) {
        const parsedUrl = url.parse(url.format(request.url), true);
        return { query: parsedUrl.query };
      }
    },
    {
      method: 'GET',
      path: '/add/responseheader',
      handler(request, h) {
        return { ok: true };
      }
    },
    {
      method: 'GET',
      path: '/{path*}',
      handler(request, h) {
        const res = h.response({ notFound: request.url });
        res.code(404);
        return res;
      }
    }
  ]);

  return httpServer;
}
