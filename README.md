[![Node.js CI](https://github.com/soundcloud/intervene/actions/workflows/run-tests.yml/badge.svg)](https://github.com/soundcloud/intervene/actions/workflows/run-tests.yml)

![npm version](https://img.shields.io/npm/v/intervene)


# Intervene

_Hassle free HTTP(S) API proxying for development_

Quickly mock endpoints in HTTP(S) APIs, edit requests and responses, proxy everything else to the real API.

https://intervene.dev

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

(Don't worry about path in the `import` statement. It's going to depend on how you installed `intervene`, but it is smart enough to automatically patch the path at runtime when importing the config)

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

### Documentation

See the documentation at https://intervene.dev
