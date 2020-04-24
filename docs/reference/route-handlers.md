
Routes definitions can be:

  - JSON to return as `application/json`
  - a string to return as `text/plain`
  - a function: `(request, h, proxy) => Promise<response>`

    - `request` is the request information, which can be edited

      - `method` - the HTTP request method
      - `url` - the requested url, parsed into object form, including query string parsing
      - `headers` - object containing the request headers
      - `payload` - for `PUT` and `POST`, contains the payload in JSON format if applicable
      - `textPayload` - for `PUT` and `POST`, contains the payload in string format
      - `rawPayload` - for `PUT` and `POST`, contains the payload in [`Buffer`](https://nodejs.org/api/buffer.html) format

    - `h` is the [hapi response toolkit](https://hapijs.com/api#response-toolkit), if you need to construct your own responses
    - `proxy` is a function which returns a promise of the response from the target. If any of the properties of the `request` are altered before calling this method, the changes are used to make the request.

    The return value of the function can be any one of the following:

    - A JavaScript object. This will be returned as an `application/json` response
    - A response created from `h.response(...)` (see [hapi response builder](https://hapijs.com/api#-hresponsevalue))
    - The (optionally altered) response object from calling `proxy()` (the third argument to the route function)
    - A promise that resolves to any of the above values


## Change the HTTP method

Set `req.method` to whichever method you need to proxy to.

```typescript
import { ProxyConfig } from 'intervene';

const config: ProxyConfig = {
  target: 'https://api.mycompany.com',

  routes: {
    // Change `POST /api/cats` to `PUT /api/cats` and forward to the server
    'POST /api/cats': (req, h, proxy) => {
      req.method = 'PUT'
      return proxy();
    }
  }
};

export default config;
```

## Change URL properties

`req.url` is the parsed URL of the **target**. This means you can update the host, path or anything else to update where the request will be proxied to.

Properties to edit:

* `host`: the hostname (without port)
* `port`: the port to use (if not default for the `protocol`, otherwise `null`)
* `protocol`: the protocol to use, followed by `:`. e.g. `http:` or `https:`
* `pathname`: the path (without the query)
* `query`: the parsed query string as an object

```typescript
import { ProxyConfig } from 'intervene';

const config: ProxyConfig = {
  target: 'https://api.mycompany.com',

  routes: {
    '/api/cats': (req, h, proxy) => {
      // Change `GET /api/cats` to `GET /api/v2/cats`
      req.url.pathname = '/api/v2/cats';

      // update the query property, to add `?api_version=2`
      req.url.query.api_version = '2';
      return proxy();
    }
  }
};

export default config;
```

### Response object

The response object is returned from calls to `proxy()` and also calls to [`httpRequest`](../guide/making-requests.md) contains the following properties

* `body`: A JavaScript object with the parsed JSON response (if content type is `application/json`)
* `text`: <`string | undefined`> The response in string format.
* `rawResponse`: <`Buffer`> The response as a raw binary Buffer
* `statusCode`: <`number`> The HTTP status code of the response
* `headers`: <`Array<string | string[] | undefined>`> An object with key value pairs of the header values

A route handler can return the response object directly, or modify it and return it.  Setting `text` or `rawResponse` properties will override the response body - whichever is set last takes precedence.
kk
