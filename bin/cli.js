#!/usr/bin/env node
const { program } = require('commander');
const path = require('path');
const { promisify } = require('util');
const fs = require('fs');
const color = require('colorette');
const resolveFrom = require('resolve-from');
const snakeCase = require('lodash/snakeCase');

const { success, exit, twoColumnDetail, findUpConfig, findUpModulePath, TableGuesser, localModuleCheck, getMigrationPaths } = require('./utils');
const cliPkg = require('../package');

const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);

const env = {
  modulePath: resolveFrom.silent(process.cwd(), 'sutando') || findUpModulePath(process.cwd(), 'sutando'),
  cwd: process.cwd(),
  configPath: findUpConfig(process.cwd(), 'sutando.config', ['js', 'cjs'])
}

let modulePackage = {};

try {
  modulePackage = require(path.join(
    path.dirname(path.dirname(env.modulePath)),
    'package.json'
  ));
} catch (e) {
  /* empty */
}

function getSutandoModule(modulePath) {
  localModuleCheck(env);
  return require(path.join(
    path.dirname(path.dirname(env.modulePath)),
    modulePath
  ));
}

const cliVersion = [
  'Sutando CLI version:',
  color.green(cliPkg.version),
].join(' ');

const localVersion = [
  'Sutando Local version:',
  color.green(modulePackage.version || 'None'),
].join(' ');

program
  .name('sutando')
  .version(`${cliVersion}\n${localVersion}`);

program
  .command('init')
  .description('Create a fresh sutando config.')
  .action(async () => {
    localModuleCheck(env);
    const type = 'js';
    if (env.configPath) {
      exit(`Error: ${env.configPath} already exists`);
    }

    try {
      const stubPath = `./sutando.config.${type}`;
      const code = await readFile(
        path.dirname(path.dirname(env.modulePath)) +
          '/src/stubs/sutando.config-' +
          type +
          '.stub'
      );
      await writeFile(stubPath, code);
          
      success(color.green(`Created ${stubPath}`));
    } catch(e) {
      exit(e);
    }
  });

program
  .command('migrate:make <name>')
  .description('Create a new migration file.')
  .option(`--table`, 'The table to migrate')
  .option(`--create`, 'The table to be created')
  .action(async (name, opts) => {
    if (!env.configPath) {
      exit('Error: sutando config not found. Run `sutando init` first.');
    }

    const config = require(env.configPath);

    try {
      name = snakeCase(name);
      let table = opts.table;
      let create = opts.create || false;

      if (!table && typeof create === 'string') {
        table = create;
        create = true;
      }

      if (!table) {
        const guessed = TableGuesser.guess(name);
        table = guessed[0];
        create = guessed[1];
      }

      const MigrationCreator = getSutandoModule('src/migrations/migration-creator');
      const creator = new MigrationCreator('');
      const fileName = await creator.create(name, env.cwd + `/${config?.migrations?.path || 'migrations'}`, table, create);

      success(color.green(`Created Migration: ${fileName}`));
    } catch (err) {
      exit(err);
    }
  });

program
  .command('migrate:run')
  .description('Run all pending migrations.')
  .option('--step', 'Force the migrations to be run so they can be rolled back individually.')
  .option('--path <path>', 'The path to the migrations directory.')
  .action(async (opts) => {
    async function prepareDatabase(migrator) {
      const exists = await migrator.repositoryExists();
      if (!exists) {
        console.log('Preparing database.');
        console.log('Creating migration table...');

        await migrator.repository.createRepository();

        console.log('Migration table created successfully.');
      }
    }
    
    if (!env.configPath) {
      exit('Error: sutando config not found. Run `sutando init` first.');
    }

    const config = require(env.configPath);
    const table = config?.migration?.table || 'migrations';

    const sutando = getSutandoModule('src/sutando');
    const MigrationRepository = getSutandoModule('src/migrations/migration-repository');
    const Migrator = getSutandoModule('src/migrations/migrator');
    
    sutando.addConnection(config, 'default');

    const repository = new MigrationRepository(sutando, table);
    const migrator = new Migrator(repository, sutando);

    await prepareDatabase(migrator);
    const paths = await getMigrationPaths(env.cwd, migrator, config?.migrations?.path, opts.path);

    await migrator.setOutput(true).run(paths, {
      step: opts.step,
      pretend: opts.pretend,
    });

    sutando.destroyAll();
  });

