class Attribute {
  get;
  set;
  withCaching = false;
  withObjectCaching = true;

  constructor({ get = null, set = null}) {
    this.get = get;
    this.set = set;
  }

  static make(get = null, set = null) {
    return new Attribute(get, set);
  }

  static get(get) {
    return new Attribute(get);
  }

  static set(set) {
    return new Attribute(null, set);
  }

  withoutObjectCaching() {
    this.withObjectCaching = false;

    return this;
  }

  shouldCache() {
    this.withCaching = true;

    return this;
  }
}

module.exports = Attribute;