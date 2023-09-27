const Relation = require('./relation');
const { collect } = require('collect.js');
const Collection = require('../collection');
const _ = require('lodash');
const { tap } = require('../utils');

let model = null;
const getBaseModel = () => {
  if (!model) {
    model = require('../model');
  }
  return model;
}

let pivot = null;

const getPivotModel = () => {
  if (!pivot) {
    pivot = require('../pivot');
  }
  return pivot;
}

class BelongsToMany extends Relation {
  table;
  foreignPivotKey;
  relatedPivotKey;
  parentKey;
  relatedKey;
  pivotColumns = [];
  pivotValues = [];
  pivotWheres = [];
  pivotWhereIns = [];
  pivotWhereNulls = [];
  accessor = 'pivot';
  // withTimestamps = false;
  using;
  pivotCreatedAt;
  pivotUpdatedAt;

  constructor(query, parent, table, foreignPivotKey, relatedPivotKey, parentKey, relatedKey) {
    super(query, parent);
    this.table = table;
    this.foreignPivotKey = foreignPivotKey;
    this.relatedPivotKey = relatedPivotKey;
    this.parentKey = parentKey;
    this.relatedKey = relatedKey;

    this.addConstraints();
    return this.asProxy()
  }

  initRelation(models, relation) {
    models.map(model => {
      model.relations[relation] = new Collection([]);
    })

    return models;
  }

  addConstraints() {
    this.performJoin();

    if (this.constructor.constraints) {
      this.addWhereConstraints();
    }
  }

  performJoin(query = null) {
    query = query || this.query;

    query.join(
      this.table,
      this.getQualifiedRelatedKeyName(),
      '=',
      this.qualifyPivotColumn(this.relatedPivotKey)
    );

    return this;
  }

  getTable() {
    return this.table;
  }

  getQualifiedRelatedKeyName() {
    return this.related.qualifyColumn(this.relatedKey);
  }

  async getResults() {
    return this.parent[this.parentKey] !== null
      ? await this.get()
      : new Collection([]);
  }

  addWhereConstraints() {
    this.query.where(
      this.getQualifiedForeignPivotKeyName(), '=', this.parent[this.parentKey]
    );

    return this;
  }

  async get(columns = ['*']) {
    const builder = this.query.applyScopes();

    columns = builder.query?._statements?.find(item => item.grouping == 'columns') ? [] : columns;

    let models = await builder.select(
      this.shouldSelect(columns)
    ).getModels();

    this.hydratePivotRelation(models);

    if (models.length > 0) {
      models = await builder.eagerLoadRelations(models);
    }

    return new Collection(models);
  }

  async paginate(page = 1, perPage = 15, columns = ['*']) {
    this.query.select(this.shouldSelect(columns));

    return tap(this.query.paginate(page, perPage), function (paginator) {
      this.hydratePivotRelation(paginator.items());
    });
  }

  as(accessor) {
    this.accessor = accessor;
    return this;
  }

  hydratePivotRelation(models) {
    models.map(model => {
      model.setRelation(this.accessor, this.newExistingPivot(
        this.migratePivotAttributes(model)
      ));
    });
  }

  migratePivotAttributes(model) {
    const values = {};

    for (const key in model.attributes) {
      const value = model.attributes[key];
      if (key.startsWith('pivot_')) {
        values[key.substring(6)] = value;
        
        _.unset(model.attributes, key);
      }
    }

    return values;
  }

  withTimestamps(createdAt = null, updatedAt = null) {
    this.pivotCreatedAt = createdAt;
    this.pivotUpdatedAt = updatedAt;

    return this.withPivot(this.createdAt(), this.updatedAt());
  }
  
  shouldSelect(columns = ['*']) {
    if (_.isEqual(columns, ['*'])) {
      columns = [this.related.table + '.*'];
    }

    return _.concat(columns, this.aliasedPivotColumns());
  }
  
  aliasedPivotColumns() {
    const defaults = [this.foreignPivotKey, this.relatedPivotKey];

    return collect(_.concat(defaults, this.pivotColumns)).map((column) => {
      return this.qualifyPivotColumn(column) + ' as pivot_' + column;
    }).unique().all();
  }

  qualifyPivotColumn(column) {
    return column.includes('.')
      ? column
      : this.table + '.' + column;
  }

