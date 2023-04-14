import { ProxyConfigWithDefaults } from './applyConfigDefaults';
import {
  addHostEntry,
  removeHostEntry,
  portProxy,
  getPortProxies,
  stopPortProxy
} from './adminRequests';
import { registerCleanup } from './cleanupQueue';
import { preloadCertForHost } from './getCertForHost';
import getPort from 'get-port';
import { getProxyResponse } from './getProxyResponse';
import { Server, Request, ResponseToolkit } from '@hapi/hapi';
import * as http from 'http';
import { createTLSListener } from './listener';
import { log } from './logger';
import { ProxyConfig, ProxyResponse, WrappedRequest } from './ProxyConfig';
import * as url from 'url';
import { getCertPath } from './getCertPath';
import { IncomingRequest } from './IncomingRequest';
import { HttpResponse } from './httpRequest';

function ProxyCallError(originalError: Error) {
  this.error = originalError;
}

ProxyCallError.prototype = new Error();

const CATCHALL_ROUTE = /\/\{[a-zA-Z0-9$_]+\*\}/;
export async function createProxy(
  proxyConfig: ProxyConfigWithDefaults
): Promise<Server> {
  let listener;

  let hostname = proxyConfig.localParsedUrl.hostname;
  let tls = proxyConfig.localParsedUrl.protocol === 'https:';
  let port: number = proxyConfig.localParsedUrl.port
    ? parseInt(proxyConfig.localParsedUrl.port, 10)
    : tls
    ? 443
    : 80;

  if (hostname && proxyConfig.writeEtcHosts) {
    log.info(`Writing /etc/hosts entry for ${hostname}`);
    const hostsEntryHostname = hostname;
    const result = await addHostEntry(hostsEntryHostname);
    if (result.success && result.added) {
      registerCleanup(() => removeHostEntry(hostsEntryHostname));
    }
  }

  const certificatePath = await getCertPath();

  // Preload/precreate the certificate
  // This helps speed up the first request to the host, and improves the success rate of the
  // first request. We ignore that it might not be needed, as we need to pass it to the portProxy anyway,
  // so it needs to be set to something
  if (tls && hostname) {
    await preloadCertForHost(certificatePath, hostname, {});
  }

  if (proxyConfig.createPrivilegedPortProxy && port < 1024) {
    // Check if there's already a privileged port proxy on the right port
    const proxiedPrivilegedPorts = await getPortProxies();
    if (
      proxiedPrivilegedPorts[port] &&
      proxiedPrivilegedPorts[port].tls === tls
    ) {
      port = proxiedPrivilegedPorts[port].localPort;
    } else {
      if (
        proxiedPrivilegedPorts[port] &&
        proxiedPrivilegedPorts[port].tls !== tls
      ) {
        // There is a proxied privileged port, but it's either TLS and we don't want TLS or vice versa
        // So just stop it and create a new one
        await stopPortProxy(port);
      }
      const localPort = await getPort();
      log.info(
        `Proxying privileged port for ${url.format(
          proxyConfig.localParsedUrl
        )} to local port ${localPort}`
      );

      const portProxyResult = await portProxy(
        url.format(proxyConfig.localParsedUrl),
        localPort,
        certificatePath,
        proxyConfig.cors
      );

      if (!portProxyResult.data.success) {
        switch (portProxyResult.data.code) {
          case 'EADDRINUSE':
            log.error(
              "Error starting privileged port listener, the port is in use. Check if there's another admin server still running from a previous process"
            );
            break;
          case 'EACCES':
            log.error(
              "Error starting privileged port listener - the admin server doesn't have rights to listen on the low numbered port. This is strange, and is probably a bug somewhere."
            );
            break;
          default:
            log.error(
              'Error starting privileged port listener: ' +
                portProxyResult.data.message
            );
            break;
        }
        throw new Error('Error starting admin server');
      }
      port = localPort;
    }
    // Disable tls for the local (non-admin) server
    tls = false;
  }

  if (tls) {
    listener = createTLSListener({
      certPath: certificatePath
    });
  } else {
    listener = http.createServer();
  }

  const server = new Server({
    port,
    listener,
    tls
  });

  addRoutes(server, proxyConfig);
  server.events.on('log', (event, tags) => {
    if (tags.error) {
      let message = event.error ? (event.error as any).message : 'unknown';
      if (message.includes('alert bad certificate')) {
        message = `${message}
        intervene attempts to trust the certificate with the operating system when supported.
        This works for some browsers but not all (e.g. Firefox).

        For Firefox, open the requested URL in your browser and add a security exception for the certificate.
        
        For Chrome on Linux, make sure you have certutil available - package libnss3-tools under Debian based distributions
        (e.g. Ubuntu) and restart intervene.
        
        For other browsers or operating systems, refer to your browser or tool documentation about accessing URLs with untrusted certificates.
        `;
      }
      log.error(`Server error: ${message}`);
    } else {
      log.error((event.error as any).message);
    }
  });
  if (proxyConfig.onShutdown) {
    registerCleanup(proxyConfig.onShutdown);
  }
  return server;
}

