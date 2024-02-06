import { applyConfigDefaults } from '../applyConfigDefaults';
import * as childProcess from 'child_process';
import { createProxy } from '../createProxy';
import { loadConfig } from '../configLoader';
import * as fs from 'fs';
import * as path from 'path';
import { log } from '../logger';
import { runCleanups, registerCleanup } from '../cleanupQueue';
import { Argv } from 'yargs';
import { Server } from '@hapi/hapi';

const command = 'start [configFilename]';
const describe = 'Start a proxy using the given config filename';
const builder = (y: Argv): Argv => {
  y.option('e', {
    alias: 'edit-config',
    desc: 'Edit the config file'
  });
  return y;
};

let proxyServer: Server;

const handler = async function commandStartProxy(options) {
  const { configFilename } = options;
  // Get the directory of the config file, if it's a URL, just use the current directory
  const configDirectory = /^https?:\/\//.test(configFilename)
    ? process.cwd()
    : path.dirname(configFilename);
  return loadConfig(configFilename)
    .then((proxyConfig) => applyConfigDefaults(proxyConfig, configDirectory))
    .then((proxyConfig) => createProxy(proxyConfig))
    .then((server) => (proxyServer = server))
    .then((server) => {
      log.info('Starting server...');
      return Promise.all([server, server.start()]);
    })
    .then(([server]) => {
      const address = server.listener.address();
      registerCleanup(() => proxyServer.stop());
      if (!address) {
        log.error('Server did not start');
      } else {
        if (typeof address !== 'string') {
          log.info(`Server started on ${address.address}:${address.port}`);
        } else {
          log.info(`Server started on ${address}`);
        }
      }
      const restartServer = function() {
        log.info('Configuration updated, reloading proxy');
        loadConfig(configFilename)
          .then((proxyConfig) => proxyServer.stop().then(() => proxyConfig))
          .then((proxyConfig) =>
            applyConfigDefaults(proxyConfig, configDirectory)
          )
          .then((proxyConfig) => createProxy(proxyConfig))
          .then((server) => {
            proxyServer = server;
            return server.start();
          })
          .then(() => {
            log.info('Server config updated');
          });
      };
      let reloadTimeout: NodeJS.Timeout | null = null;
      const configFileUpdate = function() {
        if (reloadTimeout) {
          clearTimeout(reloadTimeout);
          reloadTimeout = null;
        }
        reloadTimeout = setTimeout(restartServer, 500);
      };
      // Only watch local files
      if (!configFilename.match(/^https?:\/\//)) {
        const configFullPath = path.resolve(configFilename);
        const configDir = path.dirname(configFullPath);
        const configFilenameOnly = path.basename(configFullPath);
        fs.watch(configDir, { persistent: false }, (event, filename) => {
          if (filename && filename.toLowerCase() === configFilenameOnly.toLowerCase()) {
            configFileUpdate();
          }
        });
      }
    })
    .then(() => {
      if (options.e) {
        const editor =
          process.env.TS_EDITOR ||
          process.env.VISUAL ||
          process.env.EDITOR ||
          'vi';
        const editorProcess = childProcess.spawn(editor, [configFilename], {
          stdio: 'inherit'
        });
        editorProcess.unref();
      }
    })
    .catch((e) => {
      if (e.code === 'EACCES') {
        log.error(`Access denied error listening on port ${e.port}`);
        if (e.port < 1024) {
          log.error('You need to start with sudo to listen to ports < 1024');
        }
      } else {
        log.error(`Error starting server ${e.toString()}`, e);
      }
      return runCleanups();
    });
};

export { command, describe, builder, handler };
