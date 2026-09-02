import { expect, test } from "vitest";

import {
  createDebriefEvidencePackage,
  projectAssessmentDisclosure
} from "../../../packages/assessment-engine/src/index.ts";
import {
  CriticalRubricItemSchema,
  ScoredRubricCriterionSchema
} from "../../../packages/case-schema/src/index.ts";
import {
  createCommittedAssessmentEvent,
  createCompiledAssessmentCase,
  createExecutedSyntheticCheckEvent,
  createSyntheticDisclosureContext,
  evaluateSyntheticAssessment
} from "../../fixtures/assessment-engine/synthetic-assessment.ts";

test("active Assessment exposes only a neutral withheld projection", async () => {
  const casePackage = await createCompiledAssessmentCase();
  const event = createExecutedSyntheticCheckEvent(casePackage);
  const live = evaluateSyntheticAssessment({
    casePackage,
    committedEvents: [event],
    evaluationPhase: "LIVE"
  });
  expect(live.success).toBe(true);
  if (!live.success) return;
  const projected = projectAssessmentDisclosure({
    assessment_result: live.result,
    disclosure_context: createSyntheticDisclosureContext({
      sessionMode: "ASSESSMENT",
      disclosurePhase: "ACTIVE"
    })
  });
  expect(projected.success).toBe(true);
  if (!projected.success) return;
  expect(projected.projection).toEqual({
    projection_schema_version: "1.0",
    projection_type: "ACTIVE_ASSESSMENT_WITHHELD",
    assessment_id: "assessment.synthetic.001",
    session_id: "assessment-session",
    session_mode: "ASSESSMENT",
    assessment_status: "ACTIVE"
  });
  const bytes = JSON.stringify(projected.projection);
  for (const forbidden of [
    "score",
    "domain",
    "criterion",
    "penalt",
    "critical",
    "rubric",
    "action_id",
    "timing_window"
  ]) {
    expect(bytes.toLowerCase()).not.toContain(forbidden);
  }
});

test("active Practice reveals resolved behavior without exposing unresolved answer keys", async () => {
  const casePackage = await createCompiledAssessmentCase();
  const unresolved = evaluateSyntheticAssessment({
    casePackage,
    committedEvents: [],
    assessedThroughClinicalTime: 30,
    evaluationPhase: "LIVE",
    sessionMode: "PRACTICE_DEMO"
  });
  expect(unresolved.success).toBe(true);
  if (!unresolved.success) return;
  const unresolvedProjection = projectAssessmentDisclosure({
    assessment_result: unresolved.result,
    disclosure_context: createSyntheticDisclosureContext({
      sessionMode: "PRACTICE_DEMO",
      disclosurePhase: "ACTIVE"
    })
  });
  expect(unresolvedProjection.success).toBe(true);
  if (unresolvedProjection.success) {
    expect(unresolvedProjection.projection.projection_type).toBe("ACTIVE_PRACTICE_FEEDBACK");
    if (unresolvedProjection.projection.projection_type === "ACTIVE_PRACTICE_FEEDBACK") {
      expect(unresolvedProjection.projection.resolved_findings).toEqual([]);
      expect(JSON.stringify(unresolvedProjection.projection))
        .not.toContain("examination.synthetic-check");
    }
  }

  const event = createExecutedSyntheticCheckEvent(casePackage);
  const resolved = evaluateSyntheticAssessment({
    casePackage,
    committedEvents: [event],
    evaluationPhase: "LIVE",
    sessionMode: "PRACTICE_DEMO"
  });
  expect(resolved.success).toBe(true);
  if (!resolved.success) return;
  const resolvedProjection = projectAssessmentDisclosure({
    assessment_result: resolved.result,
    disclosure_context: createSyntheticDisclosureContext({
      sessionMode: "PRACTICE_DEMO",
      disclosurePhase: "ACTIVE"
    })
  });
  expect(resolvedProjection.success).toBe(true);
  if (resolvedProjection.success
    && resolvedProjection.projection.projection_type === "ACTIVE_PRACTICE_FEEDBACK") {
    expect(resolvedProjection.projection.resolved_findings).toHaveLength(6);
    expect(resolvedProjection.projection.resolved_findings
      .every((finding) => finding.category === "CORRECT_ACTION")).toBe(true);
    expect(JSON.stringify(resolvedProjection.projection)).not.toContain("rubric-item");
  }
});

