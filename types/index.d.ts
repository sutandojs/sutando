import { Knex } from 'knex';
import { Collection as BaseCollection } from 'collect.js';

declare module 'sutando' {
  type AnyQueryBuilder = QueryBuilder<any, any>;
  export type SchemaBuilder = Knex.SchemaBuilder;
  type Raw = Knex.Raw;
  type Trx = AnyQueryBuilder & {
    commit(): Promise<void>;
    rollback(): Promise<void>;
  };
  type Operator = string;
  type ColumnRef = string | Raw;
  type Expression<T> = T | Raw | AnyQueryBuilder;
  type FieldExpression = string;
  type NonFunctionPropertyNames<T> = { [K in keyof T]: T[K] extends Function ? never : K }[keyof T];
  type DataPropertyNames<T> = Exclude<NonFunctionPropertyNames<T>, 'AnyQueryBuilderType'>;
  type AnyQueryBuilderType<T extends Model> = T;
  type PartialModelObject<T extends Model> = {
    [K in DataPropertyNames<T>]?: Defined<T[K]> extends Model
      ? T[K]
      : Defined<T[K]> extends Array<infer I>
      ? I extends Model
        ? I[]
        : Expression<T[K]>
      : Expression<T[K]>;
  };

  type PrimitiveValue =
    | string
    | number
    | boolean
    | Date
    | string[]
    | number[]
    | boolean[]
    | Date[]
    | null
    | Buffer;

  type Defined<T> = Exclude<T, undefined>;

  interface CallbackVoid<T> {
    (this: T, arg: T): void;
  }
  interface RawInterface<R> {
    (sql: string, ...bindings: any[]): R;
  }
  interface Aliasable {
    as(alias: string): this;
  }

  type Selection<QB extends AnyQueryBuilder> = ColumnRef | AnyQueryBuilder | CallbackVoid<QB>;
  type JsonObjectOrFieldExpression = object | object[] | FieldExpression;

  interface SelectMethod<QB extends AnyQueryBuilder> {
    <QBP extends QB>(...columns: Selection<QBP>[]): QB;
    <QBP extends QB>(columns: Selection<QBP>[]): QB;
  }

  interface AsMethod<QB extends AnyQueryBuilder> {
    (alias: string): QB;
  }

  interface WhereMethod<QB extends AnyQueryBuilder> {
    (col: ColumnRef, op: Operator, expr: Expression<PrimitiveValue>): QB;
    (col: ColumnRef, expr: Expression<PrimitiveValue>): QB;

    (condition: boolean): QB;
    (cb: CallbackVoid<QB>): QB;
    (raw: Raw): QB;
    <QBA extends AnyQueryBuilder>(qb: QBA): QB;

    (obj: object): QB;
  }

  interface WhereRawMethod<QB extends AnyQueryBuilder> extends RawInterface<QB> {}

  interface WhereWrappedMethod<QB extends AnyQueryBuilder> {
    (cb: CallbackVoid<QB>): QB;
  }

  interface WhereExistsMethod<QB extends AnyQueryBuilder> {
    (cb: CallbackVoid<QB>): QB;
    (raw: Raw): QB;
    <QBA extends AnyQueryBuilder>(qb: QBA): QB;
  }

  interface WhereInMethod<QB extends AnyQueryBuilder> {
    (col: ColumnRef | ColumnRef[], expr: Expression<PrimitiveValue>[]): QB;
    (col: ColumnRef | ColumnRef[], cb: CallbackVoid<QB>): QB;
    (col: ColumnRef | ColumnRef[], qb: AnyQueryBuilder): QB;
  }

  interface WhereBetweenMethod<QB extends AnyQueryBuilder> {
    (column: ColumnRef, range: [Expression<PrimitiveValue>, Expression<PrimitiveValue>]): QB;
  }

  interface WhereNullMethod<QB extends AnyQueryBuilder> {
    (column: ColumnRef): QB;
  }

