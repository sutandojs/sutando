const { Collection: BaseCollection } = require('collect.js');
const merge = require('lodash/merge');
const snakeCase = require('lodash/snakeCase');
const flattenDeep = require('lodash/flattenDeep');
const flatten = require('lodash/flatten');
const isString = require('lodash/isString');
const isFinite = require('lodash/isFinite');
const unset = require('lodash/unset');
const isArray = require('lodash/isArray');
const difference = require('lodash/difference');
const Paginator = require('./paginator');
const Collection = require('./collection');
const Relation = require('./relations/relation');
const BelongsToMany = require('./relations/belongs-to-many');
const Scope = require('./scope');
const {
  tap,
  getRelationMethod,
  getScopeMethod
} = require('./utils');
const { ModelNotFoundError, RelationNotFoundError } = require('./errors');

class Builder {
  query;
  connection;
  model;
  actions;
  localMacros = {};
  eagerLoad = {};
  globalScopes = {};

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
          'select', 'from', 'where', 'orWhere', 'whereColumn', 'whereRaw',
          'whereNot', 'orWhereNot', 'whereIn', 'orWhereIn', 'whereNotIn', 'orWhereNotIn', 'whereNull', 'orWhereNull', 'whereNotNull', 'orWhereNotNull', 'whereExists', 'orWhereExists',
          'whereNotExists', 'orWhereNotExists', 'whereBetween', 'orWhereBetween', 'whereNotBetween', 'orWhereNotBetween',
          'whereLike', 'orWhereLike', 'whereILike', 'orWhereILike', 
          'whereJsonObject', 'whereJsonPath', 'whereJsonSupersetOf', 'whereJsonSubsetOf', 
          'join', 'joinRaw', 'leftJoin', 'leftOuterJoin', 'rightJoin', 'rightOuterJoin', 'crossJoin', 
          'transacting', 'groupBy', 'groupByRaw', 'returning',
          'having', 'havingRaw', 'havingBetween', 
          'limit', 'offset', 'orderBy', 'orderByRaw', // 'inRandomOrder',
          'union', 'insert', 'forUpdate', 'forShare', 'distinct',
          'clearOrder', 'clear', 'clearSelect', 'clearWhere', 'clearHaving', 'clearGroup',
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

