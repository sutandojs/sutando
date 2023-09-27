const collect = require('collect.js');
const Collection = require('../collection');
const { tap } = require('../utils');

const HasOneOrMany = (Relation) => {
  return class extends Relation {
    getRelationValue(dictionary, key, type) {
      const value = dictionary[key];
    
      return type === 'one' ? value[0] : new Collection(value);
    }
    
    matchOneOrMany(models, results, relation, type) {
      const dictionary = this.buildDictionary(results);
    
      models.map(model => {
        const key = model.attributes[this.localKey];
        if (dictionary[key] !== undefined) {
          model.setRelation(relation, this.getRelationValue(dictionary, key, type));
        }
      });
    
      return models;
    }
    
    buildDictionary(results) {
      const foreign = this.getForeignKeyName();
    
      return collect(results).mapToDictionary(result => [
        result[foreign], result
      ]).all();
    }
    
    async save(model) {
      this.setForeignAttributesForCreate(model);
    
      return await model.save() ? model : false;
    }
    
    async saveMany(models) {
      await Promise.all(models.map(async model => {
        await this.save(model);
      }));
    
      return models instanceof Collection ? models : new Collection(models);
    }
    
    async create(attributes = {}) {
      return await tap(this.related.constructor.init(attributes), async instance => {
        this.setForeignAttributesForCreate(instance);
    
        await instance.save();
      });
    }
    
    async createMany(records) {
      const instances = await Promise.all(records.map(async record => {
        return await this.create(record);
      }));
    
      return instances instanceof Collection ? instances : new Collection(instances);
    }
    
    setForeignAttributesForCreate(model) {
      model[this.getForeignKeyName()] = this.getParentKey();
    }
    
    getForeignKeyName() {
      const segments = this.getQualifiedForeignKeyName().split('.');
    
      return segments[segments.length - 1];
    }
    
    getParentKey() {
      return this.parent.attributes[this.localKey];
    }
    
    getQualifiedForeignKeyName() {
      return this.foreignKey;
    }
    
    getExistenceCompareKey() {
      return this.getQualifiedForeignKeyName();
    }
    
    addConstraints() {
      if (this.constructor.constraints) {
        const query = this.getRelationQuery();
    
        query.where(this.foreignKey, '=', this.getParentKey());
    
        query.whereNotNull(this.foreignKey);
      }
    }
  }
}

module.exports = HasOneOrMany;
