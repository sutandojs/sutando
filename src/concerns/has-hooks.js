const Hooks = require('../hooks');

const HasHooks = (Model) => {
  return class extends Model {
    static hooks = null;

    static addHook(hook, callback) {
      if (this.hooks instanceof Hooks === false) {
        this.hooks = new Hooks;
      }

      this.hooks.add(hook, callback);
    }

    static creating(callback) {
      this.addHook('creating', callback);
    }

    static created(callback) {
      this.addHook('created', callback);
    }

    static updating(callback) {
      this.addHook('updating', callback);
    }

    static updated(callback) {
      this.addHook('updated', callback);
    }

    static saving(callback) {
      this.addHook('saving', callback);
    }

    static saved(callback) {
      this.addHook('saved', callback);
    }

    static deleting(callback) {
      this.addHook('deleting', callback);
    }

    static deleted(callback) {
      this.addHook('deleted', callback);
    }

    static restoring(callback) {
      this.addHook('restoring', callback);
    }

    static restored(callback) {
      this.addHook('restored', callback);
    }

    static trashed(callback) {
      this.addHook('trashed', callback);
    }

    static forceDeleted(callback) {
      this.addHook('forceDeleted', callback);
    }

    async execHooks(hook, options) {
      if (this.constructor.hooks instanceof Hooks === false) {
        return;
      }

      return await this.constructor.hooks.exec(hook, [this, options]);
    }
  };
}

module.exports = HasHooks;
