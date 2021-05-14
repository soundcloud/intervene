import { ProxyConfig, WrappedRequest, ProxyResponse } from './ProxyConfig';
import * as url from 'url';
import { getIPForHost } from './dnsLookup';
import { httpRequest } from './httpRequest';

export async function getProxyResponse(
  proxyConfig: ProxyConfig,
  request: WrappedRequest
): Promise<ProxyResponse<any>> {
  // Re-parse the host to strip the port off if it's there
  // Using `parsedHost.hostname` will get the host without the port,
  // which we need for the host header and servername
  const parsedHost = url.parse(`http://${request.url.host}`);
  let host = parsedHost.hostname;

  if (proxyConfig.skipEtcHosts && host && host !== 'localhost') {
    const hosts = await getIPForHost(host);
    host = hosts[Math.floor(Math.random() * (hosts.length - 1))];
  }

  const requestUrl = url.format({
    protocol: request.url.protocol,
    slashes: request.url.slashes,
    auth: request.url.auth,
    host: request.url.port ? host + ':' + request.url.port : host,
    hostname: undefined,
    pathname: request.url.pathname,
    query: request.url.query
  });

  const requestHeaders = {
    ...request.headers,
    host: parsedHost.hostname || undefined,
    ...request.overrideHeaders
  };

  delete requestHeaders['content-encoding'];
  delete requestHeaders['content-length'];
  delete requestHeaders['transfer-encoding'];

  const proxyResponse = await httpRequest({
    method: request.method,
    url: requestUrl,
    headers: requestHeaders,
    hostname: parsedHost.hostname || undefined,
    payload: request.getCalculatedRawPayload(),
    rejectUnauthorized: !proxyConfig.allowUntrustedCerts
  });
  if (proxyConfig.removeStrictTransportSecurity === true) {
    delete proxyResponse.headers['strict-transport-security'];
  }
  return proxyResponse;
}
