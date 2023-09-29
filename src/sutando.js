const QueryBuilder = require('./query-builder');

class sutando {
  static manager = {};
  static connections = {};

  static connection(connection = null) {
    return this.getConnection(connection);
  }

  static getConnection(name = null) {
    name = name || 'default';
    if (this.manager[name] === undefined) {
      const queryBuilder = QueryBuilder(this.connections[name]);

      this.manager[name] = queryBuilder;
    }

    return this.manager[name];
  }

  static addConnection(config, name = 'default') {
    this.connections[name] = {
      ...config,
      connection: {
        ...config.connection,
        dateStrings: true,
        typeCast: function (field, next) {
          if (field.type === 'JSON') {
            return field.string();
          }
          return next();
        }
      }
    };
  }

  static beginTransaction(name = null) {
    const connection = this.connection(name);
    return connection.transaction();
  }

  static transaction(callback, name = null) {
    const connection = this.connection(name);
    return connection.transaction(callback);
  }

  static commit(name = null) {

  }

  static rollback(name = null) {

  }

  static schema(name = null) {
    const connection = this.connection(name);
    return connection.schema;
  }
}

module.exports = sutando;