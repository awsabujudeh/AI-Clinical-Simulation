import { expect, test } from "vitest";

import { RubricSequenceConstraintSchema } from "../../../packages/case-schema/src/index.ts";
import {
  createCommittedAssessmentEvent,
  createCompiledAssessmentCase,
  createExecutedSyntheticCheckEvent,
  evaluateSyntheticAssessment
} from "../../fixtures/assessment-engine/synthetic-assessment.ts";

test("live required criteria remain pending before their Clinical-Time deadline", async () => {
  const casePackage = await createCompiledAssessmentCase();
  const live = evaluateSyntheticAssessment({
    casePackage,
    committedEvents: [],
    assessedThroughClinicalTime: 30,
    evaluationPhase: "LIVE"
  });
  expect(live.success).toBe(true);
  if (!live.success) return;
  expect(live.result.evaluation_phase).toBe("LIVE");
  expect(live.result.finalization_boundary).toBeUndefined();
  expect(live.result.criterion_results.every((criterion) => criterion.status === "PENDING"))
    .toBe(true);
  expect(live.result.applied_critical_effects).toEqual([]);
});

test("an inclusive deadline remains pending at the boundary and resolves after it", async () => {
  const casePackage = await createCompiledAssessmentCase();
  const atDeadline = evaluateSyntheticAssessment({
    casePackage,
    committedEvents: [],
    assessedThroughClinicalTime: 60,
    evaluationPhase: "LIVE"
  });
  const afterDeadline = evaluateSyntheticAssessment({
    casePackage,
    committedEvents: [],
    assessedThroughClinicalTime: 61,
    evaluationPhase: "LIVE"
  });
  expect(atDeadline.success && afterDeadline.success).toBe(true);
  if (!atDeadline.success || !afterDeadline.success) return;
  expect(atDeadline.result.criterion_results[0]!.status).toBe("PENDING");
  expect(afterDeadline.result.criterion_results.slice(0, 6)
    .every((criterion) => criterion.status === "MISSED")).toBe(true);
  expect(afterDeadline.result.criterion_results.at(-1)?.status).toBe("TRIGGERED");
  expect(afterDeadline.result.criterion_results[0]!.trace_codes)
    .toContain("TIMING_WINDOW_EXPIRED");
});

test("final evaluation deterministically resolves all remaining required criteria", async () => {
  const casePackage = await createCompiledAssessmentCase();
  const final = evaluateSyntheticAssessment({
    casePackage,
    committedEvents: [],
    assessedThroughClinicalTime: 30,
    evaluationPhase: "FINAL"
  });
  expect(final.success).toBe(true);
  if (!final.success) return;
  expect(final.result.evaluation_phase).toBe("FINAL");
  expect(final.result.criterion_results.slice(0, 6)
    .every((criterion) => criterion.status === "MISSED")).toBe(true);
  expect(final.result.criterion_results.at(-1)?.status).toBe("TRIGGERED");
  expect(final.result.finalization_boundary?.clinical_time_through).toBe(30);
  expect(final.result.finalization_boundary?.event_sequence_through).toBe(0);
});

test("future sequence evidence remains pending live rather than becoming a false failure", async () => {
  const casePackage = await createCompiledAssessmentCase((draft) => {
    draft.assessment_rubric.domains[0]!.criteria[0]!.evidence.sequence_constraint =
      RubricSequenceConstraintSchema.parse({
        relation: "BEFORE",
        reference: {
          authority: "ANY_COMMITTED_EVENT",
          action_ids: [],
          event_types: ["DIAGNOSIS_SUBMITTED"]
        }
      });
  });
  const exam = createExecutedSyntheticCheckEvent(casePackage, 1, 30);
  const live = evaluateSyntheticAssessment({
    casePackage,
    committedEvents: [exam],
    assessedThroughClinicalTime: 61,
    evaluationPhase: "LIVE"
  });
  expect(live.success && live.result.criterion_results[0]!.status).toBe("PENDING");

  const diagnosis = createCommittedAssessmentEvent({
    casePackage,
    sequenceNo: 2,
    clinicalTime: 70,
    eventType: "DIAGNOSIS_SUBMITTED"
  });
  const settled = evaluateSyntheticAssessment({
    casePackage,
    committedEvents: [exam, diagnosis],
    assessedThroughClinicalTime: 70,
    evaluationPhase: "LIVE"
  });
  expect(settled.success && settled.result.criterion_results[0]!.status).toBe("SATISFIED");
});

test("Practice and Assessment modes produce byte-identical internal scoring truth", async () => {
  const casePackage = await createCompiledAssessmentCase();
  const event = createExecutedSyntheticCheckEvent(casePackage);
  const assessment = evaluateSyntheticAssessment({
    casePackage,
    committedEvents: [event],
    evaluationPhase: "LIVE",
    sessionMode: "ASSESSMENT"
  });
  const practice = evaluateSyntheticAssessment({
    casePackage,
    committedEvents: [event],
    evaluationPhase: "LIVE",
    sessionMode: "PRACTICE_DEMO"
  });
  expect(assessment.success && practice.success).toBe(true);
  if (assessment.success && practice.success) {
    expect(JSON.stringify(practice.result)).toBe(JSON.stringify(assessment.result));
  }
});
