const HasUniqueIds = (Model) => {
  return class extends Model {
    useUniqueIds = true;

    uniqueIds() {
      return [this.getKeyName()];
    }

    getKeyType() {
      if (this.uniqueIds().includes(this.getKeyName())) {
        return 'string';
      }

      return this.keyType;
    }

    getIncrementing() {
      if (this.uniqueIds().includes(this.getKeyName())) {
        return false;
      }

      return this.incrementing;
    }
  }
}

module.exports = HasUniqueIds;