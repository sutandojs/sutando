const _ = require('lodash');
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
const { compose, tap } = require('./utils');

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
  softDeletes = false;
  forceDeleting = false;

  static globalScopes = [];
  static booted = false;

  static query(trx = null) {
    const instance = new this;
    // instance.instance = instance;
    // log('model-query', trx)
    return instance.newQuery(trx).setModel(instance);
  }

  static on(connection = null) {
    const instance = new this;

    instance.setConnection(connection);
    return instance.newQuery().setModel(instance);
  }

  static init(attributes = {}) {
    return new this(attributes);
  }

  static extend(plugin, options) {
    plugin(this, options);
  }

  constructor(attributes = {}) {
    super();
    if (!this.table) {
      this.table = pluralize(_.snakeCase(this.constructor.name));
    }

    this.syncOriginal();
    this.attributes = { ...this.attributes, ...attributes };

    this.constructor.bootIfNotBooted();

    return this.asProxy();
  }

  static bootIfNotBooted() {
    if (this.booted === false) {
      this.boot();
      this.booted = true;
    }
  }

  static boot() {
    //
  }

  newInstance(attributes = {}, exists = false) {
    const model = new this.constructor;

    model.exists = exists;
    model.connection = this.getConnectionName();
    model.table = this.getTable();
    model.attributes = { ...this.attributes, ...attributes };

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
        if (target.hasOwnProperty(prop)) {
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
    return this.attributes[this.getKeyName()];
  }

  getKeyName() {
    return this.primaryKey;
  }

  getConnectionName() {
    return this.connection;
  }

  getTable() {
    return this.table;
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
    const connection = trx || this.getConnection();
    const builder = new Builder(connection);
    builder.with(this.with); // .withCount(this.withCount);
    
    if (this.useSoftDeletes() === true) {
      builder.withGlobalScope('softDeletingScope', this.constructor.softDeletingScope);
    }

    return builder;
  }

  newModelQuery(trx = null) {
    return this.newQuery(trx).setModel(this);
  }

  setTable(table) {
    this.table = table;
    return this;
  }

  static softDeletingScope(query) {
    query.whereNull(
      query.model.qualifyColumn(
        query.model.getDeletedAtColumn()
      )
    );
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
    relations = _.flatMapDeep(relations);
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

  serializeDate(date) {
    return date.toJSON();
  }

  useSoftDeletes() {
    return this.softDeletes;
  }

  toData() {
    return _.merge(this.attributesToData(), this.relationsToData());
  }

  toJSON() {
    return this.toData();
  }

  toJson(...args) {
    return JSON.stringify(this.toData(), ...args);
  }

  fill(attributes) {
    const totallyGuarded = this.totallyGuarded();
    const fillable = this.fillableFromArray(attributes)
    for (const key in fillable) {
      const value = fillable[key];
      if (this.isFillable(key)) {
        this[key] = value;
      } else if (totallyGuarded) {
        throw new Error(`Add [${key}] to fillable property to allow mass assignment on [${this.constructor.name}].`);
      }
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

  async save(options = {}) {
    const query = this.newQuery(options.client).setModel(this);
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

      const data = await query.insert([this.getAttributes()], ['id']);
      this.exists = true;
      this.attributes[this.getKeyName()] = data[0]?.id || data[0];

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
    if (this.useSoftDeletes()) {
      await this.softDelete(options);
    } else {
      await this.forceDelete(options);
    }

    return true;
  }

  async softDelete(options = {}) {
    await this.execHooks('deleting', options);

    const query = this.newQuery(options.client).setModel(this).where(this.getKeyName(), this.getKey());

    const time = new Date;

    const columns = {
      [this.getDeletedAtColumn()]: time
    };

    this.attributes[this.getDeletedAtColumn()] = time;

    if (this.usesTimestamps() && this.getUpdatedAtColumn() !== null) {
      this.attributes[this.getUpdatedAtColumn()] = time;
      columns[this.getUpdatedAtColumn()] = time;
    }

    await query.update(columns);

    await this.execHooks('deleted', options);
    await this.execHooks('trashed', options);
  }

  async forceDelete(options = {}) {
    await this.execHooks('deleting', options);

    this.forceDeleting = true;
    const query = this.newQuery(options.client).setModel(this);
    this.exists = false;
    const result = await query.where(this.getKeyName(), this.getKey()).query.delete();
    this.forceDeleting = false;

    await this.execHooks('deleted', options);
    await this.execHooks('forceDeleted', options);
    return result;
  }

  async restore(options = {}) {
    await this.execHooks('restoring', options);

    this[this.getDeletedAtColumn()] = null;
    this.exists = true;
    const result =  await this.save(options);

    await this.execHooks('restored', options);

    return result;
  }

  trashed() {
    return this[this.getDeletedAtColumn()] !== null;
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

    return `${this.table}.${column}`;
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
