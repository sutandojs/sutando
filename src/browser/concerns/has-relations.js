const unset = require('lodash/unset');
const snakeCase = require('lodash/snakeCase');
const { getRelationName, getRelationMethod } = require('../../utils');

const { RelationNotFoundError } = require('../../errors');

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
      const e = new Error();
      const stack = e.stack || e.stackTrace;
      
      if (!stack) {
        return getRelationName('unknown');
      }

      const frames = stack.split('\n');
      const frame = frames[2] || frames[1] || frames[0];
      
      let functionName = 'anonymous';
      
      if (frame.includes('@')) {
        // Safari: functionName@file:line:column
        functionName = frame.split('@')[0].trim();
      } else if (frame.includes('at ')) {
        // Chrome: at functionName (file:line:column)
        const match = frame.match(/at\s+([^(]+)\s*\(/);
        functionName = match ? match[1].trim() : 'anonymous';
        
        if (functionName.includes('.')) {
          functionName = functionName.split('.').pop();
        }
      }
      
      functionName = functionName.replace(/^</, '').replace(/>$/, '').trim();
      
      return getRelationName(functionName || 'anonymous');
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
      const instance = new related;
      foreignKey = foreignKey || this.getForeignKey();
      localKey = localKey || this.getKeyName();
  
      return (new HasOne(related, this, instance.getTable() + '.' + foreignKey, localKey));
    }
  
    hasMany(related, foreignKey = null, localKey = null) {
      const instance = new related;
      foreignKey = foreignKey || this.getForeignKey();
      localKey = localKey || this.getKeyName();
  
      return (new HasMany(related, this, instance.getTable() + '.' + foreignKey, localKey));
    }
  
    belongsTo(related, foreignKey = null, ownerKey = null, relation = null) {
      const instance = new related;
      foreignKey = foreignKey || instance.getForeignKey();
      ownerKey = ownerKey ||  instance.getKeyName();
  
      relation = relation || this.guessBelongsToRelation();
  
      return (new BelongsTo(related, this, foreignKey, ownerKey, relation));
    }
  
    belongsToMany(related, table = null, foreignPivotKey = null, relatedPivotKey = null, parentKey = null, relatedKey = null) {
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
