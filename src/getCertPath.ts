import * as path from 'path';
import promiseFs from './promiseFs';

let overridePath: string | null = null;

export function setCertPath(certPath: string) {
  overridePath = certPath;
}

export async function getCertPath(): Promise<string> {
  const certPath =
    overridePath || path.join(process.env.HOME || '.', '.dev-ssl-certs');
  let exists = false;
  try {
    const stat = await promiseFs.lstatAsync(certPath);
    exists = stat.isDirectory();
  } catch {}

  if (!exists) {
    await promiseFs.mkdirp(certPath);
  }

  return certPath;
}
