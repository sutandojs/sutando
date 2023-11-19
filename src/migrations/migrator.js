const fs = require('fs');
const path = require('path');
const color = require('colorette');
const { promisify } = require('util');

async function glob(folderPath) {
  const files = await promisify(fs.readdir)(folderPath);

  const allFiles = [];

  for (const file of files) {
    const filePath = `${folderPath}/${file}`;

    const stats = await promisify(fs.stat)(filePath);

    if (stats.isFile()) {
      allFiles.push(filePath);
    } else if (stats.isDirectory()) {
      const subFiles = await glob(filePath);
      allFiles.push(...subFiles);
    }
  }

  return allFiles;
}

class Migrator {
  events = null;
  repository;
  files;
  resolver;
  connection = null;
  paths = [];
  output = null;

  constructor(repository, resolver = null, files = null, dispatcher = null) {
    this.repository = repository;
    this.files = files;
    this.resolver = resolver;
    this.events = dispatcher;
  }

  async run(paths = [], options = {}) {
    const files = await this.getMigrationFiles(paths);
    const ran = await this.repository.getRan();
    const migrations = this.pendingMigrations(files, ran);
    await this.runPending(migrations, options);
    return migrations;
  }

  pendingMigrations(files, ran) {
    return Object.values(files).filter(file => !ran.includes(this.getMigrationName(file)));
  }

  async runPending(migrations, options = {}) {
    if (migrations.length === 0) {
      this.write('Nothing to migrate');
      return;
    }

    let batch = await this.repository.getNextBatchNumber();
    const pretend = options.pretend || false;
    const step = options.step || false;

    this.write('Running migrations.');

    for (const file of migrations) {
      await this.runUp(file, batch, pretend);
      if (step) {
        batch++;
      }
    }
  }

  async runUp(file, batch, pretend) {
    const migration = this.resolvePath(file);
    const name = this.getMigrationName(file);

    await this.writeTask(name, () => this.runMigration(migration, 'up'));
    await this.repository.log(name, batch);
  }

  async rollback(paths = [], options = {}) {
    const migrations = await this.getMigrationsForRollback(options);

    if (migrations.length === 0) {
      this.write('Nothing to rollback.');
      return [];
    }

    return await this.rollbackMigrations(migrations, paths, options);
  }

  async getMigrationsForRollback(options) {
    if (options.step > 0) {
      return await this.repository.getMigrations(options.step);
    }

    if (options.batch > 0) {
      return await this.repository.getMigrationsByBatch(options.batch);
    }

    return await this.repository.getLast();
  }

  async rollbackMigrations(migrations, paths, options) {
    const rolledBack = [];
    const files = await this.getMigrationFiles(paths);

    this.write('Rolling back migrations.');

    for (const migration of migrations) {
      const file = files[migration.migration];

      if (!file) {
        this.writeTwoColumns(
          migration.migration,
          color.yellow('Migration not found')
        )
        continue;
      }

      rolledBack.push(file);
      await this.runDown(file, migration, options.pretend || false);
    }

    return rolledBack;
  }

  async runDown(file, migration, pretend) {
    const instance = this.resolvePath(file);
    const name = this.getMigrationName(file);

    await this.writeTask(name, () => this.runMigration(instance, 'down'));
    await this.repository.delete(migration);
  }

  reset(paths = [], pretend = false) {
    const migrations = this.repository.getRan().reverse();

    if (migrations.length === 0) {
      this.write(Info, 'Nothing to rollback.');
      return [];
    }

    return this.resetMigrations(migrations, paths, pretend);
  }

  resetMigrations(migrations, paths, pretend = false) {
    migrations = migrations.map(m => ({ migration: m }));
    return this.rollbackMigrations(migrations, paths, { pretend });
  }

  async runMigration(migration, method) {
    const connection = this.resolveConnection(migration.getConnection());
    const callback = async (trx) => {
      if (typeof migration[method] === 'function') {
        await this.runMethod(trx, migration, method);
      }
    };

    if (migration.withinTransaction) {
      await connection.transaction(callback);
    } else {
      await callback(connection);
    }
  }

  async runMethod(connection, migration, method) {
    try {
      await migration[method](connection.schema, connection);
    } finally {
      //
    }
  }

  resolvePath(path) {
    const migrationClass = require(path);
    return new migrationClass;
  }

  getMigrationClass(migrationName) {
    return migrationName.split('_').slice(4).map(str => str.charAt(0).toUpperCase() + str.slice(1)).join('');
  }

  async getMigrationFiles(paths) {
    const files = [];
    for (const path of paths) {
      if (path.endsWith('.js')) {
        files.push(path);
        continue;
      }

      files.push(...await glob(path));
    }

    return files.filter(Boolean).reduce((result, file) => {
      result[this.getMigrationName(file)] = file;
      return result;
    }, {});
  }

  getMigrationName(filePath) {
    return path.basename(filePath).replace('.js', '');
  }

  path(path) {
    this.paths = Array.from(new Set([...this.paths, path]));
  }

  getPaths() {
    return this.paths;
  }

  getConnection() {
    return this.connection;
  }

  resolveConnection(connection) {
    return this.resolver.connection(connection || this.connection);
  }

  getRepository() {
    return this.repository;
  }

  repositoryExists() {
    return this.repository.repositoryExists();
  }

  async hasRunAnyMigrations() {
    const ran = await this.repository.getRan();
    const exists = await this.repositoryExists();
    return exists && ran.length > 0;
  }

  deleteRepository() {
    this.repository.deleteRepository();
  }

  setOutput(output) {
    this.output = output;
    return this;
  }

  write(...args) {
    if (this.output) {
      console.log(...args)
    }
  }

  writeTwoColumns(name, ...args) {
    const value = args.join(' ')
    const regex = /\x1b\[\d+m/g;
    const width = Math.min(process.stdout.columns, 100);
    const dots = Math.max(width - name.replace(regex, '').length - value.replace(regex, '').length - 10, 0);
    return this.write(name, color.gray('.'.repeat(dots)), value);
  }

  async writeTask(description, task) {
    const startTime = process.hrtime();
    let result = false;

    try {
      result = await (task || (() => true))();
    } catch (e) {
      throw e;
    } finally {
      const endTime = process.hrtime(startTime);
      const duration = (endTime[0] * 1e9 + endTime[1]) / 1e6;

      this.writeTwoColumns(
        color.green(description),
        color.gray(`${Math.floor(duration)}ms`),
        result !== false ? color.green('✔') : color.red('✘')
      )
    }
  }
}

module.exports = Migrator;