  match(models, results, relation) {
    const dictionary = this.buildDictionary(results);

    models.map(model => {
      const key = model.getKey();

      if (dictionary[key] !== undefined) {
        model.relations[relation] = dictionary[key];
      }
    })

    return models;
  }

  buildDictionary(results) {
    const dictionary = {};

    results.map(result => {
      const value = result[this.accessor][this.foreignPivotKey];

      if (dictionary[value] === undefined) {
        dictionary[value] = new Collection([]);
      }

      dictionary[value].push(result);
    })

    return dictionary;
  }

  addEagerConstraints(models) {
    this.query.whereIn(
      this.getQualifiedForeignPivotKeyName(),
      this.getKeys(models, this.parentKey)
    );
  }

  getQualifiedForeignPivotKeyName() {
    return this.qualifyPivotColumn(this.foreignPivotKey);
  }

  qualifyPivotColumn(column) {
    return column.includes('.')
      ? column
      : `${this.table}.${column}`;
  }

  getQualifiedRelatedPivotKeyName() {
    return this.qualifyPivotColumn(this.relatedPivotKey);
  }

  wherePivot(column, operator = null, value = null, boolean = 'and') {
    this.pivotWheres.push(Array.prototype.slice.call(arguments));
    return this.where(this.qualifyPivotColumn(column), operator, value, boolean);
  }

  wherePivotBetween(column, values, boolean = 'and', not = false) {
    return this.whereBetween(this.qualifyPivotColumn(column), values, boolean, not);
  }

  orWherePivotBetween(column, values) {
      return this.wherePivotBetween(column, values, 'or');
  }

  wherePivotNotBetween(column, values, boolean = 'and') {
    return this.wherePivotBetween(column, values, boolean, true);
  }

  orWherePivotNotBetween(column, values) {
    return this.wherePivotBetween(column, values, 'or', true);
  }

  wherePivotIn(column, values, boolean = 'and', not = false) {
    return this.whereIn(this.qualifyPivotColumn(column), values, boolean, not);
  }

  orWherePivot(column, operator = null, value = null) {
    return this.wherePivot(column, operator, value, 'or');
  }

  orWherePivotIn(column, values) {
    return this.wherePivotIn(column, values, 'or');
  }

  wherePivotNotIn(column, values, boolean = 'and') {
    return this.wherePivotIn(column, values, boolean, true);
  }

  orWherePivotNotIn(column, values) {
    return this.wherePivotNotIn(column, values, 'or');
  }

  wherePivotNull(column, boolean = 'and', not = false) {
    return this.whereNull(this.qualifyPivotColumn(column), boolean, not);
  }

  wherePivotNotNull(column, boolean = 'and') {
    return this.wherePivotNull(column, boolean, true);
  }

  orWherePivotNull(column, not = false) {
    return this.wherePivotNull(column, 'or', not);
  }

  orWherePivotNotNull(column) {
    return this.orWherePivotNull(column, true);
  }

  orderByPivot(column, direction = 'asc') {
    return this.orderBy(this.qualifyPivotColumn(column), direction);
  }

  createdAt() {
    return this.pivotCreatedAt || this.parent.getCreatedAtColumn();
  }
  
  updatedAt() {
    return this.pivotUpdatedAt || this.parent.getUpdatedAtColumn();
  }

  getExistenceCompareKey() {
    return this.getQualifiedForeignPivotKeyName();
  }

  // touchIfTouching() {
  //   if (this.touchingParent()) {
  //     this.getParent().touch();
  //   }

  //   if (this.getParent().touches(this.relationName)) {
  //     this.touch();
  //   }
  // }
}

BelongsToMany.prototype.newExistingPivot = function (attributes = []) {
  return this.newPivot(attributes, true);
}

BelongsToMany.prototype.newPivot = function (attributes = [], exists = false) {
  const pivot = this.related.newPivot(
    this.parent, attributes, this.table, exists, this.using
  );

  return pivot.setPivotKeys(this.foreignPivotKey, this.relatedPivotKey);
}

BelongsToMany.prototype.attach = async function(id, attributes = {}, touch = true) {
  if (this.using) {
    await this.attachUsingCustomClass(id, attributes);
  } else {
    await this.newPivotStatement().insert(this.formatAttachRecords(
      this.parseIds(id), attributes
    ));
  }

  // if (touch) {
  //   this.touchIfTouching();
  // }
}

