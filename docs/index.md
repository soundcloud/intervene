**Hassle free HTTP(S) API proxying for development**

Quickly mock endpoints in HTTP(S) APIs, edit requests and responses, proxy everything else to your real API.

## Feature summary

- Respond to specific endpoints with JSON responses, proxy everything else to your real server
- Alter requests and/or responses before/after proxying to your real server
- Config file can be as simple as an endpoint and some JSON to return
- Automatic CORS support
- Automatic HTTPS support (self-signed certificate generation and trusting the certificate for chrome & safari)

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

(Don't worry about path in the `import` statement. It's going to depend on how you installed `intervene`, but `intervene` is smart enough to fix this path dynamically when loading the config file)

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
There's also the option to [build types](guide/typed-routes.md) around the request and response bodies, which can be a nice way to document an interface as you're working with a mock of the data.

## Supported OS

`intervene` supports macOS and Linux. Windows is not yet supported.

## Installation

You need at least [node 8](https://nodejs.org)

```shell
npm install -g intervene
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

  // `req.payload` is the POST request payload (when JSON). Altering the object alters what gets proxied
  // You can also access `req.textPayload` to alter it as a string, or `req.rawPayload` to alter it as a buffer.
  // Whichever property is set last takes precedence - for instance, setting `req.textPayload = 'replaced'` after this
  // will overwrite the paylod with the string `replaced`
  req.payload.apiVersion = 2;

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
