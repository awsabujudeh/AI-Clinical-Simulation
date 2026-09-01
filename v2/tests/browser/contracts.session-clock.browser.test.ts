import { describe, expect, it } from "vitest";

import {
  ElapsedRealSecondsSchema,
  InterruptingEventTypesSchema,
  SAME_TIME_ORDERING,
  SESSION_CLOCK_SCHEMA_VERSION,
  SessionClinicalClockSchema
} from "../../packages/contracts/src/index.ts";

describe("shared Session/Clinical clock contracts", () => {
  it("accepts strict JSON clock data and rejects unknown versions/fields", () => {
    const clock = SessionClinicalClockSchema.parse({
      clock_schema_version: SESSION_CLOCK_SCHEMA_VERSION,
      status: "RUNNING",
      clinical_time: 45
    });

    expect(JSON.parse(JSON.stringify(clock))).toEqual(clock);
    expect(SessionClinicalClockSchema.safeParse({
      ...clock,
      clock_schema_version: "999.0"
    }).success).toBe(false);
    expect(SessionClinicalClockSchema.safeParse({
      ...clock,
      wall_time_utc: "not-authoritative"
    }).success).toBe(false);
  });

  it("requires bounded whole elapsed seconds", () => {
    expect(ElapsedRealSecondsSchema.safeParse(0).success).toBe(true);
    expect(ElapsedRealSecondsSchema.safeParse(5).success).toBe(true);
    expect(ElapsedRealSecondsSchema.safeParse(0.5).success).toBe(false);
    expect(ElapsedRealSecondsSchema.safeParse(-1).success).toBe(false);
  });

  it("keeps interrupt classifications canonical and same-time ordering explicit", () => {
    expect(InterruptingEventTypesSchema.safeParse([
      "CRITICAL_EVENT_OCCURRED",
      "OUTCOME_REACHED"
    ]).success).toBe(true);
    expect(InterruptingEventTypesSchema.safeParse([
      "OUTCOME_REACHED",
      "CRITICAL_EVENT_OCCURRED"
    ]).success).toBe(false);
    expect(InterruptingEventTypesSchema.safeParse([
      "CRITICAL_EVENT_OCCURRED",
      "CRITICAL_EVENT_OCCURRED"
    ]).success).toBe(false);
    expect(SAME_TIME_ORDERING).toBe("DUE_WORK_BEFORE_EXTERNAL_COMMAND");
  });
});
