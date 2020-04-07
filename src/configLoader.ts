import axios from 'axios';
import { log } from './logger';
import { parseTypescript } from './parseTypescript';
import * as path from 'path';
import { ProxyConfig } from './ProxyConfig';
import promiseFs from './promiseFs';
import * as ts from 'typescript';
import * as vm from 'vm';

const m = require('module');

export async function loadConfig(
  proxyConfigFile: string
): Promise<ProxyConfig> {
  try {
    let content: string = '';
    let resolvedFileName = path.resolve(proxyConfigFile);
    if (proxyConfigFile.match(/^https?:\/\//)) {
      resolvedFileName = 'config.ts';
      content = (await axios({ method: 'GET', url: proxyConfigFile })).data;
    } else {
      content = (await promiseFs.readFileAsync(proxyConfigFile)).toString(
        'utf-8'
      );
    }
    if (content) {
      content = replaceImport(__dirname, content);
    }
    const jsContents = parseTypescript(resolvedFileName, content);

    const context = {
      module: { exports: {} as any },
      process,
      console,
      setTimeout,
      setInterval,
      Buffer
    };
    if (!jsContents) {
      throw new Error('Error loading config - no config defined');
    }

    vm.runInNewContext(m.wrap(jsContents), context, {
      filename: resolvedFileName
    })(
      context.module.exports,
      createRequireFromPath(resolvedFileName),
      context.module,
      resolvedFileName,
      path.dirname(resolvedFileName)
    );

    if (!context.module.exports || !context.module.exports.default) {
      return Promise.reject(
        new Error('No config exported from the config file')
      );
    }

    return Promise.resolve(context.module.exports.default);
  } catch (e) {
    return Promise.reject(e);
  }
}

// This is copied from node 10 sources, which uses this in module.createRequireFromPath
function createRequireFromPath(filename) {
  const mod = new m.Module(filename);
  mod.filename = filename;
  // TODO: This is internal to node - not sure how to emulate this
  mod.paths = m._nodeModulePaths(path.dirname(filename));
  return makeRequireFunction(mod);
}

function makeRequireFunction(mod) {
  const Module = mod.constructor;

  const require: any = function require(path) {
    try {
      exports.requireDepth += 1;
      return mod.require(path);
    } finally {
      exports.requireDepth -= 1;
    }
  };

  const resolve: any = function resolve(request, options) {
    if (typeof request !== 'string') {
      throw new Error('Invalid argument type for require.resolve');
    }
    return Module._resolveFilename(request, mod, false, options);
  };

  require.resolve = resolve;

  function paths(request) {
    if (typeof request !== 'string') {
      throw new Error('Invalid argument type for require.paths');
    }
    return Module._resolveLookupPaths(request, mod, true);
  }

  resolve.paths = paths;

  require.main = process.mainModule;

  // Enable support to add extra extension types.
  require.extensions = Module._extensions;

  require.cache = Module._cache;

  return require;
}

export function replaceImport(realPath, content) {
  let lastReplacedImport = '';
  content = content.replace(
    /import\s+\{\s*(((ProxyConfig|WrappedRequest|WrappedResponse|RouteHandler|routeBuilder|HandlerResult|ReturnTypes|log|ProxyResponse|httpRequest|delay)\s*,?[\s]*)+)\s*\}\s+from\s+['"][^'"]+['"]/m,
    function(match, importedItems) {
      if (importedItems.indexOf('ProxyConfig') !== -1) {
        lastReplacedImport = `import { ${importedItems.trim()} } from '${realPath}'`;
        return lastReplacedImport;
      }
      return match;
    }
  );

  let v1ReplacementFound = false;
  content = content.replace(
    /import\s+ProxyConfig(?:\s*,\s*\{\s*(((WrappedResponse|WrappedRequest|RouteHandler|routeBuilder|HandlerResult|ReturnTypes|log)\s*,?[\s]*)+)\s*\})?\s+from\s+['"][^'"]+['"]/m,
    function(match, importedItems) {
      v1ReplacementFound = true;
      importedItems = importedItems ? `, ${importedItems}` : '';
      lastReplacedImport = `import { ProxyConfig${importedItems.trim()} } from '${realPath}'`;
      return lastReplacedImport;
    }
  );

  if (v1ReplacementFound) {
    log.warn(
      `This configuration uses an intervene v1 style import. This will still work, but you should change the import at the top of the file to be \`${lastReplacedImport ||
        "import { ProxyConfig } from 'intervene'}"}\``
    );
  }

  return content;
}
