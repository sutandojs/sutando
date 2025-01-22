const Model = require('./model');
const Pivot = require('./pivot');
const Collection = require('./collection');
const Paginator = require('./paginator');
const utils = require('../utils');
const Attribute = require('../casts/attribute');
const CastsAttributes = require('../casts-attributes');
const Errors = require('../errors');
const HasUniqueIds = require('../concerns/has-unique-ids');
const isArray = require('lodash/isArray');

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
  
  if (isArray(data)) {
    return new Collection(data.map(item => model.make(item)));
  }

  return model.make(data);
}

const makeCollection = (model, data) => new Collection(data.map(item => model.make(item)));
const makePaginator = (model, data) => new Paginator(data.data.map(item => model.make(item)), data.total, data.per_page, data.current_page);

const isBrowser = true;

module.exports = {
  isBrowser,
  Paginator,
  Collection,
  Model,
  Pivot,
  Attribute,
  CastsAttributes,
  HasUniqueIds,
  make,
  makeCollection,
  makePaginator,
  ...Errors,
  ...utils,
}