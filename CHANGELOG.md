## [5.0.1](https://github.com/soundcloud/intervene/compare/v5.0.0...v5.0.1) (2026-04-06)


### Bug Fixes

* **ci:** add issues:write permission for semantic-release ([26d1754](https://github.com/soundcloud/intervene/commit/26d175435b046c0b8b83777a93d08a00ab6f7f2a))
* **ci:** remove persist-credentials:false for GITHUB_TOKEN auth ([e6ff774](https://github.com/soundcloud/intervene/commit/e6ff77407812056c88effa7da5d47adbaf546028))
* **ci:** use intervene-ci PAT for semantic-release ([bd751ba](https://github.com/soundcloud/intervene/commit/bd751ba815ecdc0f5e0af135fbdd6861103b82d1))
* **ci:** work around broken npm in Node 22.22.2 ([0cef37c](https://github.com/soundcloud/intervene/commit/0cef37c649b8a7e78addda4598e241c249fcc5c1)), closes [nodejs/node#62425](https://github.com/nodejs/node/issues/62425) [actions/runner-images#13883](https://github.com/actions/runner-images/issues/13883)

# [5.0.0](https://github.com/soundcloud/intervene/compare/v4.0.0...v5.0.0) (2026-03-25)


### Bug Fixes

* **ci:** drop Node 20 from test matrix, require Node >=22 ([f76b73f](https://github.com/soundcloud/intervene/commit/f76b73f15258b4de257a0737610312580bc67121))
* **ci:** regenerate lockfile and ensure consistent npm version ([df69a56](https://github.com/soundcloud/intervene/commit/df69a5647b54c90162d67c1d1461a3ec420b9afd))
* type-safe route method in parseRoutePath ([8a2e134](https://github.com/soundcloud/intervene/commit/8a2e1343325cf9ab4ab97c92ae737377b889960a))


### Features

* **ci:** pin npm 11 across CI, restore Node 20 support ([c4f92d9](https://github.com/soundcloud/intervene/commit/c4f92d9193b1b107e0315b3a851c34338b6c54a1))


### BREAKING CHANGES

* **ci:** require Node >=20.17.0 and npm >=11. Drops
support for Node 12, 14, 15, 16, 18 and npm <11.

Made-with: Cursor

# [4.0.0](https://github.com/soundcloud/intervene/compare/v3.1.7...v4.0.0) (2024-09-03)


### Bug Fixes

* make import replacement support `import type` ([368602f](https://github.com/soundcloud/intervene/commit/368602ff2e738f8e3e560d99ea3230f6e95e8354))


### chore

* **deps:** update Hapi, @types/node  & typescript ([9f12331](https://github.com/soundcloud/intervene/commit/9f1233156f720ffe69906c6c36da0b964bade46a))


### BREAKING CHANGES

* **deps:** drop support for node 14.

## [3.1.7](https://github.com/soundcloud/intervene/compare/v3.1.6...v3.1.7) (2023-04-18)


### Bug Fixes

* correct the error code from EACCESS to EACCES ([84565f5](https://github.com/soundcloud/intervene/commit/84565f548a2cd5a9e330e6f20cbdb05f180747ce))

## [3.1.6](https://github.com/soundcloud/intervene/compare/v3.1.5...v3.1.6) (2023-02-17)


### Bug Fixes

* Pin @types/node to a version compatible with TS v3 ([e45df88](https://github.com/soundcloud/intervene/commit/e45df8869a83f2891aed11e4685b61907ce0ff54))

## [3.1.5](https://github.com/soundcloud/intervene/compare/v3.1.4...v3.1.5) (2023-02-17)


### Bug Fixes

* Downgrade @types/bluebird to v3.5.34 ([899f03b](https://github.com/soundcloud/intervene/commit/899f03bb379a52bdd43b50ff11727ce60f10001f)), closes [#52](https://github.com/soundcloud/intervene/issues/52)

## [3.1.4](https://github.com/soundcloud/intervene/compare/v3.1.3...v3.1.4) (2023-02-17)


### Bug Fixes

* Use semantic-release plugin defaults so that fix from [#51](https://github.com/soundcloud/intervene/issues/51) works ([8bd5b77](https://github.com/soundcloud/intervene/commit/8bd5b77369cb8b4003c1529eb6a5e790eb9fbec3))

## [3.1.3](https://github.com/soundcloud/intervene/compare/v3.1.2...v3.1.3) (2023-02-17)


### Bug Fixes

* Pin @types/bluebird to the last version that worked with TS v3 ([c4e6f89](https://github.com/soundcloud/intervene/commit/c4e6f890cc986ed5e0af4ba8028c632b7579adf4))
* Use tilde range for typescript ([d7aa290](https://github.com/soundcloud/intervene/commit/d7aa29049d43ce5e9eeccc97026c61a37a6ec07a))

## [3.1.2](https://github.com/soundcloud/intervene/compare/v3.1.1...v3.1.2) (2023-02-17)


### Bug Fixes

* Run semantic-release/npm before semantic-release/git ([65f23c1](https://github.com/soundcloud/intervene/commit/65f23c10f082993afab4bbb3be5f6dec6d502585))

## [3.1.1](https://github.com/soundcloud/intervene/compare/v3.1.0...v3.1.1) (2022-09-22)


### Bug Fixes

* dependapot created several PRs which have been merged. ([f18460c](https://github.com/soundcloud/intervene/commit/f18460cda7dac4f616fbfed66531d2da33c73928))

# 3.2.0

- fix critical vulnerabilties

# [3.1.0](https://github.com/soundcloud/intervene/compare/v3.0.1...v3.1.0) (2021-05-28)

### Features

- add untrusted cert error message ([d516b57](https://github.com/soundcloud/intervene/commit/d516b57700bfa80dec3958f9a48f920a12940f13))

  # 3.0.1

- Fix admin server startup issue
- Fix end-to-end tests URL

  # 3.0.0

- Update embedded hapi version (to v20)
- BREAKING CHANGE: Drop support for node < 12

  # 2.8.6

- Update app name displayed when prompting for password

  # 2.8.5

- Make @types/jest a dev dependency

  # 2.8.4

- Update dependencies

  # 2.8.3

- First open source release
