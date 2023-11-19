const color = require('colorette');
const path = require('path');
const escalade = require('escalade/sync');

function success(text) {
  console.log(text);
  process.exit(0);
}

function exit(text) {
  if (text instanceof Error) {
    if (text.message) {
      console.error(color.red(text.message));
    }
    console.error(
      color.red(`${text.detail ? `${text.detail}\n` : ''}${text.stack}`)
    );
  } else {
    console.error(color.red(text));
  }
  process.exit(1);
}

function twoColumnDetail(name, value) {
  const regex = /\x1b\[\d+m/g;
  const width = Math.min(process.stdout.columns, 100);
  const dots = Math.max(width - name.replace(regex, '').length - value.replace(regex, '').length - 10, 0);
  return console.log(name, color.gray('.'.repeat(dots)), value);
}

function findUpConfig(cwd, name, extensions) {
  return escalade(cwd, (dir, names) => {
    for (const ext of extensions) {
      const filename = `${name}.${ext}`;
      if (names.includes(filename)) {
        return filename;
      }
    }
    return false;
  });
}

function findUpModulePath(cwd, packageName) {
  const modulePackagePath = escalade(cwd, (dir, names) => {
    if (names.includes('package.json')) {
      return 'package.json';
    }
    return false;
  });

  try {
    const modulePackage = require(modulePackagePath);
    if (modulePackage.name === packageName) {
      return path.join(
        path.dirname(modulePackagePath),
        modulePackage.main || 'index.js'
      );
    }
  } catch (e) {
    /* empty */
  }
}

const join = path.join;
async function getMigrationPaths(cwd, migrator, defaultPath, path) {
  if (path) {
    return [join(cwd, path)];
  }

  return [
    ...migrator.getPaths(),
    join(cwd, defaultPath),
  ];
}

function localModuleCheck(env) {
  if (!env.modulePath) {
    console.log(
      color.red('No local sutando install found.')
    );
    exit('Try running: npm install sutando --save');
  }
}

class TableGuesser {
  static CREATE_PATTERNS = [
    /^create_(\w+)_table$/,
    /^create_(\w+)$/
  ];

  static CHANGE_PATTERNS = [
    /.+_(to|from|in)_(\w+)_table$/,
    /.+_(to|from|in)_(\w+)$/
  ];

  static guess(migration) {
    for (const pattern of TableGuesser.CREATE_PATTERNS) {
      const matches = migration.match(pattern);
      if (matches) {
        return [matches[1], true];
      }
    }

    for (const pattern of TableGuesser.CHANGE_PATTERNS) {
      const matches = migration.match(pattern);
      if (matches) {
        return [matches[2], false];
      }
    }

    return [];
  }
}

module.exports = {
  exit,
  success,
  twoColumnDetail,
  findUpModulePath,
  findUpConfig,
  localModuleCheck,
  getMigrationPaths,
  TableGuesser,
}