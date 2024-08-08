const Paginator = require('./paginator');

class QueryBuilder {
  connector = null;
  constructor(config, connector) {
    this.connector = connector(config);
    return this.asProxy();
  }

  asProxy() {
    const handler = {
      get: function (target, prop) {
        if (typeof target[prop] !== 'undefined') {
          return target[prop]
        }

        if (['destroy', 'schema'].includes(prop)) {
          return target.connector.schema;
        }

        if ([
          'select', 'from', 'where', 'orWhere', 'whereColumn', 'whereRaw',
          'whereNot', 'orWhereNot', 'whereIn', 'orWhereIn', 'whereNotIn', 'orWhereNotIn', 'whereNull', 'orWhereNull', 'whereNotNull', 'orWhereNotNull', 'whereExists', 'orWhereExists',
          'whereNotExists', 'orWhereNotExists', 'whereBetween', 'orWhereBetween', 'whereNotBetween', 'orWhereNotBetween',
          'whereLike', 'orWhereLike', 'whereILike', 'orWhereILike', 
          'whereJsonObject', 'whereJsonPath', 'whereJsonSupersetOf', 'whereJsonSubsetOf', 
          'join', 'joinRaw', 'leftJoin', 'leftOuterJoin', 'rightJoin', 'rightOuterJoin', 'crossJoin', 
          'transacting', 'groupBy', 'groupByRaw', 'returning',
          'having', 'havingRaw', 'havingBetween', 
          'limit', 'offset', 'orderBy', 'orderByRaw', // 'inRandomOrder',
          'union', 'insert', 'forUpdate', 'forShare', 'distinct',
          'clearOrder', 'clear', 'clearSelect', 'clearWhere', 'clearHaving', 'clearGroup',
        ].includes(prop)) {
          return (...args) => {
            target.connector[prop](...args);
            return target.asProxy()
          }
        }

        return target.connector[prop];
      },
      set: function (target, prop, value) {
        if (typeof target[prop] !== 'undefined') {
          target[prop] = value;
          return target;
        }

        target.connector[prop] = value;
        return target;
      }
    };

    return new Proxy(this, handler);
  }

  async beginTransaction() {
    const trx = await this.connector.transaction();
    return new QueryBuilder(null, () => trx);
  }

  table(table) {
    const c = this.connector.table(table);
    return new QueryBuilder(null, () => c);
  }

  transaction(callback) {
    if (callback) {
      return this.connector.transaction((trx) => {
        return callback(new QueryBuilder(null, () => trx))
      });
    }
    
    return callback;
  }

  async find(id, columns = ['*']) {
    return await this.connector.where('id', id).first(...columns);
  }

  async get(columns = ['*']) {
    return await this.connector;
  }

  async exists() {
    return await this.connector.first() !== null;
  }

  skip(...args) {
    return this.offset(...args);
  }

  take(...args) {
    return this.limit(...args);
  }

  async chunk(count, callback) {
    if (this.connector._statements.filter(item => item.grouping === 'order').length === 0) {
      throw new Error('You must specify an orderBy clause when using this function.');
    }

    let page = 1;
    let countResults;

    do {
      const builder = this.clone();
      const results = await builder.forPage(page, count).get();
  
      countResults = results.length;
  
      if (countResults == 0) {
        break;
      }
  
      const bool = await callback(results, page);
  
      if (bool === false) {
        return false;
      }
  
      page++;
    } while (countResults === count);
  
    return true;
  }

  async paginate(page = 1, perPage = 15) {
    const query = this.clone();

    const total = await query.clearOrder().count('*');

    let results;
    if (total > 0) {
      const skip = (page - 1) * perPage;
      this.take(perPage).skip(skip);

      results = await this.get();
    } else {
      results = [];
    }

    return new Paginator(results, parseInt(total), perPage, page);
  }

  forPage(page = 1, perPage = 15) {
    return this.offset((page - 1) * perPage).limit(perPage);
  }

  toSQL(...args) {
    return this.connector.toSQL(...args);
  }

  async count(column) {
    const [{ aggregate }] = await this.connector.count(column, { as: 'aggregate' });
    return Number(aggregate);
  }

  async min(column) {
    const [{ aggregate }] = await this.connector.min(column, { as: 'aggregate' });
    return Number(aggregate);
  }

  async max(column) {
    const [{ aggregate }] = await this.connector.max(column, { as: 'aggregate' });
    return Number(aggregate);
  }

  async sum(column) {
    const [{ aggregate }] = await this.connector.sum(column, { as: 'aggregate' });
    return Number(aggregate);
  }

  async avg(column) {
    const [{ aggregate }] = await this.connector.avg(column, { as: 'aggregate' });
    return Number(aggregate);
  }

  clone() {
    const c = this.connector.clone();
    return new QueryBuilder(null, () => c);
  }

  async delete() {
    return await this.connector.delete();
  }

  async insert(...args) {
    return await this.connector.insert(...args);
  }

  async update(...args) {
    return await this.connector.update(...args);
  }

  destroy(...args) {
    return this.connector.destroy(...args);
  }

  get _statements() {
    return this.connector._statements;
  }

  get _single() {
    return this.connector._single;
  }

  get from() {
    return this.connector.from;
  }
}

module.exports = QueryBuilder;