class BaseError extends Error {
  constructor(message, entity) {
    super(message);
    Error.captureStackTrace(this, this.constructor);

    this.name = this.constructor.name;
    this.message = message;
  }
}

class ModelNotFoundError extends BaseError {}
class RelationNotFoundError extends BaseError {}

module.exports = {
  ModelNotFoundError,
  RelationNotFoundError,
};