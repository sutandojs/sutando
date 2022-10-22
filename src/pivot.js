const Model = require('./model');

class Pivot extends Model {
  incrementing = false;
  guarded = [];
  pivotParent;
  foreignKey;
  relatedKey;

  setPivotKeys(foreignKey, relatedKey) {
    this.foreignKey = foreignKey;
    this.relatedKey = relatedKey;

    return this;
  }

  static fromRawAttributes(parent, attributes, table, exists = false){
    const instance = this.fromAttributes(parent, {}, table, exists);
    instance.timestamps = instance.hasTimestampAttributes(attributes);

    instance.attributes = attributes;
    instance.exists = exists;

    return instance;
  }

  static fromAttributes(parent, attributes, table, exists = false) {
    const instance = new this;

    instance.timestamps = instance.hasTimestampAttributes(attributes);
    instance.table = table;
    instance.attributes = attributes;
    instance.pivotParent = parent;
    instance.exists = exists;

    return instance;
  }

  hasTimestampAttributes(attributes = null) {
    return (attributes || this.attributes)[this.constructor.CREATED_AT] !== undefined;
  }
}

module.exports = Pivot;