program
  .command('migrate:rollback')
  .description('Rollback the last database migration.')
  .option('--step <number>', 'The number of migrations to be reverted.')
  .option('--path <path>', 'The path to the migrations directory.')
  .action(async (opts) => {
    if (!env.configPath) {
      exit('Error: sutando config not found. Run `sutando init` first.');
    }

    const config = require(env.configPath);
    const table = config?.migration?.table || 'migrations';

    const sutando = getSutandoModule('src/sutando');
    const MigrationRepository = getSutandoModule('src/migrations/migration-repository');
    const Migrator = getSutandoModule('src/migrations/migrator');
    
    sutando.addConnection(config, 'default');

    const repository = new MigrationRepository(sutando, table);
    const migrator = new Migrator(repository, sutando);

    const paths = await getMigrationPaths(env.cwd, migrator, config?.migrations?.path, opts.path);

    await migrator.setOutput(true).rollback(paths, {
      step: opts.step || 0,
      pretend: opts.pretend,
      batch: opts.batch || 0,
    });

    sutando.destroyAll();
  });

program
  .command('migrate:status')
  .description('Show the status of each migration.')
  .option('--path <path>', 'The path to the migrations directory.')
  .action(async (opts) => {
    if (!env.configPath) {
      exit('Error: sutando config not found. Run `sutando init` first.');
    }

    const config = require(env.configPath);
    const table = config?.migration?.table || 'migrations';

    const sutando = getSutandoModule('src/sutando');
    const MigrationRepository = getSutandoModule('src/migrations/migration-repository');
    const Migrator = getSutandoModule('src/migrations/migrator');
    
    sutando.addConnection(config, 'default');

    const repository = new MigrationRepository(sutando, table);
    const migrator = new Migrator(repository, sutando);

    async function getAllMigrationFiles() {
      return await migrator.getMigrationFiles(
        await getMigrationPaths(env.cwd, migrator, config?.migrations?.path, opts.path)
      );
    }

    async function getStatusFor(ran, batches) {
      const files = await getAllMigrationFiles();
      return Object.values(files).map(function (migration) {
        const migrationName = migrator.getMigrationName(migration);

        let status = ran.includes(migrationName)
          ? color.green('Ran')
          : color.yellow('Pending');

        if (ran.includes(migrationName)) {
          status = '[' + batches[migrationName] + '] ' + status;
        }

        return [migrationName, status];
      });
    }

    const exists = await migrator.repositoryExists();
    if (!exists) {
      exit('Migration table does not exist.');
    }

    const ran = await repository.getRan();

    const batches = await migrator.getRepository().getMigrationBatches();

    let migrations = await getStatusFor(ran, batches);

    if (opts.pending) {
      migrations = migrations.filter(function (migration) {
        return migration[1].includes('Pending');
      });
    }

    if (migrations.length > 0) {
      twoColumnDetail(color.gray('Migration name'), color.gray('Batch / Status'));

      migrations.map(
        (migration) => twoColumnDetail(migration[0], migration[1])
      );
    } else if (opts.pending) {
      console.log('No pending migrations');
    } else {
      console.log('No migrations found');
    }

    sutando.destroyAll();
  });


program
  .command('model:make <name>')
  .description('Create a new Model file.')
  .option('--force', 'Force creation if model already exists.', false)
  .action(async (name, opts) => {
    if (!env.configPath) {
      exit('Error: sutando config not found. Run `sutando init` first.');
    }
    
    const config = require(env.configPath);

    try {
      const modelPath = path.join(env.cwd, config?.models?.path || 'models', name?.toLowerCase() + '.js');

      if (!opts.force  && fs.existsSync(modelPath)) {
        exit(`Model already exists.`);
      }

      await promisify(fs.mkdir)(path.dirname(modelPath), { recursive: true });

      const stubPath = path.join(
        path.dirname(path.dirname(env.modulePath)),
        'src/stubs/model-js.stub'
      );
      let stub = await readFile(stubPath, 'utf-8');
      stub = stub.replace(/{{ name }}/g, name);
      await writeFile(modelPath, stub);

      success(color.green(`Created Model: ${modelPath}`));
    } catch (err) {
      exit(err);
    }
  });

program.parse();