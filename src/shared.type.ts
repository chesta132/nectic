import z, { ZodType } from "zod";

/** Promise of `T` with union of `T` */
export type PromiseOrValue<T> = T | Promise<T>;

export type IsUnknown<T> = unknown extends T ? (keyof T extends never ? (T extends never ? false : true) : false) : false;

export type InferZodTypeInArray<Z extends readonly ZodType[]> = Z extends [infer First, ...infer Rest]
  ? First extends ZodType
    ? [z.infer<First>, ...InferZodTypeInArray<Rest extends ZodType[] ? Rest : []>]
    : []
  : [];