BelongsToMany.prototype.detach = async function(ids = null, touch = true) {
  let results;

  if (this.using &&
    ids !== null &&
    this.pivotWheres.length == 0 &&
    this.pivotWhereIns.length == 0 &&
    this.pivotWhereNulls.length == 0) {
    results = await this.detachUsingCustomClass(ids);
  } else {
    const query = this.newPivotQuery();

    if (ids !== null) {
      ids = this.parseIds(ids);

      if (ids.length == 0) {
        return 0;
      }

      query.whereIn(this.getQualifiedRelatedPivotKeyName(), ids);
    }

    results = await query.delete();
  }

  // if (touch) {
  //   this.touchIfTouching();
  // }

  return results;
}

BelongsToMany.prototype.sync = async function (ids, detaching = true) {
  let changes = {
    attached: [],
    detached: [],
    updated: [],
  };
  let records;

  const results = await this.getCurrentlyAttachedPivots();
  const current = results.length === 0 ? [] : results.map(result => result.toData()).pluck(this.relatedPivotKey).all().map(i => String(i));

  const detach = _.difference(current, Object.keys(
    records = this.formatRecordsList(this.parseIds(ids))
  ));

  if (detaching && detach.length > 0) {
    await this.detach(detach);

    changes.detached = this.castKeys(detach);
  }

  changes = _.merge(
    changes, await this.attachNew(records, current, false)
  );

  return changes;
}

BelongsToMany.prototype.syncWithoutDetaching = function (ids) {
  return this.sync(ids, false);
}

BelongsToMany.prototype.syncWithPivotValues = function (ids, values, detaching = true) {
  return this.sync(collect(this.parseIds(ids)).mapWithKeys(id => {
    return [id, values];
  }), detaching);
}

BelongsToMany.prototype.withPivot = function (columns) {
  this.pivotColumns = _.concat(
    this.pivotColumns, _.isArray(columns) ? columns : Array.prototype.slice.call(arguments)
  );

  return this;
}

BelongsToMany.prototype.attachNew = async function (records, current, touch = true) {
  const changes = {
    attached: [],
    updated: []
  };

  for (const id in records) {
    const attributes = records[id];
    
    if (!current.includes(id)) {
      await this.attach(id, attributes, touch);

      changes.attached.push(this.castKey(id));
    } else if (Object.keys(attributes).length > 0 && await this.updateExistingPivot(id, attributes, touch)) {
      changes.updated.push(this.castKey(id));
    }
  }

  return changes;
}

BelongsToMany.prototype.updateExistingPivot = async function (id, attributes, touch = true) {
  if (this.using &&
    this.pivotWheres.length > 0 &&
    this.pivotWhereInspivotWheres.length > 0 &&
    this.pivotWhereNullspivotWheres.length > 0) {
    return await this.updateExistingPivotUsingCustomClass(id, attributes, touch);
  }

  if (this.hasPivotColumn(this.updatedAt())) {
    attributes = this.addTimestampsToAttachment(attributes, true);
  }

  const updated = this.newPivotStatementForId(this.parseId(id)).update(
    this.castAttributes(attributes)
  );

  // if (touch) {
  //   this.touchIfTouching();
  // }

  return updated;
}

BelongsToMany.prototype.addTimestampsToAttachment = function (record, exists = false) {
  let fresh = now(this.parent.getDateFormat());

  if (this.using) {
    const pivotModel = new this.using;

    fresh = now(pivotModel.getDateFormat());
  }

  if (! exists && this.hasPivotColumn(this.createdAt())) {
    record[this.createdAt()] = fresh;
  }

  if (this.hasPivotColumn(this.updatedAt())) {
    record[this.updatedAt()] = fresh;
  }

  return record;
}

BelongsToMany.prototype.updateExistingPivotUsingCustomClass = async function (id, attributes, touch) {
  const pivot = await this.getCurrentlyAttachedPivots()
    .where(this.foreignPivotKey, this.parent[this.parentKey])
    .where(this.relatedPivotKey, this.parseId(id))
    .first();

  const updated = pivot ? pivot.fill(attributes).isDirty() : false;

  if (updated) {
    await pivot.save();
  }

  // if (touch) {
  //   this.touchIfTouching();
  // }

  return parseInt(updated);
}

