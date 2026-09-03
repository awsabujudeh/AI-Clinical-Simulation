import { expect, test } from "vitest";

import {
  ASSESSMENT_EVALUATION_SCHEMA_VERSION,
  evaluateAssessment
} from "../../../packages/assessment-engine/src/index.ts";
import {
  ActionRequestSchema,
  AssessmentResultSchema,
  ClinicalEventProposalSchema
} from "../../../packages/contracts/src/index.ts";
import { CaseActionDefinitionSchema } from "../../../packages/case-schema/src/index.ts";
import {
  createAssessmentEvidenceFromCompiledCase,
  createCommittedAssessmentEvent,
  createCompiledAssessmentCase,
  createExecutedSyntheticCheckEvent,
  createSyntheticFinalizationBoundary,
  evaluateSyntheticAssessment
} from "../../fixtures/assessment-engine/synthetic-assessment.ts";

test("compiled Case pinning is required and a runtime rubric sidecar is rejected", async () => {
  const casePackage = await createCompiledAssessmentCase();
  const evidence = createAssessmentEvidenceFromCompiledCase(casePackage, []);
  const finalizationBoundary = createSyntheticFinalizationBoundary(
    casePackage,
    evidence,
    "assessment.synthetic.mismatch"
  );
  const mismatched = evaluateAssessment({
    evaluation_schema_version: ASSESSMENT_EVALUATION_SCHEMA_VERSION,
    execution_authority: "PUBLISHED_PRODUCTION",
    assessment_id: "assessment.synthetic.mismatch",
    compiled_case_package: casePackage,
    session_evidence: {
      ...evidence,
      package_hash: "f".repeat(64)
    },
    evaluation_phase: "FINAL",
    finalization_boundary: finalizationBoundary
  });
  expect(mismatched.success).toBe(false);
  if (!mismatched.success) {
    expect(mismatched.issues.some((issue) => issue.code === "PINNED_ASSESSMENT_MISMATCH"))
      .toBe(true);
  }

  const sidecar = evaluateAssessment({
    evaluation_schema_version: ASSESSMENT_EVALUATION_SCHEMA_VERSION,
    execution_authority: "PUBLISHED_PRODUCTION",
    assessment_id: "assessment.synthetic.sidecar",
    compiled_case_package: casePackage,
    session_evidence: evidence,
    evaluation_phase: "FINAL",
    finalization_boundary: createSyntheticFinalizationBoundary(
      casePackage,
      evidence,
      "assessment.synthetic.sidecar"
    ),
    rubric: casePackage.assessment_rubric
  });
  expect(sidecar.success).toBe(false);
});

test("committed successful execution earns credit while rejected intent does not", async () => {
  const casePackage = await createCompiledAssessmentCase();
  const executed = createExecutedSyntheticCheckEvent(casePackage);
  const accepted = evaluateSyntheticAssessment({ casePackage, committedEvents: [executed] });
  expect(accepted.success && accepted.result.overall_score_basis_points).toBe(10_000);

  const rejected = createCommittedAssessmentEvent({
    casePackage,
    sequenceNo: 1,
    clinicalTime: 30,
    eventType: "EXAM_PERFORMED",
    actionId: "examination.synthetic-check",
    learnerExecution: true,
    executionPayload: "REJECTED"
  });
  const denied = evaluateSyntheticAssessment({ casePackage, committedEvents: [rejected] });
  expect(denied.success && denied.result.overall_score_basis_points).toBe(0);
});

test("raw ActionRequest and uncommitted Clinical proposals cannot become evidence", async () => {
  const casePackage = await createCompiledAssessmentCase();
  const actionRequest = ActionRequestSchema.parse({
    action_request_id: "assessment-raw-intent",
    catalogue_membership: "UNVERIFIED",
    command_id: "assessment-command",
    session_id: "assessment-session",
    action_id: "examination.synthetic-check",
    request_schema_version: "1.0",
    expected_state_version: 0,
    requested_at_clinical_time: 30,
    parameters: {},
    source: "UI",
    idempotency_key: "assessment-intent-key"
  });
  const proposal = ClinicalEventProposalSchema.parse({
    proposal_schema_version: "1.0",
    originating_rule_id: "rule.synthetic.action-response",
    event_type: "EXAM_PERFORMED",
    action_id: "examination.synthetic-check",
    proposed_clinical_time: 30,
    parameters: {},
    payload: {},
    clinical_effect_ids: []
  });
  for (const invalidEvidence of [actionRequest, proposal]) {
    const result = evaluateAssessment({
      evaluation_schema_version: ASSESSMENT_EVALUATION_SCHEMA_VERSION,
      execution_authority: "PUBLISHED_PRODUCTION",
      assessment_id: "assessment.synthetic.invalid-evidence",
      compiled_case_package: casePackage,
      session_evidence: invalidEvidence,
      evaluation_phase: "LIVE"
    });
    expect(result.success).toBe(false);
  }
});

