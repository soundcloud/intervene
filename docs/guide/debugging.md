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

`log` contains methods `debug`, `info`, `warn` and `error` methods, all taking a string and optional object with more information.
