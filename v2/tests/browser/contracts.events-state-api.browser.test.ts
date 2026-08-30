import { describe, expect, test } from "vitest";

import {
  ApiErrorResponseSchema,
  CanonicalEventEnvelopeSchema,
  EventTypeSchema,
  PatientStateSchema,
  RealUtcTimeSchema
} from "../../packages/contracts/src/index.ts";
import {
  VALID_API_ERROR,
  VALID_EVENT,
  VALID_PATIENT_STATE
} from "../fixtures/contracts-fixture.ts";

describe("canonical event envelope", () => {
  test("parses a complete canonical event and the frozen taxonomy", () => {
    const event = CanonicalEventEnvelopeSchema.parse(VALID_EVENT);
    expect(event.sequence_no).toBe(3);
    expect(event.event_type).toBe("INVESTIGATION_ORDERED");
    expect(EventTypeSchema.options).toContain("PATIENT_STATE_CHANGED");
    expect(EventTypeSchema.options).toContain("SIMULATION_ENDED");
  });

  test("rejects invalid sequence, schema version, clinical time, and UTC time", () => {
    const invalidCases = [
      { ...VALID_EVENT, sequence_no: 0 },
      { ...VALID_EVENT, event_schema_version: "1.0.0" },
      { ...VALID_EVENT, clinical_time: -0.1 },
      { ...VALID_EVENT, real_time_utc: "2026-08-30T16:00:00+03:00" },
      { ...VALID_EVENT, real_time_utc: "2026-99-30T16:00:00Z" }
    ];

    for (const event of invalidCases) {
      expect(CanonicalEventEnvelopeSchema.safeParse(event).success).toBe(false);
    }
  });

  test("accepts real UTC dates and rejects impossible calendar dates", () => {
    for (const value of [
      "2026-02-28T12:00:00Z",
      "2028-02-29T12:00:00Z"
    ] as const) {
      expect(RealUtcTimeSchema.safeParse(value).success).toBe(true);
    }

    for (const value of [
      "2026-02-29T12:00:00Z",
      "2026-02-30T12:00:00Z",
      "2026-04-31T12:00:00Z",
      "2026-13-01T12:00:00Z",
      "2026-02-28T12:00:00+00:00",
      "not-a-time"
    ] as const) {
      expect(RealUtcTimeSchema.safeParse(value).success).toBe(false);
    }
  });

  test("maps event schema and case content versions to distinct contracts", () => {
    expect(CanonicalEventEnvelopeSchema.safeParse(VALID_EVENT).success).toBe(true);
    expect(CanonicalEventEnvelopeSchema.safeParse({
      ...VALID_EVENT,
      event_schema_version: "1.0.0"
    }).success).toBe(false);
    expect(CanonicalEventEnvelopeSchema.safeParse({
      ...VALID_EVENT,
      case_version: "2.0"
    }).success).toBe(false);
  });

  test("rejects unknown event fields/types and round-trips through JSON", () => {
    expect(CanonicalEventEnvelopeSchema.safeParse({
      ...VALID_EVENT,
      event_type: "ACTION_TAKEN"
    }).success).toBe(false);
    expect(CanonicalEventEnvelopeSchema.safeParse({
      ...VALID_EVENT,
      internal_stack: "not public"
    }).success).toBe(false);

    const event = CanonicalEventEnvelopeSchema.parse(VALID_EVENT);
    expect(CanonicalEventEnvelopeSchema.parse(JSON.parse(JSON.stringify(event)))).toEqual(event);
  });

  test("treats absent and explicitly undefined optional properties alike at the JSON boundary", () => {
    const { actor_id: _actorId, ...withoutActorId } = VALID_EVENT;
    const absent = CanonicalEventEnvelopeSchema.parse(withoutActorId);
    const explicitUndefined = CanonicalEventEnvelopeSchema.parse({
      ...withoutActorId,
      actor_id: undefined
    });

    expect(JSON.stringify(explicitUndefined)).toBe(JSON.stringify(absent));
    expect(CanonicalEventEnvelopeSchema.safeParse({
      ...VALID_EVENT,
      payload: { invalid_wire_value: undefined }
    }).success).toBe(false);
  });
});

describe("patient state contract", () => {
  test("parses a structurally valid generic state and serializes it", () => {
    const state = PatientStateSchema.parse(VALID_PATIENT_STATE);
    expect(state.state_version).toBe(2);
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });

  test("rejects schema-detectable malformed state shapes", () => {
    expect(PatientStateSchema.safeParse({
      ...VALID_PATIENT_STATE,
      state_schema_version: "1.0.0"
    }).success).toBe(false);
    expect(PatientStateSchema.safeParse({
      ...VALID_PATIENT_STATE,
      case_version: "2.0"
    }).success).toBe(false);
    expect(PatientStateSchema.safeParse({
      ...VALID_PATIENT_STATE,
      pain_state: { ...VALID_PATIENT_STATE.pain_state, severity_0_10: 11 }
    }).success).toBe(false);
    expect(PatientStateSchema.safeParse({
      ...VALID_PATIENT_STATE,
      cardiac_rhythm: "Invalid Display Label"
    }).success).toBe(false);
    expect(PatientStateSchema.safeParse({
      ...VALID_PATIENT_STATE,
      calculated_vitals: { heart_rate: 70 }
    }).success).toBe(false);
  });
});

describe("API error contract", () => {
  test("parses a safe machine-readable error and serializes it", () => {
    const error = ApiErrorResponseSchema.parse(VALID_API_ERROR);
    expect(error.error.code).toBe("STATE_VERSION_CONFLICT");
    expect(JSON.parse(JSON.stringify(error))).toEqual(error);
  });

  test("rejects malformed or unsafe public error shapes", () => {
    expect(ApiErrorResponseSchema.safeParse({
      ...VALID_API_ERROR,
      api_schema_version: "1.0.0"
    }).success).toBe(false);
    expect(ApiErrorResponseSchema.safeParse({
      ...VALID_API_ERROR,
      error: { ...VALID_API_ERROR.error, code: "state conflict" }
    }).success).toBe(false);
    expect(ApiErrorResponseSchema.safeParse({
      ...VALID_API_ERROR,
      error: { ...VALID_API_ERROR.error, http_status: 200 }
    }).success).toBe(false);
    expect(ApiErrorResponseSchema.safeParse({
      ...VALID_API_ERROR,
      error: { ...VALID_API_ERROR.error, stack: "provider stack" }
    }).success).toBe(false);
  });
});
