import {
  CLINICAL_TIME_ADVANCEMENT_SCHEMA_VERSION,
  advanceClinicalTime,
  initializeSessionClinicalClock,
  type ClinicalTimeAdvancementSuccess
} from "../../../packages/session-engine/src/index.ts";
import {
  SCHEDULER_SCHEMA_VERSION,
  ScheduledItemSchema,
  SchedulerStateSchema,
  type EventType,
  type ScheduledItem,
  type TransitionRule
} from "../../../packages/contracts/src/index.ts";

import {
  BASELINE_PATIENT_STATE
} from "../clinical-engine/synthetic-state.ts";
import {
  createSyntheticPinnedPolicy,
  createSyntheticRule
} from "../clinical-engine/synthetic-transitions.ts";

export function createSyntheticScheduledItem(input: {
  id: string;
  due: number;
  category?: string;
  eventType?: EventType;
  effects?: unknown[];
}): ScheduledItem {
  return ScheduledItemSchema.parse({
    scheduler_schema_version: SCHEDULER_SCHEMA_VERSION,
    scheduled_item_id: input.id,
    originating_rule_id: "rule.synthetic.session-clock",
    category: input.category ?? "schedule.synthetic-session",
    due_clinical_time: input.due,
    priority: 10,
    conflict_policy: "REPLACE",
    effects: input.effects ?? [],
    emitted_events: input.eventType === undefined
      ? []
      : [{
          event_type: input.eventType,
          parameters: { fixture_only: true },
          payload: { scheduled_item_id: input.id },
          clinical_effect_ids: []
        }]
  });
}

export const BASELINE_CLOCK = (() => {
  const result = initializeSessionClinicalClock(BASELINE_PATIENT_STATE.clinical_time);
  if (!result.success) throw new Error("Synthetic clock initialization failed.");
  return result.clock;
})();

export function createSyntheticSessionPolicy(input?: {
  rules?: readonly TransitionRule[];
  interruptingEventTypes?: readonly EventType[];
}) {
  const base = createSyntheticPinnedPolicy(input?.rules ?? []);
  return {
    ...base,
    timeline_policy: {
      ...base.timeline_policy,
      interrupting_event_types: [...(input?.interruptingEventTypes ?? [])].sort()
    }
  };
}

export function createAdvancementInput(input?: {
  target?: number;
  state?: typeof BASELINE_PATIENT_STATE;
  schedulerItems?: ScheduledItem[];
  policy?: ReturnType<typeof createSyntheticSessionPolicy>;
  clock?: typeof BASELINE_CLOCK;
}) {
  return {
    advancement_schema_version: CLINICAL_TIME_ADVANCEMENT_SCHEMA_VERSION,
    source: "CASE_OWNED_DURATION" as const,
    clock: input?.clock ?? BASELINE_CLOCK,
    policy: input?.policy ?? createSyntheticSessionPolicy(),
    state: input?.state ?? BASELINE_PATIENT_STATE,
    scheduler_state: SchedulerStateSchema.parse({
      scheduler_schema_version: SCHEDULER_SCHEMA_VERSION,
      pending_items: input?.schedulerItems ?? []
    }),
    prior_event_facts: [],
    requested_target_clinical_time: input?.target ?? 60
  };
}

export const CREATE_NESTED_DUE_RULE = createSyntheticRule({
  rule_id: "rule.synthetic.create-nested-due",
  trigger: {
    trigger_type: "SCHEDULED_ITEM",
    category: "schedule.synthetic-seed"
  },
  effects: [{
    effect_type: "SCHEDULE_RELATIVE",
    effect_id: "effect.synthetic.create-nested-due",
    scheduled_item_id: "scheduled-item.synthetic.nested-due",
    category: "schedule.synthetic-nested",
    delay_clinical_seconds: 3,
    priority: 10,
    conflict_policy: "REPLACE",
    effects: [{
      effect_type: "SET_STATE",
      effect_id: "effect.synthetic.nested-consciousness",
      target: "consciousness",
      value: "consciousness.synthetic-changed"
    }],
    emitted_events: [{
      event_type: "INVESTIGATION_RESULT_AVAILABLE",
      parameters: { fixture_only: true },
      payload: { result: "synthetic-nested" },
      clinical_effect_ids: []
    }]
  }]
});

function requireSuccess(
  result: ReturnType<typeof advanceClinicalTime>
): ClinicalTimeAdvancementSuccess {
  if (!result.success) throw new Error(JSON.stringify(result));
  return result;
}

export function createSessionEnginePortabilitySnapshot() {
  const policy = createSyntheticSessionPolicy({
    interruptingEventTypes: ["CRITICAL_EVENT_OCCURRED"]
  });
  const scheduledItems = [
    createSyntheticScheduledItem({
      id: "scheduled-item.synthetic.baseline-change",
      due: 50,
      eventType: "PATIENT_STATE_CHANGED",
      effects: [{
        effect_type: "SET_STATE",
        effect_id: "effect.synthetic.portability-hemodynamics",
        target: "hemodynamic_state",
        value: "hemodynamics.synthetic-altered"
      }]
    }),
    createSyntheticScheduledItem({
      id: "scheduled-item.synthetic.interrupt",
      due: 55,
      eventType: "CRITICAL_EVENT_OCCURRED",
      effects: [{
        effect_type: "SET_STATE",
        effect_id: "effect.synthetic.portability-rhythm",
        target: "cardiac_rhythm",
        value: "rhythm.synthetic-alternative"
      }]
    }),
    createSyntheticScheduledItem({
      id: "scheduled-item.synthetic.future",
      due: 60,
      eventType: "OUTCOME_REACHED",
      effects: [{
        effect_type: "SET_STATE",
        effect_id: "effect.synthetic.portability-consciousness",
        target: "consciousness",
        value: "consciousness.synthetic-changed"
      }]
    })
  ];
  const interrupted = requireSuccess(advanceClinicalTime(createAdvancementInput({
    target: 65,
    policy,
    schedulerItems: scheduledItems
  })));
  const resumed = requireSuccess(advanceClinicalTime(createAdvancementInput({
    target: 65,
    policy,
    state: interrupted.next_state,
    clock: interrupted.next_clock,
    schedulerItems: interrupted.next_scheduler_state.pending_items
  })));

  return {
    interrupted: {
      status: interrupted.status,
      reached_clinical_time: interrupted.reached_clinical_time,
      event_times: interrupted.event_proposals.map((event) => event.proposed_clinical_time),
      event_types: interrupted.event_proposals.map((event) => event.event_type),
      pending_ids: interrupted.next_scheduler_state.pending_items.map(
        (item) => item.scheduled_item_id
      ),
      rhythm: interrupted.next_state.cardiac_rhythm
    },
    resumed: {
      status: resumed.status,
      reached_clinical_time: resumed.reached_clinical_time,
      event_times: resumed.event_proposals.map((event) => event.proposed_clinical_time),
      event_types: resumed.event_proposals.map((event) => event.event_type),
      pending_ids: resumed.next_scheduler_state.pending_items.map(
        (item) => item.scheduled_item_id
      ),
      consciousness: resumed.next_state.consciousness
    }
  };
}

export const SESSION_ENGINE_PORTABILITY_EXPECTED = JSON.stringify({
  interrupted: {
    status: "INTERRUPTED",
    reached_clinical_time: 55,
    event_times: [50, 55],
    event_types: ["PATIENT_STATE_CHANGED", "CRITICAL_EVENT_OCCURRED"],
    pending_ids: ["scheduled-item.synthetic.future"],
    rhythm: "rhythm.synthetic-alternative"
  },
  resumed: {
    status: "REACHED_TARGET",
    reached_clinical_time: 65,
    event_times: [60],
    event_types: ["OUTCOME_REACHED"],
    pending_ids: [],
    consciousness: "consciousness.synthetic-changed"
  }
});
