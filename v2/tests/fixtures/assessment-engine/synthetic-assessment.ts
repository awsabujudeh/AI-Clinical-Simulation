import {
  ASSESSMENT_EVALUATION_SCHEMA_VERSION,
  evaluateAssessment,
  projectAssessmentDisclosure,
  type AssessmentEvaluationResult
} from "../../../packages/assessment-engine/src/index.ts";
import {
  ASSESSMENT_FINALIZATION_BOUNDARY_SCHEMA_VERSION,
  ASSESSMENT_DISCLOSURE_SCHEMA_VERSION,
  CanonicalEventEnvelopeSchema,
  AssessmentFinalizationBoundarySchema,
  type AssessmentSessionEvidence,
  TrustedAssessmentDisclosureContextSchema,
  type CanonicalEventEnvelope,
  type EventType
} from "../../../packages/contracts/src/index.ts";
import {
  CompiledCasePackageSchema,
  DraftCasePackageSchema,
  compileCasePackage,
  preparePublicationCandidate,
  type CompiledCasePackage,
  type DraftCasePackage
} from "../../../packages/case-schema/src/index.ts";
import {
  InMemorySessionAggregateSchema,
  initializeInMemorySession,
  projectAssessmentEvidenceFromSession
} from "../../../packages/session-engine/src/index.ts";
import {
  TEST_HASH_ADAPTER,
  bindSyntheticReviewAndReachabilityEvidence,
  createCandidateReadyUnderReviewCase,
  createPublicationApprovalRecord
} from "../cases/synthetic-case.ts";

export type AssessmentCaseModifier = (casePackage: DraftCasePackage) => void;

export async function createCompiledAssessmentCase(
  modifier?: AssessmentCaseModifier
): Promise<CompiledCasePackage> {
  const underReview = await createCandidateReadyUnderReviewCase(TEST_HASH_ADAPTER);
  modifier?.(underReview);
  await bindSyntheticReviewAndReachabilityEvidence(underReview, TEST_HASH_ADAPTER);
  const prepared = await preparePublicationCandidate(underReview, TEST_HASH_ADAPTER);
  if (!prepared.success) {
    throw new Error(`Assessment fixture failed candidate validation: ${JSON.stringify(prepared.report)}`);
  }

  const approved = DraftCasePackageSchema.parse(JSON.parse(JSON.stringify(underReview)));
  approved.manifest.status = "APPROVED";
  const approval = createPublicationApprovalRecord(
    approved,
    prepared.candidate.candidate_package_hash
  );
  const compiled = await compileCasePackage(approved, approval, TEST_HASH_ADAPTER);
  if (!compiled.success) {
    throw new Error(`Assessment fixture failed compilation: ${JSON.stringify(compiled.report)}`);
  }
  return CompiledCasePackageSchema.parse(compiled.package);
}

function deterministicEventId(sequenceNo: number): string {
  return `00000000-0000-4000-8000-${sequenceNo.toString().padStart(12, "0")}`;
}

export function createCommittedAssessmentEvent(input: {
  casePackage: CompiledCasePackage;
  sequenceNo: number;
  clinicalTime: number;
  eventType: EventType;
  actionId?: string;
  learnerExecution?: boolean;
  executionPayload?: "EXECUTED" | "REJECTED";
}): CanonicalEventEnvelope {
  const learnerExecution = input.learnerExecution ?? false;
  return CanonicalEventEnvelopeSchema.parse({
    event_id: deterministicEventId(input.sequenceNo),
    session_id: "assessment-session",
    sequence_no: input.sequenceNo,
    event_schema_version: "1.0",
    clinical_time: input.clinicalTime,
    real_time_utc: "2026-09-02T00:00:00Z",
    actor_type: learnerExecution ? "LEARNER" : "SYSTEM",
    ...(learnerExecution ? { actor_id: "learner.synthetic.001" } : {}),
    source: learnerExecution ? "UI" : "ENGINE",
    correlation_id: `assessment-correlation-${input.sequenceNo}`,
    ...(learnerExecution
      ? { action_request_id: `assessment-action-request-${input.sequenceNo}` }
      : {}),
    ...(input.actionId === undefined ? {} : { action_id: input.actionId }),
    event_type: input.eventType,
    parameters: {},
    status: "COMMITTED",
    payload: learnerExecution
      ? {
          catalogue_membership: "VERIFIED",
          execution_status: input.executionPayload ?? "EXECUTED"
        }
      : {},
    clinical_effect_ids: [],
    state_version_before: 0,
    state_version_after: 0,
    scoring_evidence_refs: [],
    case_version: input.casePackage.manifest.case_version,
    idempotency_key: `assessment-idempotency-${input.sequenceNo}`,
    request_id: `assessment-request-${input.sequenceNo}`
  });
}

