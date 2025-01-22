class Relation {
  parent;
  related;
  eagerKeysWereEmpty = false;

  static constraints = true

  constructor(related, parent) {
    this.parent = parent;
    this.related = related;
  }

  asProxy() {
    const handler = {
      get: function (target, prop) {
        if (typeof target[prop] !== 'undefined') {
          return target[prop]
        }

        if (typeof prop === 'string') {
          return () => target.asProxy();
        }
      },
    }

    return new Proxy(this, handler)
  }

  getRelated() {
    return this.related;
  }
}

module.exports = Relation;