  interface WhereColumnMethod<QB extends AnyQueryBuilder> {
    (col1: ColumnRef, op: Operator, col2: ColumnRef): QB;
    (col1: ColumnRef, col2: ColumnRef): QB;
  }

  interface WhereJsonMethod<QB extends AnyQueryBuilder> {
    (
      fieldExpression: FieldExpression,
      jsonObjectOrFieldExpression: JsonObjectOrFieldExpression
    ): QB;
  }

  interface WhereFieldExpressionMethod<QB extends AnyQueryBuilder> {
    (fieldExpression: FieldExpression): QB;
  }

  interface WhereJsonExpressionMethod<QB extends AnyQueryBuilder> {
    (fieldExpression: FieldExpression, keys: string | string[]): QB;
  }

  interface WhereJsonField<QB extends AnyQueryBuilder> {
    (
      fieldExpression: FieldExpression,
      operator: string,
      value: boolean | number | string | null
    ): QB;
  }

  interface WhereCompositeMethod<QB extends AnyQueryBuilder> {
    (column: ColumnRef[], op: Operator, expr: Expression<PrimitiveValue>[]): QB;
    (column: ColumnRef, expr: Expression<PrimitiveValue>): QB;
    (column: ColumnRef, op: Operator, expr: Expression<PrimitiveValue>): QB;
    (column: ColumnRef[], expr: Expression<PrimitiveValue>[]): QB;
    (column: ColumnRef[], qb: AnyQueryBuilder): QB;
  }

  interface WhereInCompositeMethod<QB extends AnyQueryBuilder> {
    (column: ColumnRef, expr: Expression<PrimitiveValue>[]): QB;
    (column: ColumnRef, qb: AnyQueryBuilder): QB;
    (column: ColumnRef[], expr: Expression<PrimitiveValue>[][]): QB;
    (column: ColumnRef[], qb: AnyQueryBuilder): QB;
  }

  type QBOrCallback<QB extends AnyQueryBuilder> = AnyQueryBuilder | CallbackVoid<QB>;

  interface BaseSetOperations<QB extends AnyQueryBuilder> {
    (callbackOrBuilder: QBOrCallback<QB>, wrap?: boolean): QB;
    (callbacksOrBuilders: QBOrCallback<QB>[], wrap?: boolean): QB;
  }

  interface SetOperationsMethod<QB extends AnyQueryBuilder> extends BaseSetOperations<QB> {
    (...callbacksOrBuilders: QBOrCallback<QB>[]): QB;
  }

  interface UnionMethod<QB extends AnyQueryBuilder> extends BaseSetOperations<QB> {
    (arg1: QBOrCallback<QB>, wrap?: boolean): QB;
    (arg1: QBOrCallback<QB>, arg2: QBOrCallback<QB>, wrap?: boolean): QB;
    (arg1: QBOrCallback<QB>, arg2: QBOrCallback<QB>, arg3: QBOrCallback<QB>, wrap?: boolean): QB;
    (
      arg1: QBOrCallback<QB>,
      arg2: QBOrCallback<QB>,
      arg3: QBOrCallback<QB>,
      arg4: QBOrCallback<QB>,
      wrap?: boolean
    ): QB;
    (
      arg1: QBOrCallback<QB>,
      arg2: QBOrCallback<QB>,
      arg3: QBOrCallback<QB>,
      arg4: QBOrCallback<QB>,
      arg5: QBOrCallback<QB>,
      wrap?: boolean
    ): QB;
    (
      arg1: QBOrCallback<QB>,
      arg2: QBOrCallback<QB>,
      arg3: QBOrCallback<QB>,
      arg4: QBOrCallback<QB>,
      arg5: QBOrCallback<QB>,
      arg6: QBOrCallback<QB>,
      wrap?: boolean
    ): QB;
    (
      arg1: QBOrCallback<QB>,
      arg2: QBOrCallback<QB>,
      arg3: QBOrCallback<QB>,
      arg4: QBOrCallback<QB>,
      arg5: QBOrCallback<QB>,
      arg6: QBOrCallback<QB>,
      arg7: QBOrCallback<QB>,
      wrap?: boolean
    ): QB;
  }

