/**
 * Only pick some fields in object, other properties will deleted.
 *
 * @param data - Object to initiate.
 * @param picks - Keys of data to pick.
 * @returns The object with only picked properties.
 */
export const pick = <T extends Record<string, any>, Z extends (keyof T)[] = []>(data: T, picks?: Z): Pick<T, Z[number]> => {
  const pickedData = { ...data };
  if (picks)
    for (const pick of Object.keys(pickedData)) {
      if (!picks.includes(pick as keyof object)) {
        delete pickedData[pick as keyof object];
      }
    }
  return pickedData;
};

/**
 * Only omit some fields in object, other properties will remain.
 *
 * @param data - Object to initiate.
 * @param omits - Keys of data to omit.
 * @returns The object with omitted properties.
 */
export const omit = <T extends Record<string, any>, Z extends (keyof T)[] = []>(data: T, omits?: Z): Omit<T, Z[number]> => {
  const omittedData = { ...data };
  if (omits)
    for (const omit of omits) {
      delete omittedData[omit];
    }
  return omittedData;
};

/**
 * Creates a new object with the same keys as the given data,
 * but all values replaced with a fixed type/value.
 *
 * @param data - Array of strings or object to get the keys from
 * @param value - The value or type to assign to each key
 * @returns A new object where each key has the same value `value`
 *
 * @example
 * ```ts
 * // From array
 * const arr = ['foo', 'bar', 'baz'] as const;
 * const rec1 = record(arr, 0); // { foo: number; bar: number; baz: number }
 * // rec1 = { foo: 0, bar: 0, baz: 0 }
 *
 * // From object
 * const obj = { foo: 1, bar: "yo" };
 * const rec2 = record(obj, false); // { foo: boolean; bar: boolean }
 * // rec2 = { foo: false, bar: false }
 * ```
 */
export function record<K extends string, Z>(data: Record<K, any> | K[], value: Z): Record<K, Z> {
  if (Array.isArray(data)) {
    const builded = {} as Record<(typeof data)[number], Z>;
    data.forEach((k: keyof typeof builded) => {
      builded[k] = value;
    });
    return builded;
  } else {
    const builded = { ...data } as Record<string, any>;
    Object.keys(builded).forEach((key) => {
      builded[key] = value;
    });
    return builded;
  }
}
