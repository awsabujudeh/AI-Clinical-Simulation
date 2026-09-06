import { describe, expect, it } from "vitest";

import {
  InMemoryRecoveryStorageAdapter,
  createInDoubtEntry,
  createRecoveryCoordinator,
  recoveryJournalEntryId,
  type RecoveryHttpRequest,
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
  RECOVERY_LATER_TIME,
  RECOVERY_OTHER_PRINCIPAL,
  RECOVERY_TEST_PRINCIPAL,
  RECOVERY_TEST_TIME,
  createActionRecoveryRequest,
  createEndRecoveryRequest,
  createStartRecoveryRequest
} from "../../fixtures/recovery/synthetic-recovery.ts";

const noDelay = { async wait() {} };

class ApiRecoveryTransport implements RecoveryTransport {
  sends = 0;
  dropNextResponse = false;

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
    const body = await response.json();
    if (this.dropNextResponse) {
      this.dropNextResponse = false;
      return {
        kind: "AMBIGUOUS_TRANSPORT_FAILURE",
        failure: "BEFORE_RESPONSE_CERTAINTY"
      };
    }
    return { kind: "HTTP_RESPONSE", status: response.status, body };
  }
}

async function startSession(harness: ApiTestHarness, key: string) {
  const response = await harness.app.request("/v1/sessions", {
    method: "POST",
    headers: apiHeaders({ idempotency: key }),
    body: JSON.stringify(startBody(harness.productionPackage.manifest.case_id))
  });
  const body = await response.json() as Record<string, any>;
  return body.data.session as {
    session_id: string;
    state_version: number;
    clinical_time: number;
    event_sequence_through: number;
    status: string;
  };
}