  interface GroupByMethod<QB extends AnyQueryBuilder> {
    (...columns: ColumnRef[]): QB;
    (columns: ColumnRef[]): QB;
  }

  type OrderByDirection = 'asc' | 'desc' | 'ASC' | 'DESC';

  interface OrderByDescriptor {
    column: ColumnRef;
    order?: OrderByDirection;
  }

  type ColumnRefOrOrderByDescriptor = ColumnRef | OrderByDescriptor;

  interface OrderByMethod<QB extends AnyQueryBuilder> {
    (column: ColumnRef, order?: OrderByDirection): QB;
    (columns: ColumnRefOrOrderByDescriptor[]): QB;
  }

  interface OrderByRawMethod<QB extends AnyQueryBuilder> extends RawInterface<QB> {}

  export class sutando {
    static connectorFactory: any | null;
    static instance: sutando | null;
    static connection(connection?: string | null): AnyQueryBuilder;
    static setConnectorFactory(connectorFactory: any): void;
    static getConnectorFactory(): any;
    static getConnection(connection?: string | null): AnyQueryBuilder;
    static addConnection(config: object, name?: string): void;
    static beginTransaction(name?: string | null): Promise<Trx>;
    static transaction(callback: (trx: Trx) => Promise<any>, name?: string | null): any;
    static schema(name?: string | null): SchemaBuilder;
    static table(table: string, connection?: string): QueryBuilder<any>;
    static destroyAll(): Promise<void>;
    static createModel(name: string, options: any): typeof Model;
    manager: {
      [key: string]: AnyQueryBuilder
    };
    connections: {
      [key: string]: any
    };
    models: {
      [key: string]: typeof Model;
    };
    connection(connection?: string | null): AnyQueryBuilder;
    setConnectorFactory(connectorFactory: any): void;
    getConnectorFactory(): any;
    addConnection(config: object, name?: string): void;
    beginTransaction(name?: string | null): Promise<Trx>;
    transaction(callback: (trx: Trx) => Promise<any>, name?: string | null): any;
    schema(name?: string | null): SchemaBuilder;
    table(table: string, connection?: string): QueryBuilder<any>;
    destroyAll(): Promise<void>;
    createModel(name: string, options: any): typeof Model;
  }

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

  export class Relation<M> extends Builder<M, any> {
  }
  class HasOneOrMany<M> extends Relation<M> {
    save(model: M): Promise<M>;
    saveMany(models: M[] | Collection<M>): Promise<Collection<M>>;
    create(attributes?: any): Promise<M>;
    createMany(records: any[]): Promise<Collection<M>>;
  }
  export class HasOne<M> extends HasOneOrMany<M> {
    getResults(): Promise<M | null>;
    withDefault(callback?: Function | object): this;
  }
  export class HasMany<M> extends HasOneOrMany<M> {
    getResults(): Promise<Collection<M>>;
  }
  export class BelongsTo<M> extends Relation<M> {
    getResults(): Promise<M | null>;
    withDefault(callback?: Function | object): this;
  }
  export class BelongsToMany<M> extends Relation<M> {
    getResults(): Promise<Collection<M>>;
    withTimestamps(): this;
    wherePivot(column: any, operator?: any, value?: any, boolean?: string, ...args: any[]): this;
    wherePivotBetween(column: any, values: any, boolean?: string, not?: boolean): this;
    orWherePivotBetween(column: any, values: any): this;
    wherePivotNotBetween(column: any, values: any, boolean?: string): this;
    orWherePivotNotBetween(column: any, values: any): this;
    wherePivotIn(column: any, values: any, boolean?: string, not?: boolean): this;
    orWherePivot(column: any, operator?: any, value?: any): this;
    orWherePivotIn(column: any, values: any): this;
    wherePivotNotIn(column: any, values: any, boolean?: string): this;
    orWherePivotNotIn(column: any, values: any): this;
    wherePivotNull(column: any, boolean?: string, not?: boolean): this;
    wherePivotNotNull(column: any, boolean?: string): this;
    orWherePivotNull(column: any, not?: boolean): this;
    orWherePivotNotNull(column: any): this;
    orderByPivot(column: any, direction?: string): this;
  }

