const Relation = require('./relation');

class BelongsTo extends Relation {
  foreignKey;
  ownerKey;
  child;
  relationName;

  constructor(related, child, foreignKey, ownerKey, relationName) {
    super(related, child);
    this.foreignKey = foreignKey;
    this.ownerKey = ownerKey;
    this.child = child;
    this.relationName = relationName;

    return this.asProxy();
  }
}

module.exports = BelongsTo;