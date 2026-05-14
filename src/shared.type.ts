import z, { ZodType } from "zod";

/** Promise of `T` with union of `T` */
export type PromiseOrValue<T> = T | Promise<T>;

export type IsUnknown<T> = unknown extends T ? (keyof T extends never ? (T extends never ? false : true) : false) : false;

export type InferZodTypeInArray<Z extends readonly ZodType[]> = Z extends [infer First, ...infer Rest]
  ? First extends ZodType
    ? [z.infer<First>, ...InferZodTypeInArray<Rest extends ZodType[] ? Rest : []>]
    : []
  : [];

export type InputZodTypeInArray<Z extends readonly ZodType[]> = Z extends [infer First, ...infer Rest]
  ? First extends ZodType
    ? [z.input<First>, ...InferZodTypeInArray<Rest extends ZodType[] ? Rest : []>]
    : []
  : [];

export type ExcludeUnserializable<T> = T extends string | number | boolean | null | undefined
  ? T
  : T extends Function
    ? null
    : T extends symbol
      ? null
      : T extends bigint
        ? null
        : T extends readonly [...infer Items]
          ? { [K in keyof Items]: ExcludeUnserializable<Items[K]> }
          : T extends Array<infer Item>
            ? ExcludeUnserializable<Item>[]
            : T extends object
              ? { [K in keyof T as ExcludeUnserializable<T[K]> extends never ? never : K]: ExcludeUnserializable<T[K]> }
              : null;
