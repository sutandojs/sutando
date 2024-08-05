const Knex = require('knex');
const QueryBuilder = require('./query-builder');
const { getRelationMethod, getScopeMethod, compose, getAttrMethod } = require('./utils');
const Attribute = require('./casts/attribute');

class sutando {
  static connectorFactory = null;
  static instance = null;

  constructor() {
    this.manager = {};
    this.connections = {};
    this.models = {};
  }

  static getInstance() {
    if (this.instance === null) {
      this.instance = new sutando();
    }

    return this.instance;
  }

  static connection(connection = null) {
    return this.getInstance().getConnection(connection);
  }

  static setConnectorFactory(connectorFactory) {
    this.connectorFactory = connectorFactory;
  }

  static getConnectorFactory() {
    return this.connectorFactory || Knex;
  }

  static addConnection(config, name = 'default') {
    return this.getInstance().addConnection(config, name);
  }

  static beginTransaction(connection = null) {
    return this.getInstance().beginTransaction(connection);
  }

  static transaction(callback, connection = null) {
    return this.getInstance().transaction(callback, connection);
  }

  static table(name, connection = null) {
    return this.getInstance().table(name, connection);
  }

  static schema(connection = null) {
    return this.getInstance().schema(connection);
  }

  static async destroyAll() {
    await this.getInstance().destroyAll();
  }

  static createModel(name, options) {
    return this.getInstance().createModel(name, options);
  }

  connection(connection = null) {
    return this.getConnection(connection);
  }

  getConnection(name = null) {
    name = name || 'default';
    if (this.manager[name] === undefined) {
      const queryBuilder = new QueryBuilder(
        this.connections[name],
        this.constructor.getConnectorFactory()
      );

      this.manager[name] = queryBuilder;
    }

    return this.manager[name];
  }

  addConnection(config, name = 'default') {
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

  beginTransaction(connection = null) {
    return this.connection(connection).transaction();
  }

  transaction(callback, connection = null) {
    return this.connection(connection).transaction(callback);
  }

  table(name, connection = null) {
    return this.connection(connection).table(name);
  }

  schema(connection = null) {
    return this.connection(connection).schema;
  }

  async destroyAll() {
    await Promise.all(Object.values(this.manager).map((connection) => {
      return connection?.destroy();
    }));
  }

  createModel(name, options = {}) {
    const Model = require('./model');
    let BaseModel = Model;
    if ('plugins' in options) {
      BaseModel = compose(BaseModel, ...options.plugins);
    }

    this.models = {
      ...this.models,
      [name]: class extends BaseModel {
        table = options?.table ?? null;
        connection = options?.connection ?? null;
        timestamps = options?.timestamps ?? true;
        primaryKey = options?.primaryKey ?? 'id';
        keyType = options?.keyType ?? 'int';
        incrementing = options?.incrementing ?? true;
        with = options?.with ?? [];
        casts = options?.casts ?? {};
  
        static CREATED_AT = options?.CREATED_AT ?? 'created_at';
        static UPDATED_AT = options?.UPDATED_AT ?? 'updated_at';
        static DELETED_AT = options?.DELETED_AT ?? 'deleted_at';
      }
    }

    if ('attributes' in options) {
      for (const attribute in options.attributes) {
        if (options.attributes[attribute] instanceof Attribute === false) {
          throw new Error(`Attribute must be an instance of "Attribute"`);
        }

        this.models[name].prototype[getAttrMethod(attribute)] = () => options.attributes[attribute];
      }
    }
    
    if ('relations' in options) {
      for (const relation in options.relations) {
        this.models[name].prototype[getRelationMethod(relation)] = function () {
          return options.relations[relation](this);
        };
      }
    }

    if ('scopes' in options) {
      for (const scope in options.scopes) {
        this.models[name].prototype[getScopeMethod(scope)] = options.scopes[scope];
      }
    }

    this.models[name].setConnectionResolver(this);
    return this.models[name];
  }
}

module.exports = sutando;