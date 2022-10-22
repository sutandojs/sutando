const Knex = require('knex');
const Paginator = require('./paginator');

Knex.QueryBuilder.extend('get', async function () {
  return await this;
});

Knex.QueryBuilder.extend('skip', function (...args) {
  return this.offset(...args);
});

Knex.QueryBuilder.extend('take', function (...args) {
  return this.limit(...args);
});

Knex.QueryBuilder.extend('forPage', function (page, perPage = 15) {
  return this.offset((page - 1) * perPage).limit(perPage);
});

Knex.QueryBuilder.extend('paginate', async function (perPage = 15, page = 1) {
  const query = this.clone();

  const [{ total }]= await query.count('*', { as: 'total' });

  let results;
  if (total > 0) {
    const skip = (page - 1) * perPage;
    this.take(perPage).skip(skip);

    results = await this.get();
  } else {
    results = [];
  }

  return new Paginator(results, total, perPage, page);
});

class sutando {
  static manager = {};
  static connections = {};
  static transation = false;

  static connection(connection = null) {
    return this.getConnection(connection);
  }

  static getConnection(name = null) {
    name = name || 'default';
    if (this.manager[name] === undefined) {
      const knexInstance = Knex(this.connections[name]);

      this.manager[name] = knexInstance;
    }

    return this.manager[name];
  }

  static addConnection(config, name = 'default') {
    this.connections[name] = config;
  }

  static beginTransaction(name = null) {
    const connection = this.connection(name);
    return connection.transaction();
  }

  static transaction(callback, name = null) {
    const connection = this.connection(name);
    return connection.transaction(callback);
  }

  static commit(name = null) {

  }

  static rollBack(name = null) {

  }

  static schema(name = null) {
    const connection = this.connection(name);
    return connection.schema;
  }
}

module.exports = sutando;