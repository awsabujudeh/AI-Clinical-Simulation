import { describe, expect, it } from "vitest";

import {
  InMemorySessionCommitAdapter,
  advanceClinicalTime,
  createSessionCoordinator
} from "../../../packages/session-engine/src/index.ts";
import {
  TEST_HASH_ADAPTER
} from "../../fixtures/cases/synthetic-case.ts";
import {
  CREATE_NESTED_DUE_RULE,
  createAdvancementInput,
  createSyntheticScheduledItem
} from "../../fixtures/session-engine/synthetic-session.ts";
import {
  DETERMINISTIC_EVENT_ID_FACTORY,
  TEST_REAL_TIME_UTC,
  createCoordinatorContext,
  createSyntheticCommandSession
} from "../../fixtures/session-engine/synthetic-command.ts";

function requireSuccess<T extends { success: boolean }>(
  result: T
): Extract<T, { success: true }> {
  expect(result.success).toBe(true);
  if (!result.success) throw new Error(JSON.stringify(result));
  return result as Extract<T, { success: true }>;
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

describe("trusted-time Session coordination", () => {
  it("establishes a first trusted anchor without inventing elapsed Clinical Time", async () => {
    const session = createSyntheticCommandSession();
    const { coordinator } = setup(session);
    const anchored = requireSuccess(await coordinator.syncRunningSession(
      createCoordinatorContext(session, TEST_REAL_TIME_UTC, "first-anchor")
    ));
    expect(anchored.status).toBe("COMMITTED");
    expect(anchored.authoritative_session.patient_state.clinical_time).toBe(
      session.patient_state.clinical_time
    );
    expect(anchored.authoritative_session.trusted_real_time_anchor_utc).toBe(
      TEST_REAL_TIME_UTC
    );
  });

  it("advances a RUNNING Session at ratio 1.0 and makes repeated time a no-op", async () => {
    const { adapter, coordinator, session } = setup();
    const first = requireSuccess(await coordinator.syncRunningSession(
      createCoordinatorContext(session, "2026-09-01T12:00:05Z", "normal")
    ));
    const repeated = requireSuccess(await coordinator.syncRunningSession(
      createCoordinatorContext(session, "2026-09-01T12:00:05Z", "repeat")
    ));
    const stored = requireSuccess(await adapter.load(session.session_id)).session;

    expect(first.status).toBe("COMMITTED");
    expect(first.authoritative_session.patient_state.clinical_time).toBe(50);
    expect(repeated.status).toBe("NO_CHANGE");
    expect(repeated.committed_events).toEqual([]);
    expect(stored.next_sequence_no).toBe(1);
    expect(stored.patient_state.state_version).toBe(
      first.authoritative_session.patient_state.state_version
    );
  });

  it("fails a backward trusted timestamp closed without changing authority", async () => {
    const { adapter, coordinator, session } = setup();
    const before = requireSuccess(await adapter.load(session.session_id));
    const result = await coordinator.syncRunningSession(
      createCoordinatorContext(session, "2026-09-01T11:59:59Z", "backward")
    );
    expect(result.success).toBe(false);
    if (result.success) throw new Error("Expected trusted-time regression.");
    expect(result.issues.map((issue) => issue.code)).toEqual(["TRUSTED_TIME_REGRESSION"]);
    expect(requireSuccess(await adapter.load(session.session_id)).session).toEqual(before.session);
  });

  it("fails non-whole-second trusted elapsed input instead of rounding silently", async () => {
    const { coordinator, session } = setup();
    const result = await coordinator.syncRunningSession(
      createCoordinatorContext(session, "2026-09-01T12:00:00.5Z", "subsecond")
    );
    expect(result.success).toBe(false);
    if (result.success) throw new Error("Expected trusted-time precision failure.");
    expect(result.issues.map((issue) => issue.code)).toEqual([
      "TRUSTED_TIME_PRECISION_INVALID"
    ]);
  });

  it("catches up a browser-sleep interval chronologically and retains future work", async () => {
    const session = createSyntheticCommandSession({
      trustedRealTimeUtc: TEST_REAL_TIME_UTC,
      schedulerItems: [
        createSyntheticScheduledItem({
          id: "scheduled-item.synthetic.sleep-50",
          due: 50,
          eventType: "PATIENT_STATE_CHANGED"
        }),
        createSyntheticScheduledItem({
          id: "scheduled-item.synthetic.sleep-60",
          due: 60,
          eventType: "INVESTIGATION_RESULT_AVAILABLE"
        }),
        createSyntheticScheduledItem({
          id: "scheduled-item.synthetic.future-180",
          due: 180,
          eventType: "OUTCOME_REACHED"
        })
      ]
    });
    const { coordinator } = setup(session);
    const result = requireSuccess(await coordinator.syncRunningSession(
      createCoordinatorContext(session, "2026-09-01T12:02:00Z", "sleep-catch-up")
    ));

    expect(result.authoritative_session.patient_state.clinical_time).toBe(165);
    expect(result.committed_events.map((event) => [event.clinical_time, event.event_type])).toEqual([
      [50, "PATIENT_STATE_CHANGED"],
      [60, "INVESTIGATION_RESULT_AVAILABLE"]
    ]);
    expect(result.authoritative_session.scheduler_state.pending_items.map(
      (item) => item.scheduled_item_id
    )).toEqual(["scheduled-item.synthetic.future-180"]);
  });

  it("processes newly-created due work inside one catch-up interval", async () => {
    const session = createSyntheticCommandSession({
      trustedRealTimeUtc: TEST_REAL_TIME_UTC,
      rules: [CREATE_NESTED_DUE_RULE],
      schedulerItems: [createSyntheticScheduledItem({
        id: "scheduled-item.synthetic.seed",
        due: 50,
        category: "schedule.synthetic-seed"
      })]
    });
    const { coordinator } = setup(session);
    const result = requireSuccess(await coordinator.syncRunningSession(
      createCoordinatorContext(session, "2026-09-01T12:00:20Z", "nested")
    ));

    expect(result.authoritative_session.patient_state.clinical_time).toBe(65);
    expect(result.authoritative_session.patient_state.consciousness).toBe(
      "consciousness.synthetic-changed"
    );
    expect(result.committed_events.map((event) => event.clinical_time)).toEqual([53]);
  });

  it("stops catch-up at an interrupt and later resumes without duplicate settlement", async () => {
    const session = createSyntheticCommandSession({
      trustedRealTimeUtc: TEST_REAL_TIME_UTC,
      interruptingEventTypes: ["CRITICAL_EVENT_OCCURRED"],
      schedulerItems: [
        createSyntheticScheduledItem({
          id: "scheduled-item.synthetic.pre-interrupt",
          due: 50,
          eventType: "PATIENT_STATE_CHANGED"
        }),
        createSyntheticScheduledItem({
          id: "scheduled-item.synthetic.interrupt",
          due: 55,
          eventType: "CRITICAL_EVENT_OCCURRED"
        }),
        createSyntheticScheduledItem({
          id: "scheduled-item.synthetic.after-interrupt",
          due: 60,
          eventType: "OUTCOME_REACHED"
        })
      ]
    });
    const { coordinator } = setup(session);
    const interrupted = requireSuccess(await coordinator.syncRunningSession(
      createCoordinatorContext(session, "2026-09-01T12:00:20Z", "interrupt")
    ));
    expect(interrupted.status).toBe("INTERRUPTED");
    expect(interrupted.authoritative_session.patient_state.clinical_time).toBe(55);
    expect(interrupted.authoritative_session.trusted_real_time_anchor_utc).toBe(
      "2026-09-01T12:00:10Z"
    );
    expect(interrupted.authoritative_session.scheduler_state.pending_items.map(
      (item) => item.scheduled_item_id
    )).toEqual(["scheduled-item.synthetic.after-interrupt"]);

    const resumed = requireSuccess(await coordinator.syncRunningSession(
      createCoordinatorContext(session, "2026-09-01T12:00:20Z", "after-interrupt")
    ));
    expect(resumed.authoritative_session.patient_state.clinical_time).toBe(65);
    expect(resumed.authoritative_session.committed_events.map(
      (event) => event.event_type
    )).toEqual([
      "PATIENT_STATE_CHANGED",
      "CRITICAL_EVENT_OCCURRED",
      "OUTCOME_REACHED"
    ]);
  });

  it("pauses after synchronization and resumes from a new anchor with no sleep catch-up", async () => {
    const { coordinator, session } = setup();
    const paused = requireSuccess(await coordinator.pauseSession(
      createCoordinatorContext(session, "2026-09-01T12:00:05Z", "pause")
    ));
    const repeatedPause = requireSuccess(await coordinator.pauseSession(
      createCoordinatorContext(session, "2026-09-01T12:00:06Z", "repeat-pause")
    ));
    const slept = requireSuccess(await coordinator.syncRunningSession(
      createCoordinatorContext(session, "2026-09-01T12:30:00Z", "paused-sleep")
    ));
    const resumed = requireSuccess(await coordinator.resumeSession(
      createCoordinatorContext(session, "2026-09-01T12:30:00Z", "resume")
    ));
    const repeatedResume = requireSuccess(await coordinator.resumeSession(
      createCoordinatorContext(session, "2026-09-01T12:30:00Z", "repeat-resume")
    ));
    const afterResume = requireSuccess(await coordinator.syncRunningSession(
      createCoordinatorContext(session, "2026-09-01T12:30:02Z", "post-resume")
    ));

    expect(paused.authoritative_session.patient_state.clinical_time).toBe(50);
    expect(paused.authoritative_session.clinical_clock.status).toBe("PAUSED");
    expect(paused.committed_events.map((event) => event.event_type)).toEqual([
      "SESSION_PAUSED"
    ]);
    expect(repeatedPause.status).toBe("NO_CHANGE");
    expect(slept.status).toBe("NO_CHANGE");
    expect(slept.authoritative_session.patient_state.clinical_time).toBe(50);
    expect(resumed.authoritative_session.clinical_clock.status).toBe("RUNNING");
    expect(resumed.authoritative_session.trusted_real_time_anchor_utc).toBe(
      "2026-09-01T12:30:00Z"
    );
    expect(repeatedResume.status).toBe("NO_CHANGE");
    expect(afterResume.authoritative_session.patient_state.clinical_time).toBe(52);
  });

  it("commits an interrupt before pause without falsely applying PAUSED", async () => {
    const session = createSyntheticCommandSession({
      trustedRealTimeUtc: TEST_REAL_TIME_UTC,
      interruptingEventTypes: ["CRITICAL_EVENT_OCCURRED"],
      schedulerItems: [
        createSyntheticScheduledItem({
          id: "scheduled-item.synthetic.pause-interrupt",
          due: 50,
          eventType: "CRITICAL_EVENT_OCCURRED"
        }),
        createSyntheticScheduledItem({
          id: "scheduled-item.synthetic.pause-future",
          due: 52,
          eventType: "OUTCOME_REACHED"
        })
      ]
    });
    const { coordinator } = setup(session);
    const result = requireSuccess(await coordinator.pauseSession(
      createCoordinatorContext(session, "2026-09-01T12:00:10Z", "pause-interrupt")
    ));

    expect(result.status).toBe("INTERRUPTED");
    expect(result.authoritative_session.clinical_clock.status).toBe("RUNNING");
    expect(result.authoritative_session.patient_state.clinical_time).toBe(50);
    expect(result.committed_events.map((event) => event.event_type)).toEqual([
      "CRITICAL_EVENT_OCCURRED"
    ]);
    expect(result.authoritative_session.scheduler_state.pending_items).toHaveLength(1);
  });

  it("keeps action-duration and trusted-time advancement source semantics distinct", () => {
    const actionDriven = requireSuccess(advanceClinicalTime(createAdvancementInput({
      target: 50
    })));
    const trustedSync = requireSuccess(advanceClinicalTime({
      ...createAdvancementInput({ target: 50 }),
      source: "TRUSTED_TIME_SYNC"
    }));
    expect(actionDriven.source).toBe("CASE_OWNED_DURATION");
    expect(trustedSync.source).toBe("TRUSTED_TIME_SYNC");
    expect(trustedSync.next_state).toEqual(actionDriven.next_state);
  });
});
