const _ = require('lodash');
const dayjs = require('dayjs');
const {
  getGetterMethod,
  getSetterMethod,
} = require('../utils');
const CastsAttributes = require('../casts-attributes');

const HasAttributes = (Model) => {
  return class extends Model {
    attributes = {}; // protected
    casts = {};
    changes = {};
    appends = [];

    setAppends(appends) {
      this.appends = appends;
      return this;
    }

    append(...keys) {
      const appends = _.flatMapDeep(keys);
      this.appends = [...this.appends, ...appends];
      return this;
    }

    syncOriginal() {
      this.original = this.getAttributes();
      return this;
    }

    syncChanges() {
      this.changes = this.getDirty();
      return this;
    }

    syncOriginalAttribute(attribute) {
      this.syncOriginalAttributes(attribute);
    }

    syncOriginalAttributes(...attributes) {
      attributes = _.flatMapDeep(attributes);

      const modelAttributes = this.getAttributes();

      for (const attribute of attributes) {
        this.original[attribute] = modelAttributes[attribute];
      }

      return this;
    }

    isDirty(...attributes) {
      const changes = this.getDirty();
      attributes = _.flatMapDeep(attributes);

      if (attributes.length === 0) {
        return Object.keys(changes).length > 0;
      }

      for (const attribute of attributes) {
        if (attribute in changes) {
          return true;
        }
      }

      return false;
    }
  
    getDirty() {
      const dirty = {};
      
      const attributes = this.getAttributes();
      for (const key in attributes) {
        const value = attributes[key];
        if (!this.originalIsEquivalent(key)) {
          dirty[key] = value;
        }
      }
  
      return dirty;
    }

    originalIsEquivalent(key) {
      if (this.original[key] === undefined) {
        return false;
      }

      const attribute = this.attributes[key];
      const original = this.original[key];

      if (attribute === original) {
        return true;
      } else {
        return false;
      }
    }

    setAttributes(attributes) {
      this.attributes = { ...attributes };
    }
  
    getAttributes() {
      return { ...this.attributes };
    }
  
    setAttribute(key, value) {
      const attrMethod = getSetterMethod(key);
      if (typeof this[attrMethod] === 'function') {
        this[attrMethod](value);
        return this;
      }
  
      const casts = this.getCasts();
  
      if (typeof castType === 'function' && (new castType) instanceof CastsAttributes) {
        return casts[key].set(this, key, value, this.attributes);
      }
  
      if (casts[key] === 'json') {
        value = JSON.stringify(value);
      }
  
      this.attributes[key] = value;
  
      return this;
    }
  
    getAttribute(key) {
      if (!key) {
        return;
      }
  
      const attrMethod = getGetterMethod(key);
      if (typeof this[attrMethod] === 'function') {
        return this[attrMethod](this.attributes[key], this.attributes);
      }
  
      if (this.attributes[key] !== undefined) {
        return this.castAttribute(key, this.attributes[key]);
      }
  
      if (this.relations[key] !==  undefined) {
        return this.relations[key];
      }
  
      return;
    }

    castAttribute(key, value) {
      // const castType = this.getCastType(key);
      const casts = this.getCasts();
      const castType = casts[key]; 
  
      if (!castType) {
        return value;
      }
  
      if (value === null) {
        return value;
      }
  
      switch (castType) {
        case 'int':
        case 'integer':
          return parseInt(value);
        case 'real':
        case 'float':
        case 'double':
          return parseFloat(value);
        case 'decimal':
          return this.asDecimal(value, castType.split(':')[1]);
        case 'string':
          return String(value);
        case 'bool':
        case 'boolean':
          return Boolean(value);
        case 'object':
        case 'json':
          try {
            return typeof value === 'string' ? JSON.parse(value) : value;
          } catch (e) {
            return null;
          }
        case 'collection':
          return new Collection(typeof value === 'string' ? JSON.parse(value) : value);
        case 'date':
          return this.asDate(value);
        case 'datetime':
        case 'custom_datetime':
          return this.asDateTime(value);
        // case 'immutable_date':
        //   return this.asDate(value).toImmutable();
        // case 'immutable_custom_datetime':
        // case 'immutable_datetime':
        //   return this.asDateTime(value).toImmutable();
        case 'timestamp':
          return this.asTimestamp(value);
      }
  
      // if (this.isEnumCastable(key)) {
      //   return this.getEnumCastableAttributeValue(key, value);
      // }
  
      if (typeof castType === 'function' && (new castType) instanceof CastsAttributes) {
        return castType.get(this, key, value, this.attributes);
      }
  
      return value;
    }

    attributesToData() {
      const attributes = { ...this.attributes };
  
      for (const key in attributes) {
        if (this.hidden.includes(key)) {
          _.unset(attributes, key);
        }
  
        if (this.visible.length > 0 && this.visible.includes(key) === false) {
          _.unset(attributes, key);
        }
      }
  
      for (const key in attributes) {
        attributes[key] = this.getAttribute(key);
  
        if (attributes[key] instanceof Date) {
          attributes[key] = this.serializeDate(attributes[key]);
        }
      }
  
      for (const key of this.appends) {
        attributes[key] = this.mutateAttribute(key, null);
      }
  
      return attributes;
    }
  
    mutateAttribute(key, value) {
      return this[getGetterMethod(key)](value)
    }
  
    mutateAttributeForArray(key, value) {
  
    }

    getCasts() {
      return this.casts;
    }

    hasCast(key) {
      return this.casts[key] !== undefined;
    }

    getDateFormat() {
      return this.dateFormat;
    }
    asDecimal(value, decimals) {
      return parseFloat(value).toFixed(decimals);
    }
  
    asDateTime(value) {
      if (value === null) {
        return null;
      }
  
      if (value instanceof Date) {
        return value;
      }
  
      if (typeof value === 'number') {
        return new Date(value * 1000);
      }
  
      return new Date(value);
    }
  
    asDate(value) {
      const date = this.asDateTime(value);
      return dayjs(date).startOf('day').toDate();
    }
  };
}

module.exports = HasAttributes;