const unset = require('lodash/unset');
const snakeCase = require('lodash/snakeCase');
const { getRelationName, getRelationMethod } = require('../utils');

const { RelationNotFoundError } = require('../errors');

const HasRelations = (Model) => {
  return class extends Model {
    relations = {};

    getRelation(relation) {
      return this.relations[relation];
    }

    setRelation(relation, value) {
      this.relations[relation] = value;
      return this;
    }
  
    unsetRelation(relation) {
      unset(this.relations, relation);
      return this;
    }
  
    relationLoaded(relation) {
      return this.relations[relation] !== undefined;
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
  
    guessBelongsToRelation() {
      let e = new Error();
      let frame = e.stack.split("\n")[2];
      // let lineNumber = frame.split(":").reverse()[1];
      let functionName = frame.split(" ")[5];
      return getRelationName(functionName);
    }

    joiningTable(related, instance = null) {
      const segments = [
        instance ? instance.joiningTableSegment() : snakeCase(related.name),
        this.joiningTableSegment(),
      ];

      return segments.sort().join('_').toLocaleLowerCase();
    }

    joiningTableSegment() {
      return snakeCase(this.constructor.name);
    }
  
    hasOne(related, foreignKey = null, localKey = null) {
      const query = related.query();
      const instance = new related;
      foreignKey = foreignKey || this.getForeignKey();
      localKey = localKey || this.getKeyName();
  
      return (new HasOne(query, this, instance.getTable() + '.' + foreignKey, localKey));
    }
  
    hasMany(related, foreignKey = null, localKey = null) {
      const query = related.query();
      const instance = new related;
      foreignKey = foreignKey || this.getForeignKey();
      localKey = localKey || this.getKeyName();
  
      return (new HasMany(query, this, instance.getTable() + '.' + foreignKey, localKey));
    }
  
    belongsTo(related, foreignKey = null, ownerKey = null, relation = null) {
      const query = related.query();
      const instance = new related;
      foreignKey = foreignKey || instance.getForeignKey();
      ownerKey = ownerKey ||  instance.getKeyName();
  
      relation = relation || this.guessBelongsToRelation();
  
      return (new BelongsTo(query, this, foreignKey, ownerKey, relation));
    }
  
    belongsToMany(related, table = null, foreignPivotKey = null, relatedPivotKey = null, parentKey = null, relatedKey = null) {
      const query = related.query();
      const instance = new related;
      table = table || this.joiningTable(related, instance);
      foreignPivotKey = foreignPivotKey || this.getForeignKey();
      relatedPivotKey = relatedPivotKey || instance.getForeignKey();
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

    hasOneThrough(related, through, firstKey = null, secondKey = null, localKey = null, secondLocalKey = null) {
      through = new through;
      const query = related.query();
  
      firstKey = firstKey || this.getForeignKey();
      secondKey = secondKey || through.getForeignKey();
  
      return (new HasOneThrough(
        query, this, through,
        firstKey, secondKey, localKey || this.getKeyName(),
        secondLocalKey || through.getKeyName()
      ));
    }

    hasManyThrough(related, through, firstKey = null, secondKey = null, localKey = null, secondLocalKey = null) {
      through = new through;
      const query = related.query();

      firstKey = firstKey || this.getForeignKey();
      secondKey = secondKey || through.getForeignKey();

      return (new HasManyThrough(
        query,
        this,
        through,
        firstKey,
        secondKey,
        localKey || this.getKeyName(),
        secondLocalKey || through.getKeyName()
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
