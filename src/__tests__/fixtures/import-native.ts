import * as path from 'path';
import { ProxyConfig } from '../../../src/ProxyConfig';

const config: ProxyConfig = {
  target: 'http://foo.test',
  routes: {
    '/foo': {
      joined: path.join('foo', 'bar')
    }
  }
};

export default config;
