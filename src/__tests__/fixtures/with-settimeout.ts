import { ProxyConfig } from '../../../src/ProxyConfig';
import * as Bluebird from 'bluebird';

// Using bluebird here so we can tell in the test if the promise is pending or resolved
const config: ProxyConfig = {
  target: 'http://foo.test',
  routes: {
    '/timeout': () => {
      return new Bluebird((resolve, reject) => {
        setTimeout(
          () =>
            resolve({
              timeout: true
            }),
          1000
        );
      });
    }
  }
};

export default config;
