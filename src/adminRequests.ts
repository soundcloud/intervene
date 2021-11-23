import { RouteOptionsCors } from '@hapi/hapi';
import Axios from 'axios';
import * as Bluebird from 'bluebird';
import * as crypto from 'crypto';
import * as EventSource from 'eventsource';
import { log } from './logger';
import * as path from 'path';
import * as sudoPrompt from 'sudo-prompt';
import { HostAdditionResponse } from './adminServer';
import { registerCleanup, removeCleanup } from './cleanupQueue';
import getPort from 'get-port';
import * as http from 'http';

// Force using IPV4 for outgoing connections
// because the admin server only listens on IPV4 but
// outgoing connections to localhost seem to default to IPV6
// since Node.js 17 (at least on macOS)
const agent = new http.Agent(
  // `family` is missing from AgentOptions type
  { family: 4 } as any
);
const axios = Axios.create({ httpAgent: agent });

const sudoExec = Bluebird.promisify<void, string, { name?: string }>(
  sudoPrompt.exec,
  { context: sudoPrompt }
);

let adminServer: null | Promise<{ port: number; adminSecret: string }> = null;

async function addHostEntry(hostname: string): Promise<HostAdditionResponse> {
  const { port, adminSecret } = await getAdminServer();
  const response = await axios.post(
    `http://localhost:${port}/${adminSecret}/hosts`,
    { hostname }
  );
  return response.data;
}

async function removeHostEntry(
  hostname: string
): Promise<HostAdditionResponse> {
  const { port, adminSecret } = await getAdminServer();
  const response = await axios.delete(
    `http://localhost:${port}/${adminSecret}/hosts/${encodeURIComponent(
      hostname
    )}`
  );
  return response.data;
}

async function trustCertificate(certFilename: string) {
  const { port, adminSecret } = await getAdminServer();
  const response = await axios.post(
    `http://localhost:${port}/${adminSecret}/trust`,
    { certFilename, homeDirectory: process.env.HOME }
  );
  return response.data;
}

async function untrustCertificate(certFilename: string) {
  const { adminSecret, port } = await getAdminServer();
  const response = await axios.post(
    `http://localhost:${port}/${adminSecret}/untrust`,
    { certFilename, homeDirectory: process.env.HOME }
  );
  return response.data;
}

async function shutdown() {
  const { port, adminSecret } = await getAdminServer();
  return await axios.post(`http://localhost:${port}/${adminSecret}/-/shutdown`);
}

async function portProxy(
  target: string,
  localPort: number,
  certificatePath: string,
  cors: boolean | RouteOptionsCors
) {
  const { port, adminSecret } = await getAdminServer();
  return await axios.post(
    `http://localhost:${port}/${adminSecret}/port-proxy`,
    {
      target,
      localPort,
      certificatePath,
      cors
    }
  );
}

async function getPortProxies(): Promise<{
  [key: string]: { tls: boolean; localPort: number };
}> {
  const { port, adminSecret } = await getAdminServer();
  return (await axios(`http://localhost:${port}/${adminSecret}/port-proxies`))
    .data;
}

async function stopPortProxy(proxyPort: number): Promise<void> {
  const { port, adminSecret } = await getAdminServer();
  return (await axios.post(
    `http://localhost:${port}/${adminSecret}/stop-port-proxy`,
    { port: proxyPort }
  )).data;
}

async function getAdminServer(): Promise<{
  port: number;
  adminSecret: string;
}> {
  if (!adminServer) {
    adminServer = startAdminServer();
  }

  return adminServer;
}

async function startAdminServer(): Promise<{
  port: number;
  adminSecret: string;
}> {
  if (adminServer) {
    return adminServer;
  }

  // Allow starting an admin server separately for debugging purposes
  if (process.env.ADMIN_SECRET && process.env.ADMIN_PORT) {
    adminServer = Promise.resolve({
      adminSecret: process.env.ADMIN_SECRET,
      port: parseInt(process.env.ADMIN_PORT, 10)
    });
    return adminServer;
  }
  let shouldPoll = true;

  const stopPolling = async () => (shouldPoll = false);

  const adminSecret = (process.env.ADMIN_SECRET = crypto
    .pseudoRandomBytes(20)
    .toString('base64')
    .replace(/[+\/=]/g, 'x'));

  const port = await getPort();

  log.info('Starting admin server');
  const cliJs = path.resolve(__dirname, 'cli.js');
  sudoExec(
    `${process.argv[0]} "${cliJs}" admin ${port} --secret "${adminSecret}"`,
    {
      name: 'Intervene'
    }
  ).catch((e) => {
    // Ignore signals to stop the server
    if (e && e.signal !== 'SIGINT') {
      log.error(`Error starting admin server ${e}`, e);
    }
    stopPolling();
  });

  // Start polling for the server started
  registerCleanup(stopPolling);

  adminServer = new Promise<{ port: number; adminSecret: string }>(
    (resolve, reject) => {
      function makeCall() {
        return axios.get(`http://localhost:${port}/${adminSecret}/-/health`);
      }

      async function poll(pollCount) {
        if (!shouldPoll) {
          return;
        }

        if (pollCount > 60) {
          // 30 second(ish) timeout. Remember the user has to type their password in in this time
          throw new Error('Timeout waiting for admin server');
        }
        try {
          const result = await makeCall();
          removeCleanup(stopPolling);
          registerCleanup(shutdown, { order: 1000 });
          return resolve({ adminSecret, port });
        } catch (e) {
          setTimeout(() => poll(pollCount + 1), getPollDelay(pollCount));
        }
      }
      poll(0);
    }
  );

  return adminServer.then(({ adminSecret, port }) => {
    const es = new EventSource(`http://localhost:${port}/${adminSecret}/log`);
    es.addEventListener('end', function() {
      this.close();
    });

    es.addEventListener('message', (e) => {
      try {
        const logMessage = JSON.parse(e.data);
        log({
          ...logMessage,
          message: `[ADMINSERVER] ${logMessage.message}`,
          tags: [...Object.keys(logMessage.tags), 'admin', 'remote-log']
        });
      } catch (e) {
        log.error(
          'Error parsing JSON log from admin server: ' + e.toString(),
          e
        );
      }
    });
    registerCleanup(() => es.close());
    return { adminSecret, port };
  });
}

function getPollDelay(pollCount: number): number {
  // This gives an exponential backoff with a max of 500: 20, 80, 180, 320, 500
  return Math.min((pollCount + 1) * ((pollCount + 1) / 5) * 100, 500);
}

export {
  addHostEntry,
  removeHostEntry,
  trustCertificate,
  untrustCertificate,
  portProxy,
  getPortProxies,
  stopPortProxy
};
