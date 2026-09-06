import { describe, expect, it } from "vitest";

import {
  MUTATION_RECONCILIATION_MAX_ATTEMPTS,
  RecoveryJournalEntryIdSchema
} from "../../../packages/contracts/src/index.ts";
import { canonicalSerialize } from "../../../packages/case-schema/src/index.ts";
import {
  BoundedInFlightRegistry,
  InMemoryRecoveryStorageAdapter,
  canonicalRecoveryRequest,
  classifyApiResponse,
  createInDoubtEntry,
  createRecoveryCoordinator,
  incrementRecoveryAttempt,
  readRetryDelayMilliseconds,
  recoveryJournalEntryId,
  reduceConnectivityState,
  shouldRetrySafeRead,
  toMutationHttpRequest,
  validateStoredEntry,
  type RecoveryTransport
} from "../../../packages/recovery-core/src/index.ts";
import {
  RECOVERY_LATER_TIME,
  RECOVERY_OTHER_PRINCIPAL,
  RECOVERY_TEST_PRINCIPAL,
  RECOVERY_TEST_TIME,
  V2_014A_PORTABILITY_EXPECTED,
  createActionRecoveryRequest,
  createStartRecoveryRequest,
  createV2014aPortabilitySnapshot
} from "../../fixtures/recovery/synthetic-recovery.ts";

const noDelay = { async wait() {} };

function ambiguousTransport(counter = { sends: 0 }): RecoveryTransport {
  return {
    async send() {
      counter.sends += 1;
      return {
        kind: "AMBIGUOUS_TRANSPORT_FAILURE",
        failure: "BEFORE_RESPONSE_CERTAINTY"
      };
    }
  };
}

describe("V2-014A connectivity and retry policy", () => {
  it("uses deterministic explicit connectivity transitions", () => {
    expect(reduceConnectivityState("ONLINE", "NAVIGATOR_REPORTED_OFFLINE"))
      .toBe("OFFLINE_OR_UNREACHABLE");
    expect(reduceConnectivityState("OFFLINE_OR_UNREACHABLE", "RECOVERY_STARTED"))
      .toBe("RECOVERING");
    expect(reduceConnectivityState("RECOVERING", "AUTHORITATIVE_SYNC_REQUIRED"))
      .toBe("SYNC_REQUIRED");
    expect(reduceConnectivityState("SYNC_REQUIRED", "AUTHORITATIVE_SYNC_COMPLETED"))
      .toBe("ONLINE");
  });

  it("does not treat a browser online hint as authoritative connectivity", () => {
    expect(reduceConnectivityState("OFFLINE_OR_UNREACHABLE", "NAVIGATOR_REPORTED_ONLINE"))
      .toBe("RECOVERING");
    expect(reduceConnectivityState("RECOVERING", "REQUEST_SUCCEEDED")).toBe("ONLINE");
  });

  it("fails closed for invalid connectivity input", () => {
    expect(reduceConnectivityState("CONNECTED", "REQUEST_SUCCEEDED")).toBeUndefined();
    expect(reduceConnectivityState("ONLINE", "MAGIC_SIGNAL")).toBeUndefined();
  });

  it("bounds safe-read retries and uses deterministic backoff", () => {
    expect([1, 2, 3].map(readRetryDelayMilliseconds)).toEqual([0, 250, 1_000]);
    expect(shouldRetrySafeRead({ attempt: 1, result: "NETWORK_FAILURE" })).toBe(true);
    expect(shouldRetrySafeRead({ attempt: 2, result: "DEPENDENCY_UNAVAILABLE" })).toBe(true);
    expect(shouldRetrySafeRead({ attempt: 3, result: "NETWORK_FAILURE" })).toBe(false);
    expect(shouldRetrySafeRead({ attempt: 1, result: "SEMANTIC_RESPONSE" })).toBe(false);
  });

  it("does not blindly retry authentication, authorization, or stale responses", () => {
    expect(classifyApiResponse(401, "AUTHENTICATION_REQUIRED"))
      .toBe("AUTHENTICATION_EXPIRED");
    expect(classifyApiResponse(403, "AUTHORIZATION_DENIED")).toBe("AUTHORIZATION_FAILURE");
    expect(classifyApiResponse(409, "SESSION_VERSION_CONFLICT")).toBe("STALE_CONFLICT");
    expect(classifyApiResponse(409, "IDEMPOTENCY_CONFLICT")).toBe("IDEMPOTENCY_CONFLICT");
    expect(classifyApiResponse(503, "DEPENDENCY_UNAVAILABLE"))
      .toBe("DEPENDENCY_UNAVAILABLE");
  });
});

