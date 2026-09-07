import type {
  RecoveryHttpRequest,
  RecoveryTransport,
  RecoveryTransportResult
} from "../../../packages/recovery-core/src/index.ts";

export type RecoveryChaosPhase =
  | "BEFORE_SEND"
  | "REQUEST_SENT"
  | "SERVER_COMMITTED"
  | "SERVER_NOT_COMMITTED"
  | "RESPONSE_PENDING"
  | "RESPONSE_DROPPED"
  | "OFFLINE"
  | "RECONNECTED"
  | "RESPONSE_DELIVERED";

export type RecoveryChaosDirective =
  | "NOT_SENT_OFFLINE"
  | "COMMIT_THEN_DROP_RESPONSE"
  | "DO_NOT_COMMIT_AND_DROP_RESPONSE"
  | "DELIVER_RESPONSE";

/**
 * Deterministic, test-only transport failpoint harness. It has no production
 * route or runtime hook and advances only through an explicit directive list.
 */
export class DeterministicRecoveryChaosTransport implements RecoveryTransport {
  readonly #directives: RecoveryChaosDirective[];
  readonly #delegate: RecoveryTransport;
  readonly trace: RecoveryChaosPhase[] = [];
  readonly requests: RecoveryHttpRequest[] = [];

  constructor(input: {
    directives: readonly RecoveryChaosDirective[];
    delegate: RecoveryTransport;
  }) {
    this.#directives = [...input.directives];
    this.#delegate = input.delegate;
  }

  reconnect(): void {
    this.trace.push("RECONNECTED");
  }

  async send(request: RecoveryHttpRequest): Promise<RecoveryTransportResult> {
    const directive = this.#directives.shift() ?? "DELIVER_RESPONSE";
    this.requests.push(structuredClone(request));

    if (directive === "NOT_SENT_OFFLINE") {
      this.trace.push("BEFORE_SEND", "OFFLINE");
      return { kind: "NOT_SENT", failure: "KNOWN_OFFLINE" };
    }

    this.trace.push("REQUEST_SENT");
    if (directive === "DO_NOT_COMMIT_AND_DROP_RESPONSE") {
      this.trace.push(
        "SERVER_NOT_COMMITTED",
        "RESPONSE_PENDING",
        "RESPONSE_DROPPED",
        "OFFLINE"
      );
      return {
        kind: "AMBIGUOUS_TRANSPORT_FAILURE",
        failure: "BEFORE_RESPONSE_CERTAINTY"
      };
    }

    const result = await this.#delegate.send(request);
    if (directive === "COMMIT_THEN_DROP_RESPONSE") {
      this.trace.push(
        "SERVER_COMMITTED",
        "RESPONSE_PENDING",
        "RESPONSE_DROPPED",
        "OFFLINE"
      );
      return {
        kind: "AMBIGUOUS_TRANSPORT_FAILURE",
        failure: "BEFORE_RESPONSE_CERTAINTY"
      };
    }

    this.trace.push("RESPONSE_PENDING", "RESPONSE_DELIVERED");
    return result;
  }
}

export const V2_014B_CHAOS_PORTABILITY_EXPECTED =
  '{"results":["NOT_SENT","AMBIGUOUS_TRANSPORT_FAILURE","HTTP_RESPONSE"],"trace":["BEFORE_SEND","OFFLINE","RECONNECTED","REQUEST_SENT","SERVER_NOT_COMMITTED","RESPONSE_PENDING","RESPONSE_DROPPED","OFFLINE","RECONNECTED","REQUEST_SENT","RESPONSE_PENDING","RESPONSE_DELIVERED"],"request_count":3}' as const;

export async function createV2014bChaosPortabilitySnapshot() {
  const request: RecoveryHttpRequest = {
    method: "GET",
    path: "/v1/sessions/session.synthetic.recovery/state",
    headers: { "X-Api-Schema-Version": "1.0" }
  };
  const transport = new DeterministicRecoveryChaosTransport({
    directives: [
      "NOT_SENT_OFFLINE",
      "DO_NOT_COMMIT_AND_DROP_RESPONSE",
      "DELIVER_RESPONSE"
    ],
    delegate: {
      async send() {
        return { kind: "HTTP_RESPONSE", status: 200, body: { safe: true } };
      }
    }
  });
  const results: RecoveryTransportResult[] = [];
  results.push(await transport.send(request));
  transport.reconnect();
  results.push(await transport.send(request));
  transport.reconnect();
  results.push(await transport.send(request));
  return {
    results: results.map((result) => result.kind),
    trace: transport.trace,
    request_count: transport.requests.length
  };
}
