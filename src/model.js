const snakeCase = require('lodash/snakeCase');
const flattenDeep = require('lodash/flattenDeep');
const merge = require('lodash/merge');
const collect = require('collect.js');
const pluralize = require('pluralize');
const Builder = require('./builder');
const Collection = require('./collection');
const sutando = require('./sutando');
const HasAttributes = require('./concerns/has-attributes');
const HasRelations = require('./concerns/has-relations');
const HasTimestamps = require('./concerns/has-timestamps');
const HidesAttributes = require('./concerns/hides-attributes');
const HasHooks = require('./concerns/has-hooks');
const HasGlobalScopes = require('./concerns/has-global-scopes');
const UniqueIds = require('./concerns/unique-ids');

const { compose, tap, getScopeMethod } = require('./utils');

const BaseModel = compose(
  class {},
  HasAttributes,
  HidesAttributes,
  HasRelations,
  HasTimestamps,
  HasHooks,
  HasGlobalScopes,
  UniqueIds,
);

class Model extends BaseModel {
  primaryKey = 'id'; // protected
  builder = null; // protected
  table = null; // protected
  connection = null; // protected
  keyType = 'int'; // protected
  incrementing = true; // protected
  perPage = 15; // protected
  exists = false;
  eagerLoad = {};
  with = [];
  withCount = []; // protected
  trx = null;
  
  static globalScopes = {};
  static pluginInitializers = {};
  static _booted = {};

  static query(trx = null) {
    const instance = new this();
    return instance.newQuery(trx);
  }

  static on(connection = null) {
    const instance = new this;

    instance.setConnection(connection);
    return instance.newQuery();
  }

  static init(attributes = {}) {
    return new this(attributes);
  }

  static extend(plugin, options) {
    plugin(this, options);
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
    model.setConnection(this.getConnectionName());
    model.setTable(this.getTable());
    model.fill(attributes);

    return model;
  }

