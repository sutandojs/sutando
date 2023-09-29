const _ = require('lodash');
const dayjs = require('dayjs');
const {
  getAttrMethod,
  getGetterMethod,
  getSetterMethod,
} = require('../utils');
const CastsAttributes = require('../casts-attributes');

const HasAttributes = (Model) => {
  return class extends Model {
    static castTypeCache = {};
    attributes = {};
    original = {};
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

    normalizeCastClassResponse(key, value) {
      return value?.constructor?.name === 'Object'
        ? value
        : {
          [key]: value
        }
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
      const setterMethod = getSetterMethod(key);
      if (typeof this[setterMethod] === 'function') {
        this[setterMethod](value);
        return this;
      }

      const attrMethod = getAttrMethod(key);
      if (typeof this[attrMethod] === 'function') {
        const attribute = this[attrMethod]();
        const callback = attribute.set || ((value) => {
          this.attributes[key] = value;
        });

        this.attributes = {
          ...this.attributes,
          ...this.normalizeCastClassResponse(
            key, callback(value, this.attributes)
          )
        };

        return this;
      }
  
      const casts = this.getCasts();
      const castType = casts[key];
  
      if (this.isCustomCast()) {
        return castType.set(this, key, value, this.attributes);
      }
  
      if (castType === 'json') {
        value = JSON.stringify(value);
      }

      if (value !== null && this.isDateAttribute(key)) {
        value = this.fromDateTime(value);
      }
  
      this.attributes[key] = value;
  
      return this;
    }
  
    getAttribute(key) {
      if (!key) {
        return;
      }

      const getterMethod = getGetterMethod(key);
      if (typeof this[getterMethod] === 'function') {
        return this[getterMethod](this.attributes[key], this.attributes);
      }

      const attrMethod = getAttrMethod(key);
      if (typeof this[attrMethod] === 'function') {
        const caster = this[attrMethod]();
        return caster.get(this.attributes[key], this.attributes);
      }
  
      if (key in this.attributes) {
        if (this.hasCast(key)) {
          return this.castAttribute(key, this.attributes[key]);
        }
        
        if (this.getDates().includes(key)) {
          return this.asDateTime(this.attributes[key]);
        }

        return this.attributes[key];
      }
  
      if (key in this.relations) {
        return this.relations[key];
      }
  
      return;
    }
  
    castAttribute(key, value) {
      const castType = this.getCastType(key);
  
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
        case 'timestamp':
          return this.asTimestamp(value);
      }
  
      if (this.isCustomCast()) {
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

      for (const key of this.getDates()) {
        if (attributes[key] === undefined) {
          continue;
        }

        attributes[key] = this.serializeDate(
          this.asDateTime(attributes[key])
        );
      }

      const casts = this.getCasts();
      for (const key in casts) {
        const value = casts[key];

        if ((key in attributes) === false) {
          continue;
        }

        attributes[key] = this.castAttribute(
          key, attributes[key]
        );

        if (key in attributes && ['date', 'datetime'].includes(value)) {
          attributes[key] = this.serializeDate(attributes[key]);
        }

        if (key in attributes && this.isCustomDateTimeCast(value)) {
          attributes[key] = dayjs(attributes[key]).format(value.split(':')[1]);
        }
      }
  
      for (const key of this.appends) {
        attributes[key] = this.mutateAttribute(key, null);
      }
  
      return attributes;
    }
  
    mutateAttribute(key, value) {
      if (typeof this[getGetterMethod(key)] === 'function') {
        return this[getGetterMethod(key)](value);
      } else if (typeof this[getAttrMethod(key)] === 'function') {
        const caster = this[getAttrMethod(key)]();
        return caster.get(key, this.attributes);
      }

      return value;
    }
  
    mutateAttributeForArray(key, value) {
  
    }

    isDateAttribute(key) {
      return this.getDates().includes(key) || this.isDateCastable(key);
    }

    getDates() {
      return this.usesTimestamps() ? [
        this.getCreatedAtColumn(),
        this.getUpdatedAtColumn(),
      ] : [];
    }
  
    getCasts() {
      if (this.getIncrementing()) {
        return {
          [this.getKeyName()]: this.getKeyType(), 
          ...this.casts
        };
      }

      return this.casts;
    }

    getCastType(key) {
      const castType = this.getCasts()[key];

      let castTypeCacheKey;
      if (typeof castType === 'string') {
        castTypeCacheKey = castType;
      } else if ((new castType) instanceof CastsAttributes) {
        castTypeCacheKey = castType.name;
      }

      if (castTypeCacheKey && this.constructor.castTypeCache[castTypeCacheKey] !== undefined) {
        return this.constructor.castTypeCache[castTypeCacheKey];
      }

      let convertedCastType;

      if (this.isCustomDateTimeCast(castType)) {
        convertedCastType = 'custom_datetime';
      } else if (this.isDecimalCast(castType)) {
        convertedCastType = 'decimal';
      } else if (this.isCustomCast(castType)) {
        convertedCastType = castType;
      } else {
        convertedCastType = castType.toLocaleLowerCase().trim();
      }

      return this.constructor.castTypeCache[castTypeCacheKey] = convertedCastType;
    }
  
    hasCast(key, types = []) {
      if (this.casts[key] !== undefined) {
        types = _.flatMap(types);
        return types ? types.includes(this.getCastType(key)) : true;
      }

      return false;
    }

    withDayjs(date) {
      return dayjs(date);
    }

    isCustomCast(cast) {
      return typeof cast === 'function' && (new cast) instanceof CastsAttributes
    }

    isCustomDateTimeCast(cast) {
      if (typeof cast !== 'string') {
        return false;
      }

      return cast.startsWith('date:') || cast.startsWith('datetime:');
    }

    isDecimalCast(cast) {
      if (typeof cast !== 'string') {
        return false;
      }
      
      return cast.startsWith('decimal:');
    }

    isDateCastable(key) {
      return this.hasCast(key, ['date', 'datetime']);
    }

    fromDateTime(value) {
      return dayjs(this.asDateTime(value)).format(
        this.getDateFormat()
      );
    }

    getDateFormat() {
      return this.dateFormat || 'YYYY-MM-DD HH:mm:ss';
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
  }
}

module.exports = HasAttributes;
