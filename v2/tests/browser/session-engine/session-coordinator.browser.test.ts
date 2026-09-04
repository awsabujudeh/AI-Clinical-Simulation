import { describe, expect, it } from "vitest";

import {
  InMemorySessionCommitAdapter,
  createSessionCommandIssue,
  createSessionCoordinator,
  type SessionCommitAdapter
} from "../../../packages/session-engine/src/index.ts";
import { TEST_HASH_ADAPTER } from "../../fixtures/cases/synthetic-case.ts";
import { createSyntheticScheduledItem } from "../../fixtures/session-engine/synthetic-session.ts";
import {
  DETERMINISTIC_EVENT_ID_FACTORY,
  TEST_REAL_TIME_UTC,
  createCoordinatorContext,
  createSyntheticCommandSession,
  createSyntheticExternalCommand
} from "../../fixtures/session-engine/synthetic-command.ts";

function requireSuccess<T extends { success: boolean }>(
  result: T
): Extract<T, { success: true }> {
  expect(result.success).toBe(true);
  if (!result.success) throw new Error(JSON.stringify(result));
  return result as Extract<T, { success: true }>;
}

function coordinatorRequest(
  session: ReturnType<typeof createSyntheticCommandSession>,
  command = createSyntheticExternalCommand(session),
  trustedTime = TEST_REAL_TIME_UTC
) {
  return {
    ...createCoordinatorContext(session, trustedTime, "command"),
    command
  };
}

function setup(session = createSyntheticCommandSession({
  trustedRealTimeUtc: TEST_REAL_TIME_UTC
})) {
  const adapter = new InMemorySessionCommitAdapter([session]);
  const coordinator = createSessionCoordinator({
    adapter,
    hash_adapter: TEST_HASH_ADAPTER,
    event_id_factory: DETERMINISTIC_EVENT_ID_FACTORY
  });
  return { adapter, coordinator, session };
}

