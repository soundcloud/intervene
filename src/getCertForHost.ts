import { trustCertificate, untrustCertificate } from './adminRequests';
import * as Bluebird from 'bluebird';
import createCert from './createCert';
import * as fs from 'fs';
import { log } from './logger';
import * as path from 'path';
import * as tls from 'tls';
import * as forge from 'node-forge';
import promiseFs from './promiseFs';
export interface CertificateOptions {
  country?: string;
  locality?: string;
  organization?: string;
  organizationalUnit?: string;
}

const HOUR_IN_MS = 60 * 60 * 1000;
const DAY_IN_MS = 24 * HOUR_IN_MS;

const certPromises: { [key: string]: Promise<tls.SecureContextOptions> | undefined } = {};

export async function getCertForHost(
  certPath: string,
  serverName: string,
  options: CertificateOptions
): Promise<tls.SecureContextOptions> {
  const existingPromise = certPromises[serverName];
  if (existingPromise) {
    return existingPromise;
  }
  const certPromise = loadOrCreateCertForHost(certPath, serverName, options);
  certPromises[serverName] = certPromise;
  return certPromise;
}

async function loadOrCreateCertForHost(
  certDirectory: string,
  serverName: string,
  options: CertificateOptions
): Promise<tls.SecureContextOptions> {
  const certFileName = path.join(
    certDirectory,
    serverName.toLowerCase() + '.pem'
  );
  const keyFileName = path.join(
    certDirectory,
    serverName.toLowerCase() + '.key'
  );
  let stats: fs.Stats | null = null;
  let cert: tls.SecureContextOptions | null = null;

  try {
    stats = await promiseFs.lstatAsync(certFileName);
  } catch {
    // Need to create
  }

  if (stats && stats.isFile()) {
    const pemFile = await promiseFs.readFileAsync(certFileName);
    const certDetails = forge.pki.certificateFromPem(pemFile.toString('utf-8'));

    if (certDetails.validity.notAfter.getTime() - Date.now() < DAY_IN_MS) {
      log.info(
        'Existing certificate expires in less than 24 hours, removing trust and deleting...'
      );
      // Certificate expires in less than 24 hours, so remove it and we'll create a new one
      try {
        await untrustCertificate(certFileName);
      } catch {
        // Ignore errors untrusting - there's nothing we can do anyway
      }
      try {
        await Promise.all([
          promiseFs.unlinkAsync(certFileName),
          promiseFs.unlinkAsync(keyFileName)
        ]);
      } catch {
        // Errors deleting don't matter
      }
    } else {
      // Certificate is fine and still valid, so just load it
      log.info('Loading on-disk key for ' + serverName);
      const keyFile = promiseFs.readFileAsync(keyFileName);
      const { keyContent, trust } = await Bluebird.props({
        keyContent: keyFile,
        trust: trustCertificate(certFileName)
      });
      if (trust && trust.success) {
        log.info(`Successfully trusted certificate`);
      } else if (trust) {
        log.error(`Trusting certificate failed. Exit code ${trust.code}. `);
        log.error(trust.stdout || '');
        log.error(trust.stderr || '');
      }

      cert = { cert: pemFile, key: keyContent };
    }
  }

  if (!cert) {
    log.info('Creating cert for ' + serverName);
    const newCert = await createCert({
      notBefore: new Date(Date.now() - HOUR_IN_MS),
      notAfter: new Date(Date.now() + DAY_IN_MS * 7),
      CN: serverName.toLowerCase()
    });
    log.info('Created cert for ' + serverName);
    await Promise.all([
      promiseFs
        .writeFileAsync(certFileName, newCert.cert)
        .then(() => trustCertificate(certFileName)),
      promiseFs.writeFileAsync(keyFileName, newCert.key)
    ]);
    cert = newCert;
  }

  return cert;
}

export async function preloadCertForHost(
  certPath: string,
  serverName: string,
  options: CertificateOptions
): Promise<void> {
  await getCertForHost(certPath, serverName, options);
}

export async function clearLocalCertCache() {
  Object.keys(certPromises).forEach(
    (serverName) => delete certPromises[serverName]
  );
}
