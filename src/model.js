const _ = require('lodash');
const collect = require('collect.js');
const pluralize = require('pluralize');
const Builder = require('./builder');
const Hooks = require('./hooks');
const Collection = require('./collection');
const sutando = require('./sutando');
const {
  now,
  getRelationName,
  getScopeName,
  getRelationMethod,
  getScopeMethod,
  getAttrMethod,
  getGetterMethod,
  getSetterMethod,
  getAttrName,
} = require('./utils');
const { ModelNotFoundError, RelationNotFoundError } = require('./errors');

class Model {
  primaryKey = 'id'; // protected
  builder = null; // protected
  table = null; // protected
  connection = null; // protected
  keyType = 'int'; // protected
  incrementing = true; // protected
  perPage = 15; // protected
  attributes = {}; // protected
  exists = false;
  eagerLoad = {};
  relations = {};
  changes = [];
  appends = [];
  hidden = [];
  visible = [];
  with = [];
  withCount = []; // protected
  timestamps = true;
  dateFormat = 'YYYY-MM-DD HH:mm:ss';
  trx = null;
  softDeletes = false;

  static CREATED_AT = 'created_at';
  static UPDATED_AT = 'updated_at';
  static DELETED_AT = 'deleted_at';
  static globalScopes = [];
  static booted = false;
  static hooks = null;

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

  static addHook(hook, callback) {
    if (this.hooks instanceof Hooks === false) {
      this.hooks = new Hooks;
    }

    this.hooks.add(hook, callback);
  }

  static creating(callback) {
    this.addHook('creating', callback);
  }

  static created(callback) {
    this.addHook('created', callback);
  }

  static updating(callback) {
    this.addHook('updating', callback);
  }

  static updated(callback) {
    this.addHook('updated', callback);
  }

  static saving(callback) {
    this.addHook('saving', callback);
  }

  static saved(callback) {
    this.addHook('saved', callback);
  }

  static deleting(callback) {
    this.addHook('deleting', callback);
  }

  static deleted(callback) {
    this.addHook('deleted', callback);
  }

  static restoring(callback) {
    this.addHook('restoring', callback);
  }

  static restored(callback) {
    this.addHook('restored', callback);
  }

  static trashed(callback) {
    this.addHook('trashed', callback);
  }

  static forceDeleted(callback) {
    this.addHook('forceDeleted', callback);
  }

  async execHooks(hook, options) {
    if (this.constructor.hooks instanceof Hooks === false) {
      return;
    }

    return await this.constructor.hooks.exec(hook, [this, options]);
  }

  constructor(attributes = {}) {
    if (!this.table) {
      this.table = pluralize(_.snakeCase(this.constructor.name));
    }

    this.changes = Object.keys(attributes);
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
        if (typeof target[prop] !== 'undefined') {
          return target[prop]
        }

        // get model column
        if (typeof prop === 'string') {
          // get custom attribute
          const attrMethod = getGetterMethod(prop);
          if (typeof target[attrMethod] === 'function') {
            return target.asProxy()[attrMethod](target.attributes[prop]);
          }

          if (typeof target.attributes[prop] !== 'undefined') {
            return target.attributes[prop];
          }

          if (typeof target.relations[prop] !== 'undefined') {
            return target.relations[prop];
          }
        }
      },

