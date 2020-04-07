module.exports = function(wallaby) {
  return {
    files: [
      'src/**/*.ts',
      'src/**/brotli-decode.js',
      'test-helpers/**/*.js',
      'package.json',
      // Scoped modules don't get mapped properly, and we need these
      // for the typescript parser, which loads node_modules directly
      // - specifically @types, and @hapi/hapi (required by ProxyConfig.ts - the @babel stuff is a dependency
      //   somewhere in the tree)
      { pattern: 'node_modules/@types/**/*', instrument: false },
      { pattern: 'node_modules/@hapi/**/*', instrument: false },
      { pattern: 'node_modules/@babel/**/*', instrument: false },
      '!src/**/__tests__/*.spec.ts'
    ],
    tests: [
      'src/**/__tests__/*.spec.ts',
      // For some reason, configLoader (actually parseTypescript) can't find iconv-lite module in wallaby
      '!src/__tests__/configLoader.spec.ts'
    ],
    env: {
      type: 'node',
      runner: 'node'
    },
    compilers: {
      'src/**/*.ts': wallaby.compilers.typeScript({})
    },

    testFramework: 'jest',

    setup: function(wallaby) {
      var jestConfig = require('./package.json').jest;
      wallaby.testFramework.configure(jestConfig);
    }
  };
};
