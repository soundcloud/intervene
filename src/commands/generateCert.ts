import { Argv } from 'yargs';
import createCert from '../createCert';
import promiseFs from '../promiseFs';
import { log } from '../logger';
import * as path from 'path';

const command = 'generate-cert [hostname]';

const describe = 'Generate a self signed certificate for a domain';

const builder = (y: Argv): Argv => {
  y.option('h', {
    alias: 'hostname',
    desc: 'Hostname to generate the certificate for'
  })
    .option('a', {
      alias: 'notafter',
      desc:
        'Date (ISO8601 YYYY-MM-DDTHH:MM:SSZ) after which the certificate is not valid'
    })
    .option('b', {
      alias: 'notbefore',
      desc:
        'Date (ISO8601 YYYY-MM-DDTHH:MM:SSZ) before which the certificate is not valid'
    })
    .option('f', {
      alias: 'filename',
      desc:
        'Filename to save the certificate to (the extension is replaced with .key for the private key)'
    });
  return y;
};

const handler = function commandGenerateCert(argv) {
  let notAfter = argv.a && new Date(argv.a);
  if (!notAfter) {
    notAfter = new Date();
    notAfter.setDate(notAfter.getDate() + 7);
  }
  let notBefore = argv.b && new Date(argv.b);
  if (!notBefore) {
    notBefore = new Date();
    notBefore.setHours(notBefore.getHours() - 1);
  }
  log.info(`Creating certificate for ${argv.hostname}`);
  createCert({
    CN: argv.hostname,
    notAfter,
    notBefore
  })
    .then(({ cert, key }) => {
      const certFileName = argv.f || path.resolve(argv.hostname + '.pem');
      const keyFileName =
        path.join(
          path.dirname(certFileName),
          path.basename(certFileName, '.pem')
        ) + '.key';
      return Promise.all([
        promiseFs.writeFileAsync(certFileName, cert),
        promiseFs.writeFileAsync(keyFileName, key)
      ]).then(() => ({ certFileName, keyFileName }));
    })
    .then(({ certFileName, keyFileName }) => {
      log.info(`Certificate written to ${certFileName}`);
      log.info(`Key written to ${keyFileName}`);
    });
};

export { command, handler, describe, builder };
