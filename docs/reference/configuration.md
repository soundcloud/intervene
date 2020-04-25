The configuration file is a [TypeScript](https://typescriptlang.org) module which exports an object of type `ProxyConfig`.

You can create a config file by running `intervene create <URL>`, which will create a sample config file, save it under the name of the host and start the proxy.

e.g. `intervene create https://api.mycompany.com`

### Example configuration

```typescript
import { ProxyConfig } from '/usr/local/lib/node_modules/intervene';

const config: ProxyConfig = {
  target: 'https://api.mycompany.com'
};

export default config;
```

### Configuration Options

`ProxyConfig` has the following members (where only `target` is mandatory)

- `target`: The URL that should be proxied to. Note that paths here are **not** supported.
- `localUrl`: The local scheme, hostname and optionally port to listen on. If this is not present, the target is used as the localUrl. See [directing to alternate hosts](../guide/alternative-hosts.md)
- `targetHeaders`: An object with headers to override when making proxy calls. Examples of headers that can be useful here are `host` and `x-forwarded-proto`.
- `writeEtcHosts`: Boolean. If this is true, `/etc/hosts` will be written to with the localUrl hostname or target hostname. Default `true`
- `skipEtcHosts`: Boolean. If this is true, `/etc/hosts` will not be used when looking up the IP address to connect to when proxying. This is the default, as it enables writing a public hostname to `/etc/hosts` (e.g. `api.mycompany.com`) and then proxying to the _real_ address. Default `true`.
- `allowUntrustedCerts`: Boolean. If this is true, when the target is HTTPS, targets are allowed to have untrusted or invalid certificates. Ensure this is true if the target is using a self-signed or custom CA signed certificate. Default is `true`.
- `removeStrictTransportSecurity`: Boolean. Removes the `Strict-Transport-Security` headers from any proxied request, meaning that browsers like Firefox that don't allow self-signed certs on sites with HSTS enabled can be worked around. Set this to `false` to leave `Strict-Transport-Security` headers in the response. Defaults to `true`.
- `onShutdown`: `() => void | Promise<any>`. A function which gets called when the proxy process is shutdown (i.e. with Ctrl-C). Use this if you need to clean anything up when shutting down.
- `routes`: An object with keys as paths to override (paths are [hapi path parameters](https://hapijs.com/api#path-parameters)). Optionally prefixed with the uppercase HTTP verb (defaults to `GET`).  Values are either

  - JSON to return as `application/json`
  - string to return as `text/plain`
  - a function: `(request, h, proxy) => Promise<response>`

    - `request` is the request information, which can be edited

      - `method` - the HTTP request method
      - `url` - the requested url, parsed into object form, including query string parsing
      - `headers` - object containing the request headers
      - `payload` - in the case of a `PUT` or `POST`, contains the payload (in JSON format if applicable)

    - `h` is the [hapi response toolkit](https://hapijs.com/api#response-toolkit), if you need to construct your own responses
    - `proxy` is a function which returns a promise of the response from the target. If any of the properties of the `request` are altered before calling this method, the changes are used to make the request.

    The return value of the function can be any one of the following:

    - A JavaScript object. This will be returned as an `application/json` response
    - A response created from `h.response(...)` (see [hapi response builder](https://hapijs.com/api#-hresponsevalue))
    - The (optionally altered) response object from calling `proxy()` (the third argument to the route function)
    - A promise that resolves to any of the above values
