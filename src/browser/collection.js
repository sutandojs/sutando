const { collect, Collection: BaseCollection } = require('collect.js');
const pick = require('lodash/pick');
const omit = require('lodash/omit');
const isEmpty = require('lodash/isEmpty');
const isArray = require('lodash/isArray');

class Collection extends BaseCollection {
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
    const dictionary = omit(this.getDictionary(), keys);

    return new this.constructor(Object.values(dictionary));
  }

  intersect(items) {
    const intersect = new this.constructor;

    if (isEmpty(items)) {
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

    if (isArray(key)) {
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

    const dictionary = pick(this.getDictionary(), keys);

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