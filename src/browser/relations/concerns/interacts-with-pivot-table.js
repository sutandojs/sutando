const { collect } = require('collect.js');
const merge = require('lodash/merge');
const concat = require('lodash/concat');
const isArray = require('lodash/isArray');
const Collection = require('../../collection');

let model = null;
const getBaseModel = () => {
  if (!model) {
    model = require('../../model');
  }
  return model;
}

let pivot = null;

const InteractsWithPivotTable = (Relation) => {
  return class extends Relation {
    newExistingPivot(attributes = []) {
      return this.newPivot(attributes, true);
    }
    
    newPivot(attributes = [], exists = false) {
      const pivot = this.related.newPivot(
        this.parent, attributes, this.getTable(), exists, this.using
      );
    
      return pivot.setPivotKeys(this.foreignPivotKey, this.relatedPivotKey);
    }
    
    syncWithoutDetaching(ids) {
      return this.sync(ids, false);
    }
    
    syncWithPivotValues(ids, values, detaching = true) {
      return this.sync(collect(this.parseIds(ids)).mapWithKeys(id => {
        return [id, values];
      }), detaching);
    }
    
    withPivot(columns) {
      this.pivotColumns = concat(
        this.pivotColumns, isArray(columns) ? columns : Array.prototype.slice.call(arguments)
      );
    
      return this;
    }
    
    addTimestampsToAttachment(record, exists = false) {
      let fresh = this.parent.freshTimestamp();
    
      if (this.using) {
        const pivotModel = new this.using;
    
        fresh = pivotModel.fromDateTime(fresh);
      }
    
      if (! exists && this.hasPivotColumn(this.createdAt())) {
        record[this.createdAt()] = fresh;
      }
    
      if (this.hasPivotColumn(this.updatedAt())) {
        record[this.updatedAt()] = fresh;
      }
    
      return record;
    }
    
    formatRecordsList(records) {
      return collect(records).mapWithKeys((attributes, id) => {
        if (! isArray(attributes)) {
          [id, attributes] = [attributes, {}];
        }
    
        return [id, attributes];
      }).all();
    }
    
    castKeys(keys) {
      return keys.map(v => {
        return this.castKey(v);
      });
    }
    
    castKey(key) {
      return this.getTypeSwapValue(
        this.related.getKeyType(),
        key
      );
    }
    
    getTypeSwapValue(type, value) {
      switch (type.toLowerCase()) {
        case 'int':
        case 'integer':
          return parseInt(value);
        case 'real':
        case 'float':
        case 'double':
          return parseFloat(value);
        case 'string':
          return String(value);
        default:
          return value;
      }
    }
    
    formatAttachRecords(ids, attributes) {
      const records = [];
      const hasTimestamps = (this.hasPivotColumn(this.createdAt()) || this.hasPivotColumn(this.updatedAt()));
    
      for (const key in ids) {
        const value = ids[key];
        records.push(this.formatAttachRecord(
          key, value, attributes, hasTimestamps
        ));
      }
    
      return records;
    }
    
    formatAttachRecord(key, value, attributes, hasTimestamps) {
      const [id, newAttributes] = this.extractAttachIdAndAttributes(key, value, attributes);
    
      return merge(
        this.baseAttachRecord(id, hasTimestamps), newAttributes
      );
    }
    
    baseAttachRecord(id, timed) {
      let record = {};
      record[this.relatedPivotKey] = id;
    
      record[this.foreignPivotKey] = this.parent[this.parentKey];
    
      if (timed) {
        record = this.addTimestampsToAttachment(record);
      }
    
      this.pivotValues.map(value => {
        record[value.column] = value.value;
      })
    
      return record;
    }
    
    extractAttachIdAndAttributes(key, value, newAttributes) {
      return isArray(value)
        ? [key, {...value, ...newAttributes}]
        : [value, newAttributes];
    }
    
    hasPivotColumn = function(column) {
      return this.pivotColumns.includes(column);
    }
    
    parseIds(value) {
      const baseModel = getBaseModel();
    
      if (value instanceof baseModel) {
        return [value[this.relatedKey]];
      }
    
      if (value instanceof Collection) {
        return value.pluck(this.relatedKey).all();
      }
    
      return isArray(value) ? value : [value];
    }
  };
}

module.exports = InteractsWithPivotTable;