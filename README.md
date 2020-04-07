# Intervene

_Hassle free HTTP(S) API proxying for development_

Quickly mock endpoints in HTTP(S) APIs, edit requests and responses, proxy everything else to the real API.

## Example

Let's say you've got a website that accesses your API at https://mycompany.com/api.  There's a `GET /api/cat` that returns some JSON information (`name`, `color`, `image`) about a cat. You're planning a major update in the backend to add `GET /api/dog`. It's going to take the backend developers a few days to get that implemented, but you want to start work on the frontend already.

Run this on the command line (Mac or Linux)

`intervene create https://mycompany.com`

It's going to ask for admin privileges because it needs to override some things. It creates a file called `mycompany.com.ts`, which is an `intervene` config. Leave the process running and open the file.

```typescript
import { ProxyConfig, routeBuilder } from '/Users/foo/Library/node_modules/intervene';

const config: ProxyConfig = {
  target: 'https://mycompany.com',

  routes: {

    // Some example configurations follow
    // ...

  }
};

export default config;
```

(Don't worry about path in the `import` statement. It's going to depend on how you installed `intervene`

You should see the site still works as normal (in chrome at least, you'll get a certificate warning in Firefox which you'll need to accept).  `GET /api/cat` still responds the same.

Now let's change the configuration to include a new route:
```typescript

const config: ProxyConfig = {
  target: 'https://mycompany.com',

  routes: {

    '/api/dog': {
      name: 'Fido',
      color: 'Beige',
      image: 'https://dogimages.com/bestdog.jpg'
    }

  }
};
```

Save the file (no need to restart the `intervene` process, it will notice and restart itself.

Now, if you `curl -k https://mycompany.com/api/dog`, you'll get the JSON specified in the file. `curl -k https://mycompany.com/api/cat` still responds the same, because it proxies through to the real `https://mycompany.com`.

### Altering responses

Another update is planned to also return the `age` of the cat. You don't want to mock the whole endpoint, you just want to add the `age` property to whatever the real backend returns.

Let's make a method endpoint.

```typescript

const config: ProxyConfig = {
  target: 'https://mycompany.com',

  routes: {

    '/api/dog': {
      name: 'Fido',
      color: 'Beige',
      image: 'https://dogimages.com/bestdog.jpg'
    },

    '/api/cat': async (req, h, proxy) => {
      const response = await proxy();
      response.body.age = 7;
      return response;
    }

  }
};
```
Save the file again, and the https://mycompany.com/api/cat endpoint now has an added `age` property, with the rest of the response exactly as returned by the real server.


### More options

You can also change the request before it's proxied, including PUT/POST bodies, add/remove/change request and response headers, change the status code, respond with invalid responses, delay responses etc etc.
There's also the option to build types around the request and response bodies, which can be a nice way to document an interface as you're working with a mock of the data.


## How does it work?

This service acts as a man-in-the-middle proxy for a single host, pretending to be the host itself, allowing easy mocking/alterations of endpoints.
When connecting to the target service, a real DNS lookup is done, such that the address can be overridden in /etc/hosts such that a browser will connect to the proxy, but the proxy knows where the "real" server is. (This behaviour can be disabled). Managing entries in /etc/hosts is handled by `intervene` automatically.


```
                      Local dev machine                                   External services



                                                                      +-------------+   +---------+
  +---------------+                                                   |             |   |         |
  |               |                        +----------+               |  DNS lookup |   |         |
  |               |                        |          +-------------> |             |   |         |
  | Browser       | api.mycompany.com      |          |               +-------------+   |         |
  |               +----------------------->+          +<------------+                   | Target  |
  |               |                        |:443      |                                 | Server  |
  |               | <----------------+     |          |                                 |         |
  +-----------+---+                  |     |intervene +-------------------------------> |         |
              |                      |     |          |                                 |         |
              |                      +-----+ <------+ | <------------------------------ |         |
+-------------v----------------+           |          |                                 |         |
|/etc/hosts                    |           |          |                                 |         |
|                              |           |          |                                 |         |
| 127.0.0.1 api.mycompany.com  |           |          |                                 |         |
|                              |           |          |                                 |         |
+------------------------------+           |          |                                 |         |
                                           |          |                                 |         |
                                           +----------+                                 |         |
                                                                                        |         |
                                                                                        +---------+

```

## Feature summary

- Automatic self-signed certificate generation and trusting the certificate for chrome & safari
- Automatic writing entry to /etc/hosts, and skipping for the real
- Skips /etc/hosts when proxying the request, so proxying a public address is straight forward
- Config file can be as simple as an endpoint and some JSON to return
- Edit requests before proxying (including modifying headers & the URL)
- Edit responses after proxying but before returning to the client
- Automatic CORS support

## Supported OS

`intervene` supports macOS and Linux. Windows is not yet supported.

## Installation

You need at least [node 8](https://nodejs.org)

```shell
npm install -g intervene
```

## Usage

Create a proxy to api.mycompany.com

```shell
intervene create https://api.mycompany.com -e
```

This creates a sample config file (called api.mycompany.com.ts), and opens the file in your editor (`TS_EDITOR`, `VISUAL` or `EDITOR` environment variables - it's advisable that these are not console editors, as the console is also used for logging from the proxy). If your editor has typescript support, you'll get autocompletion and documentation when editing the config. The proxy is automatically started. If this is a HTTPS target, a self-signed certificate is generated and trusted as part of the startup process.

The import statement is generated from the absolute location of the module, which might be in your /usr/local/lib/node_modules directory if you've installed `intervene` globally. This is actually less of a problem that it seems (especially when sharing configurations, for instance by checking them in to your repo), as the path for the import is automatically patched when starting the proxy.  For instance, even if the import is `import { ProxyConfig } from '/foo/bar/intervene';`, it will still work even though `/foo/bar` doesn't exist, because the path gets patched to the path of the current `intervene` module before the file is imported.

Saving the config file automatically reloads it and reconfigures the proxy.

To start a proxy with a given config file:

```shell
intervene start my-config.ts
```

It's also possible to use config files from HTTP(s) locations,

e.g.

```shell
intervene start https://gist.mycompany.com/raw/myconfig.ts
```

## Configuration

The configuration file is a [TypeScript](https://typescriptlang.org) module which exports an object of type `ProxyConfig`.

`ProxyConfig` has the following members (where only `target` is mandatory)

- `target`: The URL that should be proxied to. Note that paths here are **not** supported.
- `localUrl`: The local scheme, hostname and optionally port to listen on. If this is not present, the target is used as the localUrl
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


Saving the configuration will automatically reload it, no need to restart the proxy to change the configuration.

## Utility methods

Also exported from the module is a utility method that can be useful for mocking purposes.

### `delay(msDelay [, respoonseOrHandler])`

A function that returns the given response after the given delay. The first argument is the amount of time to delay, the optional second argument is either a route handler (`(req, h, proxy) => ...`), a JSON object to respond with, or a string to respond as text with. If the second argument is not provided, the request is simply proxied after the given delay.

### `httpRequest({ requestParams })`

A function that makes an HTTP request. The response object is the same type as the `proxy()` method, so the response can be returned directly or modified and then returned. Obviously it's also possible to make a request and then return some other response as usual.
Request parameters are defined as:
```
  method?:
    | 'GET'
    | 'POST'
    | 'PUT'
    | 'DELETE'
    | 'HEAD'
    | 'OPTIONS'
    | 'PATCH'
    | 'CONNECT';
  url: string;
  headers?: { [key: string]: string | string[] | undefined };
  hostname?: string;
  payload?: Buffer;
  rejectUnauthorized?: boolean;
```

## Example route configurations

1. Return a simple JSON response for `/users/<anything>`

```js
'/users/{userId}': {
   fixed: true,
   jsonResponse: true,
   here: 'can go anything'
}
```

Example request / response

```
GET /users/123456

HTTP/1.1 200 OK
content-type: application-json; charset=utf-8

{ "fixed": true, "jsonResponse": true, "here": "can go anything" }
```

2. Return a simple string

```js
'/fixedresponse': 'plain text response',
```

This returns a simple plain text response

3. Proxy a call and mutate the response

```js
'/tweets': async (req, h, proxy) => {
  // Call the target
  const realResponse = await proxy();

  // Mutate the response
  // `body` contains the JSON from the response. Mutating it will mutate the response provided
  if (realResponse.body && realResponse.body.collection) {
    // Strip everything but the first item in the collection
    realResponse.body.collection.splice(1, realResponse.body.collection.length)
  }

  // And return it
  return realResponse;
}
```

The calls the target, then mutates the response object, returning the mutated response.

4. Modifying the request before proxying, then modifying the response

```js
'POST /api/{path*}': async (req, h, proxy) => {
  // Edit the request URL before proxying
  // (req.params is an object containing the path params, in this case `path`)
  req.url.pathname = '/api/v1/' + req.params.path;

  // Edit the request headers before proxying
  // Incoming request headers are all lowercased
  req.headers['x-replaced-header'] = 'new or updated value';

  // Actually proxy the request
  const res = await proxy();

  // Edit the response headers after proxying
  res.headers['x-response-header'] = 'new or updated value';

  // Return the response
  return res;
},
```

5. Construct a custom response

```js
    'PUT /api/mockme': (req, h, proxy) => {
      // Return a custom response with a custom status code and headers

      // assuming called with `?arg=xxxx`
      const result = { some: { json: 4, queryArg: req.url.query.arg } };

      // The `h` variable is the Hapi response toolkit
      const response = h.response(result);
      response.header('x-response-header', 'new value');
      response.code(202);
      response.type('application/json');
      return response;
    }
```

## Typed routes

You may want to use `intervene` to have a discussion around the data exchange format between backend and client (whilst mocking the backend so that the client can be built).

To do this, you may want to describe the shape of the request and/or the response.

### Enter `routeBuilder`

You can import `routeBuilder` in the same way from the project. It is a function which takes up to 3 type parameters, `RequestT`, `ResponseT` and `ProxyResponseT`, and a single argument of either the response or the response handler function (so everything you can put against a route).

Examples:

```js
import { ProxyConfig, routeBuilder } from 'intervene';

interface NewTweet {
  text: string;
  source: 'web' | 'android' | 'ios';
}

// A CreatedTweet is the same as a NewTweet, but with an id
interface CreatedTweet extends NewTweet {
  id: string;
}

// A BackendTweet is the same as a CreatedTweet, but with uid as a number
// (Scenario here is to change a frontend to use `id` as a string instead of `uid` as a number)
interface BackendTweet extends NewTweet {
  uid: number;
}

const config: ProxyConfig = {
  target: 'https://api.mycompany.com',
  routes: {
    // This describes the request POST body format as a `NewPlaylist` type.
    // Note that this has no effect as we're always returning a static response
    // However, it serves as documentation for what the request body should look like
    'POST /tweet': routeBuilder<NewTweet>({ id: 'tweets:9999999999999' }),

    'POST /tweet2': routeBuilder<NewTweet>((req, h, proxy) => {
      // Here, because this is a handler method, we have typed access to the request properties
      return {
        id: 'tweets:9999999999999',
        text: req.payload.text,  // <-- all the autocomplete goodness here :)
        source: req.payload.source
      };
    }),

    // Here we're defining a response type too. We'll get errors in the console when we save the config if the response
    // deviates from what is defined
    'POST /tweet3': routeBuilder<NewTweet, CreatedTweet>((req, h, proxy) => {
      return {
        id: 'tweets:999999999999999',
        text: req.payload.text,  // <-- all the autocomplete goodness here :)
        source: req.payload.source
      };
    }),

    // Here we're just defining the response type. We'll get typescript errors if the
    // response deviates from the type. This can be useful if you're using the types to
    // form the discussion and documentation around the data exchange formats, and you
    // don't want to be returning something that isn't valid.
    'GET /tweets/999999': routeBuilder<never, CreatedTweet>({
      id: 'tweets:999999',
      text: 'foo',
      source: 'web'
    })


    // Here we're calling the real backend with the `proxy()` function, and mapping that type
    // This is useful if you're altering the backend response in some way, but want typed access
    // to both. The default type for the proxy response is the same as the ResponseT, so you only
    // need this if you are changing the shape of the data as it passes through intervene

    'GET /tweets/777777': routeBuilder<never, CreatedTweet, BackendTweet>(async (req, h, proxy) => {
      const response = await proxy();
      // response is of type BackendPlaylist
      return {
        id: 'tweets:' + (response.body.uid * 10),
        text: response.body.text,
        source: response.body.source
      };
    })
  }
}
```

## Debugging / Logging

You can use a normal `console.log` etc from your configs (since 2.2.0), but also you can simply import the `log` function from the package and use either the log function directly or the helper methods.

e.g.
```js

import { ProxyConfig, log } from 'intervene';

const config: ProxyConfig = {
  target: 'https://api.mycompany.com',
  routes: {
    '/foo': (req, h, proxy) => {
      log.debug('/foo was called');
      return { logged: true };
    },

    '/bar': (req, h, proxy) => {
      // This uses the log call directly. You need to pass tags of the level, but can also pass other tags if other loggers are configured
      // (Which isn't yet possible through the command line interface, but might be implemented at some point)
      log({ tags: ['info'], message: '/bar was called', data: { url: req.url }});
    }
  }
};

export default config;
```

## Certificates & HTTPS

HTTPS TLS certificates are automatically generated, signed, and trusted (for Chrome / Safari) when required. They are valid for 7 days and stored in ~/.dev-ssl-certs.

If when starting a proxy there is less than 24 hours validity left, the certificate is untrusted, deleted and re-created with another 7 days validity.

The command `generate-cert` allows for generating a self-signed cert.  The certificate and key are generated in the current directory and is _NOT_ automatically trusted.

e.g. `intervene generate-cert local.mycompany.test --notafter 2019-10-23` creates a certificate that is valid from 1 hour ago until 23rd October 2019, for the domain local.mycompany.test.

## F.A.Q.

#### Why can I not import other modules into my config file?

Because the file is transpiled "live" in a sandboxed environment, we can't (yet) support loading external modules, other than native node modules.

#### It won't start / has errors?

Double check that there isn't another instance running. intervene starts a second privileged process to perform administrative actions (such as writing to /etc/hosts), which it tries to shutdown when the main process ends. This isn't always successful (for instance if the main process is terminated with a SIGTERM signal).
