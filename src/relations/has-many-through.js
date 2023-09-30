const isArray = require('lodash/isArray');
const { ModelNotFoundError } = require("../errors");
const Relation = require("./relation");
const { tap } = require('../utils');

class HasManyThrough extends Relation {
  throughParent;
  farParent;
  firstKey;
  secondKey;
  localKey;
  secondLocalKey;

  constructor(query, farParent, throughParent, firstKey, secondKey, localKey, secondLocalKey) {
    super(query, throughParent);

    this.localKey = localKey;
    this.firstKey = firstKey;
    this.secondKey = secondKey;
    this.farParent = farParent;
    this.throughParent = throughParent;
    this.secondLocalKey = secondLocalKey;

    return this.asProxy();
  }

  addConstraints() {
    const localValue = this.farParent[this.localKey];

    this.performJoin();

    if (this.constructor.constraints) {
      this.query.where(this.getQualifiedFirstKeyName(), '=', localValue);
    }
  }
  
  performJoin(query = null) {
    query = query || this.query;

    const farKey = this.getQualifiedFarKeyName();

    query.join(this.throughParent.getTable(), this.getQualifiedParentKeyName(), '=', farKey);

    if (this.throughParentSoftDeletes()) {
      query.withGlobalScope('SoftDeletableHasManyThrough', (query) => {
        query.whereNull(this.throughParent.getQualifiedDeletedAtColumn());
      });
    }
  }
  
  getQualifiedParentKeyName() {
    return this.parent.qualifyColumn(this.secondLocalKey);
  }
  
  throughParentSoftDeletes() {
    return this.throughParent.pluginInitializers['SoftDeletes'] !== undefined;
  }
  
  withTrashedParents() {
    this.query.withoutGlobalScope('SoftDeletableHasManyThrough');
    return this;
  }
  
  addEagerConstraints(models) {
    const whereIn = this.whereInMethod(this.farParent, this.localKey);

    this.whereInEager(
      whereIn,
      this.getQualifiedFirstKeyName(),
      this.getKeys(models, this.localKey)
    );
  }
  
  initRelation(models, relation) {
    for (const model of models) {
      model.setRelation(relation, this.related.newCollection());
    }

    return models;
  }
  
  match(models, results, relation) {
    const dictionary = this.buildDictionary(results);
    
    for (const model of models) {
      if (dictionary[key = this.getDictionaryKey(model.getAttribute(this.localKey))] !== undefined) {
        model.setRelation(
          relation, this.related.newCollection(dictionary[key])
        );
      }
    }

    return models;
  }
  
  buildDictionary(results) {
    const dictionary = {};

    for (const result of results) {
      if (dictionary[result.laravel_through_key] === undefined) {
        dictionary[result.laravel_through_key] = [];
      }
      dictionary[result.laravel_through_key].push(result);
    }

    return dictionary;
  }
  
  async firstOrNew(attributes) {
    let instance = await this.where(attributes).first();

    return instance || this.related.newInstance(attributes);
  }
  
  async updateOrCreate(attributes, values = {}) {
    return tap(await this.firstOrCreate(attributes, values), async (instance) => {
      if (! instance.wasRecentlyCreated) {
        await instance.fill(values).save();
      }
    });
  }
  
  async firstWhere(column, operator = null, value = null, boolean = 'and') {
    return await this.where(column, operator, value, boolean).first();
  }
  
  async first(columns = ['*']) {
    const results = await this.take(1).get(columns);

    return results.count() > 0 ? results.first() : null;
  }
  
  async firstOrFail(columns = ['*']) {
    const model = await this.first(columns);
    if (model) {
      return model;
    }

    throw (new ModelNotFoundError).setModel(this.related.constructor);
  }
  
  async firstOr(columns = ['*'], callback = null) {
    if (typeof columns === 'function') {
      callback = columns;
      columns = ['*'];
    }

    const model = await this.first(columns)

    if (model) {
      return model;
    }

    return callback();
  }
  
  async find(id, columns = ['*']) {
    if (isArray(id)) {
      return await this.findMany(id, columns);
    }

    return await this.where(
      this.getRelated().getQualifiedKeyName(), '=', id
    ).first(columns);
  }
  