      set: function (target, prop, value) {
        if (target.hasOwnProperty(prop)) {
          target[prop] = value;
          return true;
        }

        if (typeof prop === 'string') {
          const attrMethod = getSetterMethod(prop);
          if (typeof target[attrMethod] === 'function') {
            target.asProxy()[attrMethod](value);
            return true;
          }
        }

        const oldValue = target.attributes[prop];
        target.attributes[prop] = value;
        
        if (oldValue !== value) {
          target.changes.push(prop);
        }

        return true;
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

  getDateFormat() {
    return this.dateFormat;
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

  setAttributes(attributes) {
    this.attributes = attributes;
  }

  getAttributes() {
    return this.attributes;
  }

  setAppends(appends) {
    this.appends = appends;
    return this;
  }

  append(...keys) {
    const appends = _.flatMapDeep(keys);
    this.appends = [...this.appends, ...appends];
    return this;
  }

  setRelation(relation, value) {
    this.relations[relation] = value;
    return this;
  }

  unsetRelation(relation) {
    _.unset(this.relations, relation);
    return this;
  }

  static softDeletingScope(query) {
    query.whereNull(
      query.model.qualifyColumn(
        query.model.getDeletedAtColumn()
      )
    );
  }

  makeVisible(...keys) {
    const visible = _.flatMapDeep(keys);
    this.visible = [...this.visible, ...visible];

    this.hidden = _.difference(this.hidden, visible);
    return this;
  }

  async load(...relations) {
    const query = this.constructor.query().with(...relations);

    await query.eagerLoadRelations([this]);

    return this;
  }

  makeHidden(...keys) {
    const hidden = _.flatMapDeep(keys);
    this.hidden = [...this.hidden, ...hidden];

    this.visible = _.difference(this.visible, hidden);
    return this;
  }

  usesTimestamps() {
    return this.timestamps;
  }

  getCreatedAtColumn() {
    return this.constructor.CREATED_AT;
  }

  getUpdatedAtColumn() {
    return this.constructor.UPDATED_AT;
  }

  getDeletedAtColumn() {
    return this.constructor.DELETED_AT;
  }

  setCreatedAt(value) {
    this.attributes[this.getCreatedAtColumn()] = value;
    this.changes.push(this.getCreatedAtColumn());
    return this;
  }

  setUpdatedAt(value) {
    this.attributes[this.getUpdatedAtColumn()] = value;
    this.changes.push(this.getUpdatedAtColumn());
    return this;
  }

  useSoftDeletes() {
    return this.softDeletes;
  }

  updateTimestamps() {
    const time = new Date;
    time.setMilliseconds(0);

    const updatedAtColumn = this.getUpdatedAtColumn();

    if (updatedAtColumn && !this.isDirty(updatedAtColumn)) {
      this.setUpdatedAt(time);
    }

    const createdAtColumn = this.getCreatedAtColumn();

    if (!this.exists && createdAtColumn && !this.isDirty(createdAtColumn)) {
      this.setCreatedAt(time);
    }

    return this;
  }

  toData() {
    return _.merge(this.attributesToData(), this.relationsToData());
  }

  attributesToData() {
    const attributes = { ...this.attributes };

    for (const key in attributes) {
      if (this.hidden.includes(key)) {
        _.unset(attributes, key);
      }

      if (this.visible.length > 0 && this.visible.includes(key) === false) {
        _.unset(attributes, key);
      }
    }

    for (const key of this.appends) {
      attributes[key] = this.mutateAttribute(key, null);
    }

    return attributes;
  }

  mutateAttribute(key, value) {
    return this[getAttrMethod(key)](value)
  }

  mutateAttributeForArray(key, value) {

  }

  relationsToData() {
    const data = {};
    for (const key in this.relations) {
      if (this.hidden.includes(key)) {
        continue;
      }

      if (this.visible.length > 0 && this.visible.includes(key) === false) {
        continue;
      }

      data[key] = this.relations[key] instanceof Array
        ? this.relations[key].map(item => item.toData())
        : this.relations[key] === null
          ? null
          : this.relations[key].toData();
    }

    return data;
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

  isDirty(...attributes) {
    if (attributes.length === 0) {
      return this.changes.length > 0;
    }

    return _.intersection(
      _.flatMapDeep(attributes),
      this.changes
    ).length > 0;
  }

  getDirty() {
    const dirty = {};

    for (const key in this.attributes) {
      const value = this.attributes[key];
      if (this.changes.includes(key)) {
        dirty[key] = value;
      }
    }

    return dirty;
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
          await this.execHooks('updated', options);
        }

        saved = true;
      }
    } else {
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
      this.changes = [];
      await this.execHooks('saved', options);
    }

    return saved;
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

    this.attributes = model.attributes;
    this.changes = [];

    await this.load(collect(this.relations).reject((relation) => {
      return relation instanceof Pivot;
    }).keys().all());

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

  related(relation) {
    if (typeof this[getRelationMethod(relation)] !== 'function') {
      const message = `Model [${this.constructor.name}]'s relation [${relation}] doesn't exist.`;
      throw new RelationNotFoundError(message);
    }
    
    return this[getRelationMethod(relation)]();
  }

  async getRelated(relation) {
    return await this.related(relation).getResults();
  }

  guessBelongsToRelation() {
    let e = new Error();
    let frame = e.stack.split("\n")[2];
    // let lineNumber = frame.split(":").reverse()[1];
    let functionName = frame.split(" ")[5];
    return getRelationName(functionName);
  }

  hasOne(model, foreignKey = null, localKey = null) {
    const query = model.query();
    const instance = new model;
    foreignKey = foreignKey || this.constructor.name.toLowerCase() + '_id';
    localKey = localKey || this.getKeyName();

    return (new HasOne(query, this, instance.getTable() + '.' + foreignKey, localKey));
  }

  hasMany(model, foreignKey = null, localKey = null) {
    const query = model.query();
    const instance = new model;
    foreignKey = foreignKey || this.constructor.name.toLowerCase() + '_id';
    localKey = localKey || this.getKeyName();

    return (new HasMany(query, this, instance.getTable() + '.' + foreignKey, localKey));
  }

  belongsTo(model, foreignKey = null, ownerKey = null, relation = null) {
    const query = model.query();
    const instance = new model;
    foreignKey = foreignKey || instance.constructor.name.toLowerCase() + '_id';
    ownerKey = ownerKey ||  instance.getKeyName();

    relation = relation || this.guessBelongsToRelation();

    return (new BelongsTo(query, this, foreignKey, ownerKey, relation));
  }

  belongsToMany(model, table = null, foreignPivotKey = null, relatedPivotKey = null, parentKey = null, relatedKey = null) {
    const query = model.query();
    const instance = new model;
    table = table || [this.constructor.name, instance.constructor.name].sort().join('_').toLocaleLowerCase();
    foreignPivotKey = foreignPivotKey || this.constructor.name.toLowerCase() + '_id';
    relatedPivotKey = relatedPivotKey || instance.constructor.name.toLowerCase() + '_id';
    parentKey = parentKey || this.getKeyName();
    relatedKey = relatedKey || instance.getKeyName();

    return (new BelongsToMany(
      query,
      this,
      table,
      foreignPivotKey,
      relatedPivotKey,
      parentKey,
      relatedKey
    ));
  }
}

module.exports = Model;

const Pivot = require('./pivot');
const HasOne = require('./relations/has-one');
const HasMany = require('./relations/has-many');
const BelongsTo = require('./relations/belongs-to');
const BelongsToMany = require('./relations/belongs-to-many');
