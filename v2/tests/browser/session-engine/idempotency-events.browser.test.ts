import { describe, expect, it } from "vitest";

import {
  ClinicalEventProposalSchema,
  EventIdSchema
} from "../../../packages/contracts/src/index.ts";
import {
  processExternalLearnerCommand,
  type EventIdFactory,
  type SessionCommandSuccess
} from "../../../packages/session-engine/src/index.ts";
import { createSyntheticRule } from "../../fixtures/clinical-engine/synthetic-transitions.ts";
import {
  TEST_REAL_TIME_UTC,
  TEST_SESSION_COMMAND_DEPENDENCIES,
  createSyntheticCommandSession,
  createSyntheticExternalCommand,
  createSyntheticPinnedAction
} from "../../fixtures/session-engine/synthetic-command.ts";

function requireSuccess(
  result: Awaited<ReturnType<typeof processExternalLearnerCommand>>
): SessionCommandSuccess {
  expect(result.success).toBe(true);
  if (!result.success) throw new Error(JSON.stringify(result));
  return result;
}

const COMMAND_EFFECT_RULE = createSyntheticRule({
  rule_id: "rule.synthetic.command-effect",
  trigger: {
    trigger_type: "COMMITTED_EVENT",
    event_type: "EXAM_PERFORMED",
    action_id: "examination.synthetic-check"
  },
  effects: [{
    effect_type: "SET_STATE",
    effect_id: "effect.synthetic.command-effect-hemodynamics",
    target: "hemodynamic_state",
    value: "hemodynamics.synthetic-altered"
  }],
  emitted_events: [{
    event_type: "PATIENT_STATE_CHANGED",
    parameters: { fixture_only: true },
    payload: { source: "command-effect" },
    clinical_effect_ids: ["clinical-effect.synthetic.command-effect"]
  }]
});

