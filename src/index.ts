// NOTE: If further things are exported from this module, they need to be included in the regex in `configLoader.ts`
// These imports are identified as coming from this module and therefore we need to know what is possible to be imported.
export {
  ProxyConfig,
  routeBuilder,
  WrappedRequest,
  RouteHandler,
  HandlerResult,
  ProxyResponse,
  ReturnTypes
} from './ProxyConfig';

export { ResponseToolkit } from '@hapi/hapi';

export { log } from './logger';

export { httpRequest } from './httpRequest';

export { delay } from './delay';
