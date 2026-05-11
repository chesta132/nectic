/** Utility type that removes all fields from `T` whose value type extend `U`. */
type OmitByValue<T, U> = {
  [K in keyof T as U extends T[K] ? never : K]: T[K];
};

/** Utility type that pick all fields from `T` whose value type extend `U`. */
type PickByValue<T, U> = {
  [K in keyof T as U extends T[K] ? K : never]: T[K];
};

/** Strict version OmitByValue. */
type OmitByValueStrict<T, U> = {
  [K in keyof T as T[K] extends U ? never : K]: T[K];
};

/** Strict version PickByValue. */
type PickByValueStrict<T, U> = {
  [K in keyof T as T[K] extends U ? K : never]: T[K];
};

/** Extracts the element type of an array `T`. */
type ExtractArray<T> = T extends (infer U)[] ? U : T;

/** Replaces all occurrences of substring `W` in string `S` with `R`. */
type ReplaceString<S extends string, F extends string, R extends string> = S extends `${infer First}${F}${infer Last}` ? `${First}${R}${Last}` : S;

/** Allows only one key of T to exist at a time. */
type OneFieldOnly<T extends Record<string, unknown>> = {
  [K in keyof T]: {
    [P in K]: T[P];
  } & {
    [P in Exclude<keyof T, K>]?: never;
  };
}[keyof T];

/** Requires at least one key from Keys to exist in T. */
type RequireAtLeastOne<T, Keys extends keyof T = keyof T> = Pick<T, Exclude<keyof T, Keys>> &
  {
    [K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>>;
  }[Keys];

/** Flattens a union type U into a single type. */
type MergeUnion<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void ? I : never;

/** Value of `T` */
type ValueOf<T> = T[keyof T];