describe("V2-014A durable lost-response reconciliation", () => {
  it("recovers a lost startSession response with the exact durable start identity", async () => {
    const harness = await createApiTestHarness({ include_stemi: false });
    const storage = new InMemoryRecoveryStorageAdapter();
    const transport = new ApiRecoveryTransport(harness);
    transport.dropNextResponse = true;
    const request = createStartRecoveryRequest(
      harness.productionPackage.manifest.case_id,
      "idempotency.recovery.lost-start"
    );
    const firstCoordinator = createRecoveryCoordinator({ storage, transport, delay: noDelay });
    const first = await firstCoordinator.submitMutation({
      principal_user_id: RECOVERY_TEST_PRINCIPAL,
      connectivity_state: "ONLINE",
      attempted_at_utc: RECOVERY_TEST_TIME,
      request
    });
    expect(first.outcome?.status).toBe("IN_DOUBT");
    expect(harness.store.sessions.size).toBe(1);

    const reloadedCoordinator = createRecoveryCoordinator({ storage, transport, delay: noDelay });
    const recovered = await reloadedCoordinator.reconcileInDoubt({
      principal_user_id: RECOVERY_TEST_PRINCIPAL,
      journal_entry_id: recoveryJournalEntryId(RECOVERY_TEST_PRINCIPAL, request),
      attempted_at_utc: RECOVERY_LATER_TIME,
      authentication_state: "VERIFIED"
    });
    expect(recovered.success).toBe(true);
    if (!recovered.success) throw new Error("Expected start reconciliation success.");
    expect(recovered.outcome.status).toBe("CONFIRMED_SUCCESS");
    expect(recovered.outcome.replayed).toBe(true);
    expect(harness.store.sessions.size).toBe(1);
    expect(await storage.listJournalEntries({ principal_user_id: RECOVERY_TEST_PRINCIPAL }))
      .toHaveLength(0);
  });

  it("recovers a lost action response without duplicate Event, state, or sequence", async () => {
    const harness = await createApiTestHarness({ include_stemi: false });
    const session = await startSession(harness, "idempotency.recovery.action-start");
    const storage = new InMemoryRecoveryStorageAdapter();
    const transport = new ApiRecoveryTransport(harness);
    transport.dropNextResponse = true;
    const request = createActionRecoveryRequest({
      session_id: session.session_id,
      expected_state_version: session.state_version,
      idempotency_key: "idempotency.recovery.lost-action"
    });
    const coordinator = createRecoveryCoordinator({ storage, transport, delay: noDelay });
    expect((await coordinator.submitMutation({
      principal_user_id: RECOVERY_TEST_PRINCIPAL,
      connectivity_state: "ONLINE",
      attempted_at_utc: RECOVERY_TEST_TIME,
      request
    })).outcome?.status).toBe("IN_DOUBT");
    const afterCommit = harness.store.sessions.get(session.session_id)!;
    const eventCount = afterCommit.committed_events.length;
    const stateVersion = afterCommit.patient_state.state_version;
    const nextSequence = afterCommit.next_sequence_no;

    const recovered = await createRecoveryCoordinator({ storage, transport, delay: noDelay })
      .reconcileInDoubt({
        principal_user_id: RECOVERY_TEST_PRINCIPAL,
        journal_entry_id: recoveryJournalEntryId(RECOVERY_TEST_PRINCIPAL, request),
        attempted_at_utc: RECOVERY_LATER_TIME,
        authentication_state: "VERIFIED"
      });
    const afterReplay = harness.store.sessions.get(session.session_id)!;
    expect(recovered.success && recovered.outcome.replayed).toBe(true);
    expect(afterReplay.committed_events).toHaveLength(eventCount);
    expect(afterReplay.patient_state.state_version).toBe(stateVersion);
    expect(afterReplay.next_sequence_no).toBe(nextSequence);
  });

  it("recovers a lost endSimulation response without duplicate finalization", async () => {
    const harness = await createApiTestHarness({ include_stemi: false });
    const session = await startSession(harness, "idempotency.recovery.end-start");
    const storage = new InMemoryRecoveryStorageAdapter();
    const transport = new ApiRecoveryTransport(harness);
    transport.dropNextResponse = true;
    const request = createEndRecoveryRequest({
      session_id: session.session_id,
      expected_state_version: session.state_version,
      idempotency_key: "idempotency.recovery.lost-end"
    });
    const coordinator = createRecoveryCoordinator({ storage, transport, delay: noDelay });
    expect((await coordinator.submitMutation({
      principal_user_id: RECOVERY_TEST_PRINCIPAL,
      connectivity_state: "ONLINE",
      attempted_at_utc: RECOVERY_TEST_TIME,
      request
    })).outcome?.status).toBe("IN_DOUBT");
    const afterCommit = harness.store.sessions.get(session.session_id)!;
    const eventCount = afterCommit.committed_events.length;
    const checkpointCount = afterCommit.idempotency_records.length;

    const recovered = await createRecoveryCoordinator({ storage, transport, delay: noDelay })
      .reconcileInDoubt({
        principal_user_id: RECOVERY_TEST_PRINCIPAL,
        journal_entry_id: recoveryJournalEntryId(RECOVERY_TEST_PRINCIPAL, request),
        attempted_at_utc: RECOVERY_LATER_TIME,
        authentication_state: "VERIFIED"
      });
    const afterReplay = harness.store.sessions.get(session.session_id)!;
    expect(recovered.success && recovered.outcome.replayed).toBe(true);
    expect(afterReplay.status).toBe("ENDED");
    expect(afterReplay.committed_events).toHaveLength(eventCount);
    expect(afterReplay.idempotency_records).toHaveLength(checkpointCount);
  });
});

