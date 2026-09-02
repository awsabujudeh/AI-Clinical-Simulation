import { expect, test } from "vitest";

import { CanonicalEventEnvelopeSchema } from "../../../packages/contracts/src/index.ts";
import {
  CriticalRubricItemSchema,
  RubricSequenceConstraintSchema,
  ScoredRubricCriterionSchema
} from "../../../packages/case-schema/src/index.ts";
import {
  createCommittedAssessmentEvent,
  createCompiledAssessmentCase,
  createExecutedSyntheticCheckEvent,
  evaluateSyntheticAssessment
} from "../../fixtures/assessment-engine/synthetic-assessment.ts";

test("six-domain scoring is deterministic and fully evidence-linked", async () => {
  const casePackage = await createCompiledAssessmentCase();
  const event = createExecutedSyntheticCheckEvent(casePackage);
  const first = evaluateSyntheticAssessment({ casePackage, committedEvents: [event] });
  const second = evaluateSyntheticAssessment({ casePackage, committedEvents: [event] });
  expect(first.success).toBe(true);
  expect(second.success).toBe(true);
  if (!first.success || !second.success) return;
  expect(first.result.domain_scores).toHaveLength(6);
  expect(first.result.domain_scores.every((domain) => domain.score_basis_points === 10_000))
    .toBe(true);
  expect(first.result.overall_score_basis_points).toBe(10_000);
  expect(first.result.criterion_results.every((criterion) => criterion.evidence_ref_ids.length > 0))
    .toBe(true);
  expect(JSON.stringify(first.result)).toBe(JSON.stringify(second.result));
});

test("Clinical-Time deadline boundaries are inclusive and wall time is irrelevant", async () => {
  const casePackage = await createCompiledAssessmentCase();
  const atDeadline = createExecutedSyntheticCheckEvent(casePackage, 1, 60);
  const timely = evaluateSyntheticAssessment({ casePackage, committedEvents: [atDeadline] });
  expect(timely.success && timely.result.overall_score_basis_points).toBe(10_000);

  const late = createExecutedSyntheticCheckEvent(casePackage, 1, 61);
  const missed = evaluateSyntheticAssessment({ casePackage, committedEvents: [late] });
  expect(missed.success && missed.result.overall_score_basis_points).toBe(0);
  if (missed.success) {
    expect(missed.result.criterion_results.some((criterion) =>
      criterion.trace_codes.includes("OUTSIDE_CLINICAL_TIME_WINDOW")
    )).toBe(true);
  }

  const differentWallTime = CanonicalEventEnvelopeSchema.parse({
    ...atDeadline,
    real_time_utc: "2030-01-01T00:00:00Z"
  });
  const wallIndependent = evaluateSyntheticAssessment({
    casePackage,
    committedEvents: [differentWallTime]
  });
  expect(wallIndependent.success).toBe(true);
  if (timely.success && wallIndependent.success) {
    expect(wallIndependent.result).toEqual(timely.result);
  }

  const exclusivePackage = await createCompiledAssessmentCase((draft) => {
    draft.timeline_policy.timing_windows[0]!.end_inclusive = false;
  });
  const exclusiveDeadline = createExecutedSyntheticCheckEvent(exclusivePackage, 1, 60);
  const excluded = evaluateSyntheticAssessment({
    casePackage: exclusivePackage,
    committedEvents: [exclusiveDeadline]
  });
  expect(excluded.success && excluded.result.overall_score_basis_points).toBe(0);
});

