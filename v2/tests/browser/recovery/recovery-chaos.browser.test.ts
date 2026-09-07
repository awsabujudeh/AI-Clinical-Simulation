import { describe, expect, it, vi } from "vitest";

import {
  InDoubtRecoveryJournalEntrySchema,
  LastKnownSafeSessionProjectionSchema,
  RECOVERY_JOURNAL_MAX_ENTRIES,
  RecoveryPrincipalIdSchema,
  type InDoubtRecoveryJournalEntry,
  type LastKnownSafeSessionProjection,
  type RecoveryJournalEntryId,
  type RecoveryPrincipalId
} from "../../../packages/contracts/src/index.ts";
import {
  InMemoryRecoveryStorageAdapter,
  canonicalRecoveryRequest,
  createInDoubtEntry,
  createRecoveryCoordinator,
  incrementRecoveryAttempt,
  recoveryJournalEntryId,
  reduceConnectivityState,
  validateStoredEntry,
  type RecoveryHttpRequest,
  type RecoveryStorageAdapter,
  type RecoveryStorageWriteResult,
  type RecoveryTransport,
  type RecoveryTransportResult
} from "../../../packages/recovery-core/src/index.ts";
import {
  API_TEST_USERS,
  actionBody,
  apiHeaders,
  createApiTestHarness,
  startBody,
  type ApiTestHarness
} from "../../fixtures/api/secure-api.ts";
import {
  DeterministicRecoveryChaosTransport,
  V2_014B_CHAOS_PORTABILITY_EXPECTED,
  createV2014bChaosPortabilitySnapshot
} from "../../fixtures/recovery/deterministic-chaos.ts";
import {
  RECOVERY_LATER_TIME,
  RECOVERY_OTHER_PRINCIPAL,
  RECOVERY_TEST_PRINCIPAL,
  RECOVERY_TEST_TIME,
  createActionRecoveryRequest,
  createEndRecoveryRequest,
  createStartRecoveryRequest
} from "../../fixtures/recovery/synthetic-recovery.ts";

const noDelay = { async wait() {} };

class ApiDelegateTransport implements RecoveryTransport {
  sends = 0;

  constructor(
    readonly harness: ApiTestHarness,
    readonly token = "learner"
  ) {}

  async send(request: RecoveryHttpRequest): Promise<RecoveryTransportResult> {
    this.sends += 1;
    const response = await this.harness.app.request(request.path, {
      method: request.method,
      headers: {
        ...request.headers,
        Authorization: `Bearer test.${this.token}`
      },
      body: request.body
    });
    return {
      kind: "HTTP_RESPONSE",
      status: response.status,
      body: await response.json()
    };
  }
}

class FaultInjectingStorage implements RecoveryStorageAdapter {
  readonly base = new InMemoryRecoveryStorageAdapter();
  readonly order: string[] = [];
  failJournalWrite = false;
  throwJournalWrite = false;
  failDelete = false;
  failProjectionWrite = false;
  forcedProjection: unknown | undefined;
  forcedEntries: readonly unknown[] | undefined;

  readJournalEntry(entryId: RecoveryJournalEntryId): Promise<unknown | null> {
    return this.base.readJournalEntry(entryId);
  }

  listJournalEntries(input: {
    principal_user_id: RecoveryPrincipalId;
    session_id?: string;
  }): Promise<readonly unknown[]> {
    return this.forcedEntries === undefined
      ? this.base.listJournalEntries(input)
      : Promise.resolve(this.forcedEntries);
  }

  async writeJournalEntry(
    entry: InDoubtRecoveryJournalEntry
  ): Promise<RecoveryStorageWriteResult> {
    this.order.push("JOURNAL_WRITE");
    if (this.throwJournalWrite) throw new Error("Synthetic journal write failure.");
    if (this.failJournalWrite) return { success: false, code: "STORAGE_FAILURE" };
    return this.base.writeJournalEntry(entry);
  }

  async deleteJournalEntry(entryId: RecoveryJournalEntryId): Promise<void> {
    this.order.push("JOURNAL_DELETE");
    if (this.failDelete) throw new Error("Synthetic journal cleanup failure.");
    await this.base.deleteJournalEntry(entryId);
  }

  readLastKnownProjection(input: {
    principal_user_id: RecoveryPrincipalId;
    session_id: string;
  }): Promise<unknown | null> {
    return this.forcedProjection === undefined
      ? this.base.readLastKnownProjection(input)
      : Promise.resolve(structuredClone(this.forcedProjection));
  }

  writeLastKnownProjection(
    projection: LastKnownSafeSessionProjection
  ): Promise<RecoveryStorageWriteResult> {
    if (this.failProjectionWrite) {
      return Promise.resolve({ success: false, code: "STORAGE_FAILURE" });
    }
    return this.base.writeLastKnownProjection(projection);
  }

  deletePrincipalRecoveryData(principalUserId: RecoveryPrincipalId): Promise<void> {
    return this.base.deletePrincipalRecoveryData(principalUserId);
  }
}

function transportThatNeverSends(): RecoveryTransport {
  return {
    async send() {
      return { kind: "NOT_SENT", failure: "KNOWN_OFFLINE" };
    }
  };
}

async function startSession(harness: ApiTestHarness, key: string) {
  const response = await harness.app.request("/v1/sessions", {
    method: "POST",
    headers: apiHeaders({ idempotency: key }),
    body: JSON.stringify(startBody(harness.productionPackage.manifest.case_id))
  });
  const body = await response.json() as {
    data: { session: {
      session_id: string;
      state_version: number;
      clinical_time: number;
      event_sequence_through: number;
      pinned_case: {
        execution_authority: "PUBLISHED_PRODUCTION" | "REVIEW_ONLY";
        case_package_id: string;
        case_version_id: string;
        case_version: string;
      };
      assessment_disclosure?: { projection_type: string };
    } };
  };
  return body.data.session;
}

