import { HttpResponse } from './../httpRequest';
import { ProxyConfig, WrappedRequest } from '../ProxyConfig';
import * as url from 'url';

const getProxyResponse = jest.fn(async function getProxyResponse(
  proxyConfig: ProxyConfig,
  targetUrl: url.UrlWithStringQuery,
  request: WrappedRequest
) {
  const httpResponse = new HttpResponse({
    statusCode: 200,
    statusMessage: 'OK',
    headers: {
      'content-type': 'application/json'
    }
  });
  httpResponse.setResponseBody(
    Buffer.from(JSON.stringify({ json: true, mocked: true }))
  );
  return Promise.resolve(httpResponse);
});

export { getProxyResponse };
