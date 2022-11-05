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
  };

  add(hook, callback) {
    if (Object.keys(this.hooks).includes(hook) === false) {
      throw new Error(`Unsupported hook [${hook}].`);
    }

    this.hooks[hook].push(callback);
  }

  async exec(hook, data) {
    for (const callback of this.hooks[hook]) {
      await callback(...data);
    }

    return true;
  }
}

module.exports = Hooks;