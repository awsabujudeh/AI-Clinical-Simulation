import { describe, expect, it } from "vitest";

import {
  fingerprintExternalLearnerCommand,
  processExternalLearnerCommand,
  type SessionCommandSuccess
} from "../../../packages/session-engine/src/index.ts";
import { createSyntheticRule } from "../../fixtures/clinical-engine/synthetic-transitions.ts";
import {
  TEST_HASH_ADAPTER
} from "../../fixtures/cases/synthetic-case.ts";
import {
  TEST_SESSION_COMMAND_DEPENDENCIES,
  createSyntheticCommandSession,
  createSyntheticExternalCommand,
  createSyntheticPinnedAction
} from "../../fixtures/session-engine/synthetic-command.ts";
import {
  createSyntheticScheduledItem
} from "../../fixtures/session-engine/synthetic-session.ts";

function requireSuccess(
  result: Awaited<ReturnType<typeof processExternalLearnerCommand>>
): SessionCommandSuccess {
  expect(result.success).toBe(true);
  if (!result.success) throw new Error(JSON.stringify(result));
  return result;
}

const POST_DUE_COMMAND_RULE = createSyntheticRule({
  rule_id: "rule.synthetic.command-post-due",
  trigger: {
    trigger_type: "COMMITTED_EVENT",
    event_type: "EXAM_PERFORMED",
    action_id: "examination.synthetic-check"
  },
  preconditions: [{
    condition_type: "STATE_EQUALS",
    target: "hemodynamic_state",
    value: "hemodynamics.synthetic-altered"
  }],
  effects: [{
    effect_type: "SET_STATE",
    effect_id: "effect.synthetic.command-post-due-consciousness",
    target: "consciousness",
    value: "consciousness.synthetic-changed"
  }],
  emitted_events: [{
    event_type: "PATIENT_STATE_CHANGED",
    parameters: { fixture_only: true },
    payload: { source: "command-post-due" },
    clinical_effect_ids: ["clinical-effect.synthetic.command-post-due"]
  }]
});

const SAME_TIME_SCHEDULE_RULE = createSyntheticRule({
  rule_id: "rule.synthetic.command-same-time-schedule",
  trigger: {
    trigger_type: "COMMITTED_EVENT",
    event_type: "EXAM_PERFORMED",
    action_id: "examination.synthetic-check"
  },
  effects: [{
    effect_type: "SCHEDULE_RELATIVE",
    effect_id: "effect.synthetic.command-schedule",
    scheduled_item_id: "scheduled-item.synthetic.command-same-time",
    category: "schedule.synthetic-command-same-time",
    delay_clinical_seconds: 3,
    priority: 10,
    conflict_policy: "REPLACE",
    effects: [{
      effect_type: "SET_STATE",
      effect_id: "effect.synthetic.command-same-time-respiratory",
      target: "respiratory_state",
      value: "respiratory.synthetic-altered"
    }, {
      effect_type: "SET_STATE",
      effect_id: "effect.synthetic.command-same-time-oxygenation",
      target: "oxygenation",
      value: "oxygenation.synthetic-altered"
    }],
    emitted_events: [{
      event_type: "PATIENT_STATE_CHANGED",
      parameters: { fixture_only: true },
      payload: { source: "command-same-time-scheduled" },
      clinical_effect_ids: ["clinical-effect.synthetic.command-same-time"]
    }]
  }]
});

describe("V2-006B command orchestration", () => {
  it("drains due work first and evaluates the command against post-due state", async () => {
    const session = createSyntheticCommandSession({
      rules: [POST_DUE_COMMAND_RULE],
      schedulerItems: [createSyntheticScheduledItem({
        id: "scheduled-item.synthetic.before-command",
        due: 45,
        eventType: "INVESTIGATION_RESULT_AVAILABLE",
        effects: [{
          effect_type: "SET_STATE",
          effect_id: "effect.synthetic.before-command-hemodynamics",
          target: "hemodynamic_state",
          value: "hemodynamics.synthetic-altered"
        }]
      })]
    });
    const result = requireSuccess(await processExternalLearnerCommand(
      session,
      createSyntheticExternalCommand(session, { requestedClinicalTime: 999 }),
      TEST_SESSION_COMMAND_DEPENDENCIES
    ));

    expect(result.committed_events.map((event) => event.event_type)).toEqual([
      "INVESTIGATION_RESULT_AVAILABLE",
      "EXAM_PERFORMED",
      "PATIENT_STATE_CHANGED"
    ]);
    expect(result.committed_events.map((event) => event.clinical_time)).toEqual([45, 45, 45]);
    expect(result.authoritative_session.patient_state.hemodynamic_state).toBe(
      "hemodynamics.synthetic-altered"
    );
    expect(result.authoritative_session.patient_state.consciousness).toBe(
      "consciousness.synthetic-changed"
    );
    expect(result.committed_events[1]?.clinical_time).not.toBe(999);
  });

  it("contains due-work failure and exposes no command event or next aggregate", async () => {
    const session = createSyntheticCommandSession({
      schedulerItems: Array.from({ length: 257 }, (_, index) =>
        createSyntheticScheduledItem({
          id: `scheduled-item.synthetic.command-budget-${String(index).padStart(3, "0")}`,
          due: 45
        }))
    });
    const result = await processExternalLearnerCommand(
      session,
      createSyntheticExternalCommand(session),
      TEST_SESSION_COMMAND_DEPENDENCIES
    );

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.issues.map((issue) => issue.code)).toContain("DUE_WORK_FAILED");
    expect(result).not.toHaveProperty("authoritative_session");
    expect(session.next_sequence_no).toBe(1);
    expect(session.committed_events).toEqual([]);
  });

  it("commits due interrupt settlement but does not execute or record the command", async () => {
    const session = createSyntheticCommandSession({
      interruptingEventTypes: ["CRITICAL_EVENT_OCCURRED"],
      schedulerItems: [createSyntheticScheduledItem({
        id: "scheduled-item.synthetic.before-command-interrupt",
        due: 45,
        eventType: "CRITICAL_EVENT_OCCURRED",
        effects: [{
          effect_type: "SET_STATE",
          effect_id: "effect.synthetic.before-command-interrupt-state",
          target: "hemodynamic_state",
          value: "hemodynamics.synthetic-altered"
        }]
      })]
    });
    const command = createSyntheticExternalCommand(session);
    const interrupted = requireSuccess(await processExternalLearnerCommand(
      session,
      command,
      TEST_SESSION_COMMAND_DEPENDENCIES
    ));

    expect(interrupted.status).toBe("INTERRUPTED_BEFORE_COMMAND");
    expect(interrupted.command_executed).toBe(false);
    expect(interrupted.committed_events.map((event) => event.event_type)).toEqual([
      "CRITICAL_EVENT_OCCURRED"
    ]);
    expect(interrupted.authoritative_session.idempotency_records).toEqual([]);
    expect(interrupted.authoritative_session.patient_state.hemodynamic_state).toBe(
      "hemodynamics.synthetic-altered"
    );

    const resumed = requireSuccess(await processExternalLearnerCommand(
      interrupted.authoritative_session,
      {
        ...command,
        action_request: {
          ...command.action_request,
          expected_state_version: interrupted.authoritative_session.patient_state.state_version
        }
      },
      TEST_SESSION_COMMAND_DEPENDENCIES
    ));
    expect(resumed.status).toBe("COMMITTED");
    expect(resumed.committed_events.map((event) => event.event_type)).toEqual(["EXAM_PERFORMED"]);
  });

  it("accepts only pinned Case actions and rejects raw effect/state payloads", async () => {
    const session = createSyntheticCommandSession();
    const accepted = requireSuccess(await processExternalLearnerCommand(
      session,
      createSyntheticExternalCommand(session),
      TEST_SESSION_COMMAND_DEPENDENCIES
    ));
    expect(accepted.committed_events[0]).toMatchObject({
      event_type: "EXAM_PERFORMED",
      action_id: "examination.synthetic-check",
      status: "COMMITTED"
    });

    const unknown = await processExternalLearnerCommand(
      session,
      createSyntheticExternalCommand(session, { actionId: "examination.unknown" }),
      TEST_SESSION_COMMAND_DEPENDENCIES
    );
    expect(!unknown.success && unknown.issues.map((issue) => issue.code)).toContain(
      "UNKNOWN_ACTION_ID"
    );

    const unsafe = await processExternalLearnerCommand(
      session,
      {
        ...createSyntheticExternalCommand(session),
        clinical_effects: [{ target: "cardiac_rhythm", value: "rhythm.client-write" }],
        patient_state: { cardiac_rhythm: "rhythm.client-write" }
      },
      TEST_SESSION_COMMAND_DEPENDENCIES
    );
    expect(!unsafe.success && unsafe.issues.map((issue) => issue.code)).toEqual([
      "INVALID_COMMAND_INPUT"
    ]);
  });

  it("commits command-triggered scheduler changes atomically without executing future work", async () => {
    const session = createSyntheticCommandSession({ rules: [SAME_TIME_SCHEDULE_RULE] });
    const result = requireSuccess(await processExternalLearnerCommand(
      session,
      createSyntheticExternalCommand(session),
      TEST_SESSION_COMMAND_DEPENDENCIES
    ));

    expect(result.authoritative_session.scheduler_state.pending_items).toHaveLength(1);
    expect(result.authoritative_session.scheduler_state.pending_items[0]).toMatchObject({
      scheduled_item_id: "scheduled-item.synthetic.command-same-time",
      due_clinical_time: 48
    });
    expect(result.authoritative_session.patient_state.respiratory_state).toBe(
      "respiratory.synthetic-baseline"
    );
    expect(result.committed_events.map((event) => event.event_type)).toEqual(["EXAM_PERFORMED"]);
  });

  it("uses deterministic canonical command fingerprints independent of key insertion order", async () => {
    const action = createSyntheticPinnedAction({
      parameter_definitions: [{
        parameter_code: "parameter.alpha",
        value_type: "STRING",
        required: true
      }, {
        parameter_code: "parameter.beta",
        value_type: "INTEGER",
        required: true
      }]
    });
    const session = createSyntheticCommandSession({ actions: [action] });
    const first = createSyntheticExternalCommand(session, {
      parameters: { "parameter.alpha": "value", "parameter.beta": 2 }
    });
    const second = createSyntheticExternalCommand(session, {
      parameters: { "parameter.beta": 2, "parameter.alpha": "value" }
    });
    const firstFingerprint = await fingerprintExternalLearnerCommand(first, TEST_HASH_ADAPTER);
    const secondFingerprint = await fingerprintExternalLearnerCommand(second, TEST_HASH_ADAPTER);

    expect(firstFingerprint.success).toBe(true);
    expect(secondFingerprint.success).toBe(true);
    if (!firstFingerprint.success || !secondFingerprint.success) return;
    expect(secondFingerprint.fingerprint).toBe(firstFingerprint.fingerprint);
    expect(secondFingerprint.canonical_payload).toBe(firstFingerprint.canonical_payload);
  });
});
