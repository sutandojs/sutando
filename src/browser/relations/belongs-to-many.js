const Relation = require('./relation');

class BelongsToMany extends Relation {
  table;
  foreignPivotKey;
  relatedPivotKey;
  parentKey;
  relatedKey;
  pivotColumns = [];
  pivotValues = [];
  pivotWheres = [];
  pivotWhereIns = [];
  pivotWhereNulls = [];
  accessor = 'pivot';
  // withTimestamps = false;
  using;
  pivotCreatedAt;
  pivotUpdatedAt;

  constructor(related, parent, table, foreignPivotKey, relatedPivotKey, parentKey, relatedKey) {
    super(related, parent);
    this.table = table;
    this.foreignPivotKey = foreignPivotKey;
    this.relatedPivotKey = relatedPivotKey;
    this.parentKey = parentKey;
    this.relatedKey = relatedKey;

    return this.asProxy()
  }
}

module.exports = BelongsToMany;