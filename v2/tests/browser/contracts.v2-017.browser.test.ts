import { describe, expect, it } from "vitest";

import {
  LEARNER_TIMELINE_SCHEMA_VERSION,
  SafeAssessmentApiProjectionSchema,
  SafeFinalAssessmentProjectionSchema,
  SafeLearnerTimelineProjectionSchema
} from "../../packages/contracts/src/index.ts";
import {
  SYNTHETIC_FINAL_ASSESSMENT,
  SYNTHETIC_LEARNER_TIMELINE
} from "../fixtures/student-ui/v2-017.ts";

describe("V2-017 disclosure-safe transport contracts", () => {
  it("pins and validates the learner timeline schema version", () => {
    expect(LEARNER_TIMELINE_SCHEMA_VERSION).toBe("1.0");
    expect(SafeLearnerTimelineProjectionSchema.safeParse(SYNTHETIC_LEARNER_TIMELINE).success).toBe(true);
    expect(SafeLearnerTimelineProjectionSchema.safeParse({
      ...SYNTHETIC_LEARNER_TIMELINE,
      timeline_schema_version: "2.0"
    }).success).toBe(false);
  });

  it("rejects timeline unknown fields and malformed learner labels", () => {
    expect(SafeLearnerTimelineProjectionSchema.safeParse({
      ...SYNTHETIC_LEARNER_TIMELINE,
      package_hash: "a".repeat(64)
    }).success).toBe(false);
    expect(SafeLearnerTimelineProjectionSchema.safeParse({
      ...SYNTHETIC_LEARNER_TIMELINE,
      items: [{
        ...SYNTHETIC_LEARNER_TIMELINE.items[0],
        labels: [{ locale: "en", text: "Invalid locale" }]
      }]
    }).success).toBe(false);
  });

  it("requires increasing committed sequence order and unique Event IDs", () => {
    const [first, second] = SYNTHETIC_LEARNER_TIMELINE.items;
    expect(SafeLearnerTimelineProjectionSchema.safeParse({
      ...SYNTHETIC_LEARNER_TIMELINE,
      items: [second, first]
    }).success).toBe(false);
    expect(SafeLearnerTimelineProjectionSchema.safeParse({
      ...SYNTHETIC_LEARNER_TIMELINE,
      items: [first, { ...second, event_id: first!.event_id }]
    }).success).toBe(false);
  });

  it("keeps learner history bounded", () => {
    expect(SafeLearnerTimelineProjectionSchema.safeParse({
      ...SYNTHETIC_LEARNER_TIMELINE,
      items: Array.from({ length: 257 }, (_, index) => ({
        ...SYNTHETIC_LEARNER_TIMELINE.items[0],
        event_id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
        sequence_no: index + 1
      })),
      event_sequence_through: 257
    }).success).toBe(false);
  });

  it("round-trips learner timeline as strict JSON", () => {
    expect(SafeLearnerTimelineProjectionSchema.parse(
      JSON.parse(JSON.stringify(SYNTHETIC_LEARNER_TIMELINE))
    )).toEqual(SYNTHETIC_LEARNER_TIMELINE);
  });

  it("accepts only the existing safe active disclosure or strict final projection", () => {
    expect(SafeAssessmentApiProjectionSchema.safeParse({
      projection_schema_version: "1.0",
      projection_type: "ACTIVE_ASSESSMENT_WITHHELD",
      assessment_id: "assessment.v2-017.active",
      session_id: "session.v2-017.active",
      session_mode: "ASSESSMENT",
      assessment_status: "ACTIVE"
    }).success).toBe(true);
    expect(SafeAssessmentApiProjectionSchema.safeParse(SYNTHETIC_FINAL_ASSESSMENT).success).toBe(true);
  });

  it("requires six localized final domain records and rejects internal rubric data", () => {
    expect(SafeFinalAssessmentProjectionSchema.safeParse({
      ...SYNTHETIC_FINAL_ASSESSMENT,
      domain_scores: SYNTHETIC_FINAL_ASSESSMENT.domain_scores.slice(0, 5)
    }).success).toBe(false);
    expect(SafeFinalAssessmentProjectionSchema.safeParse({
      ...SYNTHETIC_FINAL_ASSESSMENT,
      rubric_id: "rubric.hidden"
    }).success).toBe(false);
  });

  it("rejects raw rubric identity inside public final findings", () => {
    expect(SafeFinalAssessmentProjectionSchema.safeParse({
      ...SYNTHETIC_FINAL_ASSESSMENT,
      findings: [{
        ...SYNTHETIC_FINAL_ASSESSMENT.findings[0],
        rubric_item_id: "rubric-item.hidden"
      }]
    }).success).toBe(false);
  });
});