  // declare const model: ModelDecorator;
  type CamelToSnakeCase<S extends string> =
    S extends `${infer T}${infer U}` ?
    U extends Uncapitalize<U> ? `${Uncapitalize<T>}${CamelToSnakeCase<U>}` : `${Uncapitalize<T>}_${CamelToSnakeCase<U>}` :
    S;

  type FunctionPropertyNames<T> = {
    [K in keyof T]: T[K] extends (...args: any[]) => any ? K : never;
  }[keyof T];

  type RelationNames<T> = FunctionPropertyNames<T> extends infer R
    ? R extends `relation${infer P}` ? P extends ('sToData' | 'loaded') ? never : CamelToSnakeCase<P> : never
    : never;

  type SnakeToCamelCase<S extends string> =
    S extends `${infer T}_${infer U}` ? `${T}${Capitalize<SnakeToCamelCase<U>>}` : S;

  type ReturnTypeOfMethod<T, K extends keyof T> = T[K] extends (...args: any[]) => infer R ? R : never;

  type Hook = 'creating' | 'created' | 'updating' | 'updated' | 'saving' | 'saved' | 'deleting' | 'deleted' | 'restoring' | 'restored' | 'trashed' | 'forceDeleted';

  export class Model {
    // [value: string]: any | never;
    protected attributes: any;
    protected relations: any;
    public exists: boolean;
    protected primaryKey: string;
    protected builder: Builder<any, any>;
    protected table: string;
    protected connection: string;
    protected keyType: string;
    protected incrementing: boolean;
    protected perPage: number;
    protected with: string[];
    protected withCount: string[];
    protected trx: AnyQueryBuilder | null;
    protected timestamps: boolean;
    protected dateFormat: string;
    visible: string[];
    hidden: string[];
    static query<T extends { prototype: unknown }>(this: T, client?: AnyQueryBuilder | null): Builder<T['prototype']>;
    static on<T extends { prototype: unknown }>(this: T, connection: string | null): Builder<T['prototype']>;
    static boot(): void;
    static addHook(hook: Hook, callback: Function): void;
    static creating(callback: Function): void;
    static created(callback: Function): void;
    static updating(callback: Function): void;
    static updated(callback: Function): void;
    static deleting(callback: Function): void;
    static deleted(callback: Function): void;
    static saving(callback: Function): void;
    static saved(callback: Function): void;
    static restoring(callback: Function): void;
    static restored(callback: Function): void;
    static trashed(callback: Function): void;
    static forceDeleted(callback: Function): void;
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
    load(relations: WithRelationType): Promise<this>;
    load(...relations: WithRelationType[]): Promise<this>;
    loadAggregate(relations: WithRelationType, column: any, callback?: any): Promise<this>;
    loadCount(...relations: WithRelationType[]): Promise<this>;
    loadMax(relations: WithRelationType, column: string): Promise<this>;
    loadMin(relations: WithRelationType, column: string): Promise<this>;
    loadSum(relations: WithRelationType, column: string): Promise<this>;
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
    useSoftDeletes(): boolean;
    toData(): any;
    attributesToData(): any;
    relationsToData(): any;
    toJSON(): any;
    toJson(): string;
    toString(): string;
    isDirty(attributes?: string | string[]): boolean;
    getDirty(): string[];
    save(options?: any): Promise<boolean>;
    update(attributes?: any, options?: any): Promise<boolean>;
    increment(column: string, amount?: number, extra?: any): Promise<boolean>;
    decrement(column: string, amount?: number, extra?: any): Promise<boolean>;
    serializeDate(date: any): string;
    delete(options?: any): Promise<boolean>;
    softDelete(options?: any): Promise<boolean>;
    forceDelete(options?: any): Promise<boolean>;
    restore(options?: any): Promise<boolean>;
    trashed(): boolean;
    fresh(): Promise<this>;
    refresh(): Promise<this>;
    push(): Promise<boolean>;
    is(model: this): boolean;
    isNot(model: this): boolean;
    // related(relation: string): Builder<any>;
    // getRelated<T extends Model>(relation: string): Promise<this | Collection<T> | null>;
    related<T extends RelationNames<this>>(relation: T): ReturnTypeOfMethod<this, `relation${Capitalize<SnakeToCamelCase<T>>}`>;
    getRelated<T extends RelationNames<this>>(relation: T): ReturnTypeOfMethod<ReturnTypeOfMethod<this, `relation${Capitalize<SnakeToCamelCase<T>>}`>, 'getResults'>;
    hasOne<T extends Model>(model: new () => T, foreignKey?: string, localKey?: string): HasOne<T>;
    hasMany<T extends Model>(model: new () => T, foreignKey?: string, localKey?: string): HasMany<T>;
    belongsTo<T extends Model>(model: new () => T, foreignKey?: string, ownerKey?: string, relation?: string): BelongsTo<T>;
    belongsToMany<T extends Model>(model: new () => T, table?: string, foreignPivotKey?: string, relatedPivotKey?: string, parentKey?: string, relatedKey?: string): BelongsToMany<T>;
  }