function addRoutes(server: Server, proxyConfig: ProxyConfigWithDefaults) {
  const targetUrl = url.parse(proxyConfig.target);
  let catchAllRouteDefined = false;
  const routes = proxyConfig.routes || {};

  for (const routePath in routes) {
    const { method, path } = parseRoutePath(routePath);

    if (method === '*' && CATCHALL_ROUTE.test(path)) {
      catchAllRouteDefined = true;
    }
    const response: any = routes[routePath];
    if (typeof response === 'string' || typeof response === 'object') {
      server.route({
        method,
        path,
        options: {
          cors: proxyConfig.cors,
          handler(request, h) {
            return h.response(response);
          }
        }
      });
    }
    if (typeof response === 'function') {
      server.route({
        method,
        path,
        options: {
          cors: proxyConfig.cors,
          async handler(request, h) {
            const wrappedRequest = createWrappedRequest(
              proxyConfig,
              request,
              targetUrl
            );

            try {
              const result = await response(wrappedRequest, h, async () => {
                return getProxyResponse(proxyConfig, wrappedRequest).catch(
                  (e) => {
                    throw new ProxyCallError(e);
                  }
                );
              });

              if (result && result instanceof HttpResponse) {
                return handleProxyResponse(result as ProxyResponse, h);
              }
              return result;
            } catch (e) {
              let message;
              if (e instanceof ProxyCallError) {
                e = (e as any).error;
                message = `Proxy call to target failed for route ${method} ${path}`;
                log.error(
                  `Proxy call to target failed for route ${method} ${path}: ${e}`,
                  e
                );
              } else {
                message = `Error in intervene handler function for route ${method} ${path}`;
                log.error(
                  `Error in handler for route ${method} ${path}: ${e}`,
                  e
                );
              }
              return h
                .response({
                  statusCode: 500,
                  message,
                  error: e.toString()
                })
                .code(500);
            }
          }
        }
      });
    }
  }

  if (!catchAllRouteDefined) {
    server.route({
      method: '*',
      path: '/{path*}',
      options: {
        cors: proxyConfig.cors,
        async handler(request, h) {
          try {
            let proxyResponse;
            try {
              proxyResponse = await getProxyResponse(
                proxyConfig,
                createWrappedRequest(proxyConfig, request, targetUrl)
              );
            } catch (e) {
              throw new ProxyCallError(e);
            }
            return handleProxyResponse(proxyResponse, h);
          } catch (e) {
            let message;
            if (e instanceof ProxyCallError) {
              message = 'Proxy call to target failed in catch-all route';
              e = (e as any).error;
            } else {
              message = 'Error in catch-all route';
            }
            log.error(`${message}: ${e}`, e);
            return h
              .response({
                statusCode: 500,
                message,
                error: e.toString()
              })
              .code(500);
          }
        }
      }
    });
  }
}

function handleProxyResponse(proxyResponse: ProxyResponse, h: ResponseToolkit) {
  const res = h.response(proxyResponse.getCalculatedRawResponse());
  res.type(proxyResponse.contentType);
  res.code(proxyResponse.statusCode);
  for (const name in proxyResponse.headers) {
    switch (name) {
      // We don't want to copy these headers, they don't make sense with
      // the proxied response
      case 'transfer-encoding':
      // Transfer encoding doesn't make sense - it's always just straight, no chunked etc
      case 'content-length':
      // Content-length could have changed, so we'll skip that
      // TODO: We could & should actually update it to the new length now
      case 'content-encoding':
        // Content-encoding is now plain, as it has been gunzipped, inflated or brotli-decompressed
        continue;
      default:
        const header = proxyResponse.headers[name];
        if (typeof header === 'string') {
          res.header(name, header);
        } else if (Array.isArray(header)) {
          header.forEach((headerValue) =>
            res.header(name.toLowerCase(), headerValue, { append: true })
          );
        }
    }
  }
  return res;
}

function createWrappedRequest(
  proxyConfig: ProxyConfig,
  request: Request,
  targetUrl: url.UrlWithStringQuery
): WrappedRequest {
  const parsedRequestUrl = url.parse(url.format(request.url), true);
  const requestUrl = {
    ...targetUrl,
    path: undefined,
    pathname: request.url.pathname,
    query: parsedRequestUrl.query
  };
  return new IncomingRequest({
    method: request.method.toUpperCase() as any,
    url: requestUrl,
    params: request.params,
    headers: request.headers,
    overrideHeaders: { ...proxyConfig.targetHeaders },
    payload: request.payload,
    state: request.state
  });
}

function parseRoutePath(routePath: string): { method: string; path: string } {
  let [method, path] = routePath.split(' ');
  if (!path) {
    path = method;
    method = 'GET';
  }
  return { method, path };
}
