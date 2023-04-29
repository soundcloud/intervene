import adminServer from '../adminServer';
import { log } from '../logger';
import { Argv } from 'yargs';

const command = 'admin [port]';

// Make this a hidden command - this shouldn't show up on the help
const describe = false;

const builder = (y: Argv): Argv => {
  y.option('s', {
    alias: 'secret',
    requiresArg: true,
    desc: 'Secret to use for the URL',
    type: 'string'
  });
  return y;
};

const handler = async function commandAdminServer(options) {
  log.info('Starting admin server');
  if (options.s) {
    process.env.ADMIN_SECRET = options.s;
  }
  const server = await adminServer({ port: options.port });
  await server.start();
  log.info(`Admin server listening on ${server.info.address}:${server.info.port}`)
};

export { command, describe, builder, handler };
