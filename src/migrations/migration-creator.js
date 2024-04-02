const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const dayjs = require('dayjs');

class MigrationCreator {
  constructor(customStubPath) {
    this.files = fs;
    this.customStubPath = customStubPath;
    this.postCreate = [];
  }

  async create(name, dir, table = null, create = false) {
    // await this.ensureMigrationDoesntAlreadyExist(name, dir);

    const stub = this.getStub(table, create);
    const filePath = this.getPath(name, dir);
    await this.ensureDirectoryExists(path.dirname(filePath));

    await promisify(fs.writeFile)(filePath, this.populateStub(stub, table));

    await this.firePostCreateHooks(table, filePath);

    return filePath;
  }

  async publish(dir, callback) {
    const migrationFiles = await promisify(fs.readdir)(this.customStubPath);
    await this.ensureDirectoryExists(dir);

    for (const migrationFile of migrationFiles) {
      const sourceFilePath = path.join(this.customStubPath, migrationFile);
      const destinationFilePath = path.join(dir, migrationFile);

      await promisify(fs.copyFile)(sourceFilePath, destinationFilePath);
      callback && await callback(migrationFile, sourceFilePath, destinationFilePath);
    }
  }

  async ensureMigrationDoesntAlreadyExist(name, dir) {
    const migrationFiles = await promisify(fs.glob)(path.join(dir, '*.js'));

    for (const migrationFile of migrationFiles) {
      require(migrationFile);
    }

    const className = this.getClassName(name);
    if (typeof global[className] === 'function') {
      throw new Error(`A ${className} class already exists.`);
    }
  }

  getStub(table, create) {
    let stub;
    if (table === null) {
      const customPath = path.join(this.customStubPath, 'migration-js.stub');
      stub = fs.existsSync(customPath) ? customPath : this.stubPath() + '/migration-js.stub';
    } else if (create) {
      const customPath = path.join(this.customStubPath, 'migration.create-js.stub');
      stub = fs.existsSync(customPath) ? customPath : this.stubPath() + '/migration.create-js.stub';
    } else {
      const customPath = path.join(this.customStubPath, 'migration.update-js.stub');
      stub = fs.existsSync(customPath) ? customPath : this.stubPath() + '/migration.update-js.stub';
    }

    return fs.readFileSync(stub, 'utf-8');
  }

  populateStub(stub, table) {
    if (table !== null) {
      stub = stub.replace(/DummyTable|{{\s*table\s*}}/g, table);
    }

    return stub;
  }

  getClassName(name) {
    return name.replace(/_+([a-z])/g, (match, char) => char.toUpperCase());
  }

  getPath(name, dir) {
    const datePrefix = dayjs().format('YYYY_MM_DD_HHmmss');
    return path.join(dir, `${datePrefix}_${name}.js`);
  }

  async firePostCreateHooks(table, filePath) {
    for (const callback of this.postCreate) {
      await callback(table, filePath);
    }
  }

  afterCreate(callback) {
    this.postCreate.push(callback);
  }

  async ensureDirectoryExists(dir) {
    await promisify(fs.mkdir)(dir, { recursive: true });
  }

  stubPath() {
    return path.join(__dirname, 'stubs');
  }
}

module.exports = MigrationCreator;