import z, { ZodType } from "zod";

/** Promise of `T` with union of `T` */
export type PromiseOrValue<T> = T | Promise<T>;

export type IsUnknown<T> = unknown extends T ? (keyof T extends never ? (T extends never ? false : true) : false) : false;

export type InferZodTypeInArray<Z extends readonly ZodType[]> = Z extends [infer First, ...infer Rest]
  ? First extends ZodType
    ? [z.infer<First>, ...InferZodTypeInArray<Rest extends ZodType[] ? Rest : []>]
    : []
  : [];

export type IsPrefixOf<Prefix extends readonly any[], Full extends readonly any[]> = Prefix extends readonly []
  ? true
  : Full extends readonly []
    ? false
    : Prefix extends readonly [infer PHead, ...infer PTail]
      ? Full extends readonly [infer FHead, ...infer FTail]
        ? [PHead] extends [FHead]
          ? PTail extends readonly any[]
            ? FTail extends readonly any[]
              ? IsPrefixOf<PTail, FTail>
              : false
            : false
          : false
        : false
      : false;

type IsSerializable<T> = T extends string | number | boolean | null | undefined
  ? true
  : T extends Function
    ? false
    : T extends symbol
      ? false
      : T extends bigint
        ? false
        : T extends Array<infer Item>
          ? IsSerializable<Item>
          : T extends object
            ? { [K in keyof T]-?: IsSerializable<T[K]> }[keyof T] extends false
              ? false
              : true
            : false;

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
