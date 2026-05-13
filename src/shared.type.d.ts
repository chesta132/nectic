/** Promise of `T` with union of `T` */
export type PromiseOrValue<T> = T | Promise<T>;

export type IsUnknown<T> = unknown extends T ? (keyof T extends never ? (T extends never ? false : true) : false) : false;