  export class QueryBuilder<M, R = Collection<M> | Model> {
    schema: SchemaBuilder;
    table(name: string): this;
    select: SelectMethod<this>;
    columns: SelectMethod<this>;
    column: SelectMethod<this>;
    distinct: SelectMethod<this>;
    distinctOn: SelectMethod<this>;
    as: AsMethod<this>;

    where: WhereMethod<this>;
    andWhere: WhereMethod<this>;
    orWhere: WhereMethod<this>;
    whereNot: WhereMethod<this>;
    andWhereNot: WhereMethod<this>;
    orWhereNot: WhereMethod<this>;

    whereRaw: WhereRawMethod<this>;
    orWhereRaw: WhereRawMethod<this>;
    andWhereRaw: WhereRawMethod<this>;

    whereWrapped: WhereWrappedMethod<this>;
    havingWrapped: WhereWrappedMethod<this>;

    whereExists: WhereExistsMethod<this>;
    orWhereExists: WhereExistsMethod<this>;
    whereNotExists: WhereExistsMethod<this>;
    orWhereNotExists: WhereExistsMethod<this>;

    whereIn: WhereInMethod<this>;
    orWhereIn: WhereInMethod<this>;
    whereNotIn: WhereInMethod<this>;
    orWhereNotIn: WhereInMethod<this>;

    whereBetween: WhereBetweenMethod<this>;
    orWhereBetween: WhereBetweenMethod<this>;
    andWhereBetween: WhereBetweenMethod<this>;
    whereNotBetween: WhereBetweenMethod<this>;
    orWhereNotBetween: WhereBetweenMethod<this>;
    andWhereNotBetween: WhereBetweenMethod<this>;

    whereNull: WhereNullMethod<this>;
    orWhereNull: WhereNullMethod<this>;
    whereNotNull: WhereNullMethod<this>;
    orWhereNotNull: WhereNullMethod<this>;

    whereColumn: WhereColumnMethod<this>;
    orWhereColumn: WhereColumnMethod<this>;
    andWhereColumn: WhereColumnMethod<this>;
    whereNotColumn: WhereColumnMethod<this>;
    orWhereNotColumn: WhereColumnMethod<this>;
    andWhereNotColumn: WhereColumnMethod<this>;