describe("V2-014A fail-closed authority recovery", () => {
  it("does not auto-reexecute a stale clinical action and requires authoritative sync", async () => {
    const harness = await createApiTestHarness({ include_stemi: false });
    const session = await startSession(harness, "idempotency.recovery.stale-start");
    await harness.app.request(`/v1/sessions/${session.session_id}/actions/propose`, {
      method: "POST",
      headers: apiHeaders({ idempotency: "idempotency.recovery.advance" }),
      body: JSON.stringify(actionBody(session.state_version, {
        command_id: "command.recovery.advance",
        action_request_id: "action-request.recovery.advance"
      }))
    });
    const storage = new InMemoryRecoveryStorageAdapter();
    const transport = new ApiRecoveryTransport(harness);
    const request = createActionRecoveryRequest({
      session_id: session.session_id,
      expected_state_version: 0,
      idempotency_key: "idempotency.recovery.stale"
    });
    const before = harness.store.sessions.get(session.session_id)!;
    const result = await createRecoveryCoordinator({ storage, transport, delay: noDelay })
      .submitMutation({
        principal_user_id: RECOVERY_TEST_PRINCIPAL,
        connectivity_state: "ONLINE",
        attempted_at_utc: RECOVERY_TEST_TIME,
        request
      });
    const after = harness.store.sessions.get(session.session_id)!;
    expect(result.outcome?.status).toBe("STALE_NOT_EXECUTED");
    expect(result.outcome?.requires_authoritative_sync).toBe(true);
    expect(transport.sends).toBe(1);
    expect(after).toEqual(before);
    expect(await storage.listJournalEntries({ principal_user_id: RECOVERY_TEST_PRINCIPAL }))
      .toHaveLength(0);
  });

  it("fails closed on server idempotency conflict", async () => {
    const harness = await createApiTestHarness({ include_stemi: false });
    const session = await startSession(harness, "idempotency.recovery.conflict-start");
    const key = "idempotency.recovery.conflict";
    await harness.app.request(`/v1/sessions/${session.session_id}/actions/propose`, {
      method: "POST",
      headers: apiHeaders({ idempotency: key }),
      body: JSON.stringify(actionBody(session.state_version))
    });
    const request = createActionRecoveryRequest({
      session_id: session.session_id,
      expected_state_version: session.state_version,
      idempotency_key: key,
      action_id: "assessment.synthetic-check"
    });
    const result = await createRecoveryCoordinator({
      storage: new InMemoryRecoveryStorageAdapter(),
      transport: new ApiRecoveryTransport(harness),
      delay: noDelay
    }).submitMutation({
      principal_user_id: RECOVERY_TEST_PRINCIPAL,
      connectivity_state: "ONLINE",
      attempted_at_utc: RECOVERY_TEST_TIME,
      request
    });
    expect(result.outcome?.status).toBe("IDEMPOTENCY_CONFLICT");
    expect(result.success).toBe(false);
  });

  it("keeps dependency-unavailable mutations unresolved instead of fabricating success", async () => {
    const storage = new InMemoryRecoveryStorageAdapter();
    const transport: RecoveryTransport = {
      async send() {
        return {
          kind: "HTTP_RESPONSE",
          status: 503,
          body: {
            api_schema_version: "1.0",
            error: { code: "DEPENDENCY_UNAVAILABLE", message_key: "api.error", retryable: true }
          }
        };
      }
    };
    const request = createStartRecoveryRequest();
    const result = await createRecoveryCoordinator({ storage, transport, delay: noDelay })
      .submitMutation({
        principal_user_id: RECOVERY_TEST_PRINCIPAL,
        connectivity_state: "ONLINE",
        attempted_at_utc: RECOVERY_TEST_TIME,
        request
      });
    expect(result.outcome?.status).toBe("DEPENDENCY_UNAVAILABLE");
    expect(await storage.listJournalEntries({ principal_user_id: RECOVERY_TEST_PRINCIPAL }))
      .toHaveLength(1);
  });

  it("does not send a mutation after authentication expires", async () => {
    const harness = await createApiTestHarness({ include_stemi: false });
    const storage = new InMemoryRecoveryStorageAdapter();
    const request = createStartRecoveryRequest(
      harness.productionPackage.manifest.case_id,
      "idempotency.recovery.expired"
    );
    const entry = createInDoubtEntry({
      principal_user_id: RECOVERY_TEST_PRINCIPAL,
      request,
      attempted_at_utc: RECOVERY_TEST_TIME
    })!;
    await storage.writeJournalEntry(entry);
    const transport = new ApiRecoveryTransport(harness, "inactive");
    const result = await createRecoveryCoordinator({ storage, transport, delay: noDelay })
      .reconcileInDoubt({
        principal_user_id: RECOVERY_TEST_PRINCIPAL,
        journal_entry_id: entry.journal_entry_id,
        attempted_at_utc: RECOVERY_LATER_TIME,
        authentication_state: "MISSING"
      });
    expect(result.outcome?.status).toBe("AUTHENTICATION_REQUIRED");
    expect(transport.sends).toBe(0);
    expect(await storage.readJournalEntry(entry.journal_entry_id)).not.toBeNull();
  });

  it("requires server authorization and blocks a changed user from resuming a Session", async () => {
    const harness = await createApiTestHarness({ include_stemi: false });
    const session = await startSession(harness, "idempotency.recovery.changed-user-start");
    const result = await createRecoveryCoordinator({
      storage: new InMemoryRecoveryStorageAdapter(),
      transport: new ApiRecoveryTransport(harness, "other-learner"),
      delay: noDelay
    }).recoverSession({
      principal_user_id: RECOVERY_OTHER_PRINCIPAL,
      session_id: session.session_id,
      request_id: "request.recovery.changed-user",
      correlation_id: "correlation.recovery.changed-user",
      observed_at_utc: RECOVERY_TEST_TIME,
      authentication_state: "VERIFIED"
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.issue.code).toBe("AUTHORIZATION_DENIED");
  });

  it("blocks a disabled membership before authoritative resume", async () => {
    const harness = await createApiTestHarness({ include_stemi: false });
    const session = await startSession(harness, "idempotency.recovery.disabled-start");
    const result = await createRecoveryCoordinator({
      storage: new InMemoryRecoveryStorageAdapter(),
      transport: new ApiRecoveryTransport(harness, "inactive"),
      delay: noDelay
    }).recoverSession({
      principal_user_id: API_TEST_USERS.inactive,
      session_id: session.session_id,
      request_id: "request.recovery.disabled",
      correlation_id: "correlation.recovery.disabled",
      observed_at_utc: RECOVERY_TEST_TIME,
      authentication_state: "VERIFIED"
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.issue.code).toBe("AUTHENTICATION_REQUIRED");
  });
});

describe("V2-014A refresh and last-known safe projection", () => {
  it("reloads authority, reconciles an in-doubt action, and refreshes again", async () => {
    const harness = await createApiTestHarness({ include_stemi: false });
    const session = await startSession(harness, "idempotency.recovery.reload-start");
    const storage = new InMemoryRecoveryStorageAdapter();
    const transport = new ApiRecoveryTransport(harness);
    transport.dropNextResponse = true;
    const request = createActionRecoveryRequest({
      session_id: session.session_id,
      expected_state_version: session.state_version,
      idempotency_key: "idempotency.recovery.reload-action"
    });
    await createRecoveryCoordinator({ storage, transport, delay: noDelay })
      .submitMutation({
        principal_user_id: RECOVERY_TEST_PRINCIPAL,
        connectivity_state: "ONLINE",
        attempted_at_utc: RECOVERY_TEST_TIME,
        request
      });
    const result = await createRecoveryCoordinator({ storage, transport, delay: noDelay })
      .recoverSession({
        principal_user_id: RECOVERY_TEST_PRINCIPAL,
        session_id: session.session_id,
        request_id: "request.recovery.reload",
        correlation_id: "correlation.recovery.reload",
        observed_at_utc: RECOVERY_LATER_TIME,
        authentication_state: "VERIFIED"
      });
    expect(result.success).toBe(true);
    if (result.success && "authoritative_projection" in result) {
      expect(result.reconciliation_results).toHaveLength(1);
      expect(result.reconciliation_results[0]?.success).toBe(true);
      expect(result.authoritative_projection.state_version).toBe(1);
      expect(result.authoritative_projection.event_sequence_through).toBe(1);
    }
    expect(await storage.listJournalEntries({ principal_user_id: RECOVERY_TEST_PRINCIPAL }))
      .toHaveLength(0);
  });

  it("rehydrates authoritative Session state before exposing an online result", async () => {
    const harness = await createApiTestHarness({ include_stemi: false });
    const session = await startSession(harness, "idempotency.recovery.rehydrate-start");
    const storage = new InMemoryRecoveryStorageAdapter();
    const result = await createRecoveryCoordinator({
      storage,
      transport: new ApiRecoveryTransport(harness),
      delay: noDelay
    }).recoverSession({
      principal_user_id: RECOVERY_TEST_PRINCIPAL,
      session_id: session.session_id,
      request_id: "request.recovery.rehydrate",
      correlation_id: "correlation.recovery.rehydrate",
      observed_at_utc: RECOVERY_TEST_TIME,
      authentication_state: "VERIFIED"
    });
    expect(result.success).toBe(true);
    if (result.success && "authoritative_projection" in result) {
      expect(result.connectivity_state).toBe("ONLINE");
      expect(result.authoritative_projection.session_id).toBe(session.session_id);
      expect(result.authoritative_projection.clinical_time).toBe(session.clinical_time);
    }
  });

  it("freezes a safe last-known projection while unreachable", async () => {
    const harness = await createApiTestHarness({ include_stemi: false });
    const session = await startSession(harness, "idempotency.recovery.cached-start");
    const storage = new InMemoryRecoveryStorageAdapter();
    const online = createRecoveryCoordinator({
      storage,
      transport: new ApiRecoveryTransport(harness),
      delay: noDelay
    });
    const input = {
      principal_user_id: RECOVERY_TEST_PRINCIPAL,
      session_id: session.session_id,
      request_id: "request.recovery.cached",
      correlation_id: "correlation.recovery.cached",
      observed_at_utc: RECOVERY_TEST_TIME,
      authentication_state: "VERIFIED"
    } as const;
    await online.recoverSession(input);
    const offline = createRecoveryCoordinator({
      storage,
      transport: { async send() { return {
        kind: "AMBIGUOUS_TRANSPORT_FAILURE" as const,
        failure: "UNEXPECTED_NETWORK_FAILURE" as const
      }; } },
      delay: noDelay
    });
    const result = await offline.recoverSession({
      ...input,
      request_id: "request.recovery.cached-offline",
      correlation_id: "correlation.recovery.cached-offline",
      observed_at_utc: RECOVERY_LATER_TIME
    });
    expect(result.success).toBe(true);
    if (result.success && "last_known_projection" in result) {
      expect(result.connectivity_state).toBe("OFFLINE_OR_UNREACHABLE");
      expect(result.last_known_projection.freshness).toBe("STALE_LAST_KNOWN");
      expect(result.last_known_projection.mutation_authority).toBe("NONE");
      expect(result.last_known_projection.projection.clinical_time)
        .toBe(session.clinical_time);
    }
  });

  it("uses the same safe fallback after bounded dependency-unavailable reads", async () => {
    const harness = await createApiTestHarness({ include_stemi: false });
    const session = await startSession(harness, "idempotency.recovery.503-start");
    const storage = new InMemoryRecoveryStorageAdapter();
    const online = createRecoveryCoordinator({
      storage,
      transport: new ApiRecoveryTransport(harness),
      delay: noDelay
    });
    const base = {
      principal_user_id: RECOVERY_TEST_PRINCIPAL,
      session_id: session.session_id,
      request_id: "request.recovery.503",
      correlation_id: "correlation.recovery.503",
      observed_at_utc: RECOVERY_TEST_TIME,
      authentication_state: "VERIFIED"
    } as const;
    await online.recoverSession(base);
    let reads = 0;
    const unavailable: RecoveryTransport = { async send() {
      reads += 1;
      return {
        kind: "HTTP_RESPONSE",
        status: 503,
        body: { api_schema_version: "1.0", error: {
          code: "DEPENDENCY_UNAVAILABLE", message_key: "api.error", retryable: true
        } }
      };
    } };
    const result = await createRecoveryCoordinator({ storage, transport: unavailable, delay: noDelay })
      .recoverSession({ ...base, observed_at_utc: RECOVERY_LATER_TIME });
    expect(reads).toBe(3);
    expect(result.success && "last_known_projection" in result).toBe(true);
  });

  it("never exposes foreign-user cached projection data", async () => {
    const harness = await createApiTestHarness({ include_stemi: false });
    const session = await startSession(harness, "idempotency.recovery.scope-start");
    const storage = new InMemoryRecoveryStorageAdapter();
    const online = createRecoveryCoordinator({
      storage,
      transport: new ApiRecoveryTransport(harness),
      delay: noDelay
    });
    await online.recoverSession({
      principal_user_id: RECOVERY_TEST_PRINCIPAL,
      session_id: session.session_id,
      request_id: "request.recovery.scope",
      correlation_id: "correlation.recovery.scope",
      observed_at_utc: RECOVERY_TEST_TIME,
      authentication_state: "VERIFIED"
    });
    const result = await createRecoveryCoordinator({
      storage,
      transport: { async send() { return {
        kind: "AMBIGUOUS_TRANSPORT_FAILURE" as const,
        failure: "UNEXPECTED_NETWORK_FAILURE" as const
      }; } },
      delay: noDelay
    }).recoverSession({
      principal_user_id: RECOVERY_OTHER_PRINCIPAL,
      session_id: session.session_id,
      request_id: "request.recovery.scope-other",
      correlation_id: "correlation.recovery.scope-other",
      observed_at_utc: RECOVERY_LATER_TIME,
      authentication_state: "VERIFIED"
    });
    expect(result.success).toBe(false);
  });

  it("coalesces rapid duplicate submissions while durable API idempotency remains authority", async () => {
    const harness = await createApiTestHarness({ include_stemi: false });
    const storage = new InMemoryRecoveryStorageAdapter();
    const transport = new ApiRecoveryTransport(harness);
    const coordinator = createRecoveryCoordinator({ storage, transport, delay: noDelay });
    const request = createStartRecoveryRequest(
      harness.productionPackage.manifest.case_id,
      "idempotency.recovery.double-click"
    );
    const input = {
      principal_user_id: RECOVERY_TEST_PRINCIPAL,
      connectivity_state: "ONLINE",
      attempted_at_utc: RECOVERY_TEST_TIME,
      request
    } as const;
    const [first, second] = await Promise.all([
      coordinator.submitMutation(input),
      coordinator.submitMutation(input)
    ]);
    expect(first).toEqual(second);
    expect(transport.sends).toBe(1);
    expect(harness.store.sessions.size).toBe(1);
  });
});
