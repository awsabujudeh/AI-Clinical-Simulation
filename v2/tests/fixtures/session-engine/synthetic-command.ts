import {
  compileCasePackage
} from "../../../packages/case-schema/src/index.ts";
import {
  InMemorySessionAggregateSchema,
  InMemorySessionCommitAdapter,
  ExternalLearnerCommandEnvelopeSchema,
  PinnedSessionActionDefinitionSchema,
  PinnedSessionCaseContextSchema,
  initializeInMemorySession,
  createSessionCoordinator,
  processExternalLearnerCommand,
  type EventIdFactory,
  type ExternalLearnerCommandEnvelope,
  type InMemorySessionAggregate,
  type PinnedSessionActionDefinition,
  type SessionCommandDependencies
} from "../../../packages/session-engine/src/index.ts";
import {
  PatientStateSchema,
  SchedulerStateSchema,
  type EventType,
  type ScheduledItem,
  type TransitionRule
} from "../../../packages/contracts/src/index.ts";
import {
  TEST_HASH_ADAPTER,
  createFinalPublicationFixture
} from "../cases/synthetic-case.ts";
import { BASELINE_PATIENT_STATE } from "../clinical-engine/synthetic-state.ts";
import { createSyntheticSessionPolicy } from "./synthetic-session.ts";

export const TEST_REAL_TIME_UTC = "2026-09-01T12:00:00Z";

export const DETERMINISTIC_EVENT_ID_FACTORY: EventIdFactory = {
  createEventId(input) {
    const suffix = String(input.sequence_no).padStart(12, "0");
    return `00000000-0000-4000-8000-${suffix}`;
  }
};

export const TEST_SESSION_COMMAND_DEPENDENCIES: SessionCommandDependencies = {
  hash_adapter: TEST_HASH_ADAPTER,
  event_id_factory: DETERMINISTIC_EVENT_ID_FACTORY,
  real_time_utc: TEST_REAL_TIME_UTC
};

export function createSyntheticPinnedAction(
  overrides: Record<string, unknown> = {}
): PinnedSessionActionDefinition {
  return PinnedSessionActionDefinitionSchema.parse({
    action_id: "examination.synthetic-check",
    action_type: "EXAMINATION",
    parameter_definitions: [],
    prerequisite_action_ids: [],
    confirmation_policy: "NONE",
    repeat_policy: "REPEATABLE",
    execution_event_type: "EXAM_PERFORMED",
    ...overrides
  });
}

export function createSyntheticCommandSession(input?: {
  rules?: readonly TransitionRule[];
  interruptingEventTypes?: readonly EventType[];
  schedulerItems?: readonly ScheduledItem[];
  state?: unknown;
  actions?: readonly PinnedSessionActionDefinition[];
  trustedRealTimeUtc?: string;
}): InMemorySessionAggregate {
  const policy = createSyntheticSessionPolicy({
    rules: input?.rules ?? [],
    interruptingEventTypes: input?.interruptingEventTypes ?? []
  });
  const state = PatientStateSchema.parse(input?.state ?? BASELINE_PATIENT_STATE);
  const context = PinnedSessionCaseContextSchema.parse({
    context_schema_version: "1.0",
    execution_authority: "PUBLISHED_PRODUCTION",
    case_package_id: policy.case_package_id,
    case_version_id: policy.case_version_id,
    case_version: policy.case_version,
    package_hash: policy.package_hash,
    clinical_policy: policy,
    action_catalogue: input?.actions ?? [createSyntheticPinnedAction()]
  });
  return InMemorySessionAggregateSchema.parse({
    aggregate_schema_version: "1.0",
    status: "ACTIVE",
    session_id: state.session_id,
    mode: "PRACTICE_DEMO",
    pinned_case: context,
    patient_state: state,
    scheduler_state: SchedulerStateSchema.parse({
      scheduler_schema_version: "1.0",
      pending_items: input?.schedulerItems ?? []
    }),
    clinical_clock: {
      clock_schema_version: "1.0",
      status: "RUNNING",
      clinical_time: state.clinical_time
    },
    ...(input?.trustedRealTimeUtc === undefined
      ? {}
      : { trusted_real_time_anchor_utc: input.trustedRealTimeUtc }),
    committed_events: [],
    next_sequence_no: 1,
    idempotency_records: []
  });
}

export function createCoordinatorContext(
  session: InMemorySessionAggregate,
  trustedRealTimeUtc: string,
  suffix = "001"
) {
  return {
    coordinator_schema_version: "1.0" as const,
    session_id: session.session_id,
    trusted_real_time_utc: trustedRealTimeUtc,
    request_id: `request.synthetic.coordinator-${suffix}`,
    correlation_id: `correlation.synthetic.coordinator-${suffix}`,
    idempotency_key: `idempotency.synthetic.coordinator-${suffix}`
  };
}

export function createSyntheticExternalCommand(
  session: InMemorySessionAggregate,
  overrides?: {
    idempotencyKey?: string;
    commandId?: string;
    actionRequestId?: string;
    actionId?: string;
    parameters?: Record<string, unknown>;
    expectedStateVersion?: number;
    requestedClinicalTime?: number;
    requestId?: string;
    correlationId?: string;
    expectedPackageHash?: string;
  }
): ExternalLearnerCommandEnvelope {
  if (session.pinned_case.execution_authority !== "PUBLISHED_PRODUCTION") {
    throw new Error("Synthetic production command fixture requires production authority.");
  }
  return ExternalLearnerCommandEnvelopeSchema.parse({
    command_schema_version: "1.0",
    request_id: overrides?.requestId ?? "request.synthetic.command-001",
    correlation_id: overrides?.correlationId ?? "correlation.synthetic.command-001",
    learner_actor_id: "actor.synthetic.learner-001",
    expected_case: {
      execution_authority: "PUBLISHED_PRODUCTION",
      case_package_id: session.pinned_case.case_package_id,
      case_version_id: session.pinned_case.case_version_id,
      case_version: session.pinned_case.case_version,
      package_hash: overrides?.expectedPackageHash ?? session.pinned_case.package_hash
    },
    action_request: {
      action_request_id: overrides?.actionRequestId ?? "action-request.synthetic.001",
      catalogue_membership: "UNVERIFIED",
      command_id: overrides?.commandId ?? "command.synthetic.001",
      session_id: session.session_id,
      action_id: overrides?.actionId ?? "examination.synthetic-check",
      request_schema_version: "1.0",
      expected_state_version: overrides?.expectedStateVersion
        ?? session.patient_state.state_version,
      requested_at_clinical_time: overrides?.requestedClinicalTime
        ?? session.patient_state.clinical_time,
      parameters: overrides?.parameters ?? {},
      source: "UI",
      idempotency_key: overrides?.idempotencyKey ?? "idempotency.synthetic.command-001"
    }
  });
}

export async function createCompiledSyntheticCommandSession() {
  const fixture = await createFinalPublicationFixture();
  const compilation = await compileCasePackage(
    fixture.approved,
    fixture.approval,
    TEST_HASH_ADAPTER
  );
  if (!compilation.success) throw new Error(JSON.stringify(compilation.report));
  const initialized = initializeInMemorySession({
    session_id: "session.synthetic.compiled-command",
    mode: "PRACTICE_DEMO",
    compiled_case_package: compilation.package
  });
  if (!initialized.success) throw new Error(JSON.stringify(initialized.issues));
  return { session: initialized.session, package: compilation.package };
}

export async function createV2006BPortabilitySnapshot() {
  const session = createSyntheticCommandSession();
  const command = createSyntheticExternalCommand(session);
  const first = await processExternalLearnerCommand(
    session,
    command,
    TEST_SESSION_COMMAND_DEPENDENCIES
  );
  if (!first.success) throw new Error(JSON.stringify(first.issues));
  const retry = await processExternalLearnerCommand(
    first.authoritative_session,
    command,
    TEST_SESSION_COMMAND_DEPENDENCIES
  );
  if (!retry.success) throw new Error(JSON.stringify(retry.issues));
  return {
    first: {
      status: first.status,
      event_ids: first.committed_events.map((event) => event.event_id),
      sequences: first.committed_events.map((event) => event.sequence_no),
      event_types: first.committed_events.map((event) => event.event_type),
      state_version: first.authoritative_session.patient_state.state_version,
      next_sequence_no: first.authoritative_session.next_sequence_no,
      idempotency_count: first.authoritative_session.idempotency_records.length
    },
    retry: {
      status: retry.status,
      replayed: retry.replayed,
      event_ids: retry.committed_events.map((event) => event.event_id),
      next_sequence_no: retry.authoritative_session.next_sequence_no,
      idempotency_count: retry.authoritative_session.idempotency_records.length
    }
  };
}

export const V2_006B_COMMAND_PORTABILITY_EXPECTED = JSON.stringify({
  first: {
    status: "COMMITTED",
    event_ids: ["00000000-0000-4000-8000-000000000001"],
    sequences: [1],
    event_types: ["EXAM_PERFORMED"],
    state_version: 4,
    next_sequence_no: 2,
    idempotency_count: 1
  },
  retry: {
    status: "REPLAYED",
    replayed: true,
    event_ids: ["00000000-0000-4000-8000-000000000001"],
    next_sequence_no: 2,
    idempotency_count: 1
  }
});

export async function createV2006CPortabilitySnapshot() {
  const session = createSyntheticCommandSession({
    trustedRealTimeUtc: TEST_REAL_TIME_UTC
  });
  const adapter = new InMemorySessionCommitAdapter([session]);
  const coordinator = createSessionCoordinator({
    adapter,
    hash_adapter: TEST_HASH_ADAPTER,
    event_id_factory: DETERMINISTIC_EVENT_ID_FACTORY
  });
  const synced = await coordinator.syncRunningSession(
    createCoordinatorContext(session, "2026-09-01T12:00:05Z", "sync")
  );
  if (!synced.success) throw new Error(JSON.stringify(synced.issues));
  const paused = await coordinator.pauseSession(
    createCoordinatorContext(session, "2026-09-01T12:00:08Z", "pause")
  );
  if (!paused.success) throw new Error(JSON.stringify(paused.issues));
  const slept = await coordinator.syncRunningSession(
    createCoordinatorContext(session, "2026-09-01T12:05:00Z", "sleep")
  );
  if (!slept.success) throw new Error(JSON.stringify(slept.issues));
  const resumed = await coordinator.resumeSession(
    createCoordinatorContext(session, "2026-09-01T12:05:00Z", "resume")
  );
  if (!resumed.success) throw new Error(JSON.stringify(resumed.issues));
  const afterResume = await coordinator.syncRunningSession(
    createCoordinatorContext(session, "2026-09-01T12:05:02Z", "after-resume")
  );
  if (!afterResume.success) throw new Error(JSON.stringify(afterResume.issues));
  return {
    synced: {
      status: synced.status,
      clinical_time: synced.authoritative_session.patient_state.clinical_time,
      anchor: synced.authoritative_session.trusted_real_time_anchor_utc
    },
    paused: {
      status: paused.status,
      clock_status: paused.authoritative_session.clinical_clock.status,
      clinical_time: paused.authoritative_session.patient_state.clinical_time,
      event_types: paused.committed_events.map((event) => event.event_type)
    },
    slept: {
      status: slept.status,
      clinical_time: slept.authoritative_session.patient_state.clinical_time
    },
    resumed: {
      status: resumed.status,
      clock_status: resumed.authoritative_session.clinical_clock.status,
      anchor: resumed.authoritative_session.trusted_real_time_anchor_utc,
      event_types: resumed.committed_events.map((event) => event.event_type)
    },
    after_resume: {
      clinical_time: afterResume.authoritative_session.patient_state.clinical_time,
      next_sequence_no: afterResume.authoritative_session.next_sequence_no
    }
  };
}

export const V2_006C_COORDINATOR_PORTABILITY_EXPECTED = JSON.stringify({
  synced: {
    status: "COMMITTED",
    clinical_time: 50,
    anchor: "2026-09-01T12:00:05Z"
  },
  paused: {
    status: "COMMITTED",
    clock_status: "PAUSED",
    clinical_time: 53,
    event_types: ["SESSION_PAUSED"]
  },
  slept: {
    status: "NO_CHANGE",
    clinical_time: 53
  },
  resumed: {
    status: "COMMITTED",
    clock_status: "RUNNING",
    anchor: "2026-09-01T12:05:00Z",
    event_types: ["SESSION_RESUMED"]
  },
  after_resume: {
    clinical_time: 55,
    next_sequence_no: 3
  }
});