describe("V2-014A exact recovery request identity", () => {
  it("canonicalizes the same logical request independently of object insertion order", () => {
    const request = createStartRecoveryRequest();
    const reordered = {
      request: {
        mode: request.request.mode,
        case_id: request.request.case_id,
        client_capabilities: {
          supports_audio: false,
          supports_static_visual_fallback: true
        },
        patient_language: request.request.patient_language
      },
      operation: request.operation,
      idempotency_key: request.idempotency_key,
      correlation_id: request.correlation_id,
      request_id: request.request_id,
      api_schema_version: request.api_schema_version,
      recovery_schema_version: request.recovery_schema_version
    } as typeof request;
    expect(canonicalRecoveryRequest(reordered)).toBe(canonicalRecoveryRequest(request));
  });

  it("preserves the exact idempotency key and request body in the transport request", () => {
    const request = createActionRecoveryRequest({ session_id: "session.recovery.transport" });
    const transport = toMutationHttpRequest(request);
    expect(transport.headers["Idempotency-Key"]).toBe(request.idempotency_key);
    expect(transport.body).toBe(canonicalSerialize(request.request));
    expect(transport).not.toHaveProperty("authorization");
  });

  it("derives stable journal identity without prototype-key hazards", () => {
    const request = createStartRecoveryRequest("case.synthetic-assessment", "constructor");
    const id = recoveryJournalEntryId(RECOVERY_TEST_PRINCIPAL, request);
    expect(RecoveryJournalEntryIdSchema.safeParse(id).success).toBe(true);
    expect(id).toContain(":constructor");
  });

  it("detects canonical-request tampering", () => {
    const request = createStartRecoveryRequest();
    const entry = createInDoubtEntry({
      principal_user_id: RECOVERY_TEST_PRINCIPAL,
      request,
      attempted_at_utc: RECOVERY_TEST_TIME
    });
    expect(entry).toBeDefined();
    expect(validateStoredEntry({ ...entry, canonical_request: "{}" })).toEqual({
      success: false,
      reason: "CANONICAL_REQUEST_MISMATCH"
    });
  });

  it("keeps mutation attempt counting bounded", () => {
    const request = createStartRecoveryRequest();
    const first = createInDoubtEntry({
      principal_user_id: RECOVERY_TEST_PRINCIPAL,
      request,
      attempted_at_utc: RECOVERY_TEST_TIME
    })!;
    const second = incrementRecoveryAttempt(first, RECOVERY_LATER_TIME)!;
    const third = incrementRecoveryAttempt(second, RECOVERY_LATER_TIME)!;
    expect(third.attempt_count).toBe(MUTATION_RECONCILIATION_MAX_ATTEMPTS);
    expect(incrementRecoveryAttempt(third, RECOVERY_LATER_TIME)).toBeUndefined();
  });
});

