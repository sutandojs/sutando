const Scope = require('../scope');
const _ = require('lodash');
const { InvalidArgumentError } = require('../errors');

const HasGlobalScopes = (Model) => {
  return class extends Model {
    static addGlobalScope(scope, implementation = null) {
      if (typeof scope === 'string' && implementation instanceof Scope) {
        _.set(this.globalScopes, this.name + '.' + scope, implementation);
        return implementation;
      } else if (scope instanceof Scope) {
        _.set(this.globalScopes, this.name + '.' + scope.constructor.name, scope);
        return scope;
      }

      throw new InvalidArgumentError('Global scope must be an instance of Scope.');
    }

    static hasGlobalScope(scope) {
      return this.getGlobalScope(scope) !== null;
    }

    static getGlobalScope(scope) {
      if (typeof scope === 'string') {
        return _.get(this.globalScopes, this.name + '.' + scope);
      }

      return _.get(
        this.globalScopes, this.name + '.' + scope.constructor.name,
      );
    }

    static getAllGlobalScopes() {
      return this.globalScopes;
    }

    static setAllGlobalScopes(scopes) {
      this.globalScopes = scopes;
    }

    getGlobalScopes() {
      return _.get(this.constructor.globalScopes, this.constructor.name, {});
    }
  }
}

module.exports = HasGlobalScopes;
