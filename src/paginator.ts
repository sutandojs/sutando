import Collection from "./collection";

// const Collection = require('./collection');
type paginatorData = {
  current_page: number,
  data: Array<any>,
  per_page: number,
  total: number,
  last_page: number,
  count: number,
}

class Paginator {
  protected _items;
  total: number;
  perPage: number;
  options: any;
  lastPage: number;
  currentPage: number;
  hasMore: boolean;

  constructor(items: Collection | Array<any>, total: number, perPage: number, currentPage: null | number = null, options: any = {}) {
    this.options = options;

    // for (const key in options) {
    //   const value = options[key];
    //   this[key] = value;
    // }

    this.total = total;
    this.perPage = perPage;
    this.lastPage = Math.max(Math.ceil(total / perPage), 1);
    this.currentPage = currentPage || 1;
    this.setItems(items);
  }

  setItems(items: Collection | Array<any>): void {
    this._items = items instanceof Collection ? items : new Collection(items);

    this.hasMore = this._items.count() > this.perPage;

    this._items = this._items.slice(0, this.perPage);
  }

  hasMorePages(): boolean {
    return this.currentPage < this.lastPage;
  }

  count(): number {
    return this._items.count();
  }

  items(): Collection {
    return this._items;
  }

  map(callback): Collection {
    return this._items.map(callback);
  }

  toData(): paginatorData {
    return {
      current_page: this.currentPage,
      data: this._items.toData(),
      per_page: this.perPage,
      total: this.total,
      last_page: this.lastPage,
      count: this.count(),
    };
  }

  toJson(...args): string {
    return JSON.stringify(this.toData, ...args);
  }
}

module.exports = Paginator;