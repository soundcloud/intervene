import { CertificateOptions, getCertForHost } from './getCertForHost';
import * as https from 'https';
import * as tls from 'tls';

interface Options extends CertificateOptions {
  certPath: string; /// Path to store certificates in
}

const certs: { [key: string]: tls.SecureContextOptions } = {};

function createTLSListener(options: Options) {
  const { certPath } = options;

  const server = https.createServer({
    SNICallback: function(serverName, callback) {
      serverName = serverName.toLowerCase();

      // Faster lookup of certs (no promises :) )
      if (certs[serverName]) {
        return callback(null, tls.createSecureContext(certs[serverName]));
      }

      getCertForHost(certPath, serverName, options)
        .then(function(cert) {
          certs[serverName] = cert;
          return cert;
        })
        .then((secureContext) =>
          callback(null, tls.createSecureContext(certs[serverName]))
        );
    }
  });

  return server;
}

export { createTLSListener };