export function createExecutedSyntheticCheckEvent(
  casePackage: CompiledCasePackage,
  sequenceNo = 1,
  clinicalTime = 30
): CanonicalEventEnvelope {
  return createCommittedAssessmentEvent({
    casePackage,
    sequenceNo,
    clinicalTime,
    eventType: "EXAM_PERFORMED",
    actionId: "examination.synthetic-check",
    learnerExecution: true
  });
}

export function createAssessmentEvidenceFromCompiledCase(
  casePackage: CompiledCasePackage,
  committedEvents: readonly CanonicalEventEnvelope[],
  assessedThroughClinicalTime?: number,
  sessionMode: "PRACTICE_DEMO" | "ASSESSMENT" = "ASSESSMENT"
) {
  const initialized = initializeInMemorySession({
    session_id: "assessment-session",
    mode: sessionMode,
    compiled_case_package: casePackage
  });
  if (!initialized.success) {
    throw new Error(`Assessment Session initialization failed: ${JSON.stringify(initialized.issues)}`);
  }
  const clinicalTime = assessedThroughClinicalTime
    ?? committedEvents.reduce((maximum, event) => Math.max(maximum, event.clinical_time), 0);
  const session = InMemorySessionAggregateSchema.parse({
    ...initialized.session,
    patient_state: {
      ...initialized.session.patient_state,
      clinical_time: clinicalTime
    },
    clinical_clock: {
      ...initialized.session.clinical_clock,
      clinical_time: clinicalTime
    },
    committed_events: [...committedEvents],
    next_sequence_no: committedEvents.length + 1
  });
  const projection = projectAssessmentEvidenceFromSession(session);
  if (!projection.success) {
    throw new Error(`Assessment evidence projection failed: ${JSON.stringify(projection.issues)}`);
  }
  return projection.evidence;
}

export function createSyntheticFinalizationBoundary(
  casePackage: CompiledCasePackage,
  evidence: AssessmentSessionEvidence,
  assessmentId = "assessment.synthetic.001"
) {
  return AssessmentFinalizationBoundarySchema.parse({
    boundary_schema_version: ASSESSMENT_FINALIZATION_BOUNDARY_SCHEMA_VERSION,
    authority: "TRUSTED_SESSION_FINALIZATION",
    assessment_id: assessmentId,
    session_id: evidence.session_id,
    case_package_id: casePackage.manifest.case_package_id,
    case_version_id: casePackage.manifest.case_version_id,
    case_version: casePackage.manifest.case_version,
    package_hash: casePackage.package_hash,
    rubric_id: casePackage.assessment_rubric.rubric_id,
    rubric_version: casePackage.assessment_rubric.rubric_version,
    rubric_module_hash: casePackage.manifest.module_hashes.assessment_rubric,
    event_sequence_through: evidence.committed_events.at(-1)?.sequence_no ?? 0,
    clinical_time_through: evidence.assessed_through_clinical_time
  });
}

export function createSyntheticDisclosureContext(input: {
  assessmentId?: string;
  sessionId?: string;
  sessionMode: "PRACTICE_DEMO" | "ASSESSMENT";
  disclosurePhase: "ACTIVE" | "FINAL_DEBRIEF";
}) {
  return TrustedAssessmentDisclosureContextSchema.parse({
    context_schema_version: ASSESSMENT_DISCLOSURE_SCHEMA_VERSION,
    authority: "TRUSTED_ASSESSMENT_DISCLOSURE",
    assessment_id: input.assessmentId ?? "assessment.synthetic.001",
    session_id: input.sessionId ?? "assessment-session",
    session_mode: input.sessionMode,
    disclosure_phase: input.disclosurePhase
  });
}

