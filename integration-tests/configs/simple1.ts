import { ProxyConfig } from '../../src/ProxyConfig';

const config: ProxyConfig = {
  localUrl: 'http://localhost:5199',
  target: 'http://localhost:5123',
  routes: {
    '/-/health': 'OK',

    '/foo': { bar: true }
  }
};
export default config;
