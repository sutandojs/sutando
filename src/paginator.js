const Collection = require('./collection');

class Paginator {
  static formatter = null;

  _items;
  _total;
  _perPage;
  _lastPage;
  _currentPage;

  static setFormatter(formatter) {
    if (typeof formatter !== 'function' && formatter !== null && formatter !== undefined) {
      throw new Error('Paginator formatter must be a function or null');
    }

    this.formatter = formatter;
  }

  constructor(items, total, perPage, currentPage = null, options = {}) {
    this.options = options;

    for (const key in options) {
      const value = options[key];
      this[key] = value;
    }

    this._total = total;
    this._perPage = parseInt(perPage);
    this._lastPage = Math.max(Math.ceil(total / perPage), 1);
    this._currentPage = currentPage;
    this.setItems(items);
  }

  setItems(items) {
    this._items = items instanceof Collection ? items : new Collection(items);

    this.hasMore = this._items.count() > this._perPage;

    this._items = this._items.slice(0, this._perPage);
  }

  firstItem() {
    return this.count() > 0 ? (this._currentPage - 1) * this._perPage + 1 : null;
  }

  lastItem() {
    return this.count() > 0 ? this.firstItem() + this.count() - 1 : null;
  }

  hasMorePages() {
    return this._currentPage < this._lastPage;
  }

  get(index) {
    return this._items.get(index);
  }

  count() {
    return this._items.count();
  }

  items() {
    return this._items;
  }

  map(callback) {
    return this._items.map(callback);
  }

  currentPage() {
    return this._currentPage;
  }

  onFirstPage() {
    return this._currentPage === 1;
  }

  perPage() {
    return this._perPage;
  }

  lastPage() {
    return this._lastPage;
  }

  total() {
    return this._total;
  }

  toData() {
    if (this.constructor.formatter && typeof this.constructor.formatter === 'function') {
      return this.constructor.formatter(this);
    }

    return {
      current_page: this._currentPage,
      data: this._items.toData(),
      per_page: this._perPage,
      total: this._total,
      last_page: this._lastPage,
      count: this.count(),
    };
  }

  toJSON() {
    return this.toData();
  }

  toJson(...args) {
    return JSON.stringify(this.toData(), ...args);
  }
}

module.exports = Paginator;