class Relation {
  query;
  parent;
  related;

  static constraints = true

  constructor(query, parent) {
    this.query = query;
    this.parent = parent;
    this.related = this.query.model;
  }

  static extends(trait) {
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

  get(columns = '*') {
    return this.query.get(columns);
  }

  first(columns = '*') {
    return this.query.first(columns);
  }

  paginate(...args) {
    return this.query.paginate(...args);
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