export function evaluateSyntheticAssessment(input: {
  casePackage: CompiledCasePackage;
  committedEvents: readonly CanonicalEventEnvelope[];
  assessedThroughClinicalTime?: number;
  sessionMode?: "PRACTICE_DEMO" | "ASSESSMENT";
  evaluationPhase?: "LIVE" | "FINAL";
}): AssessmentEvaluationResult {
  const evidence = createAssessmentEvidenceFromCompiledCase(
    input.casePackage,
    input.committedEvents,
    input.assessedThroughClinicalTime,
    input.sessionMode
  );
  const evaluationPhase = input.evaluationPhase ?? "FINAL";
  return evaluateAssessment({
    evaluation_schema_version: ASSESSMENT_EVALUATION_SCHEMA_VERSION,
    execution_authority: "PUBLISHED_PRODUCTION",
    assessment_id: "assessment.synthetic.001",
    compiled_case_package: input.casePackage,
    session_evidence: evidence,
    evaluation_phase: evaluationPhase,
    ...(evaluationPhase === "FINAL"
      ? {
          finalization_boundary: createSyntheticFinalizationBoundary(
            input.casePackage,
            evidence,
            "assessment.synthetic.001"
          )
        }
      : {})
  });
}

export async function createV2007APortabilitySnapshot() {
  const casePackage = await createCompiledAssessmentCase();
  const event = createExecutedSyntheticCheckEvent(casePackage);
  const evaluated = evaluateSyntheticAssessment({
    casePackage,
    committedEvents: [event],
    assessedThroughClinicalTime: 30
  });
  if (!evaluated.success) {
    throw new Error(`Assessment portability fixture failed: ${JSON.stringify(evaluated.issues)}`);
  }
  if (evaluated.result.execution_authority !== "PUBLISHED_PRODUCTION") {
    throw new Error("Production assessment fixture returned non-production authority.");
  }
  return {
    overall_score_basis_points: evaluated.result.overall_score_basis_points,
    domain_scores: evaluated.result.domain_scores,
    criterion_statuses: evaluated.result.criterion_results.map((criterion) => ({
      rubric_item_id: criterion.rubric_item_id,
      status: criterion.status,
      occurrence_count: criterion.occurrence_count,
      evidence_ref_ids: criterion.evidence_ref_ids
    })),
    evidence_sequence: evaluated.result.evidence_records.map((evidence) => ({
      evidence_ref_id: evidence.evidence_ref_id,
      evidence_kind: evidence.evidence_kind,
      ...(evidence.evidence_kind === "COMMITTED_EVENT"
        ? {
            event_id: evidence.event_id,
            sequence_no: evidence.sequence_no,
            clinical_time: evidence.clinical_time
          }
        : {})
    })),
    rubric_module_hash: evaluated.result.rubric_module_hash,
    package_hash: evaluated.result.package_hash
  };
}

