import * as Bluebird from 'bluebird';
import { Server } from '@hapi/hapi';
import * as hostile from 'hostile';
import * as joi from 'joi';
import { spawn } from 'child_process';
import { log, useLogger, Logger } from './logger';
import * as susie from 'susie';
import * as os from 'os';
import { createProxy } from './createProxy';
import { registerCleanup, removeCleanup, runCleanups } from './cleanupQueue';
import { ProxyConfig } from './ProxyConfig';
import { applyConfigDefaults } from './applyConfigDefaults';
import { setCertPath } from './getCertPath';

const hostileSet = Bluebird.promisify<void, string, string>(hostile.set, {
  context: hostile
});

const hostileRemove = Bluebird.promisify<void, string, string>(hostile.remove, {
  context: hostile
});

type IpHost = [string, string];

const hostileGet = Bluebird.promisify<IpHost[], boolean>(hostile.get, {
  context: hostile
});

interface HostAdditionSuccessResponse {
  success: true;
  added?: boolean;
  hostname: string;
}

interface HostAdditionErrorResponse {
  success: false;
  error: string;
}

export type HostAdditionResponse =
  | HostAdditionSuccessResponse
  | HostAdditionErrorResponse;

async function adminServer({ port }): Promise<Server> {
  log.info(`Starting admin server on port ${port}`);
  const server = new Server({
    port: port || 1591,
    debug: { request: ['*'] }
  });

  server.validator(joi);

  const portProxies = {};

  const secret = process.env.ADMIN_SECRET || '';
  if (secret.length < 20) {
    throw new Error(
      'Cannot start without env ADMIN_SECRET set to at least 20 characters'
    );
  }

  await server.register(susie);

  server.route([
    {
      method: 'GET',
      path: `/${secret}/-/health`,
      handler(request, h) {
        return 'OK';
      }
    },
    {
      method: 'POST',
      path: `/${secret}/-/shutdown`,
      handler(request, h) {
        setTimeout(() => {
          runCleanups().then(() => server.stop());
        }, 0);
        return 'OK';
      }
    },
    {
      method: 'POST',
      path: `/${secret}/hosts`,
      options: {
        validate: {
          payload: {
            hostname: joi.string()
          }
        },
        async handler(request, h): Promise<HostAdditionResponse> {
          try {
            const hostname = (request.payload as any).hostname;
            const hosts: any[] = await hostileGet(false);
            const exists = hosts.some(
              ([ip, host]) =>
                ip === '127.0.0.1' && host.split(/\s+/).indexOf(hostname) !== -1
            );

            await hostileSet('127.0.0.1', hostname);
            return { success: true, added: !exists, hostname };
          } catch (e) {
            return { success: false, error: e.toString() };
          }
        }
      }
    },
    {
      method: 'DELETE',
      path: `/${secret}/hosts/{hostname}`,
      options: {
        async handler(request, h) {
          const hostname = (request.params as any).hostname;

          return hostileRemove('127.0.0.1', hostname).then(() => {
            return { success: true, hostname };
          });
        }
      }
    },

    {
      method: 'POST',
      path: `/${secret}/trust`,
      options: {
        validate: {
          payload: {
            certFilename: joi.string(),
            homeDirectory: joi.string()
          }
        },
        async handler(request, h) {
          const { certFilename, homeDirectory } = request.payload as any;

          // TODO: check if mac or linux here
          let executable: string | null = null;
          let args: string[] | null = null;

          if (os.platform() === 'darwin') {
            executable = 'security';
            args = [
              'add-trusted-cert',
              '-d',
              '-r',
              'trustRoot',
              '-p',
              'ssl',
              '-k',
              '/Library/Keychains/System.keychain',
              certFilename
            ];
          }

          if (os.platform() === 'linux') {
            // For linux, it's important to clear any existing certificate out first
            await untrustCertificate({ homeDirectory, certFilename });
            executable = 'certutil';
            args = [
              '-d',
              `sql:${homeDirectory}/.pki/nssdb`,
              '-A',
              '-t',
              'P,,',
              '-n',
              certFilename,
              '-i',
              certFilename
            ];
          }

          if (executable) {
            try {
              log.info(`Trusting certificate ${certFilename}`);
              const result = await spawnProcess(executable, args);
              const success = result.code === 0;
              return {
                success,
                code: result.code,
                stdout: result.stdout,
                stderr: result.stderr
              };
            } catch (e) {
              log.error(`Error spawning ${e}`, e);
              return { success: false };
            }
          }
          // If we got here, then we don't know how to trust certificates on this platform
          return {
            success: false,
            reason: 'unsupported platform:' + os.platform()
          };
        }
      }
    },
    {
      method: 'POST',
      path: `/${secret}/untrust`,
      options: {
        validate: {
          payload: {
            certFilename: joi.string(),
            homeDirectory: joi.string()
          }
        },
        async handler(request, h) {
          const { certFilename, homeDirectory } = request.payload as any;

          return await untrustCertificate({ certFilename, homeDirectory });
        }
      }
    },
    {
      method: 'POST',
      path: `/${secret}/port-proxy`,
      options: {
        validate: {
          payload: {
            target: joi.string(),
            localPort: joi.number(),
            certificatePath: joi.string(),
            cors: [
              joi.boolean(),
              joi.object({
                origin: joi.array().items(joi.string()),
                maxAge: joi.number(),
                headers: joi.array().items(joi.string()),
                additionalHeaders: joi.array().items(joi.string()),
                exposedHeaders: joi.array().items(joi.string()),
                additionalExposedHeaders: joi.array().items(joi.string()),
                credentials: joi.boolean()
              })
            ]
          }
        },
        handler(request, h) {
          const payload: any = request.payload;
          const proxyConfig: ProxyConfig = {
            target: 'http://localhost:' + payload.localPort,
            localUrl: payload.target,
            createPrivilegedPortProxy: false,
            cors: payload.cors || undefined,
            writeEtcHosts: false
          };
          const appliedConfig = applyConfigDefaults(proxyConfig, process.cwd());
          setCertPath(payload.certificatePath);

          const tls = /^https:/i.test(
            appliedConfig.localParsedUrl.protocol || ''
          );

          const localPort =
            parseInt(appliedConfig.localParsedUrl.port || '0', 10) ||
            (tls ? 443 : 80);

          log.info('Starting privileged port proxy');

          return createProxy(appliedConfig)
            .then((proxy) => proxy.start().then(() => proxy))
            .then((proxy) => {
              const cleanup = () => proxy.stop();
              registerCleanup(cleanup);
              portProxies[localPort] = {
                tls,
                localPort: payload.localPort,
                cleanup
              };
              return { success: true };
            })
            .catch((e) => {
              return { success: false, message: e.toString(), code: e.code };
            });
        }
      }
    },
    {
      method: 'POST',
      path: `/${secret}/stop-port-proxy`,
      options: {
        validate: {
          payload: {
            port: joi.number()
          }
        },
        handler() {
          const cleanup = portProxies[port].cleanup;
          delete portProxies[port];
          removeCleanup(cleanup);
          return cleanup().then(() => ({ success: true }));
        }
      }
    },
    {
      method: 'GET',
      path: `/${secret}/port-proxies`,
      handler() {
        return Object.keys(portProxies).reduce((all, port) => {
          all[port] = {
            tls: portProxies[port].tls,
            localPort: portProxies[port].localPort
          };
          return all;
        }, {});
      }
    },
    {
      method: 'GET',
      path: `/${secret}/log`,
      handler(request, h: any) {
        const response = h.event({
          data: { tags: ['internal'], message: 'Admin log starting' }
        });
        useLogger(
          {
            name: 'remote-log',
            log(message) {
              // Strip the `data` tag out, as it often can't be serialized
              h.event({
                data: {
                  message: message.message,
                  tags: message.tags,
                  code: message.code
                }
              });
            }
          },
          ['app', 'request', 'debug', 'info', 'warn', 'error']
        );
        registerCleanup(() => {
          // Close the stream
          h.event(null);
        });
        return response;
      }
    }
  ]);

  return server;
}