test("same-Clinical-Time ordering uses authoritative sequence", async () => {
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
  const examFirst = createExecutedSyntheticCheckEvent(casePackage, 1, 30);
  const diagnosisSecond = createCommittedAssessmentEvent({
    casePackage,
    sequenceNo: 2,
    clinicalTime: 30,
    eventType: "DIAGNOSIS_SUBMITTED"
  });
  const correct = evaluateSyntheticAssessment({
    casePackage,
    committedEvents: [examFirst, diagnosisSecond]
  });
  expect(correct.success).toBe(true);
  if (correct.success) {
    expect(correct.result.criterion_results[0]!.status).toBe("SATISFIED");
  }

  const diagnosisFirst = createCommittedAssessmentEvent({
    casePackage,
    sequenceNo: 1,
    clinicalTime: 30,
    eventType: "DIAGNOSIS_SUBMITTED"
  });
  const examSecond = createExecutedSyntheticCheckEvent(casePackage, 2, 30);
  const wrong = evaluateSyntheticAssessment({
    casePackage,
    committedEvents: [diagnosisFirst, examSecond]
  });
  expect(wrong.success).toBe(true);
  if (wrong.success) {
    expect(wrong.result.criterion_results[0]!.status).toBe("MISSED");
    expect(wrong.result.criterion_results[0]!.trace_codes)
      .toContain("SEQUENCE_CONSTRAINT_NOT_SATISFIED");
  }

  const afterPackage = await createCompiledAssessmentCase((draft) => {
    draft.assessment_rubric.domains[0]!.criteria[0]!.evidence.sequence_constraint =
      RubricSequenceConstraintSchema.parse({
        relation: "AFTER",
        reference: {
          authority: "ANY_COMMITTED_EVENT",
          action_ids: [],
          event_types: ["DIAGNOSIS_SUBMITTED"]
        }
      });
  });
  const beforeReference = createCommittedAssessmentEvent({
    casePackage: afterPackage,
    sequenceNo: 1,
    clinicalTime: 30,
    eventType: "DIAGNOSIS_SUBMITTED"
  });
  const afterTarget = createExecutedSyntheticCheckEvent(afterPackage, 2, 30);
  const after = evaluateSyntheticAssessment({
    casePackage: afterPackage,
    committedEvents: [beforeReference, afterTarget]
  });
  expect(after.success && after.result.criterion_results[0]!.status).toBe("SATISFIED");
});

test("once-only criteria cannot be farmed and bounded repeats stop at their cap", async () => {
  const basePackage = await createCompiledAssessmentCase();
  const repeated = [1, 2, 3].map((sequence) =>
    createExecutedSyntheticCheckEvent(basePackage, sequence, 30)
  );
  const once = evaluateSyntheticAssessment({ casePackage: basePackage, committedEvents: repeated });
  expect(once.success).toBe(true);
  if (once.success) {
    expect(once.result.criterion_results.slice(0, 6).every((item) => item.occurrence_count === 1))
      .toBe(true);
    expect(once.result.criterion_results[0]!.trace_codes).toContain("REPEAT_LIMIT_APPLIED");
  }

  const repeatablePackage = await createCompiledAssessmentCase((draft) => {
    draft.assessment_rubric.domains[0]!.criteria[0]!.repeat_policy = {
      mode: "BOUNDED",
      maximum_occurrences: 2
    };
  });
  const boundedEvents = [1, 2, 3].map((sequence) =>
    createExecutedSyntheticCheckEvent(repeatablePackage, sequence, 30)
  );
  const bounded = evaluateSyntheticAssessment({
    casePackage: repeatablePackage,
    committedEvents: boundedEvents
  });
  expect(bounded.success).toBe(true);
  if (bounded.success) {
    expect(bounded.result.criterion_results[0]!.occurrence_count).toBe(2);
    expect(bounded.result.domain_scores[0]!.earned_points).toBe(20);
    expect(bounded.result.domain_scores[0]!.maximum_points).toBe(20);
    expect(bounded.result.overall_score_basis_points).toBe(10_000);
  }


  const halfPackage = await createCompiledAssessmentCase((draft) => {
    draft.assessment_rubric.domains[0]!.criteria[0]!.repeat_policy = {
      mode: "BOUNDED",
      maximum_occurrences: 2
    };
  });
  const half = evaluateSyntheticAssessment({
    casePackage: halfPackage,
    committedEvents: [createExecutedSyntheticCheckEvent(halfPackage, 1, 30)]
  });
  expect(half.success).toBe(true);
  if (half.success) {
    expect(half.result.domain_scores[0]!.score_basis_points).toBe(5000);
    expect(half.result.domain_scores[0]!.weighted_contribution_basis_points).toBe(834);
    expect(half.result.overall_score_basis_points).toBe(9167);
  }
});