    whereJsonIsArray: WhereFieldExpressionMethod<this>;
    orWhereJsonIsArray: WhereFieldExpressionMethod<this>;
    whereJsonNotArray: WhereFieldExpressionMethod<this>;
    orWhereJsonNotArray: WhereFieldExpressionMethod<this>;
    whereJsonIsObject: WhereFieldExpressionMethod<this>;
    orWhereJsonIsObject: WhereFieldExpressionMethod<this>;
    whereJsonNotObject: WhereFieldExpressionMethod<this>;
    orWhereJsonNotObject: WhereFieldExpressionMethod<this>;
    whereJsonHasAny: WhereJsonExpressionMethod<this>;
    orWhereJsonHasAny: WhereJsonExpressionMethod<this>;
    whereJsonHasAll: WhereJsonExpressionMethod<this>;
    orWhereJsonHasAll: WhereJsonExpressionMethod<this>;

    having: WhereMethod<this>;
    andHaving: WhereMethod<this>;
    orHaving: WhereMethod<this>;

    havingRaw: WhereRawMethod<this>;
    orHavingRaw: WhereRawMethod<this>;

    havingIn: WhereInMethod<this>;
    orHavingIn: WhereInMethod<this>;
    havingNotIn: WhereInMethod<this>;
    orHavingNotIn: WhereInMethod<this>;

    havingNull: WhereNullMethod<this>;
    orHavingNull: WhereNullMethod<this>;
    havingNotNull: WhereNullMethod<this>;
    orHavingNotNull: WhereNullMethod<this>;

    havingExists: WhereExistsMethod<this>;
    orHavingExists: WhereExistsMethod<this>;
    havingNotExists: WhereExistsMethod<this>;
    orHavingNotExists: WhereExistsMethod<this>;

    havingBetween: WhereBetweenMethod<this>;
    orHavingBetween: WhereBetweenMethod<this>;
    havingNotBetween: WhereBetweenMethod<this>;
    orHavingNotBetween: WhereBetweenMethod<this>;

    union: UnionMethod<this>;
    unionAll: UnionMethod<this>;
    intersect: SetOperationsMethod<this>;

    orderBy: OrderByMethod<this>;
    orderByRaw: OrderByRawMethod<this>;

    groupBy: GroupByMethod<this>;
    groupByRaw: RawInterface<this>;

    beginTransaction(): Promise<Trx>;
    transaction(callback: (trx: Trx) => Promise<any>): Promise<any>;
    destroy(): void;

    raw(sql: string, bindings?: any[]): Raw;
    get(columns?: string[]): Promise<any[] | Collection<M>>;
    find(key: string | number, columns?: string[]): any;
    exists(): Promise<boolean>;
    count(column?: string): Promise<number>;
    min(column: string): Promise<number>;
    max(column: string): Promise<number>;
    sum(column: string): Promise<number>;
    avg(column: string): Promise<number>;
    skip(count: number): this;
    take(count: number): this;
    limit(count: number): this;
    offset(count: number): this;
    chunk(count: number, callback: (rows: M[] | Collection<M>) => any): Promise<boolean>;
    forPage(page: number, perPage?: number): this;
    paginate(page: number, perPage?: number): Promise<Paginator<M>>;
  }

  type WithRelationType = {
    [key: string]: <T extends Builder<any>>(builder: T) => T | void;
  } | string | string[];