export const V2_007A_ASSESSMENT_PORTABILITY_EXPECTED = JSON.stringify({
  overall_score_basis_points: 10_000,
  domain_scores: [
    { domain_id: "domain.history", earned_points: 10, maximum_points: 10, score_basis_points: 10_000, weight_basis_points: 1667, weighted_contribution_basis_points: 1667 },
    { domain_id: "domain.examination", earned_points: 10, maximum_points: 10, score_basis_points: 10_000, weight_basis_points: 1667, weighted_contribution_basis_points: 1667 },
    { domain_id: "domain.investigations", earned_points: 10, maximum_points: 10, score_basis_points: 10_000, weight_basis_points: 1667, weighted_contribution_basis_points: 1667 },
    { domain_id: "domain.treatment", earned_points: 10, maximum_points: 10, score_basis_points: 10_000, weight_basis_points: 1667, weighted_contribution_basis_points: 1667 },
    { domain_id: "domain.diagnosis", earned_points: 10, maximum_points: 10, score_basis_points: 10_000, weight_basis_points: 1666, weighted_contribution_basis_points: 1666 },
    { domain_id: "domain.disposition", earned_points: 10, maximum_points: 10, score_basis_points: 10_000, weight_basis_points: 1666, weighted_contribution_basis_points: 1666 }
  ],
  criterion_statuses: [
    { rubric_item_id: "rubric-item.synthetic.history", status: "SATISFIED", occurrence_count: 1, evidence_ref_ids: ["scoring-evidence.synthetic.history.event-1"] },
    { rubric_item_id: "rubric-item.synthetic.examination", status: "SATISFIED", occurrence_count: 1, evidence_ref_ids: ["scoring-evidence.synthetic.examination.event-1"] },
    { rubric_item_id: "rubric-item.synthetic.investigations", status: "SATISFIED", occurrence_count: 1, evidence_ref_ids: ["scoring-evidence.synthetic.investigations.event-1"] },
    { rubric_item_id: "rubric-item.synthetic.treatment", status: "SATISFIED", occurrence_count: 1, evidence_ref_ids: ["scoring-evidence.synthetic.treatment.event-1"] },
    { rubric_item_id: "rubric-item.synthetic.diagnosis", status: "SATISFIED", occurrence_count: 1, evidence_ref_ids: ["scoring-evidence.synthetic.diagnosis.event-1"] },
    { rubric_item_id: "rubric-item.synthetic.disposition", status: "SATISFIED", occurrence_count: 1, evidence_ref_ids: ["scoring-evidence.synthetic.disposition.event-1"] },
    { rubric_item_id: "rubric-item.synthetic.check", status: "NOT_TRIGGERED", occurrence_count: 1, evidence_ref_ids: ["scoring-evidence.synthetic.check.event-1"] }
  ],
  evidence_sequence: [
    "history",
    "examination",
    "investigations",
    "treatment",
    "diagnosis",
    "disposition",
    "check"
  ].map((item) => ({
    evidence_ref_id: `scoring-evidence.synthetic.${item}.event-1`,
    evidence_kind: "COMMITTED_EVENT",
    event_id: "00000000-0000-4000-8000-000000000001",
    sequence_no: 1,
    clinical_time: 30
  })),
  rubric_module_hash: "3b62052de924b953ff7afc8149190543eac44d2d339cd4b374cbcc9940644bd3",
  package_hash: "0eba9992fcc9ce11141e27dc524c8e73cd7a333e90e7677ddb2951b8345adc8f"
});