test("one committed event remains one scoring occurrence across exact re-evaluation", async () => {
  const casePackage = await createCompiledAssessmentCase();
  const event = createExecutedSyntheticCheckEvent(casePackage);
  const first = evaluateSyntheticAssessment({ casePackage, committedEvents: [event] });
  const retry = evaluateSyntheticAssessment({ casePackage, committedEvents: [event] });
  expect(first.success && retry.success).toBe(true);
  if (first.success && retry.success) {
    expect(retry.result).toEqual(first.result);
    expect(new Set(retry.result.evidence_records.map((item) => item.evidence_ref_id)).size)
      .toBe(retry.result.evidence_records.length);
  }
});

test("Practice and Assessment modes do not change internal deterministic truth", async () => {
  const casePackage = await createCompiledAssessmentCase();
  const event = createExecutedSyntheticCheckEvent(casePackage);
  const evidence = createAssessmentEvidenceFromCompiledCase(casePackage, [event]);
  const assessment = evaluateAssessment({
    evaluation_schema_version: ASSESSMENT_EVALUATION_SCHEMA_VERSION,
    execution_authority: "PUBLISHED_PRODUCTION",
    assessment_id: "assessment.synthetic.mode-independent",
    compiled_case_package: casePackage,
    session_evidence: evidence,
    evaluation_phase: "LIVE"
  });
  const practice = evaluateAssessment({
    evaluation_schema_version: ASSESSMENT_EVALUATION_SCHEMA_VERSION,
    execution_authority: "PUBLISHED_PRODUCTION",
    assessment_id: "assessment.synthetic.mode-independent",
    compiled_case_package: casePackage,
    session_evidence: { ...evidence, session_mode: "PRACTICE_DEMO" },
    evaluation_phase: "LIVE"
  });
  expect(assessment.success && practice.success).toBe(true);
  if (assessment.success && practice.success) {
    expect(practice.result).toEqual(assessment.result);
  }
});

test("evidence ordering is canonical and result contract validation succeeds", async () => {
  const casePackage = await createCompiledAssessmentCase((draft) => {
    draft.assessment_rubric.domains[0]!.criteria[0]!.repeat_policy = {
      mode: "BOUNDED",
      maximum_occurrences: 2
    };
  });
  const events = [
    createExecutedSyntheticCheckEvent(casePackage, 1, 20),
    createExecutedSyntheticCheckEvent(casePackage, 2, 30)
  ];
  const evaluated = evaluateSyntheticAssessment({ casePackage, committedEvents: events });
  expect(evaluated.success).toBe(true);
  if (evaluated.success) {
    const firstCriterionEvidence = evaluated.result.criterion_results[0]!.evidence_ref_ids;
    expect(firstCriterionEvidence[0]).toContain("event-1");
    expect(firstCriterionEvidence[1]).toContain("event-2");
    expect(AssessmentResultSchema.safeParse(evaluated.result).success).toBe(true);
    expect(JSON.parse(JSON.stringify(evaluated.result))).toEqual(evaluated.result);
  }
});

test("prototype-style Case-owned Action IDs are matched without property-chain lookup", async () => {
  const casePackage = await createCompiledAssessmentCase((draft) => {
    draft.action_catalogue.actions.push(CaseActionDefinitionSchema.parse({
      action_id: "constructor.synthetic",
      action_type: "EXAMINATION",
      parameter_definitions: [],
      aliases: [],
      prerequisite_action_ids: [],
      confirmation_policy: "NONE",
      repeat_policy: "NOT_REPEATABLE",
      source_ids: ["source.synthetic.001"]
    }));
    draft.assessment_rubric.domains[0]!.criteria[0]!.evidence.action_ids = [
      CaseActionDefinitionSchema.shape.action_id.parse("constructor.synthetic")
    ];
  });
  const event = createCommittedAssessmentEvent({
    casePackage,
    sequenceNo: 1,
    clinicalTime: 30,
    eventType: "EXAM_PERFORMED",
    actionId: "constructor.synthetic",
    learnerExecution: true
  });
  const evaluated = evaluateSyntheticAssessment({ casePackage, committedEvents: [event] });
  expect(evaluated.success).toBe(true);
  if (evaluated.success) {
    expect(evaluated.result.criterion_results[0]!.status).toBe("SATISFIED");
  }
});
