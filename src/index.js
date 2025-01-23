const Builder = require('./builder');
const Model = require('./model');
const Pivot = require('./pivot');
const Collection = require('./collection');
const Paginator = require('./paginator');
const sutando = require('./sutando');
const Scope = require('./scope');
const SoftDeletes = require('./soft-deletes');
const utils = require('./utils');
const Attribute = require('./casts/attribute');
const CastsAttributes = require('./casts-attributes');
const Migration = require('./migrations/migration');
const Errors = require('./errors');
const HasUniqueIds = require('./concerns/has-unique-ids');
const { migrateRun, migrateRollback, migrateStatus } = require('./migrate');

const make = (
  model,
  data,
  options = {},
) => {
  const { paginated } = options;
  if (paginated) {
    return new Paginator(
      data.data.map(item => model.make(item)),
      data.total,
      data.per_page,
      data.current_page
    );
  }
  
  if (Array.isArray(data)) {
    return new Collection(data.map(item => model.make(item)));
  }

  return model.make(data);
}

const makeCollection = (model, data) => new Collection(data.map(item => model.make(item)));
const makePaginator = (model, data) => new Paginator(data.data.map(item => model.make(item)), data.total, data.per_page, data.current_page);

module.exports = {
  sutando,
  Paginator,
  Collection,
  Model,
  Pivot,
  Builder,
  Attribute,
  CastsAttributes,
  Migration,
  Scope,
  SoftDeletes,
  HasUniqueIds,
  make,
  makeCollection,
  makePaginator,
  migrateRun,
  migrateRollback,
  migrateStatus,
  ...Errors,
  ...utils,
}