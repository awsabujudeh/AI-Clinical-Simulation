import { expect, test } from "vitest";

import {
  ASSESSMENT_EVIDENCE_SCHEMA_VERSION,
  ASSESSMENT_DISCLOSURE_SCHEMA_VERSION,
  AssessmentCriterionStatusSchema,
  AssessmentDisclosureProjectionSchema,
  AssessmentDomainIdSchema,
  AssessmentResultSchema,
  AssessmentSessionEvidenceSchema,
  RubricItemIdSchema,
  ScoreBasisPointsSchema,
  TrustedAssessmentDisclosureContextSchema
} from "../../packages/contracts/src/index.ts";

test("shared assessment identifiers and basis points are strict", () => {
  expect(AssessmentDomainIdSchema.parse("domain.synthetic-history"))
    .toBe("domain.synthetic-history");
  expect(RubricItemIdSchema.parse("rubric-item.synthetic.history"))
    .toBe("rubric-item.synthetic.history");
  expect(ScoreBasisPointsSchema.parse(10_000)).toBe(10_000);
  expect(AssessmentDomainIdSchema.safeParse("history").success).toBe(false);
  expect(ScoreBasisPointsSchema.safeParse(10_001).success).toBe(false);
});

test("live/final and disclosure contracts are strict and versioned", () => {
  expect(AssessmentCriterionStatusSchema.parse("PENDING")).toBe("PENDING");
  const context = {
    context_schema_version: ASSESSMENT_DISCLOSURE_SCHEMA_VERSION,
    authority: "TRUSTED_ASSESSMENT_DISCLOSURE",
    assessment_id: "assessment.synthetic.001",
    session_id: "assessment-session",
    session_mode: "ASSESSMENT",
    disclosure_phase: "ACTIVE"
  };
  expect(TrustedAssessmentDisclosureContextSchema.safeParse(context).success).toBe(true);
  expect(TrustedAssessmentDisclosureContextSchema.safeParse({
    ...context,
    show_answers: true
  }).success).toBe(false);
  expect(TrustedAssessmentDisclosureContextSchema.safeParse({
    ...context,
    context_schema_version: "999.0"
  }).success).toBe(false);
});

test("active Assessment disclosure contract cannot carry hidden score fields", () => {
  const safe = {
    projection_schema_version: ASSESSMENT_DISCLOSURE_SCHEMA_VERSION,
    projection_type: "ACTIVE_ASSESSMENT_WITHHELD",
    assessment_id: "assessment.synthetic.001",
    session_id: "assessment-session",
    session_mode: "ASSESSMENT",
    assessment_status: "ACTIVE"
  };
  expect(AssessmentDisclosureProjectionSchema.safeParse(safe).success).toBe(true);
  expect(AssessmentDisclosureProjectionSchema.safeParse({
    ...safe,
    overall_score_basis_points: 10_000
  }).success).toBe(false);
});

test("authoritative assessment evidence rejects unknown fields and non-timeline input", () => {
  const rawIntent = {
    evidence_schema_version: ASSESSMENT_EVIDENCE_SCHEMA_VERSION,
    authority: "SESSION_ENGINE_COMMITTED_TIMELINE",
    session_id: "assessment-session",
    session_mode: "ASSESSMENT",
    case_package_id: "case-package.synthetic.001",
    case_version_id: "case-version.synthetic.001",
    case_version: "2.0.0",
    package_hash: "0".repeat(64),
    assessed_through_clinical_time: 0,
    committed_events: [],
    action_request: { action_id: "examination.synthetic-check" }
  };
  expect(AssessmentSessionEvidenceSchema.safeParse(rawIntent).success).toBe(false);
});

test("assessment result schema rejects an inferred or partial score object", () => {
  expect(AssessmentResultSchema.safeParse({
    result_schema_version: "1.0",
    overall_score_basis_points: 10_000
  }).success).toBe(false);
});
