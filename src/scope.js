class Scope {
  constructor() {
    if (this.constructor === Scope) {
      throw new Error("Scope cannot be instantiated");
    }
  }

  apply(builder, model) {
    throw new Error("apply not implemented");
  }
}

module.exports = Scope