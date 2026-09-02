import { z } from "zod";

import {
  ActionIdSchema,
  ActionRequestIdSchema,
  ActorIdSchema,
  ClinicalEffectIdSchema,
  ClinicalTimeSchema,
  CorrelationIdSchema,
  EventIdSchema,
  IdempotencyKeySchema,
  RequestIdSchema,
  RuleIdSchema,
  SchemaVersionSchema,
  ScoringEvidenceRefIdSchema,
  SequenceNumberSchema,
  SessionIdSchema,
  StateVersionSchema,
  SemanticVersionSchema
} from "./ids.ts";
import { JsonObjectSchema, JsonValueSchema } from "./json.ts";

const utcTimestampPattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?Z$/u;

function isRealUtcTime(value: string): boolean {
  const match = utcTimestampPattern.exec(value);

  if (match === null) {
    return false;
  }

  const [, yearText, monthText, dayText, hourText, minuteText, secondText, fraction = ""] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const millisecond = Number(`${fraction}000`.slice(0, 3));
  const instant = new Date(0);

  instant.setUTCFullYear(year, month - 1, day);
  instant.setUTCHours(hour, minute, second, millisecond);

  return instant.getUTCFullYear() === year
    && instant.getUTCMonth() === month - 1
    && instant.getUTCDate() === day
    && instant.getUTCHours() === hour
    && instant.getUTCMinutes() === minute
    && instant.getUTCSeconds() === second
    && instant.getUTCMilliseconds() === millisecond;
}

export const RealUtcTimeSchema = z
  .string()
  .regex(
    utcTimestampPattern,
    "Expected an ISO 8601 UTC timestamp ending in Z"
  )
  .refine(isRealUtcTime, "Expected a real UTC date/time")
  .brand<"RealUtcTime">();
export type RealUtcTime = z.infer<typeof RealUtcTimeSchema>;

export const EventActorTypeSchema = z.enum([
  "LEARNER",
  "PATIENT",
  "FACULTY",
  "SYSTEM",
  "AI_WORKFLOW"
]);
export type EventActorType = z.infer<typeof EventActorTypeSchema>;

export const EventSourceSchema = z.enum([
  "UI",
  "NATURAL_LANGUAGE",
  "ENGINE",
  "AI_RESPONSE",
  "FACULTY"
]);
export type EventSource = z.infer<typeof EventSourceSchema>;

export const EventTypeSchema = z.enum([
  "SESSION_STARTED",
  "SESSION_PAUSED",
  "SESSION_RESUMED",
  "SIMULATION_ENDED",
  "QUESTION_ASKED",
  "PATIENT_RESPONSE_RECORDED",
  "EXAM_PERFORMED",
  "EXAM_FINDING_REVEALED",
  "INVESTIGATION_ORDERED",
  "INVESTIGATION_PERFORMED",
  "INVESTIGATION_RESULT_AVAILABLE",
  "INVESTIGATION_IMAGE_AVAILABLE",
  "INVESTIGATION_FORMAL_REPORT_AVAILABLE",
  "INVESTIGATION_CANCELLED",
  "MEDICATION_ORDERED",
  "MEDICATION_ADMINISTERED",
  "MEDICATION_REJECTED",
  "MEDICATION_EFFECT_APPLIED",
  "PROCEDURE_ORDERED",
  "PROCEDURE_PERFORMED",
  "PROCEDURE_CANCELLED",
  "CONSULT_REQUESTED",
  "DIAGNOSIS_SUBMITTED",
  "DISPOSITION_SELECTED",
  "PATIENT_STATE_CHANGED",
  "CRITICAL_EVENT_OCCURRED",
  "COMPLICATION_ACTIVATED",
  "OUTCOME_REACHED"
]);
export type EventType = z.infer<typeof EventTypeSchema>;

export const CanonicalEventEnvelopeSchema = z.strictObject({
  event_id: EventIdSchema,
  session_id: SessionIdSchema,
  sequence_no: SequenceNumberSchema,
  event_schema_version: SchemaVersionSchema,
  clinical_time: ClinicalTimeSchema,
  real_time_utc: RealUtcTimeSchema,
  actor_type: EventActorTypeSchema,
  actor_id: ActorIdSchema.optional(),
  source: EventSourceSchema,
  correlation_id: CorrelationIdSchema,
  causation_event_id: EventIdSchema.optional(),
  action_request_id: ActionRequestIdSchema.optional(),
  action_id: ActionIdSchema.optional(),
  rule_id: RuleIdSchema.optional(),
  event_type: EventTypeSchema,
  parameters: JsonObjectSchema,
  status: z.literal("COMMITTED"),
  payload: JsonValueSchema,
  clinical_effect_ids: z.array(ClinicalEffectIdSchema),
  state_version_before: z.union([StateVersionSchema, z.null()]),
  state_version_after: z.union([StateVersionSchema, z.null()]),
  scoring_evidence_refs: z.array(ScoringEvidenceRefIdSchema),
  case_version: SemanticVersionSchema,
  idempotency_key: IdempotencyKeySchema,
  request_id: RequestIdSchema.optional(),
  supersedes_event_id: EventIdSchema.optional()
});
export type CanonicalEventEnvelope = z.infer<typeof CanonicalEventEnvelopeSchema>;
