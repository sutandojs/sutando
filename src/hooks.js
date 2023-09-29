class Hooks {
  hooks = {
    creating: [],
    created: [],
    updating: [],
    updated: [],
    saving: [],
    saved: [],
    deleting: [],
    deleted: [],
    restoring: [],
    restored: [],
    trashed: [],
    forceDeleting: [],
    forceDeleted: [],
  };

  add(hook, callback) {
    if (typeof this.hooks[hook] === 'undefined') {
      this.hooks[hook] = [];
    }

    this.hooks[hook].push(callback);
  }

  async exec(hook, data) {
    if (typeof this.hooks[hook] === 'undefined') {
      return true;
    }

    for (const callback of this.hooks[hook]) {
      await callback(...data);
    }

    return true;
  }
}

module.exports = Hooks;