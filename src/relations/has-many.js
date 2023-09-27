const Relation = require('./relation');
const { collect } = require('collect.js');
const Collection = require('../collection');
const HasOneOrMany = require('./has-one-or-many');
const { compose } = require('../utils');

class HasMany extends compose(
  Relation,
  HasOneOrMany
) {
  foreignKey;
  localKey;

  constructor(query, parent, foreignKey, localKey) {
    super(query, parent);
    this.foreignKey = foreignKey;
    this.localKey = localKey;

    this.addConstraints();
    return this.asProxy();
  }

  initRelation(models, relation) {
    models.map(model => {
      model.setRelation(relation, new Collection([]));
    })

    return models;
  }

  async getResults() {
    return this.getParentKey() !== null
      ? await this.query.get()
      : new Collection([]);
  }

  getForeignKeyName() {
    const segments = this.foreignKey.split('.');

    return segments.pop();
  }

  buildDictionary(results) {
    const foreign = this.getForeignKeyName();

    return collect(results).mapToDictionary(result => [
      result[foreign], result
    ]).all();
  }

  match(models, results, relation) {
    return this.matchOneOrMany(models, results, relation, 'many');
  }

  addEagerConstraints(models) {
    this.query.whereIn(
      this.foreignKey, this.getKeys(models, this.localKey)
    );
  }
}

module.exports = HasMany;