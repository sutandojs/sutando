const { compose } = require('../utils');
const SupportsDefaultModels = require('./concerns/supports-default-models');
const HasManyThrough = require('./has-many-through');
const _ = require('lodash');

class HasOneThrough extends compose(
  HasManyThrough,
  SupportsDefaultModels
) {
  async getResults() {
    return (await this.first()) || this.getDefaultFor(this.farParent);
  }
  
  initRelation(models, relation) {
    for (const model of models) {
      model.setRelation(relation, this.getDefaultFor(model));
    }

    return models;
  }
  
  match(models, results, relation) {
    const dictionary = this.buildDictionary(results);

    for (const model of models) {
      const key = this.getDictionaryKey(model.getAttribute(this.localKey));
      if (dictionary[key] !== undefined) {
        const value = dictionary[key];
        model.setRelation(
          relation, value[0]
        );
      }
    }

    return models;
  }
  
  newRelatedInstanceFor(parent) {
    return this.related.newInstance();
  }
}

module.exports = HasOneThrough;
