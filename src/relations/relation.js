class Relation {
  query;
  parent;
  related;
  eagerKeysWereEmpty = false;

  static constraints = true

  constructor(query, parent) {
    this.query = query;
    this.parent = parent;
    this.related = this.query.model;
  }

  static extend(trait) {
    for (const methodName in trait) {
      this.prototype[methodName] = trait[methodName];
    }
  }

  static noConstraints(callback) {
    const previous = this.constraints;

    this.constraints = false;

    try {
      return callback();
    } finally {
      this.constraints = previous;
    }
  }

  asProxy() {
    const handler = {
      get: function (target, prop) {
        if (typeof target[prop] !== 'undefined') {
          return target[prop]
        }

        if (typeof prop === 'string') {
          // if ([
          //   'avg', 'max', 'min', 'sum', 'count',
          // ].includes(prop)) {
          //   return (column) => {
          //     const instance = target.asProxy();
          //     instance.applyScopes();
          //     column = !column && prop === 'count' ? '*' : column;
  
          //     return instance.query[prop]({
          //       aggregate: column
          //     }).then(data => data?.[0]?.aggregate);
          //   }
          // }

          if (typeof target.query[prop] === 'function') {
            return (...args) => {
              target.query[prop](...args);
              return target.asProxy();
            }
          }
        }
      },
    }

    return new Proxy(this, handler)
  }

  getRelated() {
    return this.related;
  }

  getKeys(models, key) {
    return models.map(
      model => key ? model.attributes[key] : model.getKey()
    ).sort();
  }

  getRelationQuery() {
    return this.query;
  }

  whereInEager(whereIn, key, modelKeys, query = null) {
    (query || this.query)[whereIn](key, modelKeys);

    if (modelKeys.length === 0) {
      this.eagerKeysWereEmpty = true;
    }
  }

  whereInMethod(model, key) {
    return 'whereIn';
    const segments = key.split('.');
    return model.getKeyName() === segments.pop()
      && ['int', 'integer'].includes(model.getKeyType())
        ? 'whereIntegerInRaw'
        : 'whereIn';
  }

  getEager() {
    return this.eagerKeysWereEmpty
      ? this.query.getModel().newCollection()
      : this.get();
  }

  async get(columns = '*') {
    return await this.query.get(columns);
  }

  async first(columns = '*') {
    return await this.query.first(columns);
  }

  async paginate(...args) {
    return await this.query.paginate(...args);
  }

  async count(...args) {
    return await this.query.clearSelect().count(...args);
  }

  toSql() {
    return this.query.toSql();
  }

  addConstraints() {}

  getRelationCountHash(incrementJoinCount = true) {
    return 'sutando_reserved_' + (incrementJoinCount ? this.constructor.selfJoinCount++ : this.constructor.selfJoinCount);
  }

  getRelationExistenceQuery(query, parentQuery, columns = ['*']) {
    return query.select(columns).whereColumn(
      this.getQualifiedParentKeyName(), '=', this.getExistenceCompareKey()
    );
  }

  getRelationExistenceCountQuery(query, parentQuery) {
    const db = this.related.getConnection();
    return this.getRelationExistenceQuery(
      query, parentQuery, db.raw('count(*)')
    );
  }

  getQualifiedParentKeyName() {
    return this.parent.getQualifiedKeyName();
  }
}

module.exports = Relation;