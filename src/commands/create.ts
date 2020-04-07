import * as fs from 'fs';
import * as path from 'path';
import promiseFs from '../promiseFs';
import * as start from './start';
import * as url from 'url';
import { Argv } from 'yargs';

const command = 'create [target]';
const describe = 'Create a proxy for target';
const builder = (y: Argv): Argv<Options> => {
  y.option('e', {
    alias: 'edit-config',
    desc: 'Edit the generated config file'
  });
  return y as Argv<Options>;
};

interface Options {
  target: string;
  configFilename?: string;
  e?: boolean;
}

const handler = async function commandCreateProxy(options: Options) {
  const { target } = options;
  const targetUrl = url.parse(target);
  const sourceFile = path.join(__dirname, '..', 'initial-config.ts.txt');
  const destFileBase = path.resolve(
    '.',
    targetUrl.host || 'no-target-hostname'
  );

  let iteration = 0;
  let copied = false;
  let configFilename;

  const proxyConfigPath = path.resolve(__dirname, '..');
  const sampleConfigContents = (await promiseFs.readFileAsync(sourceFile))
    .toString('utf-8')
    .replace('$$TARGET$$', target);
  const configFileContents = Buffer.from(
    `import { ProxyConfig, routeBuilder } from '${proxyConfigPath}';\n\n${sampleConfigContents}`
  );

  do {
    configFilename = destFileBase + getIterationText(iteration) + '.ts';
    let exists = false;
    try {
      await promiseFs.accessAsync(configFilename, fs.constants.F_OK);
      exists = true;
    } catch {}
    if (exists) {
      iteration++;
      continue;
    }
    await promiseFs.writeFileAsync(configFilename, configFileContents);
    copied = true;
  } while (!copied && iteration < 100);
  if (!copied) {
    throw new Error('Cannot create config file');
  }
  options.configFilename = configFilename;
  return start.handler(options);
};

function getIterationText(iteration: number): string {
  return iteration === 0 ? '' : '-' + iteration;
}

export { command, describe, builder, handler };