describe("V2-014A journal, offline, and de-duplication semantics", () => {
  it("returns NOT_SENT offline without sending or creating an offline queue", async () => {
    const sends = { sends: 0 };
    const storage = new InMemoryRecoveryStorageAdapter();
    const coordinator = createRecoveryCoordinator({
      storage,
      transport: ambiguousTransport(sends),
      delay: noDelay
    });
    const result = await coordinator.submitMutation({
      principal_user_id: RECOVERY_TEST_PRINCIPAL,
      connectivity_state: "OFFLINE_OR_UNREACHABLE",
      attempted_at_utc: RECOVERY_TEST_TIME,
      request: createStartRecoveryRequest()
    });
    expect(result.outcome?.status).toBe("NOT_SENT");
    expect(sends.sends).toBe(0);
    expect(await storage.listJournalEntries({ principal_user_id: RECOVERY_TEST_PRINCIPAL }))
      .toHaveLength(0);
  });

  it("journals before send and preserves an unresolved ambiguous mutation", async () => {
    const storage = new InMemoryRecoveryStorageAdapter();
    const request = createStartRecoveryRequest();
    const coordinator = createRecoveryCoordinator({
      storage,
      transport: ambiguousTransport(),
      delay: noDelay
    });
    const result = await coordinator.submitMutation({
      principal_user_id: RECOVERY_TEST_PRINCIPAL,
      connectivity_state: "ONLINE",
      attempted_at_utc: RECOVERY_TEST_TIME,
      request
    });
    const records = await storage.listJournalEntries({
      principal_user_id: RECOVERY_TEST_PRINCIPAL
    });
    expect(result.outcome?.status).toBe("IN_DOUBT");
    expect(records).toHaveLength(1);
    expect((records[0] as { canonical_request: string }).canonical_request)
      .toBe(canonicalRecoveryRequest(request));
  });

  it("bounds repeated exact in-doubt submissions instead of creating a fresh retry", async () => {
    const sends = { sends: 0 };
    const storage = new InMemoryRecoveryStorageAdapter();
    const coordinator = createRecoveryCoordinator({
      storage,
      transport: ambiguousTransport(sends),
      delay: noDelay
    });
    const input = {
      principal_user_id: RECOVERY_TEST_PRINCIPAL,
      connectivity_state: "ONLINE",
      attempted_at_utc: RECOVERY_TEST_TIME,
      request: createStartRecoveryRequest()
    } as const;
    expect((await coordinator.submitMutation(input)).outcome?.status).toBe("IN_DOUBT");
    expect((await coordinator.submitMutation({ ...input, attempted_at_utc: RECOVERY_LATER_TIME }))
      .outcome?.status).toBe("IN_DOUBT");
    expect((await coordinator.submitMutation({ ...input, attempted_at_utc: RECOVERY_LATER_TIME }))
      .outcome?.status).toBe("IN_DOUBT");
    expect((await coordinator.submitMutation({ ...input, attempted_at_utc: RECOVERY_LATER_TIME }))
      .outcome?.status).toBe("RETRY_LIMIT_REACHED");
    expect(sends.sends).toBe(3);
  });

  it("rejects a changed canonical request under the same local identity", async () => {
    const sends = { sends: 0 };
    const storage = new InMemoryRecoveryStorageAdapter();
    const coordinator = createRecoveryCoordinator({
      storage,
      transport: ambiguousTransport(sends),
      delay: noDelay
    });
    const first = createStartRecoveryRequest("case.synthetic-assessment", "idempotency.same");
    await coordinator.submitMutation({
      principal_user_id: RECOVERY_TEST_PRINCIPAL,
      connectivity_state: "ONLINE",
      attempted_at_utc: RECOVERY_TEST_TIME,
      request: first
    });
    const changed = createStartRecoveryRequest("case.changed", "idempotency.same");
    const result = await coordinator.submitMutation({
      principal_user_id: RECOVERY_TEST_PRINCIPAL,
      connectivity_state: "ONLINE",
      attempted_at_utc: RECOVERY_LATER_TIME,
      request: changed
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.issue.code).toBe("LOCAL_IDEMPOTENCY_CONFLICT");
    expect(sends.sends).toBe(1);
  });

  it("requires restored verified authentication before reconciliation", async () => {
    const sends = { sends: 0 };
    const storage = new InMemoryRecoveryStorageAdapter();
    const request = createStartRecoveryRequest();
    const entry = createInDoubtEntry({
      principal_user_id: RECOVERY_TEST_PRINCIPAL,
      request,
      attempted_at_utc: RECOVERY_TEST_TIME
    })!;
    await storage.writeJournalEntry(entry);
    const coordinator = createRecoveryCoordinator({
      storage,
      transport: ambiguousTransport(sends),
      delay: noDelay
    });
    const result = await coordinator.reconcileInDoubt({
      principal_user_id: RECOVERY_TEST_PRINCIPAL,
      journal_entry_id: entry.journal_entry_id,
      attempted_at_utc: RECOVERY_LATER_TIME,
      authentication_state: "MISSING"
    });
    expect(result.outcome?.status).toBe("AUTHENTICATION_REQUIRED");
    expect(sends.sends).toBe(0);
  });

  it("blocks changed-principal replay without sending", async () => {
    const sends = { sends: 0 };
    const storage = new InMemoryRecoveryStorageAdapter();
    const entry = createInDoubtEntry({
      principal_user_id: RECOVERY_TEST_PRINCIPAL,
      request: createStartRecoveryRequest(),
      attempted_at_utc: RECOVERY_TEST_TIME
    })!;
    await storage.writeJournalEntry(entry);
    const coordinator = createRecoveryCoordinator({
      storage,
      transport: ambiguousTransport(sends),
      delay: noDelay
    });
    const result = await coordinator.reconcileInDoubt({
      principal_user_id: RECOVERY_OTHER_PRINCIPAL,
      journal_entry_id: entry.journal_entry_id,
      attempted_at_utc: RECOVERY_LATER_TIME,
      authentication_state: "VERIFIED"
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.issue.code).toBe("AUTHORIZATION_DENIED");
    expect(sends.sends).toBe(0);
  });

  it("fails closed on a tampered stored canonical identity", async () => {
    const sends = { sends: 0 };
    const storage = new InMemoryRecoveryStorageAdapter();
    const entry = createInDoubtEntry({
      principal_user_id: RECOVERY_TEST_PRINCIPAL,
      request: createStartRecoveryRequest(),
      attempted_at_utc: RECOVERY_TEST_TIME
    })!;
    await storage.writeJournalEntry({ ...entry, canonical_request: "{}" });
    const coordinator = createRecoveryCoordinator({
      storage,
      transport: ambiguousTransport(sends),
      delay: noDelay
    });
    const result = await coordinator.reconcileInDoubt({
      principal_user_id: RECOVERY_TEST_PRINCIPAL,
      journal_entry_id: entry.journal_entry_id,
      attempted_at_utc: RECOVERY_LATER_TIME,
      authentication_state: "VERIFIED"
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.issue.code).toBe("LOCAL_RECORD_INVALID");
    expect(sends.sends).toBe(0);
  });

  it("isolates stored records from mutable caller references", async () => {
    const storage = new InMemoryRecoveryStorageAdapter();
    const entry = createInDoubtEntry({
      principal_user_id: RECOVERY_TEST_PRINCIPAL,
      request: createStartRecoveryRequest(),
      attempted_at_utc: RECOVERY_TEST_TIME
    })!;
    await storage.writeJournalEntry(entry);
    const first = await storage.readJournalEntry(entry.journal_entry_id) as {
      attempt_count: number;
    };
    first.attempt_count = 3;
    const second = await storage.readJournalEntry(entry.journal_entry_id) as {
      attempt_count: number;
    };
    expect(second.attempt_count).toBe(1);
  });

  it("deletes only the requested principal recovery scope on logout", async () => {
    const storage = new InMemoryRecoveryStorageAdapter();
    const a = createInDoubtEntry({
      principal_user_id: RECOVERY_TEST_PRINCIPAL,
      request: createStartRecoveryRequest("case.synthetic-assessment", "idempotency.user-a"),
      attempted_at_utc: RECOVERY_TEST_TIME
    })!;
    const b = createInDoubtEntry({
      principal_user_id: RECOVERY_OTHER_PRINCIPAL,
      request: createStartRecoveryRequest("case.synthetic-assessment", "idempotency.user-b"),
      attempted_at_utc: RECOVERY_TEST_TIME
    })!;
    await storage.writeJournalEntry(a);
    await storage.writeJournalEntry(b);
    await storage.deletePrincipalRecoveryData(RECOVERY_TEST_PRINCIPAL);
    expect(await storage.listJournalEntries({ principal_user_id: RECOVERY_TEST_PRINCIPAL }))
      .toHaveLength(0);
    expect(await storage.listJournalEntries({ principal_user_id: RECOVERY_OTHER_PRINCIPAL }))
      .toHaveLength(1);
  });

  it("coalesces same in-flight work but not conflicting work", async () => {
    const registry = new BoundedInFlightRegistry();
    let resolve!: (value: number) => void;
    const deferred = new Promise<number>((done) => { resolve = done; });
    let executions = 0;
    const first = registry.run({
      key: "constructor",
      canonical_request: "same",
      operation: async () => { executions += 1; return deferred; }
    });
    const retry = registry.run({
      key: "constructor",
      canonical_request: "same",
      operation: async () => 2
    });
    const conflict = registry.run({
      key: "constructor",
      canonical_request: "changed",
      operation: async () => 3
    });
    expect(first.success && retry.success && first.value === retry.value).toBe(true);
    expect(conflict).toEqual({ success: false, code: "IN_FLIGHT_CONFLICT" });
    resolve(1);
    if (first.success) await first.value;
    expect(executions).toBe(1);
  });

  it("does not mistake in-memory de-duplication for durable recovery", async () => {
    const firstRegistry = new BoundedInFlightRegistry();
    const secondRegistry = new BoundedInFlightRegistry();
    expect(firstRegistry).not.toBe(secondRegistry);
    expect(firstRegistry.size).toBe(0);
    expect(secondRegistry.size).toBe(0);
  });
});

describe("V2-014A portable deterministic snapshot", () => {
  it("matches the exact Browser fixture", async () => {
    expect(JSON.stringify(await createV2014aPortabilitySnapshot()))
      .toBe(V2_014A_PORTABILITY_EXPECTED);
  });
});
