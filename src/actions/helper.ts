import { ExcludeUnserializable } from "../shared.type";

export function excludeUnserializable<T>(value: T): ExcludeUnserializable<T> {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === null || value === undefined) {
    return value as ExcludeUnserializable<T>;
  }

  if (typeof value === "function" || typeof value === "symbol" || typeof value === "bigint") {
    return null as ExcludeUnserializable<T>;
  }

  if (Array.isArray(value)) {
    return value.map(excludeUnserializable) as ExcludeUnserializable<T>;
  }

  if (typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const key in value) {
      const serialized = excludeUnserializable(value[key]);
      result[key] = serialized;
    }
    return result as ExcludeUnserializable<T>;
  }

  return null as ExcludeUnserializable<T>;
}
