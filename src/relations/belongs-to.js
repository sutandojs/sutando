const Relation = require('./relation');
let model = null;

const getBaseModel = () => {
  if (!model) {
    model = require('../model');
  }
  return model;
}

class BelongsTo extends Relation {
  foreignKey;
  ownerKey;
  child;
  relationName;

  constructor(query, child, foreignKey, ownerKey, relationName) {
    super(query, child);
    this.foreignKey = foreignKey;
    this.ownerKey = ownerKey;
    this.child = child;
    this.relationName = relationName;

    this.addConstraints();
    return this.asProxy();
  }

  async getResults() {
    if (this.child[this.foreignKey] === null) {
      return null;
    }

    const result = await this.query.first();

    return result || null;
  }

  match(models, results, relation) {
    const foreign = this.foreignKey;
    const owner = this.ownerKey;

    const dictionary = [];
    
    results.map(result => {
      const attribute = result.attributes[owner];
      dictionary[attribute] = result;
    })

    models.map(model => {
      const attribute = model[foreign];
      if (dictionary[attribute] !== undefined) {
        model.relations[relation] = dictionary[attribute];
      }
    })

    return models;
  }

  initRelation(models, relation) {
    models.map(model => {
      model.relations[relation] = null;
    });

    return models;
  }

  addEagerConstraints(models) {
    const key = `${this.related.table}.${this.ownerKey}`;

    // const whereIn = this.whereIn(this.related, this.ownerKey);

    this.query.whereIn(key, this.getEagerModelKeys(models));
  }

  getEagerModelKeys(models) {
    const keys = [];

    models.map(model => {
      const value = model[this.foreignKey];

      if (value !== null && value !== undefined) {
        keys.push(value);
      }
    });

    keys.sort();

    return [...new Set(keys)];
  }

  associate(model) {
    const baseModel = getBaseModel();
    const ownerKey = model instanceof baseModel ? model.attributes[this.ownerKey] : model;

    this.child[this.foreignKey] = ownerKey;

    if (model instanceof baseModel) {
      this.child.setRelation(this.relationName, model);
    } else {
      this.child.unsetRelation(this.relationName);
    }

    return this.child;
  }

  dissociate() {
    this.child[this.foreignKey] = null;
    return this.child.setRelation(this.relationName, null);
  }

  addConstraints() {
    if (this.constructor.constraints) {
      const table = this.related.getTable();
      this.query.where(table + '.' + this.ownerKey, '=', this.child[this.foreignKey]);
    }
  }
}

module.exports = BelongsTo;