  export class Builder<M, R = Collection<M> | Model> extends QueryBuilder<M, R> {
    protected asProxy(): ProxyConstructor;
    chunk(count: number, callback: (rows: Collection<M>) => any): Promise<boolean>;
    enforceOrderBy(): void;
    clone(): Builder<M, R>;
    forPage(page: number, perPage?: number): this;
    insert(attributes: any): Promise<any>;
    update(attributes: any): Promise<any>;
    increment(column: string, amount?: number, extra?: any): Promise<any>;
    decrement(column: string, amount?: number, extra?: any): Promise<any>;
    addUpdatedAtColumn(values: any): any;
    delete(): Promise<any>;
    softDelete(): Promise<any>;
    forceDelete(): Promise<any>;
    restore(): Promise<any>;
    withTrashed(): this;
    withoutTrashed(): this;
    onlyTrashed(): this;
    getDeletedAtColumn(): string;
    create(attributes?: any): Promise<M>;
    newModelInstance(attributes?: any): M;
    count(columns?: string): Promise<number>;
    getQuery(): AnyQueryBuilder;
    getModel(): M;
    setModel(model: Model): this;
    setTable(table: string): this;
    applyScopes(): this;
    scopes(scopes: string[]): this;
    withGlobalScope(identifier: string | number, scope: string | (() => void)): this;
    withoutGlobalScope(identifier: string | number): this;
    with(relation: WithRelationType): this;
    with(...relations: WithRelationType[]): this;
    has(relation: string, operator?: any, count?: number, boolean?: any, callback?: (builder: Builder<any>) => void | null): this;
    orHas(relation: string, operator?: any, count?: number): this;
    doesntHave(relation: string, boolean?: any, callback?: (builder: Builder<any>) => void | null): this;
    orDoesntHave(relation: string): this;
    whereHas(relation: string, callback?: (builder: Builder<any>) => void | Builder<any> | null, operator?: any, count?: number): this;
    orWhereHas(relation: string, callback?: (builder: Builder<any>) => void | Builder<any> | null, operator?: any, count?: number): this;
    whereRelation(relation: string, column: string, operator?: any, value?: any): this;
    hasNested(relation: string, operator?: any, count?: number, boolean?: any, callback?: (builder: Builder<any>) => void | null): this;
    canUseExistsForExistenceCheck(operator: string, count: number): boolean;
    addHasWhere(hasQuery, relation, operator, count, boolean): this;
    withAggregate(relations: string | string[] | object, column: string, action?: string | null): this;
    toSql(): object;
    withCount(...relations: WithRelationType[]): this;
    withMax(relation: WithRelationType, column: string): this;
    withMin(relation: WithRelationType, column: string): this;
    withAvg(relation: WithRelationType, column: string): this;
    withSum(relation: WithRelationType, column: string): this;
    withExists(relation: WithRelationType): this;
    related(relation: string): this;
    take(count: number): this;
    skip(count: number): this;
    limit(count: number): this;
    offset(count: number): this;
    first(column?: string | string[]): Promise<M | null>;
    firstOrFail(column?: string | string[]): Promise<M>;
    findOrFail(key: string | number, columns?: string[]): Promise<M>;
    findOrFail(key: string[] | number[] | Collection<any>, columns?: string[]): Promise<Collection<M>>;
    findOrFail(key: string | number | string[] | number[] | Collection<any>, columns?: string[]): Promise<M | Collection<M>>;
    findOrNew(id: string | number, columns?: string[]): Promise<M>;
    firstOrNew(attributes?: object, values?: object): Promise<M>;
    firstOrCreate(attributes?: object, values?: object): Promise<M>;
    updateOrCreate(attributes: object, values?: object): Promise<M>;
    latest(column?: string): this;
    oldest(column?: string): this;
    find(key: string | number, columns?: string[]): Promise<M | null>;
    find(key: string[] | number[] | Collection<any>, columns?: string[]): Promise<Collection<M>>;
    find(key: string | number | string[] | number[] | Collection<any>, columns?: string[]): Promise<M | Collection<M> | null>;
    findMany(keys: string[] | number[] | Collection<any>, columns?: string[]): Promise<Collection<M>>;
    pluck(column: string): Promise<Collection<any>>;
    destroy(ids: string | number | string[] | number[] | Collection<any>): Promise<number>;
    get(columns?: string[]): Promise<Collection<M>>;
    all(columns?: string[]): Promise<Collection<M>>;
    paginate(page?: number, perPage?: number): Promise<Paginator<M>>;
    [value: string]: any;
  }

  export class Scope {
    apply(builder: Builder<any>, model: Model): void;
  }

