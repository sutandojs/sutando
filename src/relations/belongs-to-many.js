const { collect } = require('collect.js');
const unset = require('lodash/unset');
const isEqual = require('lodash/isEqual');
const concat = require('lodash/concat');
const Relation = require('./relation');
const Collection = require('../collection');
const { tap, compose } = require('../utils');
const InteractsWithPivotTable = require('./concerns/interacts-with-pivot-table');

class BelongsToMany extends compose(
  Relation,
  InteractsWithPivotTable
) {
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
      model.setRelation(relation, new Collection([]));
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
      this.getTable(),
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

  async first(columns = ['*']) {
    const results = await this.take(1).get(columns);
    return results.count() > 0 ? results.first() : null;
  }

  async firstOrFail(columns = ['*']) {
    const model = await this.first(columns);
    if (model !== null) {
      return model;
    }

    throw (new ModelNotFoundError).setModel(this.related.constructor);
  }

  async paginate(page = 1, perPage = 15, columns = ['*']) {
    this.query.select(this.shouldSelect(columns));

    return tap(await this.query.paginate(page, perPage), (paginator) => {
      this.hydratePivotRelation(paginator.items());
    });
  }

  async chunk(count, callback) {
    return await this.prepareQueryBuilder().chunk(count, async (results, page) => {
      this.hydratePivotRelation(results.all());

      return await callback(results, page);
    });
  }

  setUsing(model) {
    this.using = model;
    return this;
  }

  as(accessor) {
    this.accessor = accessor;
    return this;
  }

  prepareQueryBuilder() {
    return this.query.select(this.shouldSelect());
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
        
        unset(model.attributes, key);
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
    if (isEqual(columns, ['*'])) {
      columns = [this.related.getTable() + '.*'];
    }

    return concat(columns, this.aliasedPivotColumns());
  }
  
  aliasedPivotColumns() {
    const defaults = [this.foreignPivotKey, this.relatedPivotKey];

    return collect(concat(defaults, this.pivotColumns)).map((column) => {
      return this.qualifyPivotColumn(column) + ' as pivot_' + column;
    }).unique().all();
  }

  qualifyPivotColumn(column) {
    return column.includes('.')
      ? column
      : this.getTable() + '.' + column;
  }

  match(models, results, relation) {
    const dictionary = this.buildDictionary(results);

    models.map(model => {
      const key = model.getKey();

      if (dictionary[key] !== undefined) {
        model.setRelation(relation, dictionary[key]);
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

  getRelationExistenceQuery(query, parentQuery, columns = ['*']) {
    if (parentQuery.getQuery()._single.table == query.getQuery()._single.table) {
      return this.getRelationExistenceQueryForSelfJoin(query, parentQuery, columns);
    }

    this.performJoin(query);

    return super.getRelationExistenceQuery(query, parentQuery, columns);
  }

  getRelationExistenceQueryForSelfJoin(query, parentQuery, columns = ['*']) {
    const hash = this.getRelationCountHash();
    query.select(columns).from(this.related.getTable() + ' as ' + hash);

    this.related.setTable(hash);

    this.performJoin(query);

    return super.getRelationExistenceQuery(query, parentQuery, columns);
  }
}

module.exports = BelongsToMany;