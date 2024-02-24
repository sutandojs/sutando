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
            return field.string('utf8');
          }
          return next();
        }
      }
    };
  }

  static beginTransaction(connection = null) {
    return this.connection(connection).transaction();
  }

  static transaction(callback, connection = null) {
    return this.connection(connection).transaction(callback);
  }

  static commit(connection = null) {

  }

  static rollback(connection = null) {

  }

  static table(name, connection = null) {
    return this.connection(connection).table(name);
  }

  static schema(connection = null) {
    return this.connection(connection).schema;
  }

  static async destroyAll() {
    await Promise.all(Object.values(this.manager).map((connection) => {
      return connection?.destroy();
    }));
  }
}

module.exports = sutando;