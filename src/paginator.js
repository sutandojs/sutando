const Collection = require('./collection');

class Paginator {
  _items;
  _total;
  _perPage;
  _lastPage;
  _currentPage

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
    return JSON.stringify(this.toData, ...args);
  }
}

module.exports = Paginator;