import { expect, test } from "vitest";

import { ActionIdSchema } from "../../packages/contracts/src/index.ts";
import {
  validateDraftCase,
  validateForPublicationCandidate
} from "../../packages/case-schema/src/index.ts";
import {
  MINIMAL_DRAFT_CASE,
  TEST_HASH_ADAPTER,
  bindSyntheticReviewAndReachabilityEvidence,
  createCandidateReadyUnderReviewCase
} from "../fixtures/cases/synthetic-case.ts";

type MutableDraft = {
  assessment_rubric: {
    assessment_schema_version: string;
    domains: Array<{
      weight_basis_points: number;
      criteria: Array<{
        rubric_item_id: string;
        repeat_policy: { mode: string; maximum_occurrences?: number };
        evidence: { event_types: string[] };
      }>;
    }>;
  };
};

function mutableDraft(): MutableDraft {
  return JSON.parse(JSON.stringify(MINIMAL_DRAFT_CASE)) as MutableDraft;
}

test("the Case-owned rubric has exactly six weighted deterministic domains", () => {
  const report = validateDraftCase(MINIMAL_DRAFT_CASE);
  expect(report.valid).toBe(true);
  expect(MINIMAL_DRAFT_CASE.assessment_rubric.domains).toHaveLength(6);
  expect(MINIMAL_DRAFT_CASE.assessment_rubric.domains.reduce(
    (total, domain) => total + domain.weight_basis_points,
    0
  )).toBe(10_000);
});

test("duplicate criterion IDs and invalid weight totals fail schema validation", () => {
  const duplicate = mutableDraft();
  duplicate.assessment_rubric.domains[1]!.criteria[0]!.rubric_item_id =
    duplicate.assessment_rubric.domains[0]!.criteria[0]!.rubric_item_id;
  const duplicateReport = validateDraftCase(duplicate);
  expect(duplicateReport.valid).toBe(false);
  expect(duplicateReport.issues.some((issue) => issue.code === "SCHEMA_INVALID")).toBe(true);

  const weights = mutableDraft();
  weights.assessment_rubric.domains[0]!.weight_basis_points += 1;
  expect(validateDraftCase(weights).valid).toBe(false);
});

test("unsupported rubric versions, event types, and repeat bounds fail closed", () => {
  const version = mutableDraft();
  version.assessment_rubric.assessment_schema_version = "2.0";
  expect(validateDraftCase(version).valid).toBe(false);

  const eventType = mutableDraft();
  eventType.assessment_rubric.domains[0]!.criteria[0]!.evidence.event_types = [
    "CLIENT_CLICKED"
  ];
  expect(validateDraftCase(eventType).valid).toBe(false);

  const repeat = mutableDraft();
  repeat.assessment_rubric.domains[0]!.criteria[0]!.repeat_policy = {
    mode: "BOUNDED",
    maximum_occurrences: 0
  };
  expect(validateDraftCase(repeat).valid).toBe(false);
});

test("publication candidate validation blocks dangling rubric actions", async () => {
  const casePackage = await createCandidateReadyUnderReviewCase(TEST_HASH_ADAPTER);
  casePackage.assessment_rubric.domains[0]!.criteria[0]!.evidence.action_ids = [
    ActionIdSchema.parse("procedure.synthetic-missing")
  ];
  await bindSyntheticReviewAndReachabilityEvidence(casePackage, TEST_HASH_ADAPTER);
  const report = await validateForPublicationCandidate(casePackage, TEST_HASH_ADAPTER);
  expect(report.valid).toBe(false);
  expect(report.issues.some((issue) => issue.code === "DANGLING_ACTION_REFERENCE"))
    .toBe(true);
});

test("invalid Clinical-Time windows remain publication-blocking", async () => {
  const casePackage = await createCandidateReadyUnderReviewCase(TEST_HASH_ADAPTER);
  casePackage.timeline_policy.timing_windows[0]!.ends_at_clinical_seconds = 0;
  await bindSyntheticReviewAndReachabilityEvidence(casePackage, TEST_HASH_ADAPTER);
  const report = await validateForPublicationCandidate(casePackage, TEST_HASH_ADAPTER);
  expect(report.valid).toBe(false);
  expect(report.issues.some((issue) => issue.code === "INVALID_TIMING_WINDOW"))
    .toBe(true);
});
