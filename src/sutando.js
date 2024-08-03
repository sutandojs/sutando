const Knex = require('knex');
const QueryBuilder = require('./query-builder');
const { getRelationMethod, getScopeMethod } = require('./utils');

class sutando {
  static manager = {};
  static connections = {};
  static models = {};
  static connectorFactory = null;

  static connection(connection = null) {
    return this.getConnection(connection);
  }

  static setConnectorFactory(connectorFactory) {
    this.connectorFactory = connectorFactory;
  }

  static getConnectorFactory() {
    return this.connectorFactory || Knex;
  }

  static getConnection(name = null) {
    name = name || 'default';
    if (this.manager[name] === undefined) {
      const queryBuilder = new QueryBuilder(
        this.connections[name],
        this.getConnectorFactory()
      );

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

  static createModel(name, options) {
    const Model = require('./model');
    sutando.models = {
      ...sutando.models,
      [name]: class extends Model {
        table = options?.table || null;
        connection = options?.connection || null;
        timestamps = options?.timestamps || true;
        primaryKey = options?.primaryKey || 'id';
        keyType = options?.keyType || 'int';
        incrementing = options?.incrementing || true;
        with = options?.with || [];
        casts = options?.casts || {};
  
        static CREATED_AT = options?.CREATED_AT || 'created_at';
        static UPDATED_AT = options?.UPDATED_AT || 'updated_at';
        static DELETED_AT = options?.DELETED_AT || 'deleted_at';
      }
    }

    if ('relations' in options) {
      for (const relation in options.relations) {
        sutando.models[name].prototype[getRelationMethod(relation)] = options.relations[relation];
      }
    }

    if ('scopes' in options) {
      for (const scope in options.scopes) {
        sutando.models[name].prototype[getScopeMethod(scope)] = options.scopes[scope];
      }
    }

    return sutando.models[name];
  }
}

module.exports = sutando;