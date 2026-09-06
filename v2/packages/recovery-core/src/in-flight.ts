export type InFlightResult<T> =
  | { success: true; value: T }
  | { success: false; code: "IN_FLIGHT_CONFLICT" | "IN_FLIGHT_CAPACITY" };

type InFlightRecord<T> = Readonly<{
  canonical_request: string;
  promise: Promise<T>;
}>;

/** UX de-duplication only. Durable correctness remains server-side. */
export class BoundedInFlightRegistry {
  readonly #entries = new Map<string, InFlightRecord<unknown>>();

  constructor(readonly maximumEntries = 32) {
    if (!Number.isInteger(maximumEntries) || maximumEntries < 1 || maximumEntries > 128) {
      throw new Error("In-flight registry capacity must be an integer from 1 to 128.");
    }
  }

  run<T>(input: {
    key: string;
    canonical_request: string;
    operation: () => Promise<T>;
  }): InFlightResult<Promise<T>> {
    const prior = this.#entries.get(input.key);
    if (prior !== undefined) {
      return prior.canonical_request === input.canonical_request
        ? { success: true, value: prior.promise as Promise<T> }
        : { success: false, code: "IN_FLIGHT_CONFLICT" };
    }
    if (this.#entries.size >= this.maximumEntries) {
      return { success: false, code: "IN_FLIGHT_CAPACITY" };
    }
    const promise = input.operation().finally(() => {
      const current = this.#entries.get(input.key);
      if (current?.promise === promise) this.#entries.delete(input.key);
    });
    this.#entries.set(input.key, {
      canonical_request: input.canonical_request,
      promise
    });
    return { success: true, value: promise };
  }

  get size() {
    return this.#entries.size;
  }
}