            return instance.query[prop](column);
          }
        }

        if (typeof prop === 'string') {
          if (target.hasMacro(prop)) {
            const instance = target.asProxy();
            return (...args) => {
              return instance.localMacros[prop](instance, ...args);
            };
          }

          if (target.hasNamedScope(prop)) {
            const instance = target.asProxy();
            return (...args) => {
              instance.callNamedScope(prop, args);
              return instance;
            }
          }

          if (prop.startsWith('where')) {
            const column = snakeCase(prop.substring(5));
            return (...args) => {
              target.query.where(column, ...args);
              return target.asProxy()
            }
          }
        }
      },
    }

    return new Proxy(this, handler)
  }

  orWhere(...args) {
    if (typeof args[0] === 'function') {
      const callback = args[0];
      this.query.orWhere((query) => {
        this.query = query;
        callback(this);
      });

      return this;
    }

    this.query.orWhere(...args);

    return this;
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

      const bool = await callback(results, page);

      if (bool === false) {
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
    const query = this.query.clone();

    const builder = new this.constructor(query);
    builder.connection = this.connection;
    builder.setModel(this.model);
    builder.globalScopes = { ...this.globalScopes };
    builder.localMacros = { ...this.localMacros };
    builder.eagerLoad = { ...this.eagerLoad };
    
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

    values = merge(
      { [column]: this.model.freshTimestampString() },
      values
    );

    return values;
  }

  delete() {
    if (this.onDeleteCallback) {
      return this.onDeleteCallback(this);
    }

    return this.query.delete();
  }

  onDelete(callback) {
    this.onDeleteCallback = callback;
  }

  forceDelete() {
    return this.query.delete();
  }

  async create(attributes = {}) {
    return await tap(this.newModelInstance(attributes), async instance => {
      await instance.save({
        client: this.query
      });
    });
  }

  newModelInstance(attributes = {}) {
    return this.model.newInstance(attributes).setConnection(
      this.model.getConnectionName()
    );
  }

  getQuery() {
    return this.query;
  }

  getModel() {
    return this.model;
  }

  setModel(model) {
    this.model = model;
    if (typeof this.query?.client?.table == 'function') {
      this.query = this.query.client.table(this.model.getTable());
    } else {
      this.query = this.query?.table(this.model.getTable());
    }
    
    return this;
  }

  qualifyColumn(column) {
    return this.model.qualifyColumn(column);
  }

  setTable(table) {
    this.query = this.query.table(table);
    return this
  }

  applyScopes() {
    if (!this.globalScopes) {
      return this;
    }

    const builder = this;

    for (const identifier in builder.globalScopes) {
      const scope = builder.globalScopes[identifier];

      if (scope instanceof Scope) {
        scope.apply(builder, builder.getModel());
      } else {
        scope(builder);
      }
    }

    return builder;
  }

  hasNamedScope(name) {
    return this.model && this.model.hasNamedScope(name);
  }

  callNamedScope(scope, parameters) {
    return this.model.callNamedScope(scope, [this, ...parameters]);
  }

  callScope(scope, parameters = []) {
    const result = scope(this, ...parameters) || this;
    return result;
  }

  scopes(scopes) {
    scopes.map(scopeName => {
      const scopeMethod = getScopeMethod(scopeName);
      if (typeof this.model[scopeMethod] === 'function') {
        this.globalScopes[scopeName] = this.model[scopeMethod];
      }
    });

    return this;
  }

  withGlobalScope(identifier, scope) {
    this.globalScopes[identifier] = scope;

    if (typeof scope.extend === 'function') {
      scope.extend(this);
    }

    return this;
  }

  withoutGlobalScope(scope) {
    if (typeof scope !== 'string') {
      scope = scope.constructor.name;
    }
    
    unset(this.globalScopes, scope);

    return this;
  }

  macro(name, callback) {
    this.localMacros[name] = callback;
    return;
  }

  hasMacro(name) {
    return name in this.localMacros;
  }

  getMacro(name) {
    return this.localMacros[name];
  }

  with(...args) {
    let eagerLoads = {};

    if (typeof args[1] === 'function') {
      let eagerLoad = this.parseWithRelations({
        [args[0]]: args[1]
      });

      this.eagerLoad = merge(this.eagerLoad, eagerLoad);
      return this;
    }

    const relations = flattenDeep(args);
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

      eagerLoads = merge(eagerLoads, eagerLoad);
    }

    this.eagerLoad = merge(this.eagerLoad, this.parseWithRelations(eagerLoads));
    
    return this;
  }

  has(relation, operator = '>=', count = 1, boolean = 'and', callback = null) {
    if (isString(relation)) {
      if (relation.includes('.')) {
        return this.hasNested(relation, operator, count, boolean, callback);
      }

      relation = this.getRelationWithoutConstraints(getRelationMethod(relation));
    }

    const method = this.canUseExistsForExistenceCheck(operator, count)
      ? 'getRelationExistenceQuery'
      : 'getRelationExistenceCountQuery';

    const hasQuery = relation[method](
      relation.getRelated().newModelQuery(), this
    );

    if (callback) {
      callback(hasQuery);
    }

    return this.addHasWhere(
      hasQuery, relation, operator, count, boolean
    );
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

  orWhereHas(relation, callback = null, operator = '>=', count = 1) {
    return this.has(relation, operator, count, 'or', callback);
  }

  whereRelation(relation, ...args) {
    const column = args.shift();
    return this.whereHas(relation, (query) => {
      if (typeof column === 'function') {
        column(query);
      } else {
        query.where(column, ...args);
      }
    });
  }

  orWhereRelation(relation, ...args) {
    const column = args.shift();
    return this.orWhereHas(relation, function (query) {
      if (typeof column === 'function') {
        column(query);
      } else {
        query.where(column, ...args);
      }
    });
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

  addWhereExistsQuery(query, boolean = 'and', not = false) {
    const type = not ? 'NotExists' : 'Exists';

    const method = boolean === 'and' ? 'where' + type : 'orWhere' + type;

    this[method](query.connector);

    return this;
  }

  addWhereCountQuery(query, operator = '>=', count = 1, boolean = 'and') {
    // this.query.addBinding(query.getBindings(), 'where');
    const db = this.model.getConnection();

    return this.where(
      db.raw('(' + query.toSQL().sql +')'),
      operator,
      typeof count ==='number' ? db.raw(count) : count,
      boolean
    );
  }
  
  withAggregate(relations, column, action = null) {
    if (relations.length === 0) {
      return this;
    }

    relations = flattenDeep([relations]);
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

      eagerLoads = merge(eagerLoads, eagerLoad);
    }

    relations = eagerLoads;
    const db = this.model.getConnection();

    const columns = this.query._statements.filter(item => item.grouping == 'columns').map(item => item.value).flat();

    if (columns.length === 0) {
      this.query.select([this.query._single.table + '.*']);
    }

    const parses = this.parseWithRelations(relations)

    for (let name in parses) {
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

      alias = alias || snakeCase(`${name} ${action} ${column}`.replace('/[^[:alnum:][:space:]_]/u', ''));

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
    } else if (isString(query)) {
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
    return this.withAggregate(flattenDeep(args), '*', 'count');
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
      if (isString(value) || isFinite(parseInt(value))) {
        continue;
      }
      
      const [attribute, attributeSelectConstraint] = this.parseNameAndAttributeSelectionConstraint(key, value);

      preparedRelationships = merge(
        preparedRelationships,
        {
          [`${prefix}${attribute}`]: attributeSelectConstraint
        },
        this.prepareNestedWithRelationships(value, `${prefix}${attribute}`),
      );
      
      unset(relations, key);
    }

    for (const key in relations) {
      const value = relations[key];
      let attribute = key, attributeSelectConstraint = value;

      if (isString(value)) {
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
          ? query.related.getTable() + '.' + column
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

  async firstOrFail(...columns) {
    const data = await this.first(...columns);
    
    if (data === null) {
      throw (new ModelNotFoundError).setModel(this.model.constructor.name);
    }

    return data;
  }

  async findOrFail(ids, columns = '*') {
    const data = await this.find(ids, columns);

    if (isArray(ids)) {
      if (data.count() !== ids.length) {
        throw (new ModelNotFoundError).setModel(this.model.constructor.name, difference(ids, data.modelKeys()));
      }

      return data;
    }

    if (data === null) {
      throw (new ModelNotFoundError).setModel(this.model.constructor.name, ids);
    }

    return data;
  }

  async findOrNew(id, columns = ['*']) {
    const model = await this.find(id, columns)
    if (model !== null) {
      return model;
    }

    return this.newModelInstance();
  }

  async firstOrNew(attributes = {}, values = {}) {
    const instance = await this.where(attributes).first();
    if (instance !== null) {
      return instance;
    }

    return this.newModelInstance(merge(attributes, values));
  }

  async firstOrCreate(attributes = {}, values = {}) {
    const instance = await this.where(attributes).first();
    if (instance !== null) {
      return instance;
    }

    return tap(this.newModelInstance(merge(attributes, values)), async (instance) => {
      await instance.save({
        client: this.query
      });
    });
  }

  async updateOrCreate(attributes, values = {}) {
    return await tap(await this.firstOrNew(attributes), async (instance) => {
      await instance.fill(values).save({
        client: this.query
      });
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

  async find(id, columns = '*') {
    if (isArray(id) || id instanceof Collection) {
      return await this.findMany(id, columns);
    }

    return await this.where(this.model.getKeyName(), id).first(columns);
  }

  async findMany(ids, columns = '*') {
    if (ids instanceof Collection) {
      ids = ids.modelKeys();
    }

    ids = isArray(ids) ? ids : [ids];

    if (ids.length === 0) {
      return new Collection([]);
    }

    return await this.whereIn(this.model.getKeyName(), ids).get(columns);
  }

  async pluck(column) {
    const data = await this.query.pluck(column);
    return new Collection(data);
  }

  async destroy(ids) {
    if (ids instanceof Collection) {
      ids = ids.modelKeys();
    }

    if (ids instanceof BaseCollection) {
      ids = ids.all();
    }

    ids = isArray(ids) ? ids : Array.prototype.slice.call(arguments);

    if (ids.length === 0) {
      return 0;
    }

    const instance = this.model.newInstance();
    const key = instance.getKeyName();

    let count = 0;
    const models = await this.model.newModelQuery().whereIn(key, ids).get();

    for (const model of models) {
      if (await model.delete()) {
        count++;
      }
    }

    return count;
  }

  async get(columns = '*') {
    this.applyScopes();
    let models = await this.getModels(columns);

    if (models.length > 0) {
      models = await this.eagerLoadRelations(models);
    }

    return new Collection(models);
  }

  async all(columns = '*') {
    return await this.model.newModelQuery().get(columns);
  }

  async paginate(page, perPage) {
    page = page || 1;
    perPage = perPage || this?.model?.perPage || 15;
    this.applyScopes();
    const query = this.query.clone();

    const total = await query.clearOrder().clearSelect().count(this.primaryKey);

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

    return new Paginator(results, parseInt(total), perPage, page);
  }

  async getModels(...columns) {
    columns = flatten(columns);
    if (columns.length > 0) {
      if (this.query._statements.filter(item => item.grouping == 'columns').length == 0 && columns[0] !== '*') {
        this.query.select(...columns);
      }
    }
    
    return this.hydrate(
      await this.query.get()
    ).all();
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
    return new Collection(items.map(item => {
      if (!this.model) {
        return item;
      }

      const model = this.model.newFromBuilder(item);

      return model;
    }));
  }
}

module.exports = Builder;
