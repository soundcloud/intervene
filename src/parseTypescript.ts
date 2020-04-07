import * as fs from 'fs';
import * as ts from 'typescript';
import * as path from 'path';

export function parseTypescript(configFileName: string, contents: string) {
  // Generated outputs
  const compilerHost = ts.createCompilerHost({});

  // Create a program from inputs
  const resolvedConfigPath = path.resolve(configFileName);

  const typePaths = {
    hapi__hapi: '',
    node: ''
  };

  // Looking for `@types` directories until we find type paths for both hapi and node
  let directory = __dirname;
  let iterations = 0;
  while (
    directory &&
    directory !== '/' &&
    (!typePaths.hapi__hapi || !typePaths.node)
  ) {
    directory = findDirectoryWithNodeModules(directory);
    try {
      const typeModulesDirectory = path.join(
        directory,
        'node_modules',
        '@types'
      );
      const typeModules = fs.readdirSync(typeModulesDirectory);

      if (!typePaths.hapi__hapi && typeModules.includes('hapi__hapi')) {
        typePaths.hapi__hapi = typeModulesDirectory;
      }
      if (!typePaths.node && typeModules.includes('node')) {
        typePaths.node = typeModulesDirectory;
      }
    } catch (e) {}

    // move one dir up for the next iteration
    directory = path.resolve(directory, '..');

    iterations++;
    if (iterations >= 10) {
      throw new Error(
        'Reached maximum amount of iterations to find @types modules'
      );
    }
  }

  if (!typePaths.hapi__hapi || !typePaths.node) {
    throw new Error(
      'Could not find a @types module for either node or hapi__hapi'
    );
  }

  const compilerOptions: ts.CompilerOptions = {
    noImplicitAny: false,
    target: ts.ScriptTarget.ES2015,
    module: ts.ModuleKind.CommonJS,
    moduleResolution: ts.ModuleResolutionKind.NodeJs,
    typeRoots: [...new Set(Object.values(typePaths))]
  };
  const getSourceFileOriginal = compilerHost.getSourceFile;
  compilerHost.getSourceFile = function(fileName: string) {
    if (fileName === resolvedConfigPath) {
      return ts.createSourceFile(
        fileName,
        contents,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS
      );
    }
    return getSourceFileOriginal.apply(compilerHost, arguments);
  };
  var program = ts.createProgram(
    [resolvedConfigPath],
    compilerOptions,
    compilerHost
  );
  // Query for early errors
  var errors = program.getGlobalDiagnostics();

  const syntacticErrors = program.getSyntacticDiagnostics();
  const semanticErrors = program.getSemanticDiagnostics();

  if (syntacticErrors.length || semanticErrors.length) {
    throw new Error(
      'Error compiling configuration:\n  ' +
        getDiagMessages(syntacticErrors) +
        getDiagMessages(semanticErrors)
    );
  }
  const sourceFile = program.getSourceFile(resolvedConfigPath);

  let output: string | null = null;

  function writeFile(
    fileName: string,
    data: string,
    writeByteOrderMark: boolean,
    onError: () => void
  ) {
    if (
      path.basename(fileName, '.js') ===
      path.basename(resolvedConfigPath, '.ts')
    ) {
      output = data;
    }
  }

  const emitResults = program.emit(sourceFile, writeFile);
  return output;
}

/**
 * Moves up the directory tree until it finds a `node_modules`
 * directory and it returns it's parent */
function findDirectoryWithNodeModules(baseFolder: string) {
  let parentOfNodeModules = baseFolder;
  while (
    parentOfNodeModules &&
    parentOfNodeModules !== '/' &&
    !fs.readdirSync(parentOfNodeModules).includes('node_modules')
  ) {
    parentOfNodeModules = path.resolve(parentOfNodeModules, '..');
  }
  return parentOfNodeModules;
}

function getDiagMessages(diags: ReadonlyArray<ts.Diagnostic>) {
  return diags
    .map((e: ts.Diagnostic) => {
      if (e.file) {
        const pos = e.file.getLineAndCharacterOfPosition(e.start || 0);
        return `${path.basename(e.file.fileName)}:${pos.line}:${
          pos.character
        }: ${ts.flattenDiagnosticMessageText(e.messageText, '\n  ')}`;
      }
    })
    .filter((m) => m)
    .join('\n');
}
