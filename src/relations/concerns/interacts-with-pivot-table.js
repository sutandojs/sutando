const { collect } = require('collect.js');
const difference = require('lodash/difference');
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

const getPivotModel = () => {
  if (!pivot) {
    pivot = require('../../pivot');
  }
  return pivot;
}

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
    
    async attach(id, attributes = {}, touch = true) {
      if (this.using) {
        await this.attachUsingCustomClass(id, attributes);
      } else {
        await this.newPivotStatement().insert(this.formatAttachRecords(
          this.parseIds(id), attributes
        ));
      }
    
      // if (touch) {
      //   this.touchIfTouching();
      // }
    }
    
    async detach(ids = null, touch = true) {
      let results;
    
      if (this.using &&
        ids !== null &&
        this.pivotWheres.length == 0 &&
        this.pivotWhereIns.length == 0 &&
        this.pivotWhereNulls.length == 0) {
        results = await this.detachUsingCustomClass(ids);
      } else {
        const query = this.newPivotQuery();
    
        if (ids !== null) {
          ids = this.parseIds(ids);
    
          if (ids.length == 0) {
            return 0;
          }
    
          query.whereIn(this.getQualifiedRelatedPivotKeyName(), ids);
        }
    
        results = await query.delete();
      }
    
      // if (touch) {
      //   this.touchIfTouching();
      // }
    
      return results;
    }
    
    async sync(ids, detaching = true) {
      let changes = {
        attached: [],
        detached: [],
        updated: [],
      };
      let records;
    
      const results = await this.getCurrentlyAttachedPivots();
      const current = results.length === 0 ? [] : results.map(result => result.toData()).pluck(this.relatedPivotKey).all().map(i => String(i));
    
      const detach = difference(current, Object.keys(
        records = this.formatRecordsList(this.parseIds(ids))
      ));
    
      if (detaching && detach.length > 0) {
        await this.detach(detach);
    
        changes.detached = this.castKeys(detach);
      }
    
      changes = merge(
        changes, await this.attachNew(records, current, false)
      );
    
      return changes;
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
    
    async attachNew(records, current, touch = true) {
      const changes = {
        attached: [],
        updated: []
      };
    
      for (const id in records) {
        const attributes = records[id];
        
        if (!current.includes(id)) {
          await this.attach(id, attributes, touch);
    
          changes.attached.push(this.castKey(id));
        } else if (Object.keys(attributes).length > 0 && await this.updateExistingPivot(id, attributes, touch)) {
          changes.updated.push(this.castKey(id));
        }
      }
    
      return changes;
    }
    
    async updateExistingPivot(id, attributes, touch = true) {
      if (this.using &&
        this.pivotWheres.length > 0 &&
        this.pivotWhereInspivotWheres.length > 0 &&
        this.pivotWhereNullspivotWheres.length > 0) {
        return await this.updateExistingPivotUsingCustomClass(id, attributes, touch);
      }
    
      if (this.hasPivotColumn(this.updatedAt())) {
        attributes = this.addTimestampsToAttachment(attributes, true);
      }
    
      const updated = this.newPivotStatementForId(this.parseId(id)).update(
        this.castAttributes(attributes)
      );
    
      // if (touch) {
      //   this.touchIfTouching();
      // }
    
      return updated;
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
    
    async updateExistingPivotUsingCustomClass(id, attributes, touch) {
      const pivot = await this.getCurrentlyAttachedPivots()
        .where(this.foreignPivotKey, this.parent[this.parentKey])
        .where(this.relatedPivotKey, this.parseId(id))
        .first();
    
      const updated = pivot ? pivot.fill(attributes).isDirty() : false;
    
      if (updated) {
        await pivot.save();
      }
    
      // if (touch) {
      //   this.touchIfTouching();
      // }
    
      return parseInt(updated);
    }
    
    formatRecordsList(records) {
      return collect(records).mapWithKeys((attributes, id) => {
        if (! isArray(attributes)) {
          [id, attributes] = [attributes, {}];
        }
    
        return [id, attributes];
      }).all();
    }
    
    async getCurrentlyAttachedPivots() {
      const query = this.newPivotQuery();
      const results = await query.get();
      const Pivot = getPivotModel();
      return results.map(record => {
        const modelClass = this.using || Pivot;
    
        const pivot = modelClass.fromRawAttributes(this.parent, record, this.getTable(), true);
    
        return pivot.setPivotKeys(this.foreignPivotKey, this.relatedPivotKey);
      });
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
    
    newPivotQuery() {
      const query = this.newPivotStatement();
    
      this.pivotWheres.map(args => {
        query.where(...args);
      });
    
      this.pivotWhereIns.map(args => {
        query.whereIn(...args);
      });
    
      this.pivotWhereNulls.map(args => {
        query.whereNull(...args);
      });
    
      return query.where(this.getQualifiedForeignPivotKeyName(), this.parent[this.parentKey]);
    }
    
    async detachUsingCustomClass(ids) {
      let results = 0;
    
      for (const id in this.parseIds(ids)) {
        results += await this.newPivot({
          [this.foreignPivotKey]: this.parent[this.parentKey],
          [this.relatedPivotKey]: id,
        }, true).delete();
      };
    
      return results;
    }
    
    newPivotStatement() {
      const builder = this.parent.newQuery();
      builder.setTable(this.table);
    
      return builder;
    }
    
    async attachUsingCustomClass(id, attributes) {
      const records = this.formatAttachRecords(
        this.parseIds(id), attributes
      );
    
      await Promise.all(records.map(async record => {
        await this.newPivot(record, false).save();
      }));
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