describe("V2-006B idempotency and authoritative event sequencing", () => {
  it("executes a first key once and exactly replays without mutation or allocation", async () => {
    const session = createSyntheticCommandSession({ rules: [COMMAND_EFFECT_RULE] });
    const command = createSyntheticExternalCommand(session);
    const first = requireSuccess(await processExternalLearnerCommand(
      session,
      command,
      TEST_SESSION_COMMAND_DEPENDENCIES
    ));
    const retry = requireSuccess(await processExternalLearnerCommand(
      first.authoritative_session,
      command,
      {
        ...TEST_SESSION_COMMAND_DEPENDENCIES,
        real_time_utc: "2026-09-01T13:00:00Z"
      }
    ));

    expect(first.status).toBe("COMMITTED");
    expect(retry.status).toBe("REPLAYED");
    expect(retry.committed_events).toEqual(first.committed_events);
    expect(retry.authoritative_session).toEqual(first.authoritative_session);
    expect(retry.authoritative_session.next_sequence_no).toBe(3);
    expect(retry.authoritative_session.idempotency_records).toHaveLength(1);
  });

  it("fails a conflicting retry closed with no aggregate mutation", async () => {
    const session = createSyntheticCommandSession();
    const command = createSyntheticExternalCommand(session);
    const first = requireSuccess(await processExternalLearnerCommand(
      session,
      command,
      TEST_SESSION_COMMAND_DEPENDENCIES
    ));
    const conflict = await processExternalLearnerCommand(
      first.authoritative_session,
      {
        ...command,
        action_request: {
          ...command.action_request,
          action_id: "examination.different"
        }
      },
      TEST_SESSION_COMMAND_DEPENDENCIES
    );

    expect(conflict.success).toBe(false);
    if (conflict.success) return;
    expect(conflict.issues.map((issue) => issue.code)).toEqual(["IDEMPOTENCY_CONFLICT"]);
    expect(first.authoritative_session.next_sequence_no).toBe(2);
    expect(first.authoritative_session.committed_events).toHaveLength(1);
  });

  it("does not poison a key after a failed attempt and permits a corrected retry", async () => {
    const session = createSyntheticCommandSession();
    const invalid = createSyntheticExternalCommand(session, {
      actionId: "examination.unknown",
      idempotencyKey: "idempotency.synthetic.correctable"
    });
    const failed = await processExternalLearnerCommand(
      session,
      invalid,
      TEST_SESSION_COMMAND_DEPENDENCIES
    );
    expect(failed.success).toBe(false);
    expect(session.idempotency_records).toEqual([]);

    const corrected = requireSuccess(await processExternalLearnerCommand(
      session,
      createSyntheticExternalCommand(session, {
        idempotencyKey: "idempotency.synthetic.correctable"
      }),
      TEST_SESSION_COMMAND_DEPENDENCIES
    ));
    expect(corrected.status).toBe("COMMITTED");
    expect(corrected.authoritative_session.idempotency_records).toHaveLength(1);
  });

  it("converts proposals into UUID events with consecutive causal sequence", async () => {
    const session = createSyntheticCommandSession({ rules: [COMMAND_EFFECT_RULE] });
    const result = requireSuccess(await processExternalLearnerCommand(
      session,
      createSyntheticExternalCommand(session),
      TEST_SESSION_COMMAND_DEPENDENCIES
    ));

    expect(result.committed_events.map((event) => event.sequence_no)).toEqual([1, 2]);
    expect(result.committed_events.every((event) => EventIdSchema.safeParse(event.event_id).success))
      .toBe(true);
    expect(result.committed_events[1]?.causation_event_id).toBe(
      result.committed_events[0]?.event_id
    );
    expect(result.committed_events[1]).toMatchObject({
      event_type: "PATIENT_STATE_CHANGED",
      rule_id: "rule.synthetic.command-effect",
      status: "COMMITTED"
    });
    expect(ClinicalEventProposalSchema.safeParse(result.committed_events[1]).success).toBe(false);
  });

  it("preserves Clinical Engine proposal order without cosmetic sorting", async () => {
    const orderedRule = createSyntheticRule({
      rule_id: "rule.synthetic.command-ordered-events",
      trigger: {
        trigger_type: "COMMITTED_EVENT",
        event_type: "EXAM_PERFORMED",
        action_id: "examination.synthetic-check"
      },
      emitted_events: [{
        event_type: "INVESTIGATION_RESULT_AVAILABLE",
        parameters: { order: 1 },
        payload: { label: "first" },
        clinical_effect_ids: []
      }, {
        event_type: "EXAM_FINDING_REVEALED",
        parameters: { order: 2 },
        payload: { label: "second" },
        clinical_effect_ids: []
      }]
    });
    const session = createSyntheticCommandSession({ rules: [orderedRule] });
    const result = requireSuccess(await processExternalLearnerCommand(
      session,
      createSyntheticExternalCommand(session),
      TEST_SESSION_COMMAND_DEPENDENCIES
    ));

    expect(result.committed_events.map((event) => event.event_type)).toEqual([
      "EXAM_PERFORMED",
      "INVESTIGATION_RESULT_AVAILABLE",
      "EXAM_FINDING_REVEALED"
    ]);
    expect(result.committed_events.map((event) => event.sequence_no)).toEqual([1, 2, 3]);
  });

  it("rolls back tentative clinical state and consumes no sequence when event conversion fails", async () => {
    const session = createSyntheticCommandSession({ rules: [COMMAND_EFFECT_RULE] });
    const invalidSecondId: EventIdFactory = {
      createEventId(input) {
        return input.sequence_no === 2
          ? "not-a-uuid"
          : `00000000-0000-4000-8000-${String(input.sequence_no).padStart(12, "0")}`;
      }
    };
    const result = await processExternalLearnerCommand(
      session,
      createSyntheticExternalCommand(session),
      {
        ...TEST_SESSION_COMMAND_DEPENDENCIES,
        event_id_factory: invalidSecondId
      }
    );

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.issues.map((issue) => issue.code)).toEqual(["EVENT_CONVERSION_FAILED"]);
    expect(result).not.toHaveProperty("authoritative_session");
    expect(session.patient_state.hemodynamic_state).toBe("hemodynamics.synthetic-baseline");
    expect(session.patient_state.state_version).toBe(4);
    expect(session.next_sequence_no).toBe(1);

    const corrected = requireSuccess(await processExternalLearnerCommand(
      session,
      createSyntheticExternalCommand(session),
      TEST_SESSION_COMMAND_DEPENDENCIES
    ));
    expect(corrected.committed_events.map((event) => event.sequence_no)).toEqual([1, 2]);
  });

  it("rejects duplicate EventIds before exposing the tentative transaction", async () => {
    const session = createSyntheticCommandSession({ rules: [COMMAND_EFFECT_RULE] });
    const duplicateFactory: EventIdFactory = {
      createEventId() {
        return "00000000-0000-4000-8000-000000000001";
      }
    };
    const result = await processExternalLearnerCommand(
      session,
      createSyntheticExternalCommand(session),
      {
        ...TEST_SESSION_COMMAND_DEPENDENCIES,
        event_id_factory: duplicateFactory
      }
    );

    expect(!result.success && result.issues.map((issue) => issue.code)).toEqual([
      "EVENT_CONVERSION_FAILED"
    ]);
    expect(session.committed_events).toEqual([]);
    expect(session.next_sequence_no).toBe(1);
  });

  it("contains a throwing EventId provider as a typed rollback failure", async () => {
    const session = createSyntheticCommandSession();
    const throwingFactory: EventIdFactory = {
      createEventId() {
        throw new Error("synthetic provider failure");
      }
    };
    const result = await processExternalLearnerCommand(
      session,
      createSyntheticExternalCommand(session),
      {
        ...TEST_SESSION_COMMAND_DEPENDENCIES,
        event_id_factory: throwingFactory
      }
    );

    expect(!result.success && result.issues.map((issue) => issue.code)).toEqual([
      "EVENT_CONVERSION_FAILED"
    ]);
    expect(result).not.toHaveProperty("authoritative_session");
    expect(session.next_sequence_no).toBe(1);
    expect(session.idempotency_records).toEqual([]);
  });

  it("propagates Clinical Engine typed failure without a partial Session result", async () => {
    const invalidProjectionRule = createSyntheticRule({
      rule_id: "rule.synthetic.command-invalid-projection",
      trigger: {
        trigger_type: "COMMITTED_EVENT",
        event_type: "EXAM_PERFORMED",
        action_id: "examination.synthetic-check"
      },
      effects: [{
        effect_type: "SET_STATE",
        effect_id: "effect.synthetic.command-invalid-projection",
        target: "hemodynamic_state",
        value: "hemodynamics.synthetic-unmapped"
      }]
    });
    const session = createSyntheticCommandSession({ rules: [invalidProjectionRule] });
    const result = await processExternalLearnerCommand(
      session,
      createSyntheticExternalCommand(session),
      TEST_SESSION_COMMAND_DEPENDENCIES
    );

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.issues.map((issue) => issue.code)).toEqual(["CLINICAL_ENGINE_FAILURE"]);
    expect(result.clinical_engine_failure?.issues.map((issue) => issue.code)).toContain(
      "OBSERVATION_PROJECTION_FAILED"
    );
    expect(result).not.toHaveProperty("authoritative_session");
  });

  it("keeps Session sequence independent from Patient State version", async () => {
    const noStateSession = createSyntheticCommandSession();
    const noStateResult = requireSuccess(await processExternalLearnerCommand(
      noStateSession,
      createSyntheticExternalCommand(noStateSession),
      TEST_SESSION_COMMAND_DEPENDENCIES
    ));
    expect(noStateResult.authoritative_session.patient_state.state_version).toBe(4);
    expect(noStateResult.authoritative_session.next_sequence_no).toBe(2);

    const stateSession = createSyntheticCommandSession({ rules: [COMMAND_EFFECT_RULE] });
    const stateResult = requireSuccess(await processExternalLearnerCommand(
      stateSession,
      createSyntheticExternalCommand(stateSession),
      TEST_SESSION_COMMAND_DEPENDENCIES
    ));
    expect(stateResult.authoritative_session.patient_state.state_version).toBe(5);
    expect(stateResult.authoritative_session.next_sequence_no).toBe(3);
  });

  it("appends across successful transactions without mutating prior committed events", async () => {
    const session = createSyntheticCommandSession();
    const first = requireSuccess(await processExternalLearnerCommand(
      session,
      createSyntheticExternalCommand(session),
      TEST_SESSION_COMMAND_DEPENDENCIES
    ));
    const firstEventSnapshot = JSON.stringify(first.committed_events[0]);
    const second = requireSuccess(await processExternalLearnerCommand(
      first.authoritative_session,
      createSyntheticExternalCommand(first.authoritative_session, {
        idempotencyKey: "idempotency.synthetic.command-002",
        commandId: "command.synthetic.002",
        actionRequestId: "action-request.synthetic.002",
        requestId: "request.synthetic.command-002",
        correlationId: "correlation.synthetic.command-002"
      }),
      TEST_SESSION_COMMAND_DEPENDENCIES
    ));

    expect(second.authoritative_session.committed_events.map((event) => event.sequence_no))
      .toEqual([1, 2]);
    expect(JSON.stringify(second.authoritative_session.committed_events[0])).toBe(
      firstEventSnapshot
    );
    expect(second.authoritative_session.next_sequence_no).toBe(3);
  });

  it("is byte-for-byte deterministic with injected hash/time/EventId dependencies", async () => {
    const firstSession = createSyntheticCommandSession({ rules: [COMMAND_EFFECT_RULE] });
    const secondSession = createSyntheticCommandSession({ rules: [COMMAND_EFFECT_RULE] });
    const first = await processExternalLearnerCommand(
      firstSession,
      createSyntheticExternalCommand(firstSession),
      TEST_SESSION_COMMAND_DEPENDENCIES
    );
    const second = await processExternalLearnerCommand(
      secondSession,
      createSyntheticExternalCommand(secondSession),
      TEST_SESSION_COMMAND_DEPENDENCIES
    );

    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    expect(JSON.stringify(first)).toContain(TEST_REAL_TIME_UTC);
  });

  it("handles prototype-style keys and IDs without inherited-property authority", async () => {
    const session = createSyntheticCommandSession();
    const prototypeKey = requireSuccess(await processExternalLearnerCommand(
      session,
      createSyntheticExternalCommand(session, {
        idempotencyKey: "constructor"
      }),
      TEST_SESSION_COMMAND_DEPENDENCIES
    ));
    expect(prototypeKey.authoritative_session.idempotency_records[0]?.idempotency_key).toBe(
      "constructor"
    );

    const unknownPrototypeAction = await processExternalLearnerCommand(
      session,
      createSyntheticExternalCommand(session, { actionId: "examination.constructor" }),
      TEST_SESSION_COMMAND_DEPENDENCIES
    );
    expect(!unknownPrototypeAction.success
      && unknownPrototypeAction.issues.map((issue) => issue.code)).toEqual([
      "UNKNOWN_ACTION_ID"
    ]);
  });

  it("fails pinned package and stale state mismatches before clinical execution", async () => {
    const session = createSyntheticCommandSession();
    const packageMismatch = await processExternalLearnerCommand(
      session,
      createSyntheticExternalCommand(session, {
        expectedPackageHash: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
      }),
      TEST_SESSION_COMMAND_DEPENDENCIES
    );
    const stateMismatch = await processExternalLearnerCommand(
      session,
      createSyntheticExternalCommand(session, { expectedStateVersion: 99 }),
      TEST_SESSION_COMMAND_DEPENDENCIES
    );
    expect(!packageMismatch.success
      && packageMismatch.issues.map((issue) => issue.code)).toEqual(["PINNED_CASE_MISMATCH"]);
    expect(!stateMismatch.success
      && stateMismatch.issues.map((issue) => issue.code)).toEqual(["STATE_VERSION_CONFLICT"]);
    expect(session.next_sequence_no).toBe(1);
  });

  it("enforces pinned parameter, confirmation, and repeat policies", async () => {
    const parameterAction = createSyntheticPinnedAction({
      parameter_definitions: [{
        parameter_code: "parameter.dose",
        value_type: "INTEGER",
        required: true,
        minimum: 1,
        maximum: 5
      }]
    });
    const parameterSession = createSyntheticCommandSession({ actions: [parameterAction] });
    const malformed = await processExternalLearnerCommand(
      parameterSession,
      createSyntheticExternalCommand(parameterSession, {
        parameters: { "parameter.dose": 8, "parameter.client-effect": true }
      }),
      TEST_SESSION_COMMAND_DEPENDENCIES
    );
    expect(!malformed.success && malformed.issues.map((issue) => issue.code)).toEqual([
      "ACTION_PARAMETER_INVALID",
      "ACTION_PARAMETER_INVALID"
    ]);

    const confirmationSession = createSyntheticCommandSession({
      actions: [createSyntheticPinnedAction({ confirmation_policy: "EXPLICIT_REQUEST" })]
    });
    const confirmation = await processExternalLearnerCommand(
      confirmationSession,
      createSyntheticExternalCommand(confirmationSession),
      TEST_SESSION_COMMAND_DEPENDENCIES
    );
    expect(!confirmation.success && confirmation.issues.map((issue) => issue.code)).toEqual([
      "ACTION_CONFIRMATION_REQUIRED"
    ]);

    const oneShotSession = createSyntheticCommandSession({
      actions: [createSyntheticPinnedAction({ repeat_policy: "NOT_REPEATABLE" })]
    });
    const first = requireSuccess(await processExternalLearnerCommand(
      oneShotSession,
      createSyntheticExternalCommand(oneShotSession),
      TEST_SESSION_COMMAND_DEPENDENCIES
    ));
    const repeat = await processExternalLearnerCommand(
      first.authoritative_session,
      createSyntheticExternalCommand(first.authoritative_session, {
        idempotencyKey: "idempotency.synthetic.second-key",
        commandId: "command.synthetic.second",
        actionRequestId: "action-request.synthetic.second",
        requestId: "request.synthetic.second",
        correlationId: "correlation.synthetic.second"
      }),
      TEST_SESSION_COMMAND_DEPENDENCIES
    );
    expect(!repeat.success && repeat.issues.map((issue) => issue.code)).toEqual([
      "ACTION_NOT_REPEATABLE"
    ]);
  });
});