test("Case-owned penalties and critical caps apply without embedded medical knowledge", async () => {
  const casePackage = await createCompiledAssessmentCase((draft) => {
    draft.assessment_rubric.domains[0]!.criteria.push(
      ScoredRubricCriterionSchema.parse({
        rubric_item_id: "rubric-item.synthetic.harmful-event",
        kind: "PENALTY",
        points: 5,
        evidence: {
          authority: "ANY_COMMITTED_EVENT",
          action_ids: [],
          event_types: ["CRITICAL_EVENT_OCCURRED"]
        },
        repeat_policy: { mode: "ONCE" }
      })
    );
    draft.assessment_rubric.critical_items.push(
      CriticalRubricItemSchema.parse({
        rubric_item_id: "rubric-item.synthetic.unsafe-cap",
        kind: "CRITICAL_ERROR",
        evidence: {
          authority: "ANY_COMMITTED_EVENT",
          action_ids: [],
          event_types: ["CRITICAL_EVENT_OCCURRED"]
        },
        effect: {
          effect_type: "CAP_OVERALL_SCORE",
          cap_basis_points: 3000
        }
      })
    );
  });
  const exam = createExecutedSyntheticCheckEvent(casePackage, 1, 30);
  const harmful = createCommittedAssessmentEvent({
    casePackage,
    sequenceNo: 2,
    clinicalTime: 31,
    eventType: "CRITICAL_EVENT_OCCURRED"
  });
  const evaluated = evaluateSyntheticAssessment({
    casePackage,
    committedEvents: [exam, harmful]
  });
  expect(evaluated.success).toBe(true);
  if (evaluated.success) {
    const penalty = evaluated.result.criterion_results.find((criterion) =>
      criterion.rubric_item_id === "rubric-item.synthetic.harmful-event"
    );
    expect(penalty?.deducted_points).toBe(5);
    expect(evaluated.result.overall_score_basis_points).toBe(3000);
    expect(evaluated.result.applied_critical_effects).toContainEqual({
      rubric_item_id: "rubric-item.synthetic.unsafe-cap",
      effect_type: "CAP_OVERALL_SCORE",
      cap_basis_points: 3000
    });
  }
});

test("missing required action produces zero credit and a critical-action trace", async () => {
  const casePackage = await createCompiledAssessmentCase();
  const evaluated = evaluateSyntheticAssessment({ casePackage, committedEvents: [] });
  expect(evaluated.success).toBe(true);
  if (evaluated.success) {
    expect(evaluated.result.overall_score_basis_points).toBe(0);
    const critical = evaluated.result.criterion_results.find((criterion) =>
      criterion.criterion_kind === "CRITICAL_ACTION"
    );
    expect(critical?.status).toBe("TRIGGERED");
    expect(critical?.trace_codes).toContain("CRITICAL_EFFECT_APPLIED");
  }
});

test("critical zero-domain, fixed-deduction, and unsafe effects use fixed precedence", async () => {
  const casePackage = await createCompiledAssessmentCase((draft) => {
    for (const item of [
      {
        rubric_item_id: "rubric-item.synthetic.zero-domain",
        effect: { effect_type: "ZERO_DOMAIN_SCORE", domain_id: "domain.history" }
      },
      {
        rubric_item_id: "rubric-item.synthetic.fixed-deduction",
        effect: { effect_type: "DEDUCT_OVERALL_SCORE", penalty_basis_points: 1000 }
      },
      {
        rubric_item_id: "rubric-item.synthetic.mark-unsafe",
        effect: { effect_type: "MARK_UNSAFE" }
      }
    ] as const) {
      draft.assessment_rubric.critical_items.push(CriticalRubricItemSchema.parse({
        rubric_item_id: item.rubric_item_id,
        kind: "CRITICAL_ERROR",
        evidence: {
          authority: "ANY_COMMITTED_EVENT",
          action_ids: [],
          event_types: ["OUTCOME_REACHED"]
        },
        effect: item.effect
      }));
    }
  });
  const exam = createExecutedSyntheticCheckEvent(casePackage, 1, 30);
  const outcome = createCommittedAssessmentEvent({
    casePackage,
    sequenceNo: 2,
    clinicalTime: 31,
    eventType: "OUTCOME_REACHED"
  });
  const evaluated = evaluateSyntheticAssessment({
    casePackage,
    committedEvents: [exam, outcome]
  });
  expect(evaluated.success).toBe(true);
  if (evaluated.success) {
    expect(evaluated.result.domain_scores[0]!.score_basis_points).toBe(0);
    expect(evaluated.result.overall_score_basis_points).toBe(7333);
    expect(evaluated.result.unsafe).toBe(true);
  }
});