export async function createV2007BPortabilitySnapshot() {
  const casePackage = await createCompiledAssessmentCase();
  const event = createExecutedSyntheticCheckEvent(casePackage);
  const assessmentLive = evaluateSyntheticAssessment({
    casePackage,
    committedEvents: [event],
    assessedThroughClinicalTime: 30,
    evaluationPhase: "LIVE",
    sessionMode: "ASSESSMENT"
  });
  const practiceLive = evaluateSyntheticAssessment({
    casePackage,
    committedEvents: [event],
    assessedThroughClinicalTime: 30,
    evaluationPhase: "LIVE",
    sessionMode: "PRACTICE_DEMO"
  });
  const final = evaluateSyntheticAssessment({
    casePackage,
    committedEvents: [event],
    assessedThroughClinicalTime: 30,
    evaluationPhase: "FINAL"
  });
  if (!assessmentLive.success || !practiceLive.success || !final.success) {
    throw new Error("Assessment disclosure portability fixture could not evaluate truth.");
  }
  const withheld = projectAssessmentDisclosure({
    assessment_result: assessmentLive.result,
    disclosure_context: createSyntheticDisclosureContext({
      sessionMode: "ASSESSMENT",
      disclosurePhase: "ACTIVE"
    })
  });
  const practice = projectAssessmentDisclosure({
    assessment_result: practiceLive.result,
    disclosure_context: createSyntheticDisclosureContext({
      sessionMode: "PRACTICE_DEMO",
      disclosurePhase: "ACTIVE"
    })
  });
  const debrief = projectAssessmentDisclosure({
    assessment_result: final.result,
    disclosure_context: createSyntheticDisclosureContext({
      sessionMode: "ASSESSMENT",
      disclosurePhase: "FINAL_DEBRIEF"
    })
  });
  if (!withheld.success || !practice.success || !debrief.success) {
    throw new Error("Assessment disclosure portability fixture failed its projection.");
  }
  return {
    scoring_truth_equal_across_modes:
      JSON.stringify(assessmentLive.result) === JSON.stringify(practiceLive.result),
    active_assessment: withheld.projection,
    active_practice: practice.projection,
    final_debrief: debrief.projection.projection_type === "FINAL_DEBRIEF"
      ? {
          projection_type: debrief.projection.projection_type,
          finalization_boundary: debrief.projection.debrief_evidence.finalization_boundary,
          overall_score_basis_points:
            debrief.projection.debrief_evidence.assessment_result.overall_score_basis_points,
          criterion_statuses:
            debrief.projection.debrief_evidence.assessment_result.criterion_results.map(
              (criterion) => criterion.status
            ),
          evidence_sequences:
            debrief.projection.debrief_evidence.assessment_result.evidence_records.flatMap(
              (evidence) => evidence.evidence_kind === "COMMITTED_EVENT"
                ? [evidence.sequence_no]
                : []
            )
        }
      : null
  };
}

export const V2_007B_ASSESSMENT_PORTABILITY_EXPECTED = JSON.stringify({
  scoring_truth_equal_across_modes: true,
  active_assessment: {
    projection_schema_version: "1.0",
    projection_type: "ACTIVE_ASSESSMENT_WITHHELD",
    assessment_id: "assessment.synthetic.001",
    session_id: "assessment-session",
    session_mode: "ASSESSMENT",
    assessment_status: "ACTIVE"
  },
  active_practice: {
    projection_schema_version: "1.0",
    projection_type: "ACTIVE_PRACTICE_FEEDBACK",
    assessment_id: "assessment.synthetic.001",
    session_id: "assessment-session",
    session_mode: "PRACTICE_DEMO",
    assessment_status: "ACTIVE",
    resolved_findings: ["history", "examination", "investigations", "treatment", "diagnosis", "disposition"]
      .map((_, index) => ({
        finding_id: `finding:assessment.synthetic.001:${index + 1}`,
        category: "CORRECT_ACTION",
        resolution: "RESOLVED",
        evidence: [{
          event_id: "00000000-0000-4000-8000-000000000001",
          sequence_no: 1,
          clinical_time: 30,
          action_id: "examination.synthetic-check"
        }]
      }))
  },
  final_debrief: {
    projection_type: "FINAL_DEBRIEF",
    finalization_boundary: {
      boundary_schema_version: "1.0",
      authority: "TRUSTED_SESSION_FINALIZATION",
      assessment_id: "assessment.synthetic.001",
      session_id: "assessment-session",
      case_package_id: "case-package.synthetic.neutral.001",
      case_version_id: "case-version.synthetic.neutral.001",
      case_version: "2.0.0",
      package_hash: "0eba9992fcc9ce11141e27dc524c8e73cd7a333e90e7677ddb2951b8345adc8f",
      rubric_id: "rubric.synthetic.001",
      rubric_version: "1.0.0",
      rubric_module_hash: "3b62052de924b953ff7afc8149190543eac44d2d339cd4b374cbcc9940644bd3",
      event_sequence_through: 1,
      clinical_time_through: 30
    },
    overall_score_basis_points: 10_000,
    criterion_statuses: [
      "SATISFIED",
      "SATISFIED",
      "SATISFIED",
      "SATISFIED",
      "SATISFIED",
      "SATISFIED",
      "NOT_TRIGGERED"
    ],
    evidence_sequences: [1, 1, 1, 1, 1, 1, 1]
  }
});
