## Contributing

### Running tests

Tests can be run using `make test`

There are 3 different levels of test - the unit tests, run by jest, under a `__tests__` directory next to the module they're testing.  Then there's the `integration-tests` directory, which is also run by jest, but contains tests that test combined parts of the library, or tests that integrate with the external environment. For instance, `httpRequest` is tested in the integration-tests directory, as we make a small HTTP server and validate we can correctly call this server and receive the correct responses.  The `proxy.spec.ts` in the integration-tests directory tests many of the features in it's entirety.

The final set of tests is the end-to-end tests. These require user interation to run (and therefore test the process elevation and the proxy as a command line tool). To run these, use `end-to-end-tests/run.sh`.  These create a local proxy, targetting an externally hosted HTTPS server, so test the full workflow of the package.

If you'd like to contribute to these tests, use the github.com/bruderstein/intervene-test repoistory to start a local version of the server and then use `end-to-end-tests/run-local.sh`

### Architecture

`intervene` is a [hapi](https://hapijs.com) server, that has a default route that calls the target server, interprets the response, then responds with that response.

The configuration file is parsed by TypeScript (`parseTypescript.ts`), then run in a `vm` module to expose the resulting object (`configLoader.ts`).

The proxy is then created, adding the specific routes in `createProxy.ts`.

Administrative actions (i.e. actions that require elevated privileges) are performed in `adminRequests.ts`, which uses `adminServer.ts` to create an HTTP server, running locally on a random free port, with a long "secret" as the URL prefix. As this process is elevated, the only communication possible is via HTTP. Once this admin server starts, the main process connects to a log endpoint, which uses Server Side Events to emit log lines.

The `logger.ts` is used to log all requests, and is configured on startup - for instance, the main process normally uses the console logger, the admin process emits events on `/log` endpoint.

Many actions need to be cleaned up when the process shuts down (including shutting down the admin server). These are handled in `cleanupQueue.ts`, which runs all registered cleanups on a SIGINT (Ctrl-C). If the cleanup takes to long, a SIGTERM is sent to itself to terminate the process. This can result in leftover admin processes.  (There is an idea to add a heartbeat to the admin server, such that that will automatically terminate if no heartbeat is received after a given timeout.)

In order to listen on a privileged port (ports <= 1023), the admin server is used as a second proxy, proxying through to the main process which listens on a random free high numbered port.

E.g. To listen on port 443, the admin server (running as a privileged process) listens on port 443 and proxies all requests through to (say) port 50568, where the main process is listening. The admin server listening on port 443 uses the same `createProxy.ts` to create a proxy for the port, with an empty `routes` configuration. The main process uses the configuration file provided, but overwrites the `localUrl` property to `http://localhost:50568`.