test("active Practice reveals resolved harmful behavior and deadline misses only after resolution", async () => {
  const casePackage = await createCompiledAssessmentCase((draft) => {
    draft.assessment_rubric.domains[0]!.criteria.push(
      ScoredRubricCriterionSchema.parse({
        rubric_item_id: "rubric-item.synthetic.harmful-live",
        kind: "PENALTY",
        points: 3,
        evidence: {
          authority: "ANY_COMMITTED_EVENT",
          action_ids: [],
          event_types: ["CRITICAL_EVENT_OCCURRED"]
        },
        repeat_policy: { mode: "ONCE" }
      })
    );
  });
  const harmful = createCommittedAssessmentEvent({
    casePackage,
    sequenceNo: 1,
    clinicalTime: 20,
    eventType: "CRITICAL_EVENT_OCCURRED"
  });
  const harmfulLive = evaluateSyntheticAssessment({
    casePackage,
    committedEvents: [harmful],
    assessedThroughClinicalTime: 20,
    evaluationPhase: "LIVE",
    sessionMode: "PRACTICE_DEMO"
  });
  expect(harmfulLive.success).toBe(true);
  if (harmfulLive.success) {
    const projected = projectAssessmentDisclosure({
      assessment_result: harmfulLive.result,
      disclosure_context: createSyntheticDisclosureContext({
        sessionMode: "PRACTICE_DEMO",
        disclosurePhase: "ACTIVE"
      })
    });
    expect(projected.success).toBe(true);
    if (projected.success
      && projected.projection.projection_type === "ACTIVE_PRACTICE_FEEDBACK") {
      expect(projected.projection.resolved_findings.some(
        (finding) => finding.category === "UNSAFE_ACTION"
      )).toBe(true);
    }
  }

  const missed = evaluateSyntheticAssessment({
    casePackage,
    committedEvents: [],
    assessedThroughClinicalTime: 61,
    evaluationPhase: "LIVE",
    sessionMode: "PRACTICE_DEMO"
  });
  expect(missed.success).toBe(true);
  if (missed.success) {
    const projected = projectAssessmentDisclosure({
      assessment_result: missed.result,
      disclosure_context: createSyntheticDisclosureContext({
        sessionMode: "PRACTICE_DEMO",
        disclosurePhase: "ACTIVE"
      })
    });
    expect(projected.success).toBe(true);
    if (projected.success
      && projected.projection.projection_type === "ACTIVE_PRACTICE_FEEDBACK") {
      expect(projected.projection.resolved_findings.some(
        (finding) => finding.category === "MISSED_OPPORTUNITY"
      )).toBe(true);
    }
  }
});

