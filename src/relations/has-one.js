const Relation = require('./relation');
const { collect } = require('collect.js');
const HasOneOrMany = require('./has-one-or-many');

class HasOne extends Relation {
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
      model.relations[relation] = null;
    })

    return models;
  }

  matchOne(models, results, relation) {
    return this.matchOneOrMany(models, results, relation, 'one');
  }

  getForeignKeyName() {
    const segments = this.foreignKey.split('.');
    return segments.pop();
  }

  async getResults() {
    if (this.getParentKey() === null) {
      return null;
    }

    const results = await this.query.first();

    return results || null;
  }

  match(models, results, relation) {
    return this.matchOneOrMany(models, results, relation, 'one');
  }

  addEagerConstraints(models) {
    this.query.whereIn(
      this.foreignKey, this.getKeys(models, this.localKey)
    );
  }
}

HasOne.extends(HasOneOrMany);

module.exports = HasOne;