describe("one authoritative Session Coordinator", () => {
  it("exposes one coordinator with the four orchestration operations", () => {
    const { coordinator } = setup();
    expect(Object.keys(coordinator).sort()).toEqual([
      "pauseSession",
      "resumeSession",
      "submitExternalClinicalCommand",
      "syncRunningSession"
    ]);
  });

  it("synchronizes trusted time before evaluating and committing the command", async () => {
    const session = createSyntheticCommandSession({
      trustedRealTimeUtc: TEST_REAL_TIME_UTC,
      schedulerItems: [createSyntheticScheduledItem({
        id: "scheduled-item.synthetic.before-coordinator-command",
        due: 50,
        eventType: "PATIENT_STATE_CHANGED",
        effects: [{
          effect_type: "SET_STATE",
          effect_id: "effect.synthetic.before-coordinator-command",
          target: "hemodynamic_state",
          value: "hemodynamics.synthetic-altered"
        }]
      })]
    });
    const { coordinator } = setup(session);
    const result = requireSuccess(await coordinator.submitExternalClinicalCommand(
      coordinatorRequest(
        session,
        createSyntheticExternalCommand(session),
        "2026-09-01T12:00:05Z"
      )
    ));

    expect(result.status).toBe("COMMITTED");
    expect(result.authoritative_session.patient_state.clinical_time).toBe(50);
    expect(result.authoritative_session.patient_state.hemodynamic_state).toBe(
      "hemodynamics.synthetic-altered"
    );
    expect(result.committed_events.map((event) => [event.sequence_no, event.event_type])).toEqual([
      [1, "PATIENT_STATE_CHANGED"],
      [2, "EXAM_PERFORMED"]
    ]);
  });

  it("resolves a deterministic double-click as one commit plus one replay", async () => {
    const { adapter, coordinator, session } = setup();
    const request = coordinatorRequest(session);
    const [left, right] = await Promise.all([
      coordinator.submitExternalClinicalCommand(request),
      coordinator.submitExternalClinicalCommand(request)
    ]);
    const outcomes = [requireSuccess(left), requireSuccess(right)];
    expect(outcomes.map((result) => result.status).sort()).toEqual([
      "COMMITTED",
      "REPLAYED"
    ]);
    const stored = requireSuccess(await adapter.load(session.session_id)).session;
    expect(stored.committed_events).toHaveLength(1);
    expect(stored.idempotency_records).toHaveLength(1);
    expect(stored.next_sequence_no).toBe(2);
    const replay = outcomes.find((result) => result.status === "REPLAYED")!;
    expect(replay.command_result?.committed_events).toEqual(stored.committed_events);
  });

  it("returns an exact sequential retry as replay without another adapter write", async () => {
    const { adapter, coordinator, session } = setup();
    const request = coordinatorRequest(session);
    const first = requireSuccess(await coordinator.submitExternalClinicalCommand(request));
    const retry = requireSuccess(await coordinator.submitExternalClinicalCommand(request));
    const stored = requireSuccess(await adapter.load(session.session_id)).session;

    expect(first.status).toBe("COMMITTED");
    expect(retry.status).toBe("REPLAYED");
    expect(retry.committed_events).toEqual([]);
    expect(retry.command_result?.committed_events).toEqual(first.command_result?.committed_events);
    expect(stored.next_sequence_no).toBe(2);
  });

  it("does not blindly re-execute a clinical command after an unrelated stale commit", async () => {
    const session = createSyntheticCommandSession({ trustedRealTimeUtc: TEST_REAL_TIME_UTC });
    const memory = new InMemorySessionCommitAdapter([session]);
    let eventIdCalls = 0;
    let firstCommit = true;
    const conflicting: SessionCommitAdapter = {
      load: (sessionId) => memory.load(sessionId),
      async commit(input) {
        if (firstCommit) {
          firstCommit = false;
          const loaded = requireSuccess(await memory.load(session.session_id));
          const concurrent = {
            ...loaded.session,
            trusted_real_time_anchor_utc: "2026-09-01T12:00:01Z"
          };
          requireSuccess(await memory.commit({
            session_id: session.session_id,
            expected_token: loaded.commit_token,
            proposed_session: concurrent
          }));
        }
        return memory.commit(input);
      }
    };
    const coordinator = createSessionCoordinator({
      adapter: conflicting,
      hash_adapter: TEST_HASH_ADAPTER,
      event_id_factory: {
        createEventId(input) {
          eventIdCalls += 1;
          return DETERMINISTIC_EVENT_ID_FACTORY.createEventId(input);
        }
      }
    });
    const result = await coordinator.submitExternalClinicalCommand(
      coordinatorRequest(session)
    );
    expect(result.success).toBe(false);
    if (result.success) throw new Error("Expected stale persistent commit conflict.");
    expect(result.issues.map((issue) => issue.code)).toEqual(["SESSION_VERSION_CONFLICT"]);
    expect(eventIdCalls).toBe(1);
    const stored = requireSuccess(await memory.load(session.session_id)).session;
    expect(stored.committed_events).toEqual([]);
    expect(stored.idempotency_records).toEqual([]);
  });

  it("keeps intent distinct from execution when the action is not Case-pinned", async () => {
    const { adapter, coordinator, session } = setup();
    const result = await coordinator.submitExternalClinicalCommand(coordinatorRequest(
      session,
      createSyntheticExternalCommand(session, {
        actionId: "procedure.synthetic.unpinned"
      })
    ));
    expect(result.success).toBe(false);
    if (result.success) throw new Error("Expected unpinned intent failure.");
    expect(result.issues.map((issue) => issue.code)).toContain("UNKNOWN_ACTION_ID");
    const stored = requireSuccess(await adapter.load(session.session_id)).session;
    expect(stored.committed_events).toEqual([]);
    expect(stored.idempotency_records).toEqual([]);
  });

  it("contains adapter failure without exposing or storing a partial aggregate", async () => {
    const session = createSyntheticCommandSession({ trustedRealTimeUtc: TEST_REAL_TIME_UTC });
    const memory = new InMemorySessionCommitAdapter([session]);
    const failing: SessionCommitAdapter = {
      load: (sessionId) => memory.load(sessionId),
      async commit() {
        return {
          success: false,
          issues: [createSessionCommandIssue({
            code: "SESSION_ADAPTER_FAILURE",
            path: "$.adapter",
            message: "Synthetic atomic adapter failure."
          })]
        };
      }
    };
    const coordinator = createSessionCoordinator({
      adapter: failing,
      hash_adapter: TEST_HASH_ADAPTER,
      event_id_factory: DETERMINISTIC_EVENT_ID_FACTORY
    });
    const result = await coordinator.submitExternalClinicalCommand(
      coordinatorRequest(session)
    );
    expect(result.success).toBe(false);
    if (result.success) throw new Error("Expected adapter failure.");
    expect(result.issues.map((issue) => issue.code)).toEqual(["SESSION_ADAPTER_FAILURE"]);
    expect(requireSuccess(await memory.load(session.session_id)).session).toEqual(session);
  });
});
