import { describe, expect, test } from "vitest";

import {
  CompiledCasePackageSchema,
  ReviewExecutionArtifactSchema,
  createPinnedClinicalPolicy,
  isProductionPlayableCaseArtifact,
  prepareReviewExecutionArtifact
} from "../../packages/case-schema/src/index.ts";
import {
  PinnedClinicalPolicyEnvelopeSchema,
  PinnedReviewClinicalPolicyEnvelopeSchema,
  CaseControlledValueSchema,
  HemodynamicObservationDefinitionSchema
} from "../../packages/contracts/src/index.ts";
import {
  ExternalLearnerCommandEnvelopeSchema,
  createPinnedReviewSessionCaseContext,
  createPinnedSessionCaseContext,
  initializeReviewInMemorySession,
  processExternalLearnerCommand,
  projectAssessmentEvidenceFromSession,
  type EventIdFactory
} from "../../packages/session-engine/src/index.ts";
import {
  createPinnedAssessmentContext,
  createPinnedReviewAssessmentContext,
  evaluateReviewAssessment
} from "../../packages/assessment-engine/src/index.ts";
import {
  evaluatePinnedClinicalPolicy,
  initializeClinicalScheduler,
  initializePatientState
} from "../../packages/clinical-engine/src/index.ts";
import {
  TEST_HASH_ADAPTER,
  bindSyntheticReviewAndReachabilityEvidence,
  createReviewExecutableUnderReviewCase
} from "../fixtures/cases/synthetic-case.ts";
import {
  cloneDiagnosticCase,
  createDiagnosticCandidateReadyCase
} from "../fixtures/cases/synthetic-diagnostic-case.ts";

const REVIEW_EVENT_ID_FACTORY: EventIdFactory = {
  createEventId(input) {
    return `00000000-0000-4000-8000-${String(input.sequence_no).padStart(12, "0")}`;
  }
};

async function fixture() {
  const source = await createReviewExecutableUnderReviewCase();
  const prepared = await prepareReviewExecutionArtifact(source, TEST_HASH_ADAPTER);
  if (!prepared.success) throw new Error(JSON.stringify(prepared.report));
  return { source, artifact: prepared.artifact };
}

async function reviewDiagnosticFixture() {
  const casePackage = cloneDiagnosticCase(await createDiagnosticCandidateReadyCase());
  for (const declaration of casePackage.manifest.modules) {
    declaration.approval_status = "UNDER_REVIEW";
  }
  casePackage.validation.review_status = "UNDER_REVIEW";
  casePackage.validation.approval_status = "UNDER_REVIEW";
  casePackage.validation.reviews = [];
  await bindSyntheticReviewAndReachabilityEvidence(casePackage);
  return casePackage;
}

