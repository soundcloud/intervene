import * as forge from 'node-forge';
import { log } from './logger';
const pki = forge.pki;

interface Certificate {
  cert: Buffer;
  key: Buffer;
}

export default function createCertificate(attrs): Promise<Certificate> {
  return new Promise(function(resolve, reject) {
    var cert = pki.createCertificate();
    pki.rsa.generateKeyPair({ bits: 2048, workers: -1 }, function(err, keys) {
      if (err) {
        return reject(err);
      }

      cert.publicKey = keys.publicKey;

      cert.serialNumber = '' + Date.now();
      cert.validity.notBefore = new Date();
      if (attrs.notAfter) {
        cert.validity.notAfter = attrs.notAfter;
      } else {
        // Default to 30 days
        cert.validity.notAfter = new Date();
        cert.validity.notAfter.setDate(cert.validity.notAfter.getDate() + 30);
      }
      if (attrs.notBefore) {
        cert.validity.notBefore = attrs.notBefore;
      } else {
        // Default to starting 1 hour ago
        cert.validity.notBefore = new Date();
        cert.validity.notBefore.setHours(
          cert.validity.notBefore.getHours() - 1
        );
      }
      const calculatedAttrs = [
        {
          name: 'commonName',
          value: attrs.CN || 'www.set.attrs.cn.to.set.this.com'
        },
        {
          name: 'countryName',
          value: attrs.C || 'DE'
        },
        {
          shortName: 'ST',
          value: attrs.ST || 'TEST'
        },
        {
          name: 'localityName',
          value: attrs.L || 'TEST'
        },
        {
          name: 'organizationName',
          value: attrs.O || 'TEST'
        },
        {
          shortName: 'OU',
          value: attrs.OU || 'TEST'
        }
      ];
      cert.setSubject(calculatedAttrs);
      cert.setIssuer(calculatedAttrs);
      cert.setExtensions([
        {
          name: 'basicConstraints',
          cA: true
        },
        {
          name: 'keyUsage',
          keyCertSign: true,
          digitalSignature: true,
          nonRepudiation: true,
          keyEncipherment: true,
          dataEncipherment: true
        },
        {
          name: 'extKeyUsage',
          serverAuth: true,
          clientAuth: false,
          codeSigning: false,
          emailProtection: false,
          timeStamping: true
        },
        {
          name: 'nsCertType',
          client: true,
          server: true,
          email: true,
          objsign: true,
          sslCA: true,
          emailCA: false,
          objCA: true
        },
        {
          name: 'subjectKeyIdentifier'
        },
        {
          name: 'subjectAltName',
          altNames: [
            {
              type: 2, // DNS
              value: attrs.CN
            }
          ]
        }
      ]);

      cert.sign(keys.privateKey, forge.md.sha256.create());

      var pem = pki.certificateToPem(cert);

      resolve({
        cert: Buffer.from(pem, 'utf-8'),
        key: Buffer.from(pki.privateKeyToPem(keys.privateKey), 'utf-8')
      });
    });
  });
}
