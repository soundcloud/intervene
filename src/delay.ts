import { RouteHandler, ReturnTypes } from './ProxyConfig';

/**
 * Delays the response (or handler) by the given number of milliseconds
 *
 * @param delayMs Milliseconds to delay
 * @param routeResponse Optional response or route handler
 */
export function delay(
  delayMs: number,
  routeResponse?: RouteHandler | ReturnTypes
): RouteHandler {
  return (req, h, proxy) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        if (typeof routeResponse === 'function') {
          const routeHandler = routeResponse as RouteHandler;
          resolve(routeHandler(req, h, proxy));
        } else if (routeResponse) {
          resolve(routeResponse);
        } else {
          resolve(proxy());
        }
      }, delayMs);
    });
  };
}
