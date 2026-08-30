import type { JsonValue } from "../../contracts/src/index.ts";
import { JsonValueSchema } from "../../contracts/src/index.ts";

function sortJsonValue(value: JsonValue): JsonValue {
  if (Array.isArray(value)) {
    return value.map(sortJsonValue);
  }

  if (value !== null && typeof value === "object") {
    const sorted: { [key: string]: JsonValue } = {};

    for (const key of Object.keys(value).sort()) {
      const child = value[key];

      if (child !== undefined) {
        sorted[key] = sortJsonValue(child);
      }
    }

    return sorted;
  }

  return value;
}

export function canonicalizeJson(input: unknown): JsonValue {
  return sortJsonValue(JsonValueSchema.parse(input));
}

export function canonicalSerialize(input: unknown): string {
  return JSON.stringify(canonicalizeJson(input));
}
