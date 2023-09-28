const Knex = require('knex');
const Builder = require('knex/lib/query/querybuilder')
const Paginator = require('./paginator');

Builder.prototype._aggregate = async function (method, column, options = {}) {
  this._statements.push({
    grouping: 'columns',
    type: column.isRawInstance ? 'aggregateRaw' : 'aggregate',
    method,
    value: column,
    aggregateDistinct: options.distinct || false,
    alias: 'aggregate',
  });

  const [{ aggregate }] = await this;
  return aggregate;
};

Knex.QueryBuilder.extend('beginTransaction', async function () {
  return await this.transaction();
});

Knex.QueryBuilder.extend('get', async function () {
  return await this;
});

Knex.QueryBuilder.extend('skip', function (...args) {
  return this.offset(...args);
});

Knex.QueryBuilder.extend('take', function (...args) {
  return this.limit(...args);
});

Knex.QueryBuilder.extend('forPage', function (page = 1, perPage = 15) {
  return this.offset((page - 1) * perPage).limit(perPage);
});

Knex.QueryBuilder.extend('paginate', async function (page = 1, perPage = 15) {
  const query = this.clone();

  const total = await query.clearOrder().count();

  let results;
  if (total > 0) {
    const skip = (page - 1) * perPage;
    this.take(perPage).skip(skip);

    results = await this.get();
  } else {
    results = [];
  }

  return new Paginator(results, parseInt(total), perPage, page);
});

module.exports = Knex;
