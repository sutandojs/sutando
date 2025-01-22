import { Collection as BaseCollection } from 'collect.js';

declare module 'sutando' {
  export interface Constructor<T> {
    new (): T;
  }
  type AnyModelConstructor = ModelConstructor<Model>;
  export interface ModelConstructor<M extends Model> extends Constructor<M> {}
  type FieldExpression = string;

  export class Attribute {
    static make(config: { get?: Function | null, set?: Function | null }): Attribute;
    get: Function | null;
    set: Function | null;
  }

  export class CastsAttributes {
    constructor();
    static get(): any;
    static set(): void;
  }

  export class Relation<M> {
    [key: string]: this;
  }
  export class HasOne<M> extends Relation<M> {}
  export class HasMany<M> extends Relation<M> {}
  export class BelongsTo<M> extends Relation<M> {}
  export class BelongsToMany<M> extends Relation<M> {}

  export class Model {
    // [value: string]: any | never;
    protected attributes: any;
    protected relations: any;
    public exists: boolean;
    protected primaryKey: string;
    protected table: string;
    protected connection: string;
    protected keyType: string;
    protected incrementing: boolean;
    protected perPage: number;
    protected with: string[];
    protected withCount: string[];
    protected timestamps: boolean;
    protected dateFormat: string;
    visible: string[];
    hidden: string[];
    static boot(): void;
    static make<T extends Model>(this: new () => T, attributes?: {}): T;
    constructor(attributes?: any);
    protected bootIfNotBooted(): void;
    protected initialize(): void;
    protected initializePlugins(): void;
    protected addPluginInitializer(method: any): void;
    protected newInstance(attributes?: {}, exists?: boolean): any;
    getKey(): string | number | null | undefined;
    getKeyName(): string;
    getConnectionName(): string;
    getConnection(): any;
    setConnection(connection: string): this;
    usesUniqueIds(): boolean;
    uniqueIds(): string[];
    newUniqueId(): string;
    setUniqueIds(): void;
    getKeyType(): string;
    getIncrementing(): boolean;
    setIncrementing(value: boolean): this;
    getTable(): string;
    setTable(table: string): this;
    getDates(): string[];
    getDateFormat(): string;
    getAttributes(): object;
    getAttribute(key: string): any;
    setAttribute(key: string, value: any): this;
    fill(attributes: any): this;
    setAppends(appends: string[]): this;
    append(key: string | string[]): this;
    getRelation<T extends Model>(relation: string): T | Collection<T> | null | undefined;
    setRelation<T extends Model>(relation: string, value: T | Collection<T> | null): this;
    unsetRelation(relation: string): this;
    relationLoaded(relation: string): boolean;
    makeVisible(attributes: string | string[]): this;
    makeHidden(attributes: string | string[]): this;
    newCollection(models?: any[]): Collection<this>;
    usesTimestamps(): boolean;
    updateTimestamps(): this;
    getCreatedAtColumn(): string;
    getUpdatedAtColumn(): string;
    getDeletedAtColumn(): string;
    setCreatedAt(value: string): this;
    setUpdatedAt(value: string): this;
    freshTimestamp(): Date;
    freshTimestampString(): string;
    fromDateTime(value: Date | number | null): string;
    toData(): any;
    attributesToData(): any;
    relationsToData(): any;
    toJSON(): any;
    toJson(): string;
    toString(): string;
    isDirty(attributes?: string | string[]): boolean;
    getDirty(): string[];
    is(model: this): boolean;
    isNot(model: this): boolean;
    hasOne<T extends Model>(model: new () => T, foreignKey?: string, localKey?: string): HasOne<T>;
    hasMany<T extends Model>(model: new () => T, foreignKey?: string, localKey?: string): HasMany<T>;
    belongsTo<T extends Model>(model: new () => T, foreignKey?: string, ownerKey?: string, relation?: string): BelongsTo<T>;
    belongsToMany<T extends Model>(model: new () => T, table?: string, foreignPivotKey?: string, relatedPivotKey?: string, parentKey?: string, relatedKey?: string): BelongsToMany<T>;
  }

  export class Pivot extends Model {}

  export class Collection<T> extends BaseCollection<T> {
    modelKeys(): string[] | number[];
    contains(key: Model | any, operator?: any, value?: any): boolean;
    diff(items: Collection<T> | any[]): Collection<T>;
    except(keys: any[]): Collection<T>;
    intersect(items: any[]): Collection<T>;
    unique(key?: any, strict?: boolean): Collection<T>;
    find(key: any, defaultValue?: any): any;
    makeVisible(attributes: string | string[]): this;
    makeHidden(attributes: string | string[]): this;
    append(attributes: string[]): this;
    only(keys: null | any[]): this;
    getDictionary(items?: any): any;
    toData(): any;
    toJSON(): any;
    toJson(): string;
    toString(): string;
    [Symbol.iterator](): Iterator<T>;
  }

  export class Paginator<T, K = {
    current_page: number,
    data: any[],
    per_page: number,
    total: number,
    last_page: number,
    count: number,
  }> {
    static formatter: (paginator: Paginator<any>) => any | null;
    static setFormatter(formatter: (paginator: Paginator<any>) => any | null): void;
    constructor(items: T[], total: number, perPage: number, currentPage?: null | number, options?: any);
    setItems(items: T[] | Collection<T>): void;
    hasMorePages(): boolean;
    get(index: number): T;
    count(): number;
    items(): Collection<T>;
    map<U>(callback: (value: T, index: number, array: T[]) => U): Collection<U>;
    currentPage(): number;
    perPage(): number;
    lastPage(): number;
    firstItem(): number | null;
    lastItem(): number | null;
    total(): number;
    toData<U = K>(): U;
    toJSON<U = K>(): U;
    toJson(): string;
    [Symbol.iterator](): { next: () => { value: T; done: boolean } };
  }
  export class RelationNotFoundError extends Error {}
  export class InvalidArgumentError extends Error {}

  export function make<T extends new (...args: any[]) => Model>(modelClass: T, attributes: Record<string, any>[]): Collection<T>;
  export function makeCollection<T extends new (...args: any[]) => Model>(modelClass: T, attributes: Record<string, any>[]): Collection<T>;
  export function makePaginator<T extends new (...args: any[]) => Model>(modelClass: T, attributes: Record<string, any>[]): Paginator<T>;

  export function HasUniqueIds<T extends new (...args: any[]) => Model>(Base: T): T & {
    new (...args: ConstructorParameters<T>): {
      useUniqueIds: boolean;
    };
  };

  export function getRelationMethod(name: string): string;
  export function getScopeMethod(name: string): string;
  export const compose: MixinFunction;

  export interface Plugin {
    <M extends typeof Model>(modelClass: M): M;
  }

  export interface MixinFunction {
    <MC extends AnyModelConstructor>(modelClass: MC, ...plugins: Plugin[]): MC;
  }

  export const isBrowser: boolean;
}