describe("ReviewExecutionArtifact architecture gate", () => {
  test("prepares an immutable REVIEW_ONLY artifact without lifecycle promotion or approvals", async () => {
    const source = await createReviewExecutableUnderReviewCase();
    const before = JSON.stringify(source);
    const prepared = await prepareReviewExecutionArtifact(source, TEST_HASH_ADAPTER);
    expect(prepared.success).toBe(true);
    if (!prepared.success) return;
    expect(JSON.stringify(source)).toBe(before);
    expect(source.manifest.status).toBe("UNDER_REVIEW");
    expect(source.validation.reviews).toEqual([]);
    expect(prepared.artifact.execution_authority).toBe("REVIEW_ONLY");
    expect(prepared.artifact.source_identity.source_lifecycle).toBe("UNDER_REVIEW");
    expect(prepared.artifact.source_case.manifest.status).toBe("UNDER_REVIEW");
    expect(ReviewExecutionArtifactSchema.safeParse(prepared.artifact).success).toBe(true);
    expect(CompiledCasePackageSchema.safeParse(prepared.artifact).success).toBe(false);
  });

  test("hashes identical sources identically and binds every module plus review subject", async () => {
    const first = await fixture();
    const second = await fixture();
    expect(second.artifact.review_execution_hash).toBe(first.artifact.review_execution_hash);
    expect(second.artifact.review_subject_hash).toBe(first.artifact.review_subject_hash);
    expect(Object.keys(first.artifact.module_hashes).sort()).toHaveLength(16);
  });

  test("a specialist-relevant edit invalidates review and artifact hashes", async () => {
    const baseline = await createReviewExecutableUnderReviewCase();
    const changed = structuredClone(baseline);
    const neutralHemodynamics = CaseControlledValueSchema.parse("hemodynamics.neutral");
    changed.initial_state.observation_projection!.hemodynamic_mappings[neutralHemodynamics] = HemodynamicObservationDefinitionSchema.parse({
      heart_rate_bpm: 71,
      systolic_bp_mm_hg: 110,
      diastolic_bp_mm_hg: 70
    });
    await bindSyntheticReviewAndReachabilityEvidence(changed);
    const first = await prepareReviewExecutionArtifact(baseline, TEST_HASH_ADAPTER);
    const second = await prepareReviewExecutionArtifact(changed, TEST_HASH_ADAPTER);
    expect(first.success && second.success).toBe(true);
    if (!first.success || !second.success) return;
    expect(second.artifact.module_hashes.initial_state).not.toBe(first.artifact.module_hashes.initial_state);
    expect(second.artifact.review_subject_hash).not.toBe(first.artifact.review_subject_hash);
    expect(second.artifact.review_execution_hash).not.toBe(first.artifact.review_execution_hash);
  });

  test("fails closed when exact reachability evidence or observation coverage is absent", async () => {
    const missingEvidence = await createReviewExecutableUnderReviewCase();
    missingEvidence.validation.deferred_checks = [];
    const evidenceResult = await prepareReviewExecutionArtifact(missingEvidence, TEST_HASH_ADAPTER);
    expect(evidenceResult.success).toBe(false);
    if (!evidenceResult.success) {
      expect(evidenceResult.report.issues.map((issue) => issue.code))
        .toContain("RULE_REACHABILITY_EVIDENCE_MISSING");
    }

    const missingMapping = await createReviewExecutableUnderReviewCase();
    const alternateHemodynamics = CaseControlledValueSchema.parse("hemodynamics.alternate");
    delete missingMapping.initial_state.observation_projection!.hemodynamic_mappings[
      alternateHemodynamics
    ];
    const mappingResult = await prepareReviewExecutionArtifact(missingMapping, TEST_HASH_ADAPTER);
    expect(mappingResult.success).toBe(false);
    if (!mappingResult.success) {
      expect(mappingResult.report.issues.map((issue) => issue.code))
        .toContain("REACHABLE_OBSERVATION_MAPPING_MISSING");
    }
  });

  test("fails closed when deterministic analysis finds an unreachable rule", async () => {
    const source = await createReviewExecutableUnderReviewCase();
    source.rules.rules[0]!.preconditions = [{
      condition_type: "STATE_EQUALS",
      target: "clinical_phase",
      value: CaseControlledValueSchema.parse("phase.unreachable")
    }];
    await bindSyntheticReviewAndReachabilityEvidence(source);
    const result = await prepareReviewExecutionArtifact(source, TEST_HASH_ADAPTER);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.report.issues.map((issue) => issue.code)).toContain("RULE_UNREACHABLE");
      expect(result.report.issues.map((issue) => issue.code)).toContain("RULE_REACHABILITY_FAILED");
    }
  });

  test("blocks unsupported diagnostic execution but permits pending media with structured fallback", async () => {
    const blocking = await reviewDiagnosticFixture();
    blocking.action_catalogue.actions.find(
      (action) => action.action_id === "investigation.synthetic-ecg"
    )!.investigation!.execution_mode = "BLOCKING_PATIENT_UNAVAILABLE";
    await bindSyntheticReviewAndReachabilityEvidence(blocking);
    const blocked = await prepareReviewExecutionArtifact(blocking, TEST_HASH_ADAPTER);
    expect(blocked.success).toBe(false);
    if (!blocked.success) {
      expect(blocked.report.issues.map((issue) => issue.code))
        .toContain("DIAGNOSTIC_EXECUTION_MODE_UNSUPPORTED");
    }

    const pendingMedia = await reviewDiagnosticFixture();
    for (const asset of pendingMedia.visual_manifest.media_assets) {
      if (asset.diagnostic_governance !== undefined) {
        asset.diagnostic_governance.rights_status = "UNRESOLVED";
        asset.diagnostic_governance.clinical_review_status = "UNRESOLVED";
        delete asset.diagnostic_governance.clinical_review_id;
      }
    }
    await bindSyntheticReviewAndReachabilityEvidence(pendingMedia);
    const allowed = await prepareReviewExecutionArtifact(pendingMedia, TEST_HASH_ADAPTER);
    expect(allowed.success).toBe(true);
    if (allowed.success) {
      expect(allowed.report.issues.some(
        (issue) => issue.code === "DIAGNOSTIC_ASSET_RIGHTS_INCOMPLETE"
          && issue.severity === "WARNING"
      )).toBe(true);
    }
  });

  test("requires exactly UNDER_REVIEW and never accepts a fabricated approved Clinical Review", async () => {
    const source = await createReviewExecutableUnderReviewCase();
    source.manifest.status = "APPROVED";
    source.validation.review_status = "APPROVED";
    source.validation.approval_status = "APPROVED";
    const result = await prepareReviewExecutionArtifact(source, TEST_HASH_ADAPTER);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.report.issues.map((issue) => issue.code))
        .toContain("REVIEW_EXECUTION_SOURCE_LIFECYCLE_INVALID");
    }
  });

  test("keeps production and review Clinical policy pinning structurally separate", async () => {
    const { artifact } = await fixture();
    expect(() => createPinnedClinicalPolicy(artifact)).toThrow();
    const review = (await import("../../packages/case-schema/src/index.ts"))
      .createPinnedReviewClinicalPolicy(artifact);
    expect(review.execution_authority).toBe("REVIEW_ONLY");
    expect(review.review_execution_hash).toBe(artifact.review_execution_hash);
    expect(PinnedReviewClinicalPolicyEnvelopeSchema.safeParse(review).success).toBe(true);
    expect(PinnedClinicalPolicyEnvelopeSchema.safeParse({
      ...review,
      execution_authority: "PUBLISHED_PRODUCTION"
    }).success).toBe(false);
  });

  test("Clinical Engine executes the exact review-pinned policy without authority conversion", async () => {
    const { artifact } = await fixture();
    const policy = (await import("../../packages/case-schema/src/index.ts"))
      .createPinnedReviewClinicalPolicy(artifact);
    const patient = initializePatientState(
      artifact.source_case.initial_state.patient_state,
      "session.synthetic.review-002"
    );
    const scheduler = initializeClinicalScheduler(policy.timeline_policy.initial_scheduled_items);
    expect(patient.success && scheduler.success).toBe(true);
    if (!patient.success || !scheduler.success) return;
    const result = evaluatePinnedClinicalPolicy({
      operation: "EVALUATE_TRIGGER",
      policy,
      state: patient.state,
      scheduler_state: scheduler.schedulerState,
      prior_event_facts: [],
      trigger: {
        trigger_type: "COMMITTED_EVENT",
        event_type: "EXAM_PERFORMED",
        action_id: "examination.synthetic-check"
      },
      current_clinical_time: 0
    });
    expect(result.success).toBe(true);
    expect(policy.execution_authority).toBe("REVIEW_ONLY");
  });

  test("keeps production and review Session pinning separate and executable", async () => {
    const { artifact } = await fixture();
    expect(createPinnedSessionCaseContext(artifact).success).toBe(false);
    const review = createPinnedReviewSessionCaseContext(artifact);
    expect(review.success).toBe(true);
    if (!review.success) return;
    expect(review.context.execution_authority).toBe("REVIEW_ONLY");
    expect(review.context.review_execution_hash).toBe(artifact.review_execution_hash);
    const initialized = initializeReviewInMemorySession({
      session_id: "session.synthetic.review-001",
      mode: "PRACTICE_DEMO",
      review_execution_artifact: artifact
    });
    expect(initialized.success).toBe(true);
    if (initialized.success) {
      expect(initialized.session.pinned_case.execution_authority).toBe("REVIEW_ONLY");
    }
  });

  test("keeps production and review Assessment pinning separate", async () => {
    const { artifact } = await fixture();
    expect(createPinnedAssessmentContext(artifact).success).toBe(false);
    const review = createPinnedReviewAssessmentContext(artifact);
    expect(review.success).toBe(true);
    if (!review.success) return;
    expect(review.context.execution_authority).toBe("REVIEW_ONLY");
    expect(review.context.review_execution_hash).toBe(artifact.review_execution_hash);
    expect(review.context.review_subject_hash).toBe(artifact.review_subject_hash);
  });

  test("commits, replays, and scores authoritative review Session evidence without sidecars", async () => {
    const { artifact } = await fixture();
    const initialized = initializeReviewInMemorySession({
      session_id: "session.synthetic.review-assessment",
      mode: "PRACTICE_DEMO",
      review_execution_artifact: artifact
    });
    expect(initialized.success).toBe(true);
    if (!initialized.success) return;
    const command = ExternalLearnerCommandEnvelopeSchema.parse({
      command_schema_version: "1.0",
      request_id: "request.synthetic.review-command",
      correlation_id: "correlation.synthetic.review-command",
      learner_actor_id: "actor.synthetic.reviewer",
      expected_case: {
        execution_authority: "REVIEW_ONLY",
        case_package_id: artifact.source_identity.case_package_id,
        case_version_id: artifact.source_identity.case_version_id,
        case_version: artifact.source_identity.case_version,
        review_execution_hash: artifact.review_execution_hash
      },
      action_request: {
        action_request_id: "action-request.synthetic.review-command",
        catalogue_membership: "UNVERIFIED",
        command_id: "command.synthetic.review-command",
        session_id: initialized.session.session_id,
        action_id: "examination.synthetic-check",
        request_schema_version: "1.0",
        expected_state_version: initialized.session.patient_state.state_version,
        requested_at_clinical_time: initialized.session.patient_state.clinical_time,
        parameters: {},
        source: "UI",
        idempotency_key: "idempotency.synthetic.review-command"
      }
    });
    const committed = await processExternalLearnerCommand(
      initialized.session,
      command,
      {
        hash_adapter: TEST_HASH_ADAPTER,
        event_id_factory: REVIEW_EVENT_ID_FACTORY,
        real_time_utc: "2026-08-30T12:10:00Z"
      }
    );
    expect(committed.success).toBe(true);
    if (!committed.success) return;
    expect(committed.status).toBe("COMMITTED");
    expect(committed.authoritative_session.pinned_case.execution_authority)
      .toBe("REVIEW_ONLY");
    expect(committed.committed_events).toHaveLength(1);

    const replay = await processExternalLearnerCommand(
      committed.authoritative_session,
      command,
      {
        hash_adapter: TEST_HASH_ADAPTER,
        event_id_factory: REVIEW_EVENT_ID_FACTORY,
        real_time_utc: "2026-08-30T12:10:00Z"
      }
    );
    expect(replay.success).toBe(true);
    if (!replay.success) return;
    expect(replay.status).toBe("REPLAYED");
    expect(replay.authoritative_session.committed_events).toHaveLength(1);
    expect(replay.authoritative_session.pinned_case.execution_authority)
      .toBe("REVIEW_ONLY");

    const evidence = projectAssessmentEvidenceFromSession(
      replay.authoritative_session
    );
    expect(evidence.success).toBe(true);
    if (!evidence.success || evidence.evidence.execution_authority !== "REVIEW_ONLY") return;
    expect(evidence.evidence.committed_events).toHaveLength(1);
    expect(evidence.evidence.review_execution_hash).toBe(artifact.review_execution_hash);
    const evaluated = evaluateReviewAssessment({
      evaluation_schema_version: "1.0",
      execution_authority: "REVIEW_ONLY",
      evaluation_phase: "LIVE",
      assessment_id: "assessment.synthetic.review-001",
      review_execution_artifact: artifact,
      session_evidence: evidence.evidence
    });
    expect(evaluated.success).toBe(true);
    if (evaluated.success) {
      expect(evaluated.result.execution_authority).toBe("REVIEW_ONLY");
      if (evaluated.result.execution_authority === "REVIEW_ONLY") {
        expect(evaluated.result.review_execution_hash).toBe(artifact.review_execution_hash);
        expect(evaluated.result.evidence_records.some(
          (record) => record.evidence_kind === "COMMITTED_EVENT"
        )).toBe(true);
      }
    }
  });

  test("cannot cross the production-playability boundary", async () => {
    const { artifact } = await fixture();
    expect(isProductionPlayableCaseArtifact(artifact)).toBe(false);
    expect(isProductionPlayableCaseArtifact({
      ...artifact,
      execution_authority: "PUBLISHED_PRODUCTION"
    })).toBe(false);
  });

  test("prototype-style controlled values remain safe and deterministic", async () => {
    const source = await createReviewExecutableUnderReviewCase();
    const prototypeValue = CaseControlledValueSchema.parse("constructor");
    source.initial_state.patient_state.hemodynamic_state = prototypeValue;
    source.initial_state.observation_projection!.hemodynamic_mappings = {
      ...source.initial_state.observation_projection!.hemodynamic_mappings,
      [prototypeValue]: HemodynamicObservationDefinitionSchema.parse({
        heart_rate_bpm: 70,
        systolic_bp_mm_hg: 110,
        diastolic_bp_mm_hg: 70
      })
    };
    await bindSyntheticReviewAndReachabilityEvidence(source);
    const result = await prepareReviewExecutionArtifact(source, TEST_HASH_ADAPTER);
    expect(result.success).toBe(true);
  });
});