  async findMany(ids, columns = ['*']) {
    if (ids.length === 0) {
      return this.getRelated().newCollection();
    }

    return await this.whereIn(
      this.getRelated().getQualifiedKeyName(), ids
    ).get(columns);
  }
  
  async findOrFail(id, columns = ['*']) {
    const result = await this.find(id, columns);

    if (isArray(id)) {
      if (result.count() === id.length) {
        return result;
      }
    } else if (result) {
      return result;
    }

    throw (new ModelNotFoundError).setModel(this.related.constructor, id);
  }
  
  async getResults() {
    return this.farParent[this.localKey]
      ? await this.get()
      : this.related.newCollection();
  }
  
  async get(columns = ['*']) {
    const builder = this.prepareQueryBuilder(columns);

    let models = await builder.getModels();

    if (models.count() > 0) {
      models = await builder.eagerLoadRelations(models);
    }

    return this.related.newCollection(models);
  }
  
  async paginate(perPage = null, columns = ['*'], pageName = 'page', page = null) {
    this.query.addSelect(this.shouldSelect(columns));

    return await this.query.paginate(perPage, columns, pageName, page);
  }
  
  shouldSelect(columns = ['*']) {
    if (columns == ['*']) {
      columns = [this.related.getTable() + '.*'];
    }

    return [...columns, this.getQualifiedFirstKeyName() + ' as laravel_through_key'];
  }
  
  async chunk(count, callback) {
    return await this.prepareQueryBuilder().chunk(count, callback);
  }
  
  prepareQueryBuilder(columns = ['*']) {
    const builder = this.query.applyScopes();

    return builder.addSelect(
      this.shouldSelect(builder.getQuery().columns ? [] : columns)
    );
  }
  
  getRelationExistenceQuery(query, parentQuery, columns = ['*']) {
    if (parentQuery.getQuery().from === query.getQuery().from) {
      return this.getRelationExistenceQueryForSelfRelation(query, parentQuery, columns);
    }

    if (parentQuery.getQuery().from === this.throughParent.getTable()) {
      return this.getRelationExistenceQueryForThroughSelfRelation(query, parentQuery, columns);
    }

    this.performJoin(query);

    return query.select(columns).where(
      this.getQualifiedLocalKeyName(), '=', this.getQualifiedFirstKeyName()
    );
  }
  
  getRelationExistenceQueryForSelfRelation(query, parentQuery, columns = ['*']) {
    const hash = this.getRelationCountHash();
    query.from(query.getModel().getTable() + ' as ' + hash);

    query.join(this.throughParent.getTable(), this.getQualifiedParentKeyName(), '=', hash + '.' + this.secondKey);

    if (this.throughParentSoftDeletes()) {
      query.whereNull(this.throughParent.getQualifiedDeletedAtColumn());
    }

    query.getModel().setTable(hash);

    return query.select(columns).whereColumn(
        parentQuery.getQuery().from + '.' + this.localKey, '=', this.getQualifiedFirstKeyName()
    );
  }
  
  getRelationExistenceQueryForThroughSelfRelation(query, parentQuery, columns = ['*']) {
    const hash = this.getRelationCountHash();
    const table = this.throughParent.getTable() + ' as ' + hash;

    query.join(table, hash + '.' + this.secondLocalKey, '=', this.getQualifiedFarKeyName());

    if (this.throughParentSoftDeletes()) {
      query.whereNull(hash + '.' + this.throughParent.getDeletedAtColumn());
    }

    return query.select(columns).where(
      parentQuery.getQuery().from + '.' + this.localKey, '=', hash + '.' + this.firstKey
    );
  }
  
  getQualifiedFarKeyName() {
    return this.getQualifiedForeignKeyName();
  }
  
  getFirstKeyName() {
    return this.firstKey;
  }
  
  getQualifiedFirstKeyName() {
    return this.throughParent.qualifyColumn(this.firstKey);
  }
  
  getForeignKeyName() {
    return this.secondKey;
  }
  
  getQualifiedForeignKeyName() {
    return this.related.qualifyColumn(this.secondKey);
  }
  
  getLocalKeyName() {
    return this.localKey;
  }
  
  getQualifiedLocalKeyName() {
    return this.farParent.qualifyColumn(this.localKey);
  }

  getSecondLocalKeyName() {
    return this.secondLocalKey;
  }
}

module.exports = HasManyThrough;
