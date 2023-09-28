class CastsAttributes {
  constructor() {
    if (this.constructor === CastsAttributes) {
      throw new Error("CastsAttributes cannot be instantiated");
    }
  }

  static get() {
    throw new Error("get not implemented");
  }

  static set() {
    throw new Error("set not implemented");
  }
}

module.exports = CastsAttributes