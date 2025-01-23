const { getMigrationPaths } = require('../bin/utils');

async function prepareDatabase(migrator) {
  const exists = await migrator.repositoryExists();
  if (!exists) {
    console.log('Preparing database.');
    console.log('Creating migration table...');

    await migrator.repository.createRepository();

    console.log('Migration table created successfully.');
  }
}

async function setupConnection(config) {
  const sutando = require('./sutando');
  const MigrationRepository = require('./migrations/migration-repository');
  const Migrator = require('./migrations/migrator');
  
  const table = config?.migration?.table || 'migrations';
  
  sutando.addConnection(config, 'default');

  Object.entries(config.connections || {}).forEach(([name, connection]) => {
      sutando.addConnection(connection, name);
  });

  const repository = new MigrationRepository(sutando, table);
  const migrator = new Migrator(repository, sutando);

  return { sutando, migrator };
}

async function migrateRun(config, options = {}, destroyAll = false) {
  const { sutando, migrator } = await setupConnection(config);

  await prepareDatabase(migrator);
  const paths = await getMigrationPaths(process.cwd(), migrator, config?.migrations?.path, options.path);

  await migrator.setOutput(true).run(paths, {
    step: options.step,
    pretend: options.pretend,
  });

  if (destroyAll) {
    await sutando.destroyAll();
  }
}

async function migrateRollback(config, options = {}, destroyAll = false) {
  const { sutando, migrator } = await setupConnection(config);

  const paths = await getMigrationPaths(process.cwd(), migrator, config?.migrations?.path, options.path);

  await migrator.setOutput(true).rollback(paths, {
    step: options.step || 0,
    pretend: options.pretend,
    batch: options.batch || 0,
  });

  if (destroyAll) {
    await sutando.destroyAll();
  }
}

async function migrateStatus(config, options = {}, destroyAll = false) {
  const { sutando, migrator } = await setupConnection(config);

  async function getAllMigrationFiles() {
    return await migrator.getMigrationFiles(
      await getMigrationPaths(process.cwd(), migrator, config?.migrations?.path, options.path)
    );
  }

  async function getStatusFor(ran, batches) {
    const files = await getAllMigrationFiles();
    return Object.values(files).map(function (migration) {
      const migrationName = migrator.getMigrationName(migration);

      const status = {
        name: migrationName,
        ran: ran.includes(migrationName),
        batch: ran.includes(migrationName) ? batches[migrationName] : null
      };

      return status;
    });
  }

  const exists = await migrator.repositoryExists();
  if (!exists) {
    throw new Error('Migration table does not exist.');
  }

  const ran = await migrator.repository.getRan();
  const batches = await migrator.getRepository().getMigrationBatches();
  const migrations = await getStatusFor(ran, batches);

  if (destroyAll) {
    await sutando.destroyAll();
  }
  
  return migrations;
}

module.exports = {
  migrateRun,
  migrateRollback,
  migrateStatus
}; 