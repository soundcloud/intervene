import { ProxyConfig } from '../../../src/ProxyConfig';

const config: ProxyConfig = {
  target: 'http://foo.test',
  routes: {
    '/foo': {
      env: process.env.FOO
    }
  }
};

export default config;