  export class Collection<T> extends BaseCollection<T> {
    load(...relations: WithRelationType[]): Promise<this>;
    loadAggregate(relations: string | string[], column: string, action?: string | null): Promise<this>;
    loadCount(relation: string, column: string): Promise<this>;
    loadMax(relation: string, column: string): Promise<this>;
    loadMin(relation: string, column: string): Promise<this>;
    loadSum(relation: string, column: string): Promise<this>;
    loadAvg(relation: string, column: string): Promise<this>;
    mapThen(callback: () => void): Promise<any>;
    modelKeys(): string[] | number[];
    contains(key: Model | any, operator?: any, value?: any): boolean;
    diff(items: Collection<T> | any[]): Collection<T>;
    except(keys: any[]): Collection<T>;
    intersect(items: any[]): Collection<T>;
    unique(key?: any, strict?: boolean): Collection<T>;
    find(key: any, defaultValue?: any): any;
    fresh(withs?: any[]): Promise<Collection<T>>;
    makeVisible(attributes: string | string[]): this;
    makeHidden(attributes: string | string[]): this;
    append(attributes: string[]): this;
    only(keys: null | any[]): this;
    getDictionary(items?: any): any;
    toQuery(): Builder<T, any>;
    toData(): any;
    toJSON(): any;
    toJson(): string;
    toString(): string;
  }

  export class Paginator<T> {
    constructor(items: T[], total: number, perPage: number, currentPage?: null | number, options?: any);
    setItems(items: T[] | Collection<T>): void;
    hasMorePages(): boolean;
    get(index: number): T;
    count(): number;
    items: T[];
    map<U>(callback: (value: T, index: number, array: T[]) => U): Collection<U>;
    currentPage(): number;
    perPage(): number;
    lastPage(): number;
    total(): number;
    toData(): {
      current_page: number,
      data: any[],
      per_page: number,
      total: number,
      last_page: number,
      count: number,
    };
    toJSON(): {
      current_page: number,
      data: any[],
      per_page: number,
      total: number,
      last_page: number,
      count: number,
    };
    toJson(): string;
    [Symbol.iterator](): { next: () => { value: T; done: boolean } };
  }
  export class ModelNotFoundError extends Error {
    protected model: Model;
    protected ids: string[] | number[];
    setModel(model: Model, ids?: string[] | number[]): this;
    getModel(): Model;
    getIds(): string[] | number[];
  }
  export class RelationNotFoundError extends Error {}
  export class InvalidArgumentError extends Error {}

  export function HasUniqueIds<T extends new (...args: any[]) => Model>(Base: T): T & {
    new (...args: ConstructorParameters<T>): {
      useUniqueIds: boolean;
    };
  };

  export interface ISoftDeletes {
    new (...args: ConstructorParameters<T>): {
      forceDeleting: boolean;
      initializeSoftDeletes(): void;
      forceDelete(): Promise<boolean>;
      forceDeleteQuietly(): any;
      performDeleteOnModel(options?: {}): Promise<any>;
      exists: boolean;
      runSoftDelete(options?: {}): Promise<void>;
      restore(options?: any): Promise<any>;
      restoreQuietly(): any;
      trashed(): boolean;
      isForceDeleting(): boolean;
      getDeletedAtColumn(): any;
      getQualifiedDeletedAtColumn(): any;
    };
    bootSoftDeletes(): void;
    softDeleted(callback: Function): void;
    restoring(callback: Function): void;
    restored(callback: Function): void;
    forceDeleting(callback: Function): void;
    forceDeleted(callback: Function): void;
  }

  export function SoftDeletes<T extends new (...args: any[]) => Model>(Base: T): T & ISoftDeletes;

  export class Migration {
    protected connection: AnyQueryBuilder;
    getConnection(): AnyQueryBuilder;
    up(schema: SchemaBuilder, connection?: AnyQueryBuilder): Promise<any>;
    down(schema: SchemaBuilder, connection?: AnyQueryBuilder): Promise<any>;
  }

  export function getRelationMethod(name: string): string;
  export function getScopeMethod(name: string): string;
}
