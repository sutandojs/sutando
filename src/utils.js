const _ = require('lodash');
const dayjs = require('dayjs');
const advancedFormat = require('dayjs/plugin/advancedFormat');
dayjs.extend(advancedFormat);

const now = (format = 'YYYY-MM-DD HH:mm:ss') => dayjs().format(format);

const getRelationName = (relationMethod) => {
  // 'relation' length 8
  return relationMethod.substring(8).toLowerCase();
}

const getScopeName = (scopeMethod) => {
  // 'scope' length 5
  return scopeMethod.substring(5).toLowerCase();
}

const getRelationMethod = (relation) => {
  return _.camelCase(`relation_${relation}`);
}

const getScopeMethod = (scope) => {
  return _.camelCase(`scope_${scope}`);
}

const getAttrMethod = (attr) => {
  return _.camelCase(`get_${attr}_attribute`);
}

const getGetterMethod = (attr) => {
  return _.camelCase(`get_${attr}_attribute`);
}

const getSetterMethod = (attr) => {
  return _.camelCase(`set_${attr}_attribute`);
}

const getAttrName = (attrMethod) => {
  return attrMethod.substring(3, attrMethod.length - 9).toLowerCase();
}

const tap = (instance, callback) => {
  const result = callback(instance);
  return result instanceof Promise ? result.then(() => instance) : instance;
}

module.exports = {
  now,
  getRelationName,
  getScopeName,
  getRelationMethod,
  getScopeMethod,
  getAttrMethod,
  getGetterMethod,
  getSetterMethod,
  getAttrName,
  tap,
};