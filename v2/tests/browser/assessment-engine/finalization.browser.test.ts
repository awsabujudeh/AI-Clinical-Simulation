import { expect, test } from "vitest";

import {
  ASSESSMENT_EVALUATION_SCHEMA_VERSION,
  evaluateAssessment
} from "../../../packages/assessment-engine/src/index.ts";
import {
  createAssessmentEvidenceFromCompiledCase,
  createCommittedAssessmentEvent,
  createCompiledAssessmentCase,
  createExecutedSyntheticCheckEvent,
  createSyntheticFinalizationBoundary,
  evaluateSyntheticAssessment
} from "../../fixtures/assessment-engine/synthetic-assessment.ts";

test("final snapshot binds exact Session, package, rubric, sequence, and Clinical Time", async () => {
  const casePackage = await createCompiledAssessmentCase();
  const event = createExecutedSyntheticCheckEvent(casePackage, 1, 30);
  const final = evaluateSyntheticAssessment({
    casePackage,
    committedEvents: [event],
    assessedThroughClinicalTime: 45,
    evaluationPhase: "FINAL"
  });
  expect(final.success).toBe(true);
  if (!final.success) return;
  expect(final.result.event_sequence_through).toBe(1);
  expect(final.result.assessed_through_clinical_time).toBe(45);
  expect(final.result.finalization_boundary).toMatchObject({
    session_id: "assessment-session",
    case_package_id: casePackage.manifest.case_package_id,
    package_hash: casePackage.package_hash,
    rubric_id: casePackage.assessment_rubric.rubric_id,
    rubric_module_hash: casePackage.manifest.module_hashes.assessment_rubric,
    event_sequence_through: 1,
    clinical_time_through: 45
  });
});

test("inconsistent final sequence, time, identity, and rubric provenance fail closed", async () => {
  const casePackage = await createCompiledAssessmentCase();
  const event = createExecutedSyntheticCheckEvent(casePackage, 1, 30);
  const evidence = createAssessmentEvidenceFromCompiledCase(casePackage, [event], 30);
  const baseBoundary = createSyntheticFinalizationBoundary(casePackage, evidence);
  for (const boundary of [
    { ...baseBoundary, event_sequence_through: 2 },
    { ...baseBoundary, event_sequence_through: 0 },
    { ...baseBoundary, clinical_time_through: 31 },
    { ...baseBoundary, session_id: "other-session" },
    { ...baseBoundary, package_hash: "f".repeat(64) },
    { ...baseBoundary, rubric_module_hash: "e".repeat(64) }
  ]) {
    const evaluated = evaluateAssessment({
      evaluation_schema_version: ASSESSMENT_EVALUATION_SCHEMA_VERSION,
      evaluation_phase: "FINAL",
      assessment_id: "assessment.synthetic.001",
      compiled_case_package: casePackage,
      session_evidence: evidence,
      finalization_boundary: boundary
    });
    expect(evaluated.success).toBe(false);
    if (!evaluated.success) {
      expect(evaluated.issues.some((issue) => issue.code === "FINALIZATION_BOUNDARY_INVALID"))
        .toBe(true);
    }
  }
});

test("repeated finalization of one boundary is exact and later evidence cannot mutate it", async () => {
  const casePackage = await createCompiledAssessmentCase();
  const firstEvent = createExecutedSyntheticCheckEvent(casePackage, 1, 30);
  const first = evaluateSyntheticAssessment({
    casePackage,
    committedEvents: [firstEvent],
    assessedThroughClinicalTime: 30,
    evaluationPhase: "FINAL"
  });
  const repeated = evaluateSyntheticAssessment({
    casePackage,
    committedEvents: [firstEvent],
    assessedThroughClinicalTime: 30,
    evaluationPhase: "FINAL"
  });
  expect(first.success && repeated.success).toBe(true);
  if (!first.success || !repeated.success) return;
  const originalBytes = JSON.stringify(first.result);
  expect(JSON.stringify(repeated.result)).toBe(originalBytes);

  const laterEvent = createCommittedAssessmentEvent({
    casePackage,
    sequenceNo: 2,
    clinicalTime: 40,
    eventType: "OUTCOME_REACHED"
  });
  const later = evaluateSyntheticAssessment({
    casePackage,
    committedEvents: [firstEvent, laterEvent],
    assessedThroughClinicalTime: 40,
    evaluationPhase: "FINAL"
  });
  expect(later.success).toBe(true);
  expect(JSON.stringify(first.result)).toBe(originalBytes);
  if (later.success) {
    expect(later.result.event_sequence_through).toBe(2);
    expect(later.result.finalization_boundary).not.toEqual(first.result.finalization_boundary);
  }
});

test("a final request cannot include evidence after its claimed boundary", async () => {
  const casePackage = await createCompiledAssessmentCase();
  const events = [
    createExecutedSyntheticCheckEvent(casePackage, 1, 30),
    createCommittedAssessmentEvent({
      casePackage,
      sequenceNo: 2,
      clinicalTime: 31,
      eventType: "OUTCOME_REACHED"
    })
  ];
  const evidence = createAssessmentEvidenceFromCompiledCase(casePackage, events, 31);
  const boundary = {
    ...createSyntheticFinalizationBoundary(casePackage, evidence),
    event_sequence_through: 1,
    clinical_time_through: 30
  };
  const result = evaluateAssessment({
    evaluation_schema_version: ASSESSMENT_EVALUATION_SCHEMA_VERSION,
    evaluation_phase: "FINAL",
    assessment_id: "assessment.synthetic.001",
    compiled_case_package: casePackage,
    session_evidence: evidence,
    finalization_boundary: boundary
  });
  expect(result.success).toBe(false);
});
