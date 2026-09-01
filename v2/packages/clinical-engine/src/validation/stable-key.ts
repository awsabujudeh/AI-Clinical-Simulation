function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(record).sort().map((key) => [key, canonicalize(record[key])])
    );
  }
  return value;
}

/** Deterministic, locale-neutral key for already validated JSON-only data. */
export function stableJsonKey(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}
