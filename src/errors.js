const isArray = require('lodash/isArray');

class BaseError extends Error {
  constructor(message, entity) {
    super(message);
    Error.captureStackTrace(this, this.constructor);

    this.name = this.constructor.name;
    this.message = message;
  }
}

class ModelNotFoundError extends BaseError {
  model;
  ids;

  setModel(model, ids = []) {
    this.model = model;
    this.ids = isArray(ids) ? ids : [ids];

    this.message = `No query results for model [${model}]`;

    if (this.ids.length > 0) {
      this.message += ' ' + this.ids.join(', ');
    } else {
      this.message += '.';
    }

    return this;
  }

  getModel() {
    return this.model;
  }

  getIds() {
    return this.ids;
  }
}
class RelationNotFoundError extends BaseError {}
class InvalidArgumentError extends BaseError {}

module.exports = {
  ModelNotFoundError,
  RelationNotFoundError,
  InvalidArgumentError,
};