function coordinator(input: {
  storage: RecoveryStorageAdapter;
  transport: RecoveryTransport;
}) {
  return createRecoveryCoordinator({ ...input, delay: noDelay });
}

describe("V2-014B deterministic network and reload chaos", () => {
  it("uses one explicit deterministic phase harness in Browser and Deno", async () => {
    const first = JSON.stringify(await createV2014bChaosPortabilitySnapshot());
    const second = JSON.stringify(await createV2014bChaosPortabilitySnapshot());
    expect(first).toBe(V2_014B_CHAOS_PORTABILITY_EXPECTED);
    expect(second).toBe(first);
  });

  it("classifies pre-send outage as NOT_SENT and never auto-submits on reconnect", async () => {
    const harness = await createApiTestHarness({ include_stemi: false });
    const storage = new InMemoryRecoveryStorageAdapter();
    const transport = new DeterministicRecoveryChaosTransport({
      directives: ["NOT_SENT_OFFLINE"],
      delegate: new ApiDelegateTransport(harness)
    });
    const request = createStartRecoveryRequest(
      harness.productionPackage.manifest.case_id,
      "idempotency.chaos.not-sent"
    );
    const result = await coordinator({ storage, transport }).submitMutation({
      principal_user_id: RECOVERY_TEST_PRINCIPAL,
      connectivity_state: "ONLINE",
      attempted_at_utc: RECOVERY_TEST_TIME,
      request
    });
    transport.reconnect();
    expect(result.outcome?.status).toBe("NOT_SENT");
    expect(harness.store.sessions.size).toBe(0);
    expect(await storage.listJournalEntries({ principal_user_id: RECOVERY_TEST_PRINCIPAL }))
      .toHaveLength(0);
    expect(transport.requests).toHaveLength(1);
  });

  it("replays a committed response-loss mutation with one exact identity", async () => {
    const harness = await createApiTestHarness({ include_stemi: false });
    const storage = new InMemoryRecoveryStorageAdapter();
    const delegate = new ApiDelegateTransport(harness);
    const transport = new DeterministicRecoveryChaosTransport({
      directives: ["COMMIT_THEN_DROP_RESPONSE", "DELIVER_RESPONSE"],
      delegate
    });
    const request = createStartRecoveryRequest(
      harness.productionPackage.manifest.case_id,
      "idempotency.chaos.commit-drop"
    );
    const first = await coordinator({ storage, transport }).submitMutation({
      principal_user_id: RECOVERY_TEST_PRINCIPAL,
      connectivity_state: "ONLINE",
      attempted_at_utc: RECOVERY_TEST_TIME,
      request
    });
    expect(first.outcome?.status).toBe("IN_DOUBT");
    expect(harness.store.sessions.size).toBe(1);
    transport.reconnect();
    const recovered = await coordinator({ storage, transport }).reconcileInDoubt({
      principal_user_id: RECOVERY_TEST_PRINCIPAL,
      journal_entry_id: recoveryJournalEntryId(RECOVERY_TEST_PRINCIPAL, request),
      attempted_at_utc: RECOVERY_LATER_TIME,
      authentication_state: "VERIFIED"
    });
    expect(recovered.success && recovered.outcome.replayed).toBe(true);
    expect(harness.store.sessions.size).toBe(1);
    expect(transport.requests[1]).toEqual(transport.requests[0]);
    expect(transport.trace).toContain("SERVER_COMMITTED");
  });

  it("does not fabricate success when an ambiguous request was not committed", async () => {
    const harness = await createApiTestHarness({ include_stemi: false });
    const storage = new InMemoryRecoveryStorageAdapter();
    const transport = new DeterministicRecoveryChaosTransport({
      directives: ["DO_NOT_COMMIT_AND_DROP_RESPONSE"],
      delegate: new ApiDelegateTransport(harness)
    });
    const request = createStartRecoveryRequest(
      harness.productionPackage.manifest.case_id,
      "idempotency.chaos.noncommit"
    );
    const result = await coordinator({ storage, transport }).submitMutation({
      principal_user_id: RECOVERY_TEST_PRINCIPAL,
      connectivity_state: "ONLINE",
      attempted_at_utc: RECOVERY_TEST_TIME,
      request
    });
    expect(result.success).toBe(false);
    expect(result.outcome?.status).toBe("IN_DOUBT");
    expect(harness.store.sessions.size).toBe(0);
    expect(await storage.listJournalEntries({ principal_user_id: RECOVERY_TEST_PRINCIPAL }))
      .toHaveLength(1);
  });

  it("does not persist or execute a request when refresh occurs before submission", async () => {
    const harness = await createApiTestHarness({ include_stemi: false });
    const storage = new InMemoryRecoveryStorageAdapter();
    createStartRecoveryRequest(
      harness.productionPackage.manifest.case_id,
      "idempotency.chaos.pre-submit-refresh"
    );
    coordinator({ storage, transport: new ApiDelegateTransport(harness) });
    expect(harness.store.sessions.size).toBe(0);
    expect(await storage.listJournalEntries({ principal_user_id: RECOVERY_TEST_PRINCIPAL }))
      .toHaveLength(0);
  });

  it("survives coordinator/process replacement and reconciles persisted IN_DOUBT", async () => {
    const harness = await createApiTestHarness({ include_stemi: false });
    const storage = new InMemoryRecoveryStorageAdapter();
    const delegate = new ApiDelegateTransport(harness);
    const chaos = new DeterministicRecoveryChaosTransport({
      directives: ["COMMIT_THEN_DROP_RESPONSE", "DELIVER_RESPONSE"],
      delegate
    });
    const request = createStartRecoveryRequest(
      harness.productionPackage.manifest.case_id,
      "idempotency.chaos.process-restart"
    );
    await coordinator({ storage, transport: chaos }).submitMutation({
      principal_user_id: RECOVERY_TEST_PRINCIPAL,
      connectivity_state: "ONLINE",
      attempted_at_utc: RECOVERY_TEST_TIME,
      request
    });
    const freshProcessCoordinator = coordinator({ storage, transport: chaos });
    const result = await freshProcessCoordinator.reconcileInDoubt({
      principal_user_id: RECOVERY_TEST_PRINCIPAL,
      journal_entry_id: recoveryJournalEntryId(RECOVERY_TEST_PRINCIPAL, request),
      attempted_at_utc: RECOVERY_LATER_TIME,
      authentication_state: "VERIFIED"
    });
    expect(result.success && result.outcome.replayed).toBe(true);
    expect(delegate.sends).toBe(2);
    expect(harness.store.sessions.size).toBe(1);
  });
});

describe("V2-014B multi-context and authority chaos", () => {
  it("allows only one authoritative execution for same-request two-tab submission", async () => {
    const harness = await createApiTestHarness({ include_stemi: false });
    const storage = new InMemoryRecoveryStorageAdapter();
    const request = createStartRecoveryRequest(
      harness.productionPackage.manifest.case_id,
      "idempotency.chaos.two-tabs"
    );
    const input = {
      principal_user_id: RECOVERY_TEST_PRINCIPAL,
      connectivity_state: "ONLINE",
      attempted_at_utc: RECOVERY_TEST_TIME,
      request
    } as const;
    const [left, right] = await Promise.all([
      coordinator({ storage, transport: new ApiDelegateTransport(harness) }).submitMutation(input),
      coordinator({ storage, transport: new ApiDelegateTransport(harness) }).submitMutation(input)
    ]);
    expect(left.success || right.success).toBe(true);
    expect(harness.store.sessions.size).toBe(1);
    expect([...harness.store.startRecords.values()]).toHaveLength(1);
  });

  it("makes one different-request same-base tab stale without auto-reexecution", async () => {
    const harness = await createApiTestHarness({ include_stemi: false });
    const session = await startSession(harness, "idempotency.chaos.stale-tabs-start");
    const storage = new InMemoryRecoveryStorageAdapter();
    const leftRequest = createActionRecoveryRequest({
      session_id: session.session_id,
      expected_state_version: session.state_version,
      idempotency_key: "idempotency.chaos.tab-left"
    });
    const rightRequest = createActionRecoveryRequest({
      session_id: session.session_id,
      expected_state_version: session.state_version,
      idempotency_key: "idempotency.chaos.tab-right",
      action_id: "assessment.synthetic-check"
    });
    const [left, right] = await Promise.all([
      coordinator({ storage, transport: new ApiDelegateTransport(harness) }).submitMutation({
        principal_user_id: RECOVERY_TEST_PRINCIPAL,
        connectivity_state: "ONLINE",
        attempted_at_utc: RECOVERY_TEST_TIME,
        request: leftRequest
      }),
      coordinator({ storage, transport: new ApiDelegateTransport(harness) }).submitMutation({
        principal_user_id: RECOVERY_TEST_PRINCIPAL,
        connectivity_state: "ONLINE",
        attempted_at_utc: RECOVERY_TEST_TIME,
        request: rightRequest
      })
    ]);
    const outcomes = [left.outcome?.status, right.outcome?.status].sort();
    expect(outcomes).toEqual(["CONFIRMED_SUCCESS", "STALE_NOT_EXECUTED"]);
    const authoritative = harness.store.sessions.get(session.session_id)!;
    expect(authoritative.patient_state.state_version).toBe(1);
    expect(authoritative.committed_events).toHaveLength(1);
  });

  it("keeps an offline tab frozen until server authority replaces its cache", async () => {
    const harness = await createApiTestHarness({ include_stemi: false });
    const session = await startSession(harness, "idempotency.chaos.offline-tab-start");
    const storage = new InMemoryRecoveryStorageAdapter();
    const online = coordinator({ storage, transport: new ApiDelegateTransport(harness) });
    const recoverInput = {
      principal_user_id: RECOVERY_TEST_PRINCIPAL,
      session_id: session.session_id,
      request_id: "request.chaos.offline-tab",
      correlation_id: "correlation.chaos.offline-tab",
      observed_at_utc: RECOVERY_TEST_TIME,
      authentication_state: "VERIFIED"
    } as const;
    await online.recoverSession(recoverInput);
    await harness.app.request(`/v1/sessions/${session.session_id}/actions/propose`, {
      method: "POST",
      headers: apiHeaders({ idempotency: "idempotency.chaos.offline-tab-advance" }),
      body: JSON.stringify(actionBody(session.state_version))
    });
    const offline = await coordinator({
      storage,
      transport: transportThatNeverSends()
    }).recoverSession({ ...recoverInput, observed_at_utc: RECOVERY_LATER_TIME });
    expect(offline.success && "last_known_projection" in offline).toBe(true);
    if (offline.success && "last_known_projection" in offline) {
      expect(offline.last_known_projection.projection.state_version).toBe(0);
      expect(offline.last_known_projection.projection.clinical_time).toBe(session.clinical_time);
      expect(offline.last_known_projection.mutation_authority).toBe("NONE");
    }
    const reconnected = await online.recoverSession({
      ...recoverInput,
      request_id: "request.chaos.offline-tab-reconnected",
      correlation_id: "correlation.chaos.offline-tab-reconnected",
      observed_at_utc: RECOVERY_LATER_TIME
    });
    expect(reconnected.success && "authoritative_projection" in reconnected
      ? reconnected.authoritative_projection.state_version
      : -1).toBe(1);
  });

  it("blocks expired auth, then permits only the same verified principal to reconcile", async () => {
    const harness = await createApiTestHarness({ include_stemi: false });
    const storage = new InMemoryRecoveryStorageAdapter();
    const delegate = new ApiDelegateTransport(harness);
    const chaos = new DeterministicRecoveryChaosTransport({
      directives: ["COMMIT_THEN_DROP_RESPONSE", "DELIVER_RESPONSE"],
      delegate
    });
    const request = createStartRecoveryRequest(
      harness.productionPackage.manifest.case_id,
      "idempotency.chaos.reauth"
    );
    await coordinator({ storage, transport: chaos }).submitMutation({
      principal_user_id: RECOVERY_TEST_PRINCIPAL,
      connectivity_state: "ONLINE",
      attempted_at_utc: RECOVERY_TEST_TIME,
      request
    });
    const entryId = recoveryJournalEntryId(RECOVERY_TEST_PRINCIPAL, request);
    const expired = await coordinator({ storage, transport: chaos }).reconcileInDoubt({
      principal_user_id: RECOVERY_TEST_PRINCIPAL,
      journal_entry_id: entryId,
      attempted_at_utc: RECOVERY_LATER_TIME,
      authentication_state: "MISSING"
    });
    const changed = await coordinator({ storage, transport: chaos }).reconcileInDoubt({
      principal_user_id: RECOVERY_OTHER_PRINCIPAL,
      journal_entry_id: entryId,
      attempted_at_utc: RECOVERY_LATER_TIME,
      authentication_state: "VERIFIED"
    });
    expect(expired.outcome?.status).toBe("AUTHENTICATION_REQUIRED");
    expect(changed.outcome?.status).toBe("AUTHORIZATION_DENIED");
    expect(delegate.sends).toBe(1);
    const restored = await coordinator({ storage, transport: chaos }).reconcileInDoubt({
      principal_user_id: RECOVERY_TEST_PRINCIPAL,
      journal_entry_id: entryId,
      attempted_at_utc: RECOVERY_LATER_TIME,
      authentication_state: "VERIFIED"
    });
    expect(restored.success && restored.outcome.replayed).toBe(true);
  });

  it("fails closed for disabled membership and foreign Session recovery", async () => {
    const harness = await createApiTestHarness({ include_stemi: false });
    const session = await startSession(harness, "idempotency.chaos.authz-start");
    const base = {
      session_id: session.session_id,
      request_id: "request.chaos.authz",
      correlation_id: "correlation.chaos.authz",
      observed_at_utc: RECOVERY_TEST_TIME,
      authentication_state: "VERIFIED"
    } as const;
    const disabled = await coordinator({
      storage: new InMemoryRecoveryStorageAdapter(),
      transport: new ApiDelegateTransport(harness, "inactive")
    }).recoverSession({ ...base, principal_user_id: API_TEST_USERS.inactive });
    const foreign = await coordinator({
      storage: new InMemoryRecoveryStorageAdapter(),
      transport: new ApiDelegateTransport(harness, "other-learner")
    }).recoverSession({ ...base, principal_user_id: RECOVERY_OTHER_PRINCIPAL });
    expect(disabled.success).toBe(false);
    expect(foreign.success).toBe(false);
  });

  it("does not blindly retry a definitive authorization denial after cleanup failure", async () => {
    const harness = await createApiTestHarness({ include_stemi: false });
    const session = await startSession(harness, "idempotency.chaos.denied-start");
    const storage = new FaultInjectingStorage();
    storage.failDelete = true;
    const deniedTransport = new ApiDelegateTransport(harness, "other-learner");
    const request = createActionRecoveryRequest({
      session_id: session.session_id,
      expected_state_version: session.state_version,
      idempotency_key: "idempotency.chaos.denied-cleanup"
    });
    const denied = await coordinator({ storage, transport: deniedTransport }).submitMutation({
      principal_user_id: RECOVERY_OTHER_PRINCIPAL,
      connectivity_state: "ONLINE",
      attempted_at_utc: RECOVERY_TEST_TIME,
      request
    });
    expect(denied.outcome?.status).toBe("AUTHORIZATION_DENIED");
    expect(deniedTransport.sends).toBe(1);

    storage.failDelete = false;
    let retrySends = 0;
    const retry = await coordinator({
      storage,
      transport: {
        async send() {
          retrySends += 1;
          return { kind: "HTTP_RESPONSE", status: 500, body: null } as const;
        }
      }
    }).reconcileInDoubt({
      principal_user_id: RECOVERY_OTHER_PRINCIPAL,
      journal_entry_id: recoveryJournalEntryId(RECOVERY_OTHER_PRINCIPAL, request),
      attempted_at_utc: RECOVERY_LATER_TIME,
      authentication_state: "VERIFIED"
    });
    expect(retry.outcome?.status).toBe("RETRY_LIMIT_REACHED");
    expect(retrySends).toBe(0);
  });
});

describe("V2-014B untrusted storage and bounded recovery", () => {
  it("rejects principal, role, institution, authority, canonical, and schema tampering", () => {
    const request = createStartRecoveryRequest();
    const entry = createInDoubtEntry({
      principal_user_id: RECOVERY_TEST_PRINCIPAL,
      request,
      attempted_at_utc: RECOVERY_TEST_TIME
    })!;
    expect(validateStoredEntry({
      ...entry,
      principal_user_id: RECOVERY_OTHER_PRINCIPAL
    })).toEqual({ success: false, reason: "JOURNAL_IDENTITY_MISMATCH" });
    for (const field of ["role", "institution_id", "execution_authority"]) {
      expect(validateStoredEntry({ ...entry, [field]: "PUBLISHED_PRODUCTION" }).success)
        .toBe(false);
    }
    expect(validateStoredEntry({ ...entry, canonical_request: "{}" }))
      .toEqual({ success: false, reason: "CANONICAL_REQUEST_MISMATCH" });
    expect(validateStoredEntry({ ...entry, recovery_schema_version: "999.0" }).success)
      .toBe(false);
    expect(validateStoredEntry({ malformed: true }).success).toBe(false);
  });

  it("enforces 64 unresolved entries without eviction and rejects attempt regression", async () => {
    const storage = new InMemoryRecoveryStorageAdapter();
    let first: InDoubtRecoveryJournalEntry | undefined;
    for (let index = 0; index < RECOVERY_JOURNAL_MAX_ENTRIES; index += 1) {
      const request = createStartRecoveryRequest(
        undefined,
        `idempotency.chaos.capacity-${index.toString().padStart(2, "0")}`
      );
      const entry = createInDoubtEntry({
        principal_user_id: RECOVERY_TEST_PRINCIPAL,
        request,
        attempted_at_utc: RECOVERY_TEST_TIME
      })!;
      first ??= entry;
      expect(await storage.writeJournalEntry(entry)).toEqual({ success: true });
    }
    const overflowRequest = createStartRecoveryRequest(
      undefined,
      "idempotency.chaos.capacity-overflow"
    );
    const overflow = createInDoubtEntry({
      principal_user_id: RECOVERY_TEST_PRINCIPAL,
      request: overflowRequest,
      attempted_at_utc: RECOVERY_TEST_TIME
    })!;
    expect(await storage.writeJournalEntry(overflow))
      .toEqual({ success: false, code: "STORAGE_FULL" });
    expect(await storage.listJournalEntries({ principal_user_id: RECOVERY_TEST_PRINCIPAL }))
      .toHaveLength(64);
    const advanced = incrementRecoveryAttempt(first!, RECOVERY_LATER_TIME)!;
    expect(await storage.writeJournalEntry(advanced)).toEqual({ success: true });
    expect(await storage.writeJournalEntry(first!))
      .toEqual({ success: false, code: "LOCAL_IDEMPOTENCY_CONFLICT" });
  });

  it("persists journal before transport and blocks send on write failure or throw", async () => {
    for (const failureMode of ["return", "throw"] as const) {
      const storage = new FaultInjectingStorage();
      storage.failJournalWrite = failureMode === "return";
      storage.throwJournalWrite = failureMode === "throw";
      let sends = 0;
      const result = await coordinator({
        storage,
        transport: { async send() {
          storage.order.push("TRANSPORT_SEND");
          sends += 1;
          return { kind: "NOT_SENT", failure: "KNOWN_OFFLINE" };
        } }
      }).submitMutation({
        principal_user_id: RECOVERY_TEST_PRINCIPAL,
        connectivity_state: "ONLINE",
        attempted_at_utc: RECOVERY_TEST_TIME,
        request: createStartRecoveryRequest(undefined, `idempotency.chaos.write-${failureMode}`)
      });
      if (result.success) {
        throw new Error("Expected the failed journal write to fail closed.");
      }
      expect(result.issue.code).toBe("LOCAL_STORAGE_FAILURE");
      expect(sends).toBe(0);
      expect(storage.order).toEqual(["JOURNAL_WRITE"]);
    }
  });

  it("contains reconciliation write throws inside typed Result failure", async () => {
    const storage = new FaultInjectingStorage();
    const request = createStartRecoveryRequest(undefined, "idempotency.chaos.reconcile-write");
    const entry = createInDoubtEntry({
      principal_user_id: RECOVERY_TEST_PRINCIPAL,
      request,
      attempted_at_utc: RECOVERY_TEST_TIME
    })!;
    await storage.base.writeJournalEntry(entry);
    storage.throwJournalWrite = true;
    const result = await coordinator({ storage, transport: transportThatNeverSends() })
      .reconcileInDoubt({
        principal_user_id: RECOVERY_TEST_PRINCIPAL,
        journal_entry_id: entry.journal_entry_id,
        attempted_at_utc: RECOVERY_LATER_TIME,
        authentication_state: "VERIFIED"
    });
    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error("Expected the reconciliation journal write to fail closed.");
    }
    expect(result.issue.code).toBe("LOCAL_STORAGE_FAILURE");
  });

  it("keeps server truth idempotent when local resolution cleanup fails", async () => {
    const harness = await createApiTestHarness({ include_stemi: false });
    const session = await startSession(harness, "idempotency.chaos.cleanup-start");
    const storage = new FaultInjectingStorage();
    storage.failDelete = true;
    const request = createActionRecoveryRequest({
      session_id: session.session_id,
      expected_state_version: session.state_version,
      idempotency_key: "idempotency.chaos.cleanup-action"
    });
    const delegate = new ApiDelegateTransport(harness);
    const first = await coordinator({ storage, transport: delegate }).submitMutation({
      principal_user_id: RECOVERY_TEST_PRINCIPAL,
      connectivity_state: "ONLINE",
      attempted_at_utc: RECOVERY_TEST_TIME,
      request
    });
    expect(first.success).toBe(false);
    if (first.success) {
      throw new Error("Expected failed local cleanup to surface as a typed failure.");
    }
    expect(first.issue.code).toBe("LOCAL_STORAGE_FAILURE");
    const afterCommit = harness.store.sessions.get(session.session_id)!;
    expect(afterCommit.committed_events).toHaveLength(1);
    storage.failDelete = false;
    const replay = await coordinator({ storage, transport: delegate }).reconcileInDoubt({
      principal_user_id: RECOVERY_TEST_PRINCIPAL,
      journal_entry_id: recoveryJournalEntryId(RECOVERY_TEST_PRINCIPAL, request),
      attempted_at_utc: RECOVERY_LATER_TIME,
      authentication_state: "VERIFIED"
    });
    expect(replay.success && replay.outcome.replayed).toBe(true);
    expect(harness.store.sessions.get(session.session_id)!.committed_events).toHaveLength(1);
  });

  it("never retries a known NOT_SENT mutation when terminal cleanup initially fails", async () => {
    const storage = new FaultInjectingStorage();
    storage.failDelete = true;
    let sends = 0;
    const request = createStartRecoveryRequest(
      undefined,
      "idempotency.chaos.not-sent-cleanup"
    );
    const first = await coordinator({
      storage,
      transport: {
        async send() {
          sends += 1;
          return { kind: "NOT_SENT", failure: "KNOWN_OFFLINE" } as const;
        }
      }
    }).submitMutation({
      principal_user_id: RECOVERY_TEST_PRINCIPAL,
      connectivity_state: "ONLINE",
      attempted_at_utc: RECOVERY_TEST_TIME,
      request
    });
    expect(first.outcome?.status).toBe("NOT_SENT");
    expect(sends).toBe(1);

    storage.failDelete = false;
    const retry = await coordinator({
      storage,
      transport: {
        async send() {
          sends += 1;
          return { kind: "HTTP_RESPONSE", status: 500, body: null } as const;
        }
      }
    }).reconcileInDoubt({
      principal_user_id: RECOVERY_TEST_PRINCIPAL,
      journal_entry_id: recoveryJournalEntryId(RECOVERY_TEST_PRINCIPAL, request),
      attempted_at_utc: RECOVERY_LATER_TIME,
      authentication_state: "VERIFIED"
    });
    expect(retry.outcome?.status).toBe("RETRY_LIMIT_REACHED");
    expect(sends).toBe(1);
  });

  it("rejects wrong-Session cached projections and journal listings from untrusted adapters", async () => {
    const harness = await createApiTestHarness({ include_stemi: false });
    const left = await startSession(harness, "idempotency.chaos.binding-left");
    const right = await startSession(harness, "idempotency.chaos.binding-right");
    const storage = new FaultInjectingStorage();
    const online = coordinator({ storage, transport: new ApiDelegateTransport(harness) });
    await online.recoverSession({
      principal_user_id: RECOVERY_TEST_PRINCIPAL,
      session_id: right.session_id,
      request_id: "request.chaos.binding-right",
      correlation_id: "correlation.chaos.binding-right",
      observed_at_utc: RECOVERY_TEST_TIME,
      authentication_state: "VERIFIED"
    });
    storage.forcedProjection = await storage.base.readLastKnownProjection({
      principal_user_id: RECOVERY_TEST_PRINCIPAL,
      session_id: right.session_id
    });
    const wrongProjection = await coordinator({
      storage,
      transport: transportThatNeverSends()
    }).recoverSession({
      principal_user_id: RECOVERY_TEST_PRINCIPAL,
      session_id: left.session_id,
      request_id: "request.chaos.binding-left",
      correlation_id: "correlation.chaos.binding-left",
      observed_at_utc: RECOVERY_LATER_TIME,
      authentication_state: "VERIFIED"
    });
    expect(wrongProjection.success).toBe(false);

    storage.forcedProjection = undefined;
    const rightRequest = createActionRecoveryRequest({
      session_id: right.session_id,
      expected_state_version: right.state_version,
      idempotency_key: "idempotency.chaos.wrong-list"
    });
    storage.forcedEntries = [createInDoubtEntry({
      principal_user_id: RECOVERY_TEST_PRINCIPAL,
      request: rightRequest,
      attempted_at_utc: RECOVERY_TEST_TIME
    })!];
    const wrongJournal = await online.recoverSession({
      principal_user_id: RECOVERY_TEST_PRINCIPAL,
      session_id: left.session_id,
      request_id: "request.chaos.wrong-list",
      correlation_id: "correlation.chaos.wrong-list",
      observed_at_utc: RECOVERY_LATER_TIME,
      authentication_state: "VERIFIED"
    });
    expect(wrongJournal.success).toBe(false);
    if (!wrongJournal.success) expect(wrongJournal.issue.code).toBe("LOCAL_RECORD_INVALID");
  });
});

describe("V2-014B prolonged outage, disclosure, and authority pinning", () => {
  it("keeps Clinical Time, diagnostics, scheduler, and Assessment truth frozen offline", async () => {
    const harness = await createApiTestHarness({ include_stemi: false });
    const session = await startSession(harness, "idempotency.chaos.prolonged-start");
    const storage = new InMemoryRecoveryStorageAdapter();
    const input = {
      principal_user_id: RECOVERY_TEST_PRINCIPAL,
      session_id: session.session_id,
      request_id: "request.chaos.prolonged",
      correlation_id: "correlation.chaos.prolonged",
      observed_at_utc: RECOVERY_TEST_TIME,
      authentication_state: "VERIFIED"
    } as const;
    await coordinator({ storage, transport: new ApiDelegateTransport(harness) })
      .recoverSession(input);
    const dateSpy = vi.spyOn(Date, "now").mockReturnValue(4_102_444_800_000);
    try {
      const offline = await coordinator({ storage, transport: transportThatNeverSends() })
        .recoverSession({ ...input, observed_at_utc: "2099-12-31T23:59:59.000Z" });
      expect(offline.success && "last_known_projection" in offline).toBe(true);
      if (offline.success && "last_known_projection" in offline) {
        const projection = offline.last_known_projection.projection;
        expect(projection.clinical_time).toBe(session.clinical_time);
        expect(projection.state_version).toBe(session.state_version);
        expect(projection.assessment_disclosure?.projection_type)
          .toBe("ACTIVE_ASSESSMENT_WITHHELD");
        expect(projection).not.toHaveProperty("scheduler");
        expect(projection).not.toHaveProperty("investigation_results");
        expect(JSON.stringify(projection)).not.toMatch(/rubric|answer_key|criterion_results/u);
      }
    } finally {
      dateSpy.mockRestore();
    }
  });

  it("uses actual transport rather than navigator hints and remains deterministic for 24 transitions", async () => {
    expect(reduceConnectivityState("OFFLINE_OR_UNREACHABLE", "NAVIGATOR_REPORTED_ONLINE"))
      .toBe("RECOVERING");
    expect(reduceConnectivityState("ONLINE", "NAVIGATOR_REPORTED_OFFLINE"))
      .toBe("OFFLINE_OR_UNREACHABLE");
    expect(reduceConnectivityState("OFFLINE_OR_UNREACHABLE", "REQUEST_SUCCEEDED"))
      .toBe("ONLINE");
    let state: "ONLINE" | "OFFLINE_OR_UNREACHABLE" | "RECOVERING" | "SYNC_REQUIRED" = "ONLINE";
    const transitions: string[] = [];
    for (let cycle = 0; cycle < 6; cycle += 1) {
      for (const signal of [
        "NAVIGATOR_REPORTED_OFFLINE",
        "NAVIGATOR_REPORTED_ONLINE",
        "REQUEST_FAILED_AMBIGUOUSLY",
        "REQUEST_SUCCEEDED"
      ] as const) {
        state = reduceConnectivityState(state, signal)!;
        transitions.push(state);
      }
    }
    expect(transitions).toHaveLength(24);
    expect(state).toBe("ONLINE");
  });

  it("preserves REVIEW_ONLY STEMI and rejects production recovery by a learner", async () => {
    const harness = await createApiTestHarness();
    const reviewArtifact = harness.reviewArtifact!;
    const response = await harness.app.request("/v1/review-sessions", {
      method: "POST",
      headers: apiHeaders({ token: "faculty", idempotency: "idempotency.chaos.review-start" }),
      body: JSON.stringify(startBody(reviewArtifact.source_case.manifest.case_id))
    });
    const body = await response.json() as { data: { session: { session_id: string } } };
    const reviewSession = harness.store.sessions.get(body.data.session.session_id)!;
    expect(reviewSession.pinned_case.execution_authority).toBe("REVIEW_ONLY");
    if (reviewSession.pinned_case.execution_authority !== "REVIEW_ONLY") {
      throw new Error("Expected a review-only pinned Case authority.");
    }
    expect(reviewSession.pinned_case.review_subject_hash)
      .toBe("46388c32e3ef74db413228adf837e90e828913a7db996a3ba57d181a2cbab11f");
    expect(reviewSession.pinned_case.review_execution_hash)
      .toBe("a8e76e5cd96c8b29461968796d295674f8de1ab3630a55a5568a25664c2b7ab7");
    const denied = await coordinator({
      storage: new InMemoryRecoveryStorageAdapter(),
      transport: new ApiDelegateTransport(harness, "learner")
    }).recoverSession({
      principal_user_id: RECOVERY_TEST_PRINCIPAL,
      session_id: body.data.session.session_id,
      request_id: "request.chaos.review-denied",
      correlation_id: "correlation.chaos.review-denied",
      observed_at_utc: RECOVERY_TEST_TIME,
      authentication_state: "VERIFIED"
    });
    expect(denied.success).toBe(false);
  });

  it("rehydrates the exact synthetic production Case despite a tampered stale projection", async () => {
    const harness = await createApiTestHarness({ include_stemi: false });
    const session = await startSession(harness, "idempotency.chaos.production-pin");
    const storage = new InMemoryRecoveryStorageAdapter();
    const input = {
      principal_user_id: RECOVERY_TEST_PRINCIPAL,
      session_id: session.session_id,
      request_id: "request.chaos.production-pin",
      correlation_id: "correlation.chaos.production-pin",
      observed_at_utc: RECOVERY_TEST_TIME,
      authentication_state: "VERIFIED"
    } as const;
    await coordinator({ storage, transport: new ApiDelegateTransport(harness) })
      .recoverSession(input);
    const raw = await storage.readLastKnownProjection(input);
    const cached = LastKnownSafeSessionProjectionSchema.parse(raw);
    const tampered = LastKnownSafeSessionProjectionSchema.parse({
      ...cached,
      projection: {
        ...cached.projection,
        pinned_case: {
          ...cached.projection.pinned_case,
          case_package_id: "case-package.tampered-local"
        }
      }
    });
    await storage.writeLastKnownProjection(tampered);
    const recovered = await coordinator({
      storage,
      transport: new ApiDelegateTransport(harness)
    }).recoverSession({
      ...input,
      request_id: "request.chaos.production-pin-reload",
      correlation_id: "correlation.chaos.production-pin-reload",
      observed_at_utc: RECOVERY_LATER_TIME
    });
    expect(recovered.success && "authoritative_projection" in recovered
      ? recovered.authoritative_projection.pinned_case
      : undefined).toEqual(session.pinned_case);
  });

  it("keeps ten reload/recovery cycles coherent without local drift", async () => {
    const harness = await createApiTestHarness({ include_stemi: false });
    const session = await startSession(harness, "idempotency.chaos.ten-cycles");
    const storage = new InMemoryRecoveryStorageAdapter();
    const input = {
      principal_user_id: RECOVERY_TEST_PRINCIPAL,
      session_id: session.session_id,
      request_id: "request.chaos.cycle-00",
      correlation_id: "correlation.chaos.cycle-00",
      observed_at_utc: RECOVERY_TEST_TIME,
      authentication_state: "VERIFIED"
    } as const;
    await coordinator({ storage, transport: new ApiDelegateTransport(harness) })
      .recoverSession(input);
    for (let cycle = 0; cycle < 10; cycle += 1) {
      const result = await coordinator({
        storage,
        transport: cycle % 2 === 0
          ? transportThatNeverSends()
          : new ApiDelegateTransport(harness)
      }).recoverSession({
        ...input,
        request_id: `request.chaos.cycle-${cycle + 1}`,
        correlation_id: `correlation.chaos.cycle-${cycle + 1}`,
        observed_at_utc: RECOVERY_LATER_TIME
      });
      expect(result.success).toBe(true);
    }
    const authoritative = harness.store.sessions.get(session.session_id)!;
    expect(authoritative.patient_state.state_version).toBe(0);
    expect(authoritative.committed_events).toHaveLength(0);
  });
});

describe("V2-014B mixed end-to-end chaos", () => {
  it("ends coherent after two tabs, response loss, stale conflict, replay, and finalization loss", async () => {
    const harness = await createApiTestHarness({ include_stemi: false });
    const session = await startSession(harness, "idempotency.chaos.mixed-start");
    const storage = new InMemoryRecoveryStorageAdapter();
    const delegate = new ApiDelegateTransport(harness);
    const chaos = new DeterministicRecoveryChaosTransport({
      directives: [
        "COMMIT_THEN_DROP_RESPONSE",
        "DELIVER_RESPONSE",
        "DELIVER_RESPONSE",
        "COMMIT_THEN_DROP_RESPONSE",
        "DELIVER_RESPONSE"
      ],
      delegate
    });
    const action = createActionRecoveryRequest({
      session_id: session.session_id,
      expected_state_version: session.state_version,
      idempotency_key: "idempotency.chaos.mixed-action"
    });
    const stale = createActionRecoveryRequest({
      session_id: session.session_id,
      expected_state_version: session.state_version,
      idempotency_key: "idempotency.chaos.mixed-stale",
      action_id: "assessment.synthetic-check"
    });
    expect((await coordinator({ storage, transport: chaos }).submitMutation({
      principal_user_id: RECOVERY_TEST_PRINCIPAL,
      connectivity_state: "ONLINE",
      attempted_at_utc: RECOVERY_TEST_TIME,
      request: action
    })).outcome?.status).toBe("IN_DOUBT");
    expect((await coordinator({ storage, transport: chaos }).submitMutation({
      principal_user_id: RECOVERY_TEST_PRINCIPAL,
      connectivity_state: "ONLINE",
      attempted_at_utc: RECOVERY_TEST_TIME,
      request: stale
    })).outcome?.status).toBe("STALE_NOT_EXECUTED");
    expect((await coordinator({ storage, transport: chaos }).reconcileInDoubt({
      principal_user_id: RECOVERY_TEST_PRINCIPAL,
      journal_entry_id: recoveryJournalEntryId(RECOVERY_TEST_PRINCIPAL, action),
      attempted_at_utc: RECOVERY_LATER_TIME,
      authentication_state: "VERIFIED"
    })).success).toBe(true);
    const afterAction = harness.store.sessions.get(session.session_id)!;
    const end = createEndRecoveryRequest({
      session_id: session.session_id,
      expected_state_version: afterAction.patient_state.state_version,
      idempotency_key: "idempotency.chaos.mixed-end"
    });
    expect((await coordinator({ storage, transport: chaos }).submitMutation({
      principal_user_id: RECOVERY_TEST_PRINCIPAL,
      connectivity_state: "ONLINE",
      attempted_at_utc: RECOVERY_LATER_TIME,
      request: end
    })).outcome?.status).toBe("IN_DOUBT");
    expect((await coordinator({ storage, transport: chaos }).reconcileInDoubt({
      principal_user_id: RECOVERY_TEST_PRINCIPAL,
      journal_entry_id: recoveryJournalEntryId(RECOVERY_TEST_PRINCIPAL, end),
      attempted_at_utc: "2026-09-06T10:02:00.000Z",
      authentication_state: "VERIFIED"
    })).success).toBe(true);
    const authoritative = harness.store.sessions.get(session.session_id)!;
    expect(authoritative.status).toBe("ENDED");
    expect(authoritative.committed_events.map((event) => event.sequence_no))
      .toEqual(authoritative.committed_events.map((_, index) => index + 1));
    expect(authoritative.committed_events.filter((event) => event.event_type === "SIMULATION_ENDED"))
      .toHaveLength(1);
    expect(await storage.listJournalEntries({ principal_user_id: RECOVERY_TEST_PRINCIPAL }))
      .toHaveLength(0);
  });
});
