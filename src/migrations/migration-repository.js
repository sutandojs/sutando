class MigrationRepository {
  resolver;
  table;
  connection = null;

  constructor(resolver, table) {
    this.resolver = resolver;
    this.table = table;
  }

  async getRan() {
    return await this.getTable()
      .orderBy('batch', 'asc')
      .orderBy('migration', 'asc')
      .pluck('migration');
  }

  async getMigrations(steps) {
    const query = this.getTable().where('batch', '>=', '1');

    return (await query.orderBy('batch', 'desc')
      .orderBy('migration', 'desc')
      .take(steps).get());
  }

  async getMigrationsByBatch(batch) {
    return (await this.getTable()
      .where('batch', batch)
      .orderBy('migration', 'desc')
      .get());
  }

  async getLast() {
    const query = this.getTable().where('batch', await this.getLastBatchNumber());

    return (await query.orderBy('migration', 'desc').get());
  }

  async getMigrationBatches() {
    const migrations = await this.getTable()
      .select('batch', 'migration')
      .orderBy('batch', 'asc')
      .orderBy('migration', 'asc')
      .get();
    
    const migrationBatches = {};
    migrations.map(migration => {
      migrationBatches[migration.migration] = migration.batch;
    });

    return migrationBatches;
  }

  async log(file, batch) {
    await this.getTable().insert({
      migration: file,
      batch: batch
    });
  }

  async delete(migration) {
    await this.getTable().where('migration', migration.migration).delete();
  }

  async getNextBatchNumber() {
    return (await this.getLastBatchNumber()) + 1;
  }

  async getLastBatchNumber() {
    return await this.getTable().max('batch');
  }

  async createRepository() {
    const schema = this.getConnection().schema;

    await schema.createTable(this.table, function (table) {
      table.increments('id');
      table.string('migration');
      table.integer('batch');
    });
  }

  repositoryExists() {
    const schema = this.getConnection().schema;

    return schema.hasTable(this.table);
  }

  async deleteRepository() {
    const schema = this.getConnection().schema;

    await schema.drop(this.table);
  }

  getTable() {
    return this.getConnection().table(this.table);
  }

  getConnection() {
    return this.resolver.connection(this.connection);
  }

  setSource(name) {
    this.connection = name;
  }
}

module.exports = MigrationRepository;