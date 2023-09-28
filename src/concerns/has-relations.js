const _ = require('lodash');
const {
  now,
  getRelationName,
  getScopeName,
  getRelationMethod,
  getScopeMethod,
  getAttrMethod,
  getGetterMethod,
  getSetterMethod,
  getAttrName,
  tap,
} = require('../utils');

const { RelationNotFoundError } = require('../errors');

const HasRelations = (Model) => {
  return class extends Model {
    relations = {};

    setRelation(relation, value) {
      this.relations[relation] = value;
      return this;
    }
  
    unsetRelation(relation) {
      _.unset(this.relations, relation);
      return this;
    }
  
    relationLoaded(relation) {
      return this.relations[relation] !== undefined;
    }
    
    relationsToData() {
      const data = {};
      for (const key in this.relations) {
        if (this.hidden.includes(key)) {
          continue;
        }
  
        if (this.visible.length > 0 && this.visible.includes(key) === false) {
          continue;
        }
  
        data[key] = this.relations[key] instanceof Array
          ? this.relations[key].map(item => item.toData())
          : this.relations[key] === null
            ? null
            : this.relations[key].toData();
      }
  
      return data;
    }

    related(relation) {
      if (typeof this[getRelationMethod(relation)] !== 'function') {
        const message = `Model [${this.constructor.name}]'s relation [${relation}] doesn't exist.`;
        throw new RelationNotFoundError(message);
      }
      
      return this[getRelationMethod(relation)]();
    }
  
    async getRelated(relation) {
      return await this.related(relation).getResults();
    }
  
    guessBelongsToRelation() {
      let e = new Error();
      let frame = e.stack.split("\n")[2];
      // let lineNumber = frame.split(":").reverse()[1];
      let functionName = frame.split(" ")[5];
      return getRelationName(functionName);
    }
  
    hasOne(model, foreignKey = null, localKey = null) {
      const query = model.query();
      const instance = new model;
      foreignKey = foreignKey || this.constructor.name.toLowerCase() + '_id';
      localKey = localKey || this.getKeyName();
  
      return (new HasOne(query, this, instance.getTable() + '.' + foreignKey, localKey));
    }
  
    hasMany(model, foreignKey = null, localKey = null) {
      const query = model.query();
      const instance = new model;
      foreignKey = foreignKey || this.constructor.name.toLowerCase() + '_id';
      localKey = localKey || this.getKeyName();
  
      return (new HasMany(query, this, instance.getTable() + '.' + foreignKey, localKey));
    }
  
    belongsTo(model, foreignKey = null, ownerKey = null, relation = null) {
      const query = model.query();
      const instance = new model;
      foreignKey = foreignKey || instance.constructor.name.toLowerCase() + '_id';
      ownerKey = ownerKey ||  instance.getKeyName();
  
      relation = relation || this.guessBelongsToRelation();
  
      return (new BelongsTo(query, this, foreignKey, ownerKey, relation));
    }
  
    belongsToMany(model, table = null, foreignPivotKey = null, relatedPivotKey = null, parentKey = null, relatedKey = null) {
      const query = model.query();
      const instance = new model;
      table = table || [this.constructor.name, instance.constructor.name].sort().join('_').toLocaleLowerCase();
      foreignPivotKey = foreignPivotKey || this.constructor.name.toLowerCase() + '_id';
      relatedPivotKey = relatedPivotKey || instance.constructor.name.toLowerCase() + '_id';
      parentKey = parentKey || this.getKeyName();
      relatedKey = relatedKey || instance.getKeyName();
  
      return (new BelongsToMany(
        query,
        this,
        table,
        foreignPivotKey,
        relatedPivotKey,
        parentKey,
        relatedKey
      ));
    }
  }
}

module.exports = HasRelations;

const HasOne = require('../relations/has-one');
const HasMany = require('../relations/has-many');
const BelongsTo = require('../relations/belongs-to');
const BelongsToMany = require('../relations/belongs-to-many');
const HasOneThrough = require('../relations/has-one-through');
const HasManyThrough = require('../relations/has-many-through');