  newFromBuilder(attributes = {}, connection = null) {
    const model = this.newInstance({}, true);
    model.setRawAttributes(attributes, true);
    model.setConnection(connection || this.getConnectionName());

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

  getConnection() {
    return sutando.connection(this.connection);
  }

  setConnection(connection) {
    this.connection = connection;
    return this;
  }

  getKeyType() {
    return this.keyType;
  }

  newQuery(trx = null) {
    return this.addGlobalScopes(this.newQueryWithoutScopes(trx));
  }

  newQueryWithoutScopes(trx = null) {
    return this.newModelQuery(trx)
      .with(this.with)
      .withCount(this.withCount);
  }

  newModelQuery(trx = null) {
    const builder = new Builder(trx || this.getConnection());

    return builder.setModel(this);
  }

  addGlobalScopes(builder) {
    const globalScopes = this.getGlobalScopes();
    for (const identifier in globalScopes) {
      const scope = globalScopes[identifier];
      builder.withGlobalScope(identifier, scope);
    }

    return builder;
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

  async load(...relations) {
    const query = this.constructor.query().with(...relations);

    await query.eagerLoadRelations([this]);

    return this;
  }

  async loadAggregate(relations, column, callback = null) {
    await new Collection([this]).loadAggregate(relations, column, callback);
    return this;
  }

  async loadCount(...relations) {
    relations = flattenDeep(relations);
    return await this.loadAggregate(relations, '*', 'count');
  }

  async loadMax(relations, column) {
    return await this.loadAggregate(relations, column, 'max');
  }

  async loadMin(relations, column) {
    return await this.loadAggregate(relations, column, 'min');
  }

  async loadSum(relations, column) {
    return await this.loadAggregate(relations, column, 'sum');
  }

  async increment(column, amount = 1, extra = {}, options = {}) {
    return await this.incrementOrDecrement(column, amount, extra, 'increment', options);
  }

  async decrement(column, amount = 1, extra = {}, options = {}) {
    return await this.incrementOrDecrement(column, amount, extra, 'decrement', options);
  }

  async incrementOrDecrement(column, amount, extra, method, options) {
    const query = this.newModelQuery(options.client);

    if (! this.exists) {
      return await query[method](column, amount, extra);
    }

    this.attributes[column] = this[column] + (method === 'increment' ? amount : amount * -1);

    for (let key in extra) {
      this.attributes[key] = extra[key];
    }

    await this.execHooks('updating', options);

    return await tap(await query.where(this.getKeyName(), this.getKey())[method](column, amount, extra), async () => {
      this.syncChanges();
      await this.execHooks('updated', options);
      this.syncOriginalAttribute(column);
    });
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

  getIncrementing() {
    return this.incrementing;
  }

  setIncrementing(value) {
    this.incrementing = value;
    return this;
  }

  async save(options = {}) {
    // const query = this.newQuery(options.client).setModel(this);
    const query = this.newModelQuery(options.client);
    let saved;

    await this.execHooks('saving', options);

    if (this.exists) {
      if (this.isDirty() === false) {
        saved = true;
      } else {
        await this.execHooks('updating', options);

        if (this.usesTimestamps()) {
          this.updateTimestamps();
        }

        const dirty = this.getDirty();

        if (Object.keys(dirty).length > 0) {
          await query.where(this.getKeyName(), this.getKey()).query.update(dirty);
          this.syncChanges();
          await this.execHooks('updated', options);
        }

        saved = true;
      }
    } else {
      if (this.usesUniqueIds()) {
        this.setUniqueIds();
      }

      await this.execHooks('creating', options);

      if (this.usesTimestamps()) {
        this.updateTimestamps();
      }

      const attributes = this.getAttributes();

      if (this.getIncrementing()) {
        const keyName = this.getKeyName();
        const data = await query.insert([attributes], [keyName]);
        this.setAttribute(keyName, data[0]?.[keyName] || data[0]);
      } else {
        if (Object.keys(attributes).length > 0) {
          await query.insert(attributes);
        }
      }

      this.exists = true;

      await this.execHooks('created', options);

      saved = true;
    }

    if (saved) {
      await this.execHooks('saved', options);
      this.syncOriginal();
    }

    return saved;
  }

  async update(attributes = {}, options = {}) {
    if (! this.exists) {
      return false;
    }

    for (let key in attributes) {
      this[key] = attributes[key];
    }

    return await this.save(options);
  }

  async delete(options = {}) {
    await this.execHooks('deleting', options);

    await this.performDeleteOnModel(options);

    await this.execHooks('deleted', options);

    return true;
  }

  async performDeleteOnModel(options = {}) {
    await this.setKeysForSaveQuery(this.newModelQuery(options.client)).delete();

    this.exists = false;
  }

  setKeysForSaveQuery(query) {
    query.where(this.getKeyName(), '=', this.getKey());
    return query;
  }

  async forceDelete(options = {}) {
    return await this.delete(options);
  }

  fresh() {
    if (!this.exists) {
      return;
    }

    return this.constructor.query().where(this.getKeyName(), this.getKey()).first();
  }

  async refresh() {
    if (!this.exists) {
      return;
    }

    const model = await this.constructor.query().where(this.getKeyName(), this.getKey()).first();

    this.attributes = { ...model.attributes };

    await this.load(collect(this.relations).reject((relation) => {
      return relation instanceof Pivot;
    }).keys().all());

    this.syncOriginal();

    return this;
  }

  newPivot(parent, attributes, table, exists, using = null) {
    return using ? using.constructor.fromRawAttributes(parent, attributes, table, exists)
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

  async push(options = {}) {
    const saved = await this.save(options);
    if (! saved) {
      return false;
    }

    for (const relation in this.relations) {
      let models = this.relations[relation];
      models = models instanceof Collection ? models.all() : [models];

      for (const model of models) {
        if (! await model.push(options)) {
          return false;
        }
      };
    }

    return true;
  }

  is(model) {
    return model && model instanceof Model &&
      this.getKey() === model.getKey() &&
      this.getTable() === model.getTable() &&
      this.getConnectionName() === model.getConnectionName();
  }

  isNot(model) {
    return !this.is(model);
  }
}

module.exports = Model;

const Pivot = require('./pivot');
