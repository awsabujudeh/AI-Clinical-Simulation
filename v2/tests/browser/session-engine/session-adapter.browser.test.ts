import { describe, expect, it } from "vitest";

import {
  InMemorySessionAggregateSchema,
  InMemorySessionCommitAdapter,
  processExternalLearnerCommand
} from "../../../packages/session-engine/src/index.ts";
import {
  TEST_REAL_TIME_UTC,
  TEST_SESSION_COMMAND_DEPENDENCIES,
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

describe("storage-neutral in-memory Session commit adapter", () => {
  it("loads and commits copy-safe snapshots without leaking mutable references", async () => {
    const initial = createSyntheticCommandSession({ trustedRealTimeUtc: TEST_REAL_TIME_UTC });
    const adapter = new InMemorySessionCommitAdapter([initial]);
    const firstLoad = requireSuccess(await adapter.load(initial.session_id));
    const originalPainSeverity = initial.patient_state.pain_state.severity_0_10;

    firstLoad.session.patient_state.pain_state.severity_0_10 = 9;
    const secondLoad = requireSuccess(await adapter.load(initial.session_id));
    expect(secondLoad.session.patient_state.pain_state.severity_0_10).toBe(
      originalPainSeverity
    );

    const command = createSyntheticExternalCommand(secondLoad.session);
    const proposal = requireSuccess(await processExternalLearnerCommand(
      secondLoad.session,
      command,
      TEST_SESSION_COMMAND_DEPENDENCIES
    ));
    const committed = requireSuccess(await adapter.commit({
      session_id: secondLoad.session.session_id,
      expected_token: secondLoad.commit_token,
      proposed_session: proposal.authoritative_session
    }));
    proposal.authoritative_session.committed_events[0]!.payload = { tampered: true };

    const stored = requireSuccess(await adapter.load(initial.session_id));
    expect(stored.session).toEqual(committed.session);
    expect(stored.session.committed_events[0]!.payload).toEqual({
      catalogue_membership: "VERIFIED",
      execution_status: "EXECUTED"
    });
    committed.session.patient_state.pain_state.severity_0_10 = 8;
    expect(requireSuccess(await adapter.load(initial.session_id)).session.patient_state
      .pain_state.severity_0_10).toBe(originalPainSeverity);
  });

  it("fails stale out-of-order proposals before any event, sequence, or replay write", async () => {
    const initial = createSyntheticCommandSession({ trustedRealTimeUtc: TEST_REAL_TIME_UTC });
    const adapter = new InMemorySessionCommitAdapter([initial]);
    const left = requireSuccess(await adapter.load(initial.session_id));
    const right = requireSuccess(await adapter.load(initial.session_id));
    const leftProposal = requireSuccess(await processExternalLearnerCommand(
      left.session,
      createSyntheticExternalCommand(left.session, {
        idempotencyKey: "idempotency.synthetic.left",
        commandId: "command.synthetic.left",
        actionRequestId: "action-request.synthetic.left",
        requestId: "request.synthetic.left"
      }),
      TEST_SESSION_COMMAND_DEPENDENCIES
    ));
    const rightProposal = requireSuccess(await processExternalLearnerCommand(
      right.session,
      createSyntheticExternalCommand(right.session, {
        idempotencyKey: "idempotency.synthetic.right",
        commandId: "command.synthetic.right",
        actionRequestId: "action-request.synthetic.right",
        requestId: "request.synthetic.right"
      }),
      TEST_SESSION_COMMAND_DEPENDENCIES
    ));

    requireSuccess(await adapter.commit({
      session_id: initial.session_id,
      expected_token: left.commit_token,
      proposed_session: leftProposal.authoritative_session
    }));
    const stale = await adapter.commit({
      session_id: initial.session_id,
      expected_token: right.commit_token,
      proposed_session: rightProposal.authoritative_session
    });
    expect(stale.success).toBe(false);
    if (stale.success) throw new Error("Expected stale commit conflict.");
    expect(stale.issues.map((issue) => issue.code)).toEqual(["SESSION_VERSION_CONFLICT"]);

    const stored = requireSuccess(await adapter.load(initial.session_id)).session;
    expect(stored.committed_events).toHaveLength(1);
    expect(stored.next_sequence_no).toBe(2);
    expect(stored.idempotency_records.map((record) => record.idempotency_key)).toEqual([
      "idempotency.synthetic.left"
    ]);
  });

  it("uses Map identity safely for prototype-style Session IDs", async () => {
    const base = createSyntheticCommandSession({ trustedRealTimeUtc: TEST_REAL_TIME_UTC });
    const prototypeSession = InMemorySessionAggregateSchema.parse({
      ...base,
      session_id: "constructor",
      patient_state: { ...base.patient_state, session_id: "constructor" }
    });
    const adapter = new InMemorySessionCommitAdapter([prototypeSession]);
    const loaded = requireSuccess(await adapter.load("constructor"));
    expect(loaded.session.session_id).toBe("constructor");
  });
});
