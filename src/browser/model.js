const snakeCase = require('lodash/snakeCase');
const merge = require('lodash/merge');
const pluralize = require('pluralize');
const Collection = require('./collection');
const HasRelations = require('./concerns/has-relations');
const HasAttributes = require('../concerns/has-attributes');
const HasTimestamps = require('../concerns/has-timestamps');
const HidesAttributes = require('../concerns/hides-attributes');

const { compose, getScopeMethod, getRelationMethod } = require('../utils');

const BaseModel = compose(
  class {},
  HasAttributes,
  HidesAttributes,
  HasRelations,
  HasTimestamps,
);

class Model extends BaseModel {
  primaryKey = 'id'; // protected
  table = null; // protected
  keyType = 'int'; // protected
  perPage = 15; // protected
  
  static globalScopes = {};
  static pluginInitializers = {};
  static _booted = {};
  static resolver = null;
  static browser = true;

  static init(attributes = {}) {
    return new this(attributes);
  }

  static extend(plugin, options) {
    plugin(this, options);
  }

  static make(attributes = {}) {
    const instance = new this();
    const HasMany = require('./relations/has-many');
    const HasOne = require('./relations/has-one');
    const BelongsTo = require('./relations/belongs-to');
    const BelongsToMany = require('./relations/belongs-to-many');

    for (let attribute in attributes) {

      if (typeof instance[getRelationMethod(attribute)] !== 'function') {
        instance.setAttribute(attribute, attributes[attribute]);
      } else {
        const relation = instance[getRelationMethod(attribute)]();
        if (
          relation instanceof HasOne
          || relation instanceof BelongsTo
        ) {
          instance.setRelation(attribute, relation.related.make(attributes[attribute]));
        } else if (
          (relation instanceof HasMany || relation instanceof BelongsToMany)
          && Array.isArray(attributes[attribute])
        ) {
          instance.setRelation(attribute, new Collection(attributes[attribute].map(item => relation.related.make(item))));
        }
      }
    }

    return instance;
  }

  constructor(attributes = {}) {
    super();

    this.bootIfNotBooted();
    this.initializePlugins();
    this.syncOriginal();
    
    this.fill(attributes);

    return this.asProxy();
  }

  bootIfNotBooted() {
    if (this.constructor._booted[this.constructor.name] === undefined) {
      this.constructor._booted[this.constructor.name] = true;

      this.constructor.booting();
      this.initialize();
      this.constructor.boot();
      this.constructor.booted();
    }
  }

  static booting() {
    
  }

  static boot() {
    
  }

  static booted() {
    
  }

  static setConnectionResolver(resolver) {
    this.resolver = resolver;
  }

  initialize() {
    
  }

  initializePlugins() {
    if (typeof this.constructor.pluginInitializers[this.constructor.name] === 'undefined') {
      return;
    }

    for (const method of this.constructor.pluginInitializers[this.constructor.name]) {
      this[method]();
    }
  }

  addPluginInitializer(method) {
    if (!this.constructor.pluginInitializers[this.constructor.name]) {
      this.constructor.pluginInitializers[this.constructor.name] = [];
    }

    this.constructor.pluginInitializers[this.constructor.name].push(method);
  }

  newInstance(attributes = {}, exists = false) {
    const model = new this.constructor;

    model.exists = exists;
    model.setTable(this.getTable());
    model.fill(attributes);

    return model;
  }

  asProxy () {
    const handler = {
      get: function (target, prop) {
        if (target[prop] !== undefined) {
          return target[prop]
        }

        // get model column
        if (typeof prop === 'string') {
          // get custom attribute
          return target.getAttribute(prop);
        }
      },

      set: function (target, prop, value) {
        if (target[prop] !== undefined && typeof target !== 'function') {
          target[prop] = value;
          return target;
        }

        if (typeof prop === 'string') {
          return target.setAttribute(prop, value);
        }

        return target;
      }
    }

    return new Proxy(this, handler)
  }

  getKey() {
    return this.getAttribute(this.getKeyName());
  }

  getKeyName() {
    return this.primaryKey;
  }

  getForeignKey() {
    return snakeCase(this.constructor.name) + '_' + this.getKeyName();
  }

  getConnectionName() {
    return this.connection;
  }

  getTable() {
    return this.table || pluralize(snakeCase(this.constructor.name));
  }

  setConnection(connection) {
    this.connection = connection;
    return this;
  }

  getKeyType() {
    return this.keyType;
  }

  hasNamedScope(name) {
    const scope = getScopeMethod(name)
    return typeof this[scope] === 'function';
  }

  callNamedScope(scope, parameters) {
    const scopeMethod = getScopeMethod(scope);
    return this[scopeMethod](...parameters);
  }

  setTable(table) {
    this.table = table;
    return this;
  }

  newCollection(models = []) {
    return new Collection(models);
  }

  getIncrementing() {
    return this.incrementing;
  }

  setIncrementing(value) {
    this.incrementing = value;
    return this;
  }

  toData() {
    return merge(this.attributesToData(), this.relationsToData());
  }

  toJSON() {
    return this.toData();
  }

  toJson(...args) {
    return JSON.stringify(this.toData(), ...args);
  }

  toString() {
    return this.toJson();
  }

  fill(attributes) {
    for (const key in attributes) {
      this.setAttribute(key, attributes[key]);
    }

    return this;
  }

  transacting(trx) {
    this.trx = trx;
    return this;
  }

  trashed() {
    return this[this.getDeletedAtColumn()] !== null;
  }

  newPivot(parent, attributes, table, exists, using = null) {
    return using ? using.fromRawAttributes(parent, attributes, table, exists)
      : Pivot.fromAttributes(parent, attributes, table, exists);
  }

  qualifyColumn(column) {
    if (column.includes('.')) {
      return column;
    }

    return `${this.getTable()}.${column}`;
  }

  getQualifiedKeyName() {
    return this.qualifyColumn(this.getKeyName());
  }

  is(model) {
    return model && model instanceof Model &&
      this.getKey() === model.getKey() &&
      this.getTable() === model.getTable();
  }

  isNot(model) {
    return !this.is(model);
  }
}

module.exports = Model;

const Pivot = require('./pivot');

