const HasTimestamps = (Model) => {
  return class extends Model {
    static CREATED_AT = 'created_at';
    static UPDATED_AT = 'updated_at';
    static DELETED_AT = 'deleted_at';

    timestamps = true;
    dateFormat = 'YYYY-MM-DD HH:mm:ss';

    usesTimestamps() {
      return this.timestamps;
    }

    updateTimestamps() {
      const time = new Date;
      time.setMilliseconds(0);
  
      const updatedAtColumn = this.getUpdatedAtColumn();
  
      if (updatedAtColumn && !this.isDirty(updatedAtColumn)) {
        this.setUpdatedAt(time);
      }
  
      const createdAtColumn = this.getCreatedAtColumn();
  
      if (!this.exists && createdAtColumn && !this.isDirty(createdAtColumn)) {
        this.setCreatedAt(time);
      }
  
      return this;
    }

    getCreatedAtColumn() {
      return this.constructor.CREATED_AT;
    }
  
    getUpdatedAtColumn() {
      return this.constructor.UPDATED_AT;
    }
  
    getDeletedAtColumn() {
      return this.constructor.DELETED_AT;
    }
  
    setCreatedAt(value) {
      this.attributes[this.getCreatedAtColumn()] = value;
      this.changes.push(this.getCreatedAtColumn());
      return this;
    }
  
    setUpdatedAt(value) {
      this.attributes[this.getUpdatedAtColumn()] = value;
      this.changes.push(this.getUpdatedAtColumn());
      return this;
    }
  }
}

module.exports = HasTimestamps;