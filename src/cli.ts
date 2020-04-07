#!/usr/bin/env node

import { useLogger, log, expandTags } from './logger';
import * as admin from './commands/admin';
import * as create from './commands/create';
import * as generateCert from './commands/generateCert';
import * as start from './commands/start';
import * as yargs from 'yargs';

const argv = yargs
  .option('l', {
    alias: 'logger',
    type: 'string',
    global: true,
    default: 'console',
    description: 'name of a logger to use (e.g. "console")'
  })
  .option('v', {
    alias: 'log-level',
    type: 'string',
    global: true,
    default: 'info',
    description: 'log level to use: debug,info,warn or error. Default: info'
  })
  .middleware(setupLogger)
  .command(create)
  .command(start)
  .command(admin)
  .command(generateCert)
  .version()
  .help().argv;

function setupLogger(argv) {
  if (argv.l) {
    useLogger(require('./loggers/' + argv.l).default, expandTags([argv.v]));
  }
}
