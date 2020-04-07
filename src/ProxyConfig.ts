import { ResponseToolkit, ResponseObject, RouteOptionsCors } from '@hapi/hapi';
import * as url from 'url';

export type ProxyConfig = {
  target: string;
  localUrl?: string;
  /**
   * When proxying to the target, skip /etc/hosts (i.e. do a real DNS lookup)
   *
   * This enables setting the same name in /etc/hosts as the target, and proxying through to the original target
   * Default: true
   */
  skipEtcHosts?: boolean;

  /**
   * Write the localUrl (or target) to /etc/hosts when proxying
   *
   * Default: true
   */
  writeEtcHosts?: boolean;

  /**
   * When making proxied HTTPS requests to the target, allow invalid / untrusted certificates
   * This includes if the certificate in the target is self-signed, even if it is trusted by the OS,
   * as intervene (node.js) uses a separate trusted CA store
   *
   * Default: true
   */
  allowUntrustedCerts?: boolean;

  /**
   * Extra headers to add/override when making proxied requests to the target
   * Examples of common uses would be `host` (to override the Host header) and
   * `x-forwarded-proto` to identify that the request originally came from HTTPS
   *
   * These headers are available in `overrideHeaders` in the request object sent to
   * a route handler, so they can be overridden or removed for an individual route if
   * required.
   */
  targetHeaders?: {
    [header: string]: string;
  };

  /**
   * A function which gets called when the proxy is shutdown.
   * Use this if you need to clean anything up when the proxy process shuts down
   *
   * Note, this is not called on every restart, when the proxy is just stopped and restarted.
   */
  onShutdown?: () => void | Promise<any>;

  /**
   * If the localUrl (or target if localUrl is not specified) is on a privileged port, uses the admin
   * server to create a tiny proxy through to a non-privileged port.
   * This means you can start intervene without admin rights, and it will ask for escalated rights
   * to start the admin server, which starts a proxy simply proxying all requests from the low numbered port
   * to a high numbered port.
   *
   * Set this to false if you want to disable this behaviour and run the proxy as admin when proxying a low numbered port.
   * Defaults to true.
   */
  createPrivilegedPortProxy?: boolean;

  /**
   * Strict Transport Security (aka HSTS) headers mean that browsers will only connect to a host via HTTPS.
   * This setting is remembered for the time specified in the header.
   *
   * Firefox (at least) will not allow to connect to a host with a self-signed certificate that have a
   * Strict-Transport-Security header (or have previously been visited and the time has not expired).
   *
   * This setting (defaulted to `true`) automatically strips the Strict-Transport-Security header from
   * any proxied request. This means that in order to use intervene with a site using
   * Strict-Transport-Security, you need to forget all Strict-Transport-Security settings for the domain
   * in the browser, and set this flag to true (which is the default).
   *
   * If you need to leave the Strict-Transport-Security headers intact, set the false.
   *
   * Default: true
   */
  removeStrictTransportSecurity?: boolean;

  routes?: {
    /**
     * A route configuration. The key is the URL, optionally prefixed with the HTTP method.
     * If the method is not specified, the default is GET
     *
     * e.g. '/api/users', 'POST /api/users'
     *
     * The value is either the JSON that should be returned, or a string for text/plain,
     * or a RouteHandler function
     */
    [route: string]: RouteHandler | ReturnTypes;
  };

  /**
   * A boolean or an object that defines how the proxy server handles CORS
   * requests. By default, CORS is enabled for any origin. For details, check
   * out the hapi.js docs for the
   * [`cors` route option](https://hapi.dev/api/?v=18.3.1#route.options.cors).
   *
   * The default is `{ credentials: true, maxAge: 60 }`.
   */
  cors?: boolean | RouteOptionsCors;
};

export interface ProxyResponse<ResponseT extends ReturnTypes = ReturnTypes> {
  body: ResponseT;
  text: string | undefined;

  rawResponse: Buffer;
  contentType: string;
  statusCode: number;

  headers: {
    [header: string]: string | string[] | undefined;
  };

  getCalculatedRawResponse(): Buffer;
}

export interface WrappedRequest<
  PayloadT extends ParsedPayloadTypes = ParsedPayloadTypes
> {
  method:
    | 'GET'
    | 'PUT'
    | 'POST'
    | 'PATCH'
    | 'HEAD'
    | 'OPTIONS'
    | 'DELETE'
    | 'CONNECT';
  url: url.UrlWithParsedQuery;
  params: { [key: string]: string };
  headers: { [name: string]: string | string[] };
  overrideHeaders: { [name: string]: string };
  payload: PayloadT;
  textPayload: string;
  rawPayload: Buffer;
  getCalculatedRawPayload(): Buffer;
  state: { [key: string]: string };
}

export type ParsedPayloadTypes =
  | (null | string | number | boolean)
  | (object | object[])
  | symbol;

export type ReturnTypes =
  | (null | string | number | boolean)
  | (Buffer)
  | (Error)
  | (object | object[])
  | symbol
  | ResponseToolkit
  | ResponseObject;

export type HandlerResult<ResponseT extends ReturnTypes = ReturnTypes> =
  | ResponseT
  | Promise<ResponseT>
  // We always need to allow returning a ResponseObject, whatever the type of response
  | ResponseObject
  // This is now a ResponseT, not a ProxyResponseT, as the result from the handler should
  // always be of type ResponseT.  So the handler might call the proxy() func, get a ProxyResponseT back, but then
  // it needs to do the mapping to return ResponseT
  | Promise<ProxyResponse<ResponseT>>;

export type RouteHandler<
  PayloadT extends ReturnTypes = any,
  ResponseT extends ReturnTypes = any,
  ProxyResponseT extends ReturnTypes = any
> = (
  /** The request object contains all the details of the request, and can be edited before optionally calling proxy() */
  request: WrappedRequest<PayloadT>,
  /** The Hapi response toolkit - use this to generate your own custom responses, if not proxying */
  h: ResponseToolkit,
  /** A function which calls the target and returns the response. This returns a promise, so easiest is to `await` the response */
  proxy: () => Promise<ProxyResponse<ProxyResponseT>>
) => HandlerResult<ResponseT>;

export function routeBuilder<
  PayloadT extends ReturnTypes = ReturnTypes,
  ResponseT extends ReturnTypes = ReturnTypes,
  ProxyResponseT extends ReturnTypes = ResponseT
>(response: ResponseT | RouteHandler<PayloadT, ResponseT, ProxyResponseT>) {
  return response;
}
