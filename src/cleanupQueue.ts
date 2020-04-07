import { log } from './logger';

type CleanupCallback = () => void | Promise<any>;
interface Cleanup {
  order: number;
  callback: CleanupCallback;
}
const cleanups: Cleanup[] = [];

export function registerCleanup(
  cleanup: CleanupCallback,
  options?: { order: number }
) {
  cleanups.push({ callback: cleanup, order: (options && options.order) || 0 });
}

export function removeCleanup(cleanup: () => void | Promise<any>) {
  const index = cleanups.findIndex((e) => e.callback === cleanup);
  cleanups.splice(index, 1);
}

// Used for testing
export function removeAllCleanups() {
  cleanups.length = 0;
}

export async function runCleanups(shutdown: boolean = true) {
  log.info('Shutting down...');
  if (shutdown) {
    const timeout = setTimeout(() => checkStillRunning(1), 2000);
    timeout.unref();
  }
  let sortedCleanups = cleanups.sort((a, b) => a.order - b.order);
  runCleanup(sortedCleanups, 0);
}

function runCleanup(list: Cleanup[], index) {
  if (index >= list.length) {
    log.info('Shutdown complete');
    return;
  }
  // Convert the result to a promise if it isn't already
  return Promise.resolve()
    .then(() => list[index].callback())
    .then(() => {
      runCleanup(list, index + 1);
    });
}

function checkStillRunning(iteration: number) {
  switch (iteration) {
    case 1:
      log.info('Still shutting down...');
      break;

    case 2:
      log.info('This is taking a while...');
      break;

    case 3:
      log.info('Ok, giving up. Sending SIGTERM to ourselves to terminate');
      process.kill(process.pid, 'SIGTERM');
      break;
  }
  setTimeout(() => checkStillRunning(iteration + 1), 1000).unref();
}

process.on('SIGINT', runCleanups);
