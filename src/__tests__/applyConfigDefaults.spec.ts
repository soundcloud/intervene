import { applyConfigDefaults } from '../applyConfigDefaults';
import * as path from 'path';
import * as unexpected from 'unexpected';
import { ProxyConfig } from '../ProxyConfig';
import * as url from 'url';

const expect = unexpected.clone();

describe('applyConfigDefaults', () => {
  it('should apply defaults to a non-localhost port 80 config', () => {
    expect(
      applyConfigDefaults(
        {
          target: 'http://foo.test'
        },
        '/tmp'
      ),
      'to satisfy',
      {
        target: 'http://foo.test',
        localUrl: 'http://foo.test',
        skipEtcHosts: true,
        writeEtcHosts: true,
        createPrivilegedPortProxy: true,
        targetHeaders: {},
        targetParsedUrl: url.parse('http://foo.test'),
        localParsedUrl: url.parse('http://foo.test'),
        allowUntrustedCerts: true,
        removeStrictTransportSecurity: true
      }
    );
  });

  it('should apply defaults to a localhost port 80 config', () => {
    expect(
      applyConfigDefaults(
        {
          target: 'http://localhost'
        },
        '/tmp'
      ),
      'to satisfy',
      {
        target: 'http://localhost',
        localUrl: 'http://localhost',
        skipEtcHosts: true,
        writeEtcHosts: false,
        createPrivilegedPortProxy: true,
        targetHeaders: {},
        targetParsedUrl: url.parse('http://localhost'),
        localParsedUrl: url.parse('http://localhost'),
        allowUntrustedCerts: true,
        removeStrictTransportSecurity: true
      }
    );
  });

  it('should apply defaults to a high numbered port localhost config', () => {
    expect(
      applyConfigDefaults(
        {
          target: 'http://localhost',
          localUrl: 'http://localhost:5050'
        },
        '/tmp'
      ),
      'to satisfy',
      {
        target: 'http://localhost',
        localUrl: 'http://localhost:5050',
        skipEtcHosts: true,
        writeEtcHosts: false,
        createPrivilegedPortProxy: true,
        targetHeaders: {},
        targetParsedUrl: url.parse('http://localhost'),
        localParsedUrl: url.parse('http://localhost:5050'),
        allowUntrustedCerts: true,
        removeStrictTransportSecurity: true
      }
    );
  });
});