BelongsToMany.prototype.formatRecordsList = function (records) {
  return collect(records).mapWithKeys((attributes, id) => {
    if (! _.isArray(attributes)) {
      [id, attributes] = [attributes, {}];
    }

    return [id, attributes];
  }).all();
}

BelongsToMany.prototype.getCurrentlyAttachedPivots = async function () {
  const query = this.newPivotQuery();
  const results = await query.get();
  const Pivot = getPivotModel();
  return results.map(record => {
    const modelClass = this.using || Pivot;

    const pivot = modelClass.fromRawAttributes(this.parent, record, this.getTable(), true);

    return pivot.setPivotKeys(this.foreignPivotKey, this.relatedPivotKey);
  });
}

BelongsToMany.prototype.castKeys = function (keys) {
  return keys.map(v => {
    return this.castKey(v);
  });
}

BelongsToMany.prototype.castKey = function (key) {
  return this.getTypeSwapValue(
    this.related.getKeyType(),
    key
  );
}

BelongsToMany.prototype.getTypeSwapValue = function (type, value) {
  switch (type.toLowerCase()) {
    case 'int':
    case 'integer':
      return parseInt(value);
      break;
    case 'real':
    case 'float':
    case 'double':
      return parseFloat(value);
      break;
    case 'string':
      return String(value);
      break;
    default:
      return value;
  }
}

BelongsToMany.prototype.newPivotQuery = function () {
  const query = this.newPivotStatement();

  this.pivotWheres.map(args => {
    query.where(...args);
  });

  this.pivotWhereIns.map(args => {
    query.whereIn(...args);
  });

  this.pivotWhereNulls.map(args => {
    query.whereNull(...args);
  });

  return query.where(this.getQualifiedForeignPivotKeyName(), this.parent[this.parentKey]);
}

BelongsToMany.prototype.detachUsingCustomClass = async function (ids) {
  let results = 0;

  for (const id in this.parseIds(ids)) {
    results += await this.newPivot({
      [this.foreignPivotKey]: this.parent[this.parentKey],
      [this.relatedPivotKey]: id,
    }, true).delete();
  };

  return results;
}

BelongsToMany.prototype.newPivotStatement = function () {
  const builder = this.parent.newQuery();
  builder.setTable(this.table);

  return builder;
}

BelongsToMany.prototype.attachUsingCustomClass = async function (id, attributes) {
  const records = this.formatAttachRecords(
    this.parseIds(id), attributes
  );

  await Promise.all(records.map(async record => {
    await this.newPivot(record, false).save();
  }));
}

BelongsToMany.prototype.formatAttachRecords = function(ids, attributes) {
  const records = [];
  const hasTimestamps = (this.hasPivotColumn(this.createdAt()) || this.hasPivotColumn(this.updatedAt()));

  for (const key in ids) {
    const value = ids[key];
    records.push(this.formatAttachRecord(
      key, value, attributes, hasTimestamps
    ));
  }

  return records;
}

BelongsToMany.prototype.formatAttachRecord = function (key, value, attributes, hasTimestamps) {
  const [id, newAttributes] = this.extractAttachIdAndAttributes(key, value, attributes);

  return _.merge(
    this.baseAttachRecord(id, hasTimestamps), newAttributes
  );
}

BelongsToMany.prototype.baseAttachRecord = function (id, timed) {
  const record = {};
  record[this.relatedPivotKey] = id;

  record[this.foreignPivotKey] = this.parent[this.parentKey];

  if (timed) {
    record = this.addTimestampsToAttachment(record);
  }

  this.pivotValues.map(value => {
    record[value.column] = value.value;
  })

  return record;
}

BelongsToMany.prototype.extractAttachIdAndAttributes = function (key, value, newAttributes) {
  return _.isArray(value)
    ? [key, {...value, ...newAttributes}]
    : [value, newAttributes];
}

BelongsToMany.prototype.hasPivotColumn = function(column) {
  return this.pivotColumns.includes(column);
}

BelongsToMany.prototype.parseIds = function (value) {
  const baseModel = getBaseModel();

  if (value instanceof baseModel) {
    return [value[this.relatedKey]];
  }

  if (value instanceof Collection) {
    return value.pluck(this.relatedKey).all();
  }

  return _.isArray(value) ? value : [value];
}

module.exports = BelongsToMany;