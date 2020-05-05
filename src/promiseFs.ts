import * as Bluebird from 'bluebird';
import * as fs from 'fs';
import * as mkdirp from 'mkdirp';

export interface PromisifiedFs {
  lstatAsync: (path: string) => Promise<fs.Stats>;
  unlinkAsync: (path: string) => Promise<void>;
  readFileAsync: (path: string) => Promise<Buffer>;
  writeFileAsync: (path: string, content: string | Buffer) => Promise<void>;
  mkdirp: (path: string) => Promise<string>;
  accessAsync: (path: string, mode: number) => Promise<void>;
}

Bluebird.promisifyAll(fs);

// Horrible, but I can't find any other solution
const promiseFs: PromisifiedFs = (fs as any) as PromisifiedFs;

promiseFs.mkdirp = mkdirp;

export default promiseFs;