test("final debrief exposes complete deterministic evidence and preserves critical effects", async () => {
  const casePackage = await createCompiledAssessmentCase((draft) => {
    draft.assessment_rubric.critical_items.push(CriticalRubricItemSchema.parse({
      rubric_item_id: "rubric-item.synthetic.final-unsafe",
      kind: "CRITICAL_ERROR",
      evidence: {
        authority: "ANY_COMMITTED_EVENT",
        action_ids: [],
        event_types: ["OUTCOME_REACHED"]
      },
      effect: { effect_type: "MARK_UNSAFE" }
    }));
  });
  const events = [
    createExecutedSyntheticCheckEvent(casePackage, 1, 30),
    createCommittedAssessmentEvent({
      casePackage,
      sequenceNo: 2,
      clinicalTime: 31,
      eventType: "OUTCOME_REACHED"
    })
  ];
  const final = evaluateSyntheticAssessment({
    casePackage,
    committedEvents: events,
    assessedThroughClinicalTime: 31,
    evaluationPhase: "FINAL"
  });
  expect(final.success).toBe(true);
  if (!final.success) return;
  const debrief = createDebriefEvidencePackage(final.result);
  expect(debrief.success).toBe(true);
  const projected = projectAssessmentDisclosure({
    assessment_result: final.result,
    disclosure_context: createSyntheticDisclosureContext({
      sessionMode: "ASSESSMENT",
      disclosurePhase: "FINAL_DEBRIEF"
    })
  });
  expect(projected.success).toBe(true);
  if (!projected.success || projected.projection.projection_type !== "FINAL_DEBRIEF") return;
  const truth = projected.projection.debrief_evidence.assessment_result;
  expect(truth.domain_scores).toHaveLength(6);
  expect(truth.criterion_results).toEqual(final.result.criterion_results);
  expect(truth.evidence_records).toEqual(final.result.evidence_records);
  expect(truth.applied_critical_effects).toContainEqual({
    rubric_item_id: "rubric-item.synthetic.final-unsafe",
    effect_type: "MARK_UNSAFE"
  });
  expect(truth.unsafe).toBe(true);
  const bytes = JSON.stringify(projected.projection);
  for (const generated of ["generated_prose", "llm", "recommendation", "rag_citation"] ) {
    expect(bytes.toLowerCase()).not.toContain(generated);
  }
  expect(bytes).not.toContain("ClinicalEventProposal");
});

test("disclosure is reproducible, non-mutating, and rejects client reveal flags", async () => {
  const casePackage = await createCompiledAssessmentCase();
  const event = createExecutedSyntheticCheckEvent(casePackage);
  const live = evaluateSyntheticAssessment({
    casePackage,
    committedEvents: [event],
    evaluationPhase: "LIVE"
  });
  expect(live.success).toBe(true);
  if (!live.success) return;
  const original = JSON.stringify(live.result);
  const context = createSyntheticDisclosureContext({
    sessionMode: "ASSESSMENT",
    disclosurePhase: "ACTIVE"
  });
  const first = projectAssessmentDisclosure({
    assessment_result: live.result,
    disclosure_context: context
  });
  const second = projectAssessmentDisclosure({
    assessment_result: live.result,
    disclosure_context: context
  });
  expect(first.success && second.success).toBe(true);
  if (first.success && second.success) {
    expect(JSON.stringify(second.projection)).toBe(JSON.stringify(first.projection));
  }
  expect(JSON.stringify(live.result)).toBe(original);

  const revealAttempt = projectAssessmentDisclosure({
    assessment_result: live.result,
    disclosure_context: { ...context, show_answers: true }
  });
  expect(revealAttempt.success).toBe(false);
});

test("invalid disclosure phase or provenance fails without a partial projection", async () => {
  const casePackage = await createCompiledAssessmentCase();
  const live = evaluateSyntheticAssessment({
    casePackage,
    committedEvents: [],
    evaluationPhase: "LIVE"
  });
  expect(live.success).toBe(true);
  if (!live.success) return;
  const premature = projectAssessmentDisclosure({
    assessment_result: live.result,
    disclosure_context: createSyntheticDisclosureContext({
      sessionMode: "ASSESSMENT",
      disclosurePhase: "FINAL_DEBRIEF"
    })
  });
  expect(premature.success).toBe(false);
  expect("projection" in premature).toBe(false);

  const wrongSession = projectAssessmentDisclosure({
    assessment_result: live.result,
    disclosure_context: createSyntheticDisclosureContext({
      sessionId: "constructor",
      sessionMode: "ASSESSMENT",
      disclosurePhase: "ACTIVE"
    })
  });
  expect(wrongSession.success).toBe(false);
  if (!wrongSession.success) {
    expect(wrongSession.issues[0]?.code).toBe("DISCLOSURE_PROVENANCE_MISMATCH");
  }
});