async function untrustCertificate(options) {
  const { certFilename, homeDirectory } = options;
  let executable: string | undefined = undefined;
  let args: string[] | undefined = undefined;
  if (os.platform() === 'darwin') {
    executable = 'security';
    args = ['remove-trusted-cert', '-d', certFilename];
  }

  if (os.platform() === 'linux') {
    executable = 'certutil';
    args = ['-d', `sql:${homeDirectory}/.pki/nssdb`, '-D', '-n', certFilename];
  }

  if (executable) {
    try {
      log.info(`Untrusting certificate ${certFilename}`);
      const result = await spawnProcess(executable, args);
      const success = result.code === 0;
      return {
        success,
        code: result.code,
        stdout: result.stdout,
        stderr: result.stderr
      };
    } catch (e) {
      log.error(`Error spawning ${e}`, e);
      return { success: false };
    }
  }
  // If we got here, then we don't know how to trust certificates on this platform
  return {
    success: false,
    reason: 'unsupported platform:' + os.platform()
  };
}

function spawnProcess(
  command,
  args,
  options = {}
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    log.debug(`Spawning "${command}" ${args.map((a) => `"${a}"`).join(' ')}`);
    const process = spawn(command, args);
    const output: Buffer[] = [];
    const errors: Buffer[] = [];
    let stdout: Buffer;
    let stderr: Buffer;

    process.stdout.on('data', (data) => {
      if (typeof data === 'string') {
        output.push(Buffer.from(data));
      } else {
        output.push(data);
      }
    });
    process.stdout.on('end', () => {
      stdout = Buffer.concat(output);
    });
    process.stderr.on('end', () => {
      stderr = Buffer.concat(errors);
    });
    process.on('close', (code) => {
      resolve({
        code: code || 0,
        stdout: stdout.toString('utf-8'),
        stderr: stderr.toString('utf-8')
      });
    });
  });
}

export default adminServer;
