const TypeScript = require('typescript');
const typeScriptConfig = require('../tsconfig.json');


module.exports = {
  process(src, path) {
    if (path.endsWith('.ts') || path.endsWith('.tsx')) {
      return TypeScript.transpile(
        src,
        typeScriptConfig.compilerOptions,
        path,
        []
      );
    }
    return src;
  }
};
