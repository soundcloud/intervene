# AGENTS.md

intervene is an HTTP/HTTPS proxy for local development that intercepts requests and applies user-defined routing rules. Published to npm as `intervene`.

## Build and test commands

```bash
npm run build          # TypeScript compile + copy brotli-decode assets
npm test               # unit + integration tests (sequential)
npm run unit-test      # jest src/**/__tests__/*.spec.ts
npm run integration-test  # jest integration-tests/**/*.spec.ts
make test              # used by CI (equivalent to npm test)
```

Single-file test: `npx jest <path>` (e.g. `npx jest src/__tests__/createProxy.spec.ts`).

## Code style

- TypeScript 4.9, compiled with `tsc`. No bundler.
- Jest with `ts-jest` preset for tests. Test files live in `src/__tests__/` (unit) and `integration-tests/` (integration).
- Prettier: single quotes, always parens on arrow functions (configured in `package.json`).
- CommonJS modules (`require`/`module.exports` in compiled output).

## Release

semantic-release with the **Angular** commit preset. Commits on `master` must be conventional:

| Prefix                                | Release             |
| ------------------------------------- | ------------------- |
| `fix:`                                | patch               |
| `feat:`                               | minor               |
| `refactor:`                           | patch (custom rule) |
| `revert:`                             | patch (custom rule) |
| `feat!:` or `BREAKING CHANGE:` footer | major               |

**No local or CI enforcement** — there is no commitlint or husky. Agents must verify commit format manually before committing.

Release config: `release.config.js`. Plugins: commit-analyzer, release-notes-generator, changelog, npm, git, github.

## Node and npm

- `engines.node`: `>=20.17.0`
- `engines.npm`: `>=11`
- `.nvmrc` is the source of truth for local and CI Node version.
- npm 11 lockfile format — lockfiles generated with npm 11 will fail `npm ci` on npm 10.

## CI

GitHub Actions workflows in `.github/workflows/`:

| Workflow           | Trigger                        | Purpose                                                        |
| ------------------ | ------------------------------ | -------------------------------------------------------------- |
| `run-tests.yml`    | push/PR to `master`            | Test matrix: Node 20/22/24 on ubuntu + macOS                   |
| `release.yml`      | `workflow_run` after CI passes | semantic-release with npm OIDC trusted publishing (provenance) |
| `publish-docs.yml` | —                              | Documentation publishing                                       |

`release.yml` uses `GH_TOKEN` (from `CI_TOKEN` secret) for GitHub releases and npm OIDC (no `NPM_TOKEN`) for npm publishing.

## Project structure

```
src/              TypeScript source; CLI entry point (cli.ts), proxy core (createProxy.ts), config loading
src/__tests__/    Unit tests
src/commands/     CLI subcommands
src/loggers/      Output formatters
integration-tests/  End-to-end proxy tests with a sample server
.github/workflows/  CI and release workflows
```
