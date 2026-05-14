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
