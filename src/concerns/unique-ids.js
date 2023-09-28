const UniqueIds = (Model) => {
  return class extends Model {
    useUniqueIds = false;
    usesUniqueIds() {
      return this.useUniqueIds;
    }

    uniqueIds() {
      return [];
    }

    newUniqueId() {
      return null;
    }

    setUniqueIds() {
      const uniqueIds = this.uniqueIds()
      for (const column of uniqueIds) {
        if (this[column] === null || this[column] === undefined) {
          this[column] = this.newUniqueId();
        }
      }
    }
  }
}

module.exports = UniqueIds;