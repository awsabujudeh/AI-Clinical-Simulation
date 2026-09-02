import type { CanonicalEventEnvelope } from "../../../contracts/src/index.ts";
import type {
  RubricEventMatcher,
  RubricEvidence,
  TimingWindow
} from "../../../case-schema/src/index.ts";

export type RubricEvidenceResolution =
  | {
      success: true;
      events: CanonicalEventEnvelope[];
      outside_timing_window: boolean;
      sequence_constraint_unsatisfied: boolean;
    }
  | { success: false; missing_timing_window_id: string };

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A learner event proves execution only when the committed Session envelope says so. */
export function isCommittedLearnerExecution(event: CanonicalEventEnvelope): boolean {
  if (
    event.status !== "COMMITTED"
    || event.actor_type !== "LEARNER"
    || event.action_request_id === undefined
    || event.action_id === undefined
    || !isObjectRecord(event.payload)
  ) {
    return false;
  }
  return Object.prototype.hasOwnProperty.call(event.payload, "catalogue_membership")
    && Object.prototype.hasOwnProperty.call(event.payload, "execution_status")
    && event.payload.catalogue_membership === "VERIFIED"
    && event.payload.execution_status === "EXECUTED";
}

export function eventMatchesRubricMatcher(
  event: CanonicalEventEnvelope,
  matcher: RubricEventMatcher
): boolean {
  if (
    matcher.authority === "COMMITTED_LEARNER_EXECUTION"
    && !isCommittedLearnerExecution(event)
  ) {
    return false;
  }
  if (matcher.action_ids.length > 0) {
    if (event.action_id === undefined || !matcher.action_ids.includes(event.action_id)) {
      return false;
    }
  }
  return matcher.event_types.length === 0 || matcher.event_types.includes(event.event_type);
}

function isInsideWindow(clinicalTime: number, timingDefinition: TimingWindow): boolean {
  const afterStart = timingDefinition.start_inclusive
    ? clinicalTime >= timingDefinition.starts_at_clinical_seconds
    : clinicalTime > timingDefinition.starts_at_clinical_seconds;
  const beforeEnd = timingDefinition.end_inclusive
    ? clinicalTime <= timingDefinition.ends_at_clinical_seconds
    : clinicalTime < timingDefinition.ends_at_clinical_seconds;
  return afterStart && beforeEnd;
}

function satisfiesSequenceConstraint(
  event: CanonicalEventEnvelope,
  evidence: RubricEvidence,
  events: readonly CanonicalEventEnvelope[]
): boolean {
  const constraint = evidence.sequence_constraint;
  if (constraint === undefined) return true;
  return events.some((reference) => {
    if (!eventMatchesRubricMatcher(reference, constraint.reference)) return false;
    return constraint.relation === "BEFORE"
      ? event.sequence_no < reference.sequence_no
      : event.sequence_no > reference.sequence_no;
  });
}

/** Resolves only committed timeline evidence and preserves authoritative sequence order. */
export function resolveRubricEvidence(
  evidence: RubricEvidence,
  events: readonly CanonicalEventEnvelope[],
  timingWindows: ReadonlyMap<string, TimingWindow>
): RubricEvidenceResolution {
  const matched = events.filter((event) => eventMatchesRubricMatcher(event, evidence));
  let timeEligible = matched;
  let outsideTimingWindow = false;
  if (evidence.timing_window_id !== undefined) {
    const timingWindow = timingWindows.get(evidence.timing_window_id);
    if (timingWindow === undefined) {
      return { success: false, missing_timing_window_id: evidence.timing_window_id };
    }
    timeEligible = matched.filter((event) => isInsideWindow(event.clinical_time, timingWindow));
    outsideTimingWindow = matched.length > 0 && timeEligible.length === 0;
  }

  const sequenceEligible = timeEligible.filter((event) =>
    satisfiesSequenceConstraint(event, evidence, events)
  );
  return {
    success: true,
    events: sequenceEligible,
    outside_timing_window: outsideTimingWindow,
    sequence_constraint_unsatisfied: timeEligible.length > 0 && sequenceEligible.length === 0
  };
}
