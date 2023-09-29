const { collect, Collection: BaseCollection } = require('collect.js')
const _ = require('lodash')

class Collection extends BaseCollection {
  async load(...relations) {
    if (this.isNotEmpty()) {
      const query = this.first().constructor.query().with(...relations);

      const items = await query.eagerLoadRelations(this.items);
      return new this.constructor(items)
    }

    return this;
  }

  async loadAggregate(relations, column, action = null) {
    if (this.isEmpty()) {
      return this;
    }

    const models = (await this.first().newModelQuery()
      .whereIn(this.first().getKeyName(), this.modelKeys())
      .select(this.first().getKeyName())
      .withAggregate(relations, column, action)
      .get())
      .keyBy(this.first().getKeyName());

    const attributes = _.difference(
      Object.keys(models.first().getAttributes()),
      [models.first().getKeyName()]
    );

    this.each((model) => {
      const extraAttributes = _.pick(models.get(model.getKey()).getAttributes(), attributes);

      model.fill(extraAttributes)
        .syncOriginalAttributes(attributes);
    });

    return this;
  }

  loadCount(relations) {
    return this.loadAggregate(relations, '*', 'count');
  }

  loadMax(relation, column) {
    return this.loadAggregate(relation, column, 'max');
  }

  loadMin(relation, column) {
    return this.loadAggregate(relation, column, 'min');
  }

  loadSum(relation, column) {
    return this.loadAggregate(relation, column, 'sum');
  }

  loadAvg(relation, column) {
    return this.loadAggregate(relation, column, 'avg');
  }

  mapThen(callback) {
    return Promise.all(this.map(callback));
  }

  modelKeys() {
    return this.all().map(item => item.getKey());
  }

  contains(key, operator = null, value = null) {
    if (arguments.length > 1) {
      return super.contains(key, operator, value);
    }

    const Model = require('./model');
    if (key instanceof Model) {
      return super.contains(model => {
        return model.is(key);
      });
    }

    return super.contains(model => {
      return model.getKey() == key;
    });
  }

  diff(items) {
    const diff = new this.constructor;

    const dictionary = this.getDictionary(items);

    this.items.map(item => {
      if (dictionary[item.getKey()] === undefined) {
        diff.add(item);
      }
    });

    return diff;
  }

  except(keys) {
    const dictionary = _.omit(this.getDictionary(), keys);

    return new this.constructor(Object.values(dictionary));
  }

  intersect(items) {
    const intersect = new this.constructor;

    if (_.isEmpty(items)) {
      return intersect;
    }

    const dictionary = this.getDictionary(items);

    for (let item of this.items) {
      if (dictionary[item.getKey()] !== undefined) {
        intersect.add(item);
      }
    }

    return intersect;
  }

  unique(key = null, strict = false) {
    if (key !== null) {
      return super.unique(key, strict);
    }

    return new this.constructor(Object.values(this.getDictionary()));
  }

  find(key, defaultValue = null) {
    const Model = require('./model');
    if (key instanceof Model) {
      key = key.getKey();
    }

    if (_.isArray(key)) {
      if (this.isEmpty()) {
        return new this.constructor;
      }

      return this.whereIn(this.first().getKeyName(), key);
    }

    collect(this.items).first(model => {
      return model.getKey() == key;
    })

    return this.items.filter(model => {
      return model.getKey() == key;
    })[0] || defaultValue;
  }

  async fresh(...args) {
    if (this.isEmpty()) {
      return new this.constructor;
    }

    const model = this.first();

    const freshModels = (await model.newQuery()
      .with(...args)
      .whereIn(model.getKeyName(), this.modelKeys())
      .get())
      .getDictionary();

    return this.filter(model => {
      return model.exists && freshModels[model.getKey()] !== undefined;
    }).map(model => {
      return freshModels[model.getKey()];
    });
  }

  makeVisible(attributes) {
    return this.each(item => {
      item.makeVisible(attributes);
    })
  }

  makeHidden(attributes) {
    return this.each(item => {
      item.makeHidden(attributes);
    })
  }

  append(attributes) {
    return this.each(item => {
      item.append(attributes);
    })
  }

  only(keys) {
    if (keys === null) {
      return new Collection(this.items);
    }

    const dictionary = _.pick(this.getDictionary(), keys);

    return new this.constructor(Object.values(dictionary));
  }

  getDictionary(items = null) {
    items = items === null ? this.items : items;

    const dictionary = {};

    items.map(value => {
      dictionary[value.getKey()] = value;
    });

    return dictionary;
  }

  toQuery() {
    const model = this.first();

    if (! model) {
      throw new Error('Unable to create query for empty collection.');
    }

    const modelName = model.constructor.name;

    if (this.filter(model => {
      return ! model instanceof modelName;
    }).isNotEmpty()) {
      throw new Error('Unable to create query for collection with mixed types.');
    }

    return model.newModelQuery().whereKey(this.modelKeys());
  }

  toData() {
    return this.all().map(item => typeof item.toData == 'function' ? item.toData() : item);
  }

  toJSON() {
    return this.toData();
  }

  toJson(...args) {
    return JSON.stringify(this.toData(), ...args);
  }

  [Symbol.iterator]() {
    const items = this.items;
    let length = this.items.length;
    let n = 0;
    return {
      next() {
        return n < length ? {
          value: items[n++],
          done: false
        } : {
          done: true
        };
      }
    };
  }
}

module.exports = Collection;