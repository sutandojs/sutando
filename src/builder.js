const Paginator = require('./paginator');
const _ = require('lodash');
const Collection = require('./collection');
const { Collection: BaseCollection } = require('collect.js')
const Relation = require('./relations/relation')
const BelongsToMany = require('./relations/belongs-to-many');
const {
  now,
  tap,
  getRelationName,
  getScopeName,
  getRelationMethod,
  getScopeMethod,
  getAttrMethod,
  getAttrName,
} = require('./utils');
const { ModelNotFoundError, RelationNotFoundError } = require('./errors');

class Builder {
  query;
  connection;
  model;
  actions;
  eagerLoad = {};
  _scopes = {};

  constructor(query) {
    this.query = query;
    return this.asProxy();
  }

  asProxy() {
    const handler = {
      get: function (target, prop) {
        if (typeof target[prop] !== 'undefined') {
          return target[prop]
        }

        if ([
          'select', 'where', 'whereColumn', 'from', 'whereNot', 'whereIn', 'orWhere', 'whereNot', 'whereNotIn', 'whereNull', 'whereNotNull', 'whereExists',
          'whereNotExists', 'whereBetween', 'whereNotBetween', 'whereRaw', 'whereJsonObject', 'whereJsonPath', 'whereJsonSupersetOf',
          'whereJsonSubsetOf', 'leftJoin', 'leftOuterJoin', 'rightJoin', 'rightOuterJoin', 'crossJoin', 'transacting', 'groupBy',
          'limit', 'offset', 'orderBy', 'join', 'union', 'insert', 'forUpdate', 'forShare', 'distinct',
        ].includes(prop)) {
          return (...args) => {
            target.query[prop](...args);
            return target.asProxy()
          }
        }

        if ([
          'avg', 'max', 'min', 'sum', 'count',
        ].includes(prop)) {
          return (column) => {
            const instance = target.asProxy();
            instance.applyScopes();
            column = !column && prop === 'count' ? '*' : column;

            return instance.query[prop]({
              aggregate: column
            }).then(data => data?.[0]?.aggregate);
          }
        }

        if (typeof prop === 'string') {
          if (prop.startsWith('where')) {
            const column = _.snakeCase(prop.substring(5));
            return (...args) => {
              target.query.where(column, ...args);
              return target.asProxy()
            }
          }

          const scopeMethod = getScopeMethod(prop);
          if (typeof target?.model?.[scopeMethod] === 'function') {
            return (...args) => {
              target._scopes[prop] = (query) => target.model[scopeMethod](query, ...args);
              return target.asProxy();
            }
          }
        }
      },
    }

    return new Proxy(this, handler)
  }

  async chunk(count, callback) {
    let page = 1;
    let countResults;

    do {
      this.enforceOrderBy();
      const builder = this.clone();
      const results = await builder.forPage(page, count).get();

      countResults = results.count();

      if (countResults == 0) {
        break;
      }

      if (callback(results, page) === false) {
        return false;
      }

      page++;
    } while (countResults === count);

    return true;
  }

  enforceOrderBy() {
    if (this.query._statements.filter(item => item.grouping === 'order').length === 0) {
      this.orderBy(this.model.getQualifiedKeyName(), 'asc');
    }
  }

  clone() {
    const builder = new this.constructor(this.query.clone());
    builder.connection = this.connection;
    builder.setModel(this.model);
    builder._scopes = { ...this._scopes };
    return builder;
  }

  forPage(page, perPage = 15) {
    return this.offset((page - 1) * perPage).limit(perPage);
  }

  insert(...args) {
    return this.query.insert(...args);
  }

  update(values) {
    this.applyScopes();
    return this.query.update(this.addUpdatedAtColumn(values));
  }

  increment(column, amount = 1, extra = {}) {
    this.applyScopes();
    const db = this.model.getConnection();
    return this.query.update(this.addUpdatedAtColumn({
      ...extra,
      [column]: db.raw(`${column} + ${amount}`),
    }))
  }

  decrement(column, amount = 1, extra = {}) {
    this.applyScopes();
    const db = this.model.getConnection();
    return this.query.update(this.addUpdatedAtColumn({
      ...extra,
      [column]: db.raw(`${column} - ${amount}`),
    }))
  }

  addUpdatedAtColumn(values) {
    if (! this.model.usesTimestamps()
    || this.model.getUpdatedAtColumn() === null) {
      return values;
    }

    const column = this.model.getUpdatedAtColumn();

    values = _.merge(
      { [column]: new Date },
      values
    );

    return values;
  }

  delete() {
    if (this.model.useSoftDeletes() === true) {
      return this.softDelete();
    }

    return this.forceDelete();
  }

  softDelete() {
    const column = this.getDeletedAtColumn(this);
    return this.update({
      [column]: new Date,
    });
  }

  restore() {
    return this.update({
      [this.getModel().getDeletedAtColumn()]: null
    });
  }

  withTrashed() {
    return this.withoutGlobalScope('softDeletingScope');
  }

  withoutTrashed() {
    const model = this.getModel();

    this.withoutGlobalScope('softDeletingScope').whereNull(
      model.qualifyColumn(model.getDeletedAtColumn())
    );

    return this;
  }

  onlyTrashed() {
    const model = this.getModel();

    this.withoutGlobalScope('softDeletingScope').whereNotNull(
      model.qualifyColumn(model.getDeletedAtColumn())
    );

    return this;
  }

  getDeletedAtColumn(builder) {
    const model = builder.getModel();
    if (builder.query._statements.filter(item => item.constructor.name == 'JoinClause').length > 0) {
      return model.qualifyColumn(model.getDeletedAtColumn());
    }

    return model.qualifyColumn(model.getDeletedAtColumn());
  }

  forceDelete() {
    return this.query.delete();
  }

  async create(attributes = {}) {
    return await tap(this.newModelInstance(attributes), async instance => {
      await instance.save();
    });
  }

  newModelInstance(attributes = {}) {
    return this.model.newInstance(attributes).setConnection(
      this.query.getConnectionName()
    );
  }

  count(columns = '*') {
    this.applyScopes();
    return this.query.count({
      aggregate: columns
    }).then(data => data?.[0]?.aggregate);
  }

  getQuery() {
    return this.query;
  }

  getModel() {
    return this.model;
  }

  setModel(model) {
    this.model = model;
    this.query = this.query.table(this.model.table);
    return this;
  }

  setTable(talbe) {
    this.query = this.query.table(talbe);
    return this
  }

  applyScopes() {
    if (!this._scopes) {
      return this;
    }

    for (const identifier in this._scopes) {
      const scope = this._scopes[identifier];
      scope(this);
    }

    return this;
  }

  scopes(scopes) {
    scopes.map(scopeName => {
      const scopeMethod = getScopeMethod(scopeName);
      if (typeof this.model[scopeMethod] === 'function') {
        this._scopes[scopeName] = this.model[scopeMethod];
      }
    });

    return this;
  }

  withGlobalScope(identifier, scope) {
    this._scopes[identifier] = scope;
    return this;
  }

  withoutGlobalScope(identifier) {
    _.unset(this._scopes, identifier);
    return this;
  }

  with(...args) {
    let eagerLoads = {};

    if (typeof args[1] === 'function') {
      let eagerLoad = this.parseWithRelations({
        [args[0]]: args[1]
      });

      this.eagerLoad = _.merge(this.eagerLoad, eagerLoad);
      return this;
    }

    const relations = _.flattenDeep(args);
    if (relations.length === 0) {
      return this;
    }
    
    for (const relation of relations) {
      let eagerLoad;
      if (typeof relation === 'string') {
        eagerLoad = {
          [relation]: q => q,
        };
      } else if (typeof relation === 'object') {
        eagerLoad = relation;
      }

      eagerLoads = _.merge(eagerLoads, eagerLoad);
    }

    this.eagerLoad = _.merge(this.eagerLoad, this.parseWithRelations(eagerLoads));
    
    return this;
  }
  
  has(relation, operator = '>=', count = 1, boolean = 'and', callback = null) {
    if (_.isString(relation)) {
      if (relation.includes('.')) {
        return this.hasNested(relation, operator, count, boolean, callback);
      }

      relation = this.getRelationWithoutConstraints(getRelationMethod(relation));
    }

    const db = this.model.getConnection();

    const method = this.canUseExistsForExistenceCheck(operator, count)
      ? 'getRelationExistenceQuery'
      : 'getRelationExistenceCountQuery';

    const hasQuery = relation[method](
      relation.getRelated().newModelQuery(), this, db.raw('count(*)')
    );

    if (callback) {
      callback(hasQuery);
    }

    if (boolean == 'and') {
      return this.where(db.raw('(' + hasQuery.toSql().sql + ')'), operator, count);
    } else {
      return this.orWhere(db.raw('(' + hasQuery.toSql().sql + ')'), operator, count);
    }
  }

  orHas(relation, operator = '>=', count = 1) {
    return this.has(relation, operator, count, 'or');
  }

  doesntHave(relation, boolean = 'and', callback = null) {
    return this.has(relation, '<', 1, boolean, callback);
  }

  orDoesntHave(relation) {
    return this.doesntHave(relation, 'or');
  }

  whereHas(relation, callback = null, operator = '>=', count = 1) {
    return this.has(relation, operator, count, 'and', callback);
  }

  hasNested(relations, operator = '>=', count = 1, boolean = 'and', callback = null) {
    relations = relations.split('.');

    const doesntHave = operator === '<' && count === 1;

    if (doesntHave) {
      operator = '>=';
      count = 1;
    }

    const closure = (q) => {
      relations.length > 1
        ? q.whereHas(relations.shift(), closure)
        : q.has(relations.shift(), operator, count, 'and', callback);
    };

    return this.has(relations.shift(), doesntHave ? '<' : '>=', 1, boolean, closure);
  }

  canUseExistsForExistenceCheck(operator, count) {
    return (operator === '>=' || operator === '<') && count === 1;
  }

  addHasWhere(hasQuery, relation, operator, count, boolean) {
    hasQuery.mergeConstraintsFrom(relation.getQuery());

    return this.canUseExistsForExistenceCheck(operator, count)
      ? this.addWhereExistsQuery(hasQuery.getQuery(), boolean, operator === '<' && count === 1)
      : this.addWhereCountQuery(hasQuery.getQuery(), operator, count, boolean);
  }
  
  withAggregate(relations, column, action = null) {
    if (relations.length === 0) {
      return this;
    }

    relations = _.flattenDeep([relations]);
    let eagerLoads = {};

    for (const relation of relations) {
      let eagerLoad;
      if (typeof relation === 'string') {
        eagerLoad = {
          [relation]: q => q,
        };
      } else if (typeof relation === 'object') {
        eagerLoad = relation;
      }

      eagerLoads = _.merge(eagerLoads, eagerLoad);
    }

    relations = eagerLoads;
    const db = this.model.getConnection();

    const columns = this.query._statements.filter(item => item.grouping == 'columns').map(item => item.value).flat();

    if (columns.length === 0) {
      this.query.select([this.query._single.table + '.*']);
    }

    const parses = this.parseWithRelations(relations)

    for (const name in parses) {
      const constraints = parses[name];
      const segments = name.split(' ');

      let alias, expression;

      if (segments.length === 3 && segments[1].toLocaleLowerCase() === 'as') {
        [name, alias] = [segments[0], segments[2]];
      }

      const relation = this.getRelationWithoutConstraints(getRelationMethod(name));

      if (action) {
        const hashedColumn = this.query._single.table === relation.query.query._single.table
          ? `${relation.getRelationCountHash(false)}.${column}`
          : column;

        const wrappedColumn = column === '*' ? column : relation.getRelated().qualifyColumn(hashedColumn);

        expression = action === 'exists' ? wrappedColumn : `${action}(${wrappedColumn})`;
      } else {
        expression = column;
      }

      const query = relation.getRelationExistenceQuery(
        relation.getRelated().newModelQuery(), this, db.raw(expression)
      );

      constraints(query);

      alias = alias || _.snakeCase(`${name} ${action} ${column}`.replace('/[^[:alnum:][:space:]_]/u', ''));

      if (action === 'exists') {
        this.select(
          db.raw(`exists(${query.toSql().sql}) as ${alias}`),
          // query.getBindings()
        );
      } else {
        this.selectSub(
          action ? query : query.limit(1),
          alias
        );
      }
    }

    return this;
  }

  toSql() {
    const query = this.clone();
    query.applyScopes();
    return query.query.toSQL();
  }

  mergeConstraintsFrom(from) {
    return this;
    const whereBindings = from.getQuery().getRawBindings()['where'] || [];

    const wheres = from.getQuery()._single.table !== this.getQuery()._single.table
      ? this.requalifyWhereTables(
          from.getQuery().wheres,
          from.getQuery().from,
          this.getModel().getTable()
      ) : from.getQuery().wheres;

    return this.where(
      [], []
    );
  }

  selectSub(query, as) {
    const [querySub, bindings] = this.createSub(query);

    const db = this.model.getConnection();
    return this.select(
      db.raw('(' + querySub + ') as ' + as, bindings)
    );
  }

  createSub(query) {
    return this.parseSub(query);
  }

  parseSub(query) {
    if (query instanceof Builder || query instanceof Relation) {
      return [query.toSql().sql, query.toSql().bindings];
    } else if (_.isString(query)) {
      return [query, []];
    } else {
      throw new Error('A subquery must be a query builder instance, a Closure, or a string.');
    }
  }

  prependDatabaseNameIfCrossDatabaseQuery(query) {
    if (query.query._single.table !== this.query._single.table) {
      const databaseName = query.query._single.table;

      if (! query.query._single.table.startsWith(databaseName) && ! query.query._single.table.contains('.')) {
        query.from(databaseName + '.' + query.from);
      }
    }

    return query;
  }

  getRelationWithoutConstraints(relation) {
    return Relation.noConstraints(() => {
      return this.getModel()[relation]();
    });
  }

  withCount(...args) {
    return this.withAggregate(_.flattenDeep(args), '*', 'count');
  }

  withMax(relation, column) {
    return this.withAggregate(relation, column, 'max');
  }

  withMin(relation, column) {
    return this.withAggregate(relation, column, 'min');
  }

  withAvg(relation, column) {
    return this.withAggregate(relation, column, 'avg');
  }

  withSum(relation, column) {
    return this.withAggregate(relation, column, 'sum');
  }

  withExists(relation) {
    return this.withAggregate(relation, '*', 'exists');
  }

  parseWithRelations(relations) {
    if (relations.length === 0) {
      return [];
    }

    let results = {};

    const constraintsMap = this.prepareNestedWithRelationships(relations);
    for (const name in constraintsMap) {
      results = this.addNestedWiths(name, results);
      results[name] = constraintsMap[name];
    }

    return results;
  }

  addNestedWiths(name, results) {
    const progress = [];

    name.split('.').map(segment => {
      progress.push(segment);

      const last = progress.join('.');

      if (results[last] === undefined) {
        results[last] = () => {};
      }
    });

    return results;
  }

  prepareNestedWithRelationships(relations, prefix = '') {
    let preparedRelationships = {};

    if (prefix !== '') {
        prefix += '.';
    }

    for (const key in relations) {
      const value = relations[key];
      if (_.isString(value) || _.isFinite(parseInt(value))) {
        continue;
      }
      
      const [attribute, attributeSelectConstraint] = this.parseNameAndAttributeSelectionConstraint(key, value);

      preparedRelationships = _.merge(
        preparedRelationships,
        {
          [`${prefix}${attribute}`]: attributeSelectConstraint
        },
        this.prepareNestedWithRelationships(value, `${prefix}${attribute}`),
      );
      
      _.unset(relations, key);
    }

    for (const key in relations) {
      const value = relations[key];
      let attribute = key, attributeSelectConstraint = value;

      if (_.isString(value)) {
        [attribute, attributeSelectConstraint] = this.parseNameAndAttributeSelectionConstraint(value);
      }
      
      preparedRelationships[`${prefix}${attribute}`] = this.combineConstraints([
        attributeSelectConstraint,
        preparedRelationships[`${prefix}${attribute}`] || (() => {}),
      ]);
    }

    return preparedRelationships;
  }

  combineConstraints(constraints) {
    return (builder) => {
      constraints.map(constraint => {
        builder = constraint(builder) || builder;
      });

      return builder;
    };
  }

  parseNameAndAttributeSelectionConstraint(name, value) {
    return name.includes(':')
      ? this.createSelectWithConstraint(name)
      : [name, value];
  }

  createSelectWithConstraint(name) {
    return [name.split(':')[0], (query) => {
      query.select(name.split(':')[1].split(',').map((column) => {
        if (column.includes('.')) {
          return column;
        }
        
        return query instanceof BelongsToMany
          ? query.related.table + '.' + column
          : column;
      }));
    }];
  }

  related(relation) {
    if (typeof this.model[getRelationMethod(relation)] !== 'function') {
      const message = `Model [${this.model.constructor.name}]'s relation [${relation}] doesn't exist.`;
      throw new RelationNotFoundError(message);
    }

    return this.model[getRelationMethod(relation)]();
  }

  take(...args) {
    return this.limit(...args);
  }

  skip(...args) {
    return this.offset(...args);
  }

  async first(...columns) {
    this.applyScopes();
    this.limit(1);

    let models = await this.getModels(columns);

    if (models.length > 0) {
      models = await this.eagerLoadRelations(models);
    }
    
    return models[0] || null;
  }

  firstOrFail(...columns) {
    return this.first(...columns).then(data => {
      if (data === null) {
        const message = `No query results for model [${this.model.constructor.name}].`;
        throw new ModelNotFoundError(message);
      }

      return data;
    })
  }

  findOrFail(ids, columns = '*') {
    return this.find(ids, columns).then(data => {
      if (data === null) {
        const message = `No query results for model [${this.model.constructor.name}].`;
        throw new ModelNotFoundError(message);
      }

      return data;
    })
  }

  findOrNew(id, columns = ['*']) {
    const model = this.find(id, columns)
    if (model !== null) {
      return model;
    }

    return this.newModelInstance();
  }

  firstOrNew(attributes = {}, values = {}) {
    const instance = this.where(attributes).first();
    if (instance !== null) {
      return instance;
    }

    return this.newModelInstance(_.merge(attributes, values));
  }

  async firstOrCreate(attributes = {}, values = {}) {
    const instance = await this.where(attributes).first();
    if (instance !== null) {
      return instance;
    }

    return tap(this.newModelInstance(_.merge(attributes, values)), async (instance) => {
      await instance.save();
    });
  }

  async updateOrCreate(attributes, values = {}) {
    return await tap(this.firstOrNew(attributes), async (instance) => {
      await instance.fill(values).save();
    });
  }

  latest(column = null) {
    if (column === null) {
      column = this.model.getCreatedAtColumn() || 'created_at';
    }

    this.query.orderBy(column, 'desc');

    return this;
  }

  oldest(column = null) {
    if (column === null) {
      column = this.model.getCreatedAtColumn() || 'created_at';
    }

    this.query.orderBy(column, 'asc');

    return this;
  }

  find(ids, columns = '*') {
    if (ids instanceof Collection) {
      ids = ids.modelKeys();
    }

    if (ids instanceof BaseCollection) {
      ids = ids.all();
    }

    ids = _.isArray(ids) ? ids : Array.prototype.slice.call(arguments);

    this.whereIn(this.model.getKeyName(), ids);
    
    return this.get(columns).then(data => {
      return data.count() > 1 ? data : data.first()
    });
  }

  pluck(column) {
    return this.query.pluck(column).then(data => new Collection(data));
  }

  destroy(ids) {
    if (ids instanceof Collection) {
      ids = ids.modelKeys();
    }

    if (ids instanceof BaseCollection) {
      ids = ids.all();
    }

    ids = _.isArray($ids) ? ids : Array.prototype.slice.call(arguments);

    if (ids.length === 0) {
      return 0;
    }

    const instance = this.model.newInstance();
    const key = instance.getKeyName();

    return instance.whereIn(key, ids).delete();
  }

  async get(columns = '*') {
    this.applyScopes();
    let models = await this.getModels(columns);

    if (models.length > 0) {
      models = await this.eagerLoadRelations(models);
    }

    return new Collection(models);
  }

  all(columns = '*') {
    return this.get(columns);
  }

  async paginate(perPage = 15, page = 1) {
    perPage = perPage || 15;
    this.applyScopes();
    const query = this.query.clone();

    const [{ total }]= await query.count(this.primaryKey, { as: 'total' });

    let results;
    if (total > 0) {
      const skip = (page - 1) * perPage;
      this.take(perPage).skip(skip);

      results = await this.getModels();

      if (results.length > 0) {
        results = await this.eagerLoadRelations(results);
      }

    } else {
      results = [];
    }

    return new Paginator(results, total, perPage, page);
  }

  async getModels(columns = ['*']) {
    return this.hydrate(
      await this.query
    );
  }

  getRelation(name) {
    if (typeof this.model[getRelationMethod(name)] !== 'function') {
      const message = `Model [${this.model.constructor.name}]'s relation [${name}] doesn't exist.`;
      throw new RelationNotFoundError(message);
    }

    const relation = Relation.noConstraints(() => (this.model.newInstance(this.model.attributes))[getRelationMethod(name)]());

    const nested = this.relationsNestedUnder(name);

    if (Object.keys(nested).length > 0) {
      relation.query.with(nested);
    }

    return relation.asProxy();
  }
  
  relationsNestedUnder(relation) {
    const nested = {};

    for (const name in this.eagerLoad) {
      const constraints = this.eagerLoad[name];
      if (this.isNestedUnder(relation, name)) {
        nested[name.substring((relation + '.').length)] = constraints;
      }
    }

    return nested;
  }

  isNestedUnder(relation, name) {
    return name.includes('.') && name.startsWith(relation + '.');
  }

  async eagerLoadRelation(models, name, constraints) {
    const relation = this.getRelation(name);

    relation.addEagerConstraints(models);

    constraints(relation);

    return relation.match(
      relation.initRelation(models, name),
      await relation.get(),
      name
    );
  }

  async eagerLoadRelations(models) {
    for (const name in this.eagerLoad) {
      const constraints = this.eagerLoad[name];

      if (! name.includes('.')) {
        models = await this.eagerLoadRelation(models, name, constraints);
      }
    }

    return models;
  }

  hydrate(items) {
    return items.map(item => {
      if (!this.model) {
        return item;
      }

      const model = this.model.newInstance(item, true);

      return model;
    });
  }
}

module.exports = Builder;