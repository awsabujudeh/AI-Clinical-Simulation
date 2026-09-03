import { describe, expect, test } from "vitest";

import {
  CompiledCasePackageSchema,
  ReviewExecutionArtifactSchema,
  analyzeRuleReachability,
  createPinnedReviewClinicalPolicy,
  prepareReviewExecutionArtifact,
  validateDraftCase,
  validateForPublication
} from "../../../packages/case-schema/src/index.ts";
import {
  createPinnedReviewAssessmentContext,
  projectAssessmentDisclosure
} from "../../../packages/assessment-engine/src/index.ts";
import {
  createPinnedReviewSessionCaseContext
} from "../../../packages/session-engine/src/index.ts";
import {
  projectObservations
} from "../../../packages/clinical-engine/src/index.ts";
import {
  createStemiUnderReviewCase
} from "../../../content/cases/stemi/v2-draft/stemi-case.ts";
import { PORTABLE_SHA256_ADAPTER } from "../../fixtures/portable-sha256.ts";
import {
  createStemiPortabilitySnapshot,
  prepareStemiReviewArtifact,
  runStemiClinicalProbe,
  runStemiGoldenTrace,
  runStemiNitrateIndependentManagementProbe,
  runStemiTherapyAlternativeRepeatProbe,
  STEMI_PORTABILITY_SNAPSHOT_SHA256
} from "../../fixtures/cases/stemi-review.ts";

function findAction(casePackage: Awaited<ReturnType<typeof createStemiUnderReviewCase>>, id: string) {
  const action = casePackage.action_catalogue.actions.find((entry) => entry.action_id === id);
  if (action === undefined) throw new Error(`Missing action: ${id}`);
  return action;
}

describe("V2-009 Acute Inferior STEMI review Case", () => {
  test("parses one exact 16-module UNDER_REVIEW Case without approval authority", async () => {
    const casePackage = await createStemiUnderReviewCase(PORTABLE_SHA256_ADAPTER);
    expect(casePackage.manifest.status).toBe("UNDER_REVIEW");
    expect(casePackage.manifest.modules).toHaveLength(16);
    expect(new Set(casePackage.manifest.modules.map((module) => module.module_name)).size).toBe(16);
    expect(casePackage.manifest.modules.every((module) => module.approval_status === "UNDER_REVIEW")).toBe(true);
    expect(casePackage.validation.reviews).toEqual([]);
    expect(casePackage.validation.review_status).toBe("UNDER_REVIEW");
    expect(casePackage.validation.approval_status).toBe("UNDER_REVIEW");
    expect(validateDraftCase(casePackage).valid).toBe(true);
    expect(CompiledCasePackageSchema.safeParse(casePackage).success).toBe(false);
  });

  test("prepares one immutable REVIEW_ONLY artifact and aligned review pinning contexts", async () => {
    const artifact = await prepareStemiReviewArtifact();
    expect(ReviewExecutionArtifactSchema.safeParse(artifact).success).toBe(true);
    expect(artifact.execution_authority).toBe("REVIEW_ONLY");
    expect(artifact.source_case.manifest.status).toBe("UNDER_REVIEW");
    expect(Object.keys(artifact.module_hashes)).toHaveLength(16);
    expect(createPinnedReviewClinicalPolicy(artifact).review_execution_hash)
      .toBe(artifact.review_execution_hash);
    const session = createPinnedReviewSessionCaseContext(artifact);
    const assessment = createPinnedReviewAssessmentContext(artifact);
    expect(session.success && assessment.success).toBe(true);
    if (!session.success || !assessment.success) return;
    expect(session.context.review_subject_hash).toBe(artifact.review_subject_hash);
    expect(assessment.context.review_subject_hash).toBe(artifact.review_subject_hash);
    expect(session.context.execution_authority).toBe("REVIEW_ONLY");
    expect(assessment.context.execution_authority).toBe("REVIEW_ONLY");
  });

  test("cannot pass publication or fabricate an exact-package Approval Record", async () => {
    const casePackage = await createStemiUnderReviewCase(PORTABLE_SHA256_ADAPTER);
    const publication = await validateForPublication(
      casePackage,
      undefined,
      PORTABLE_SHA256_ADAPTER
    );
    expect(publication.valid).toBe(false);
    expect(publication.issues.map((issue) => issue.code)).toContain("PACKAGE_APPROVAL_MISSING");
    expect(casePackage.validation.reviews).toHaveLength(0);
    expect(JSON.stringify(casePackage)).not.toContain('"status":"APPROVED"');
  });

  test("preserves ar-JO/en-US and canonical JU/JUST unknown mappings", async () => {
    const casePackage = await createStemiUnderReviewCase(PORTABLE_SHA256_ADAPTER);
    expect(casePackage.patient_profile.default_language).toBe("ar-JO");
    expect(casePackage.patient_profile.supported_languages).toEqual(["ar-JO", "en-US"]);
    const institutions = casePackage.curriculum_mappings.objectives.map((entry) => entry.institution);
    expect(institutions.some((entry) => entry.institution_id === "ju"
      && entry.institution_code === "JU"
      && entry.institution_name === "University of Jordan")).toBe(true);
    expect(institutions.some((entry) => entry.institution_id === "just"
      && entry.institution_code === "JUST"
      && entry.institution_name === "Jordan University of Science and Technology")).toBe(true);
    expect(JSON.stringify(casePackage).includes(`"${"U" + "J"}"`)).toBe(false);
    expect(casePackage.curriculum_mappings.official_alignment_claimed).toBe(false);
    expect(casePackage.curriculum_mappings.objectives.every((entry) => entry.status === "UNKNOWN"))
      .toBe(true);
  });

  test("uses the exact authoritative initial state and projected baseline observations", async () => {
    const casePackage = await createStemiUnderReviewCase(PORTABLE_SHA256_ADAPTER);
    const state = casePackage.initial_state.patient_state;
    expect(state).toMatchObject({
      state_version: 0,
      clinical_time: 0,
      cardiac_rhythm: "rhythm.sinus-tachycardia",
      hemodynamic_state: "hemodynamics.stemi-baseline-hypotension",
      respiratory_state: "respiratory.stemi-baseline-tachypnea",
      oxygenation: "oxygenation.stemi-baseline-room-air",
      consciousness: "consciousness.gcs-15"
    });
    expect(state.pain_state.severity_0_10).toBe(8);
    const projected = projectObservations(
      { ...state, session_id: "session.stemi.initial-projection" },
      casePackage.initial_state.observation_projection
    );
    expect(projected.success).toBe(true);
    if (!projected.success) return;
    expect(projected.observations).toMatchObject({
      heart_rate_bpm: 112,
      systolic_bp_mm_hg: 88,
      diastolic_bp_mm_hg: 60,
      respiratory_rate_per_minute: 24,
      spo2_percent: 92,
      temperature_celsius: 36.7,
      rhythm: { cardiac_rhythm: "rhythm.sinus-tachycardia" }
    });
  });

  test("authors exact ECG, right-sided ECG, laboratory, CXR, and echo review data", async () => {
    const casePackage = await createStemiUnderReviewCase(PORTABLE_SHA256_ADAPTER);
    const ecg = findAction(casePackage, "investigation.ecg-standard").investigation!;
    const right = findAction(casePackage, "investigation.ecg-right-sided").investigation!;
    const troponin = findAction(casePackage, "investigation.hs-ctni").investigation!;
    const cxr = findAction(casePackage, "investigation.chest-xray").investigation!;
    const echo = findAction(casePackage, "investigation.focused-echo").investigation!;
    expect(ecg.milestones.find((entry) => entry.milestone_type === "RESULT_AVAILABLE")?.offset_clinical_seconds).toBe(120);
    expect(right.milestones.find((entry) => entry.milestone_type === "RESULT_AVAILABLE")?.offset_clinical_seconds).toBe(120);
    expect(troponin.milestones.find((entry) => entry.milestone_type === "RESULT_AVAILABLE")?.offset_clinical_seconds).toBe(600);
    expect(cxr.milestones.map((entry) => [entry.milestone_type, entry.offset_clinical_seconds])).toContainEqual(["FORMAL_REPORT_AVAILABLE", 480]);
    expect(echo.milestones.map((entry) => [entry.milestone_type, entry.offset_clinical_seconds])).toContainEqual(["FORMAL_REPORT_AVAILABLE", 360]);
    if (troponin.result.result_type !== "STRUCTURED_LAB") throw new Error("Troponin result discriminator changed.");
    expect(troponin.result.analytes[0]).toMatchObject({ value: 286, unit_code: "unit.ng-l", abnormal_flag: "HIGH", reference_interval: { upper_bound: 34 } });
    expect(["investigation.cbc", "investigation.chemistry", "investigation.coagulation"].map((id) =>
      findAction(casePackage, id).investigation!.milestones.find((entry) => entry.milestone_type === "RESULT_AVAILABLE")?.offset_clinical_seconds
    )).toEqual([480, 480, 480]);
    expect(ecg.milestones.every((entry) => entry.offset_clinical_seconds <= 120)).toBe(true);
    expect(cxr.milestones.find((entry) => entry.milestone_type === "IMAGE_AVAILABLE")?.offset_clinical_seconds).toBe(300);
    expect(echo.milestones.find((entry) => entry.milestone_type === "IMAGE_AVAILABLE")?.offset_clinical_seconds).toBe(240);
  });

  test("keeps every diagnostic asset and human governance decision pending", async () => {
    const casePackage = await createStemiUnderReviewCase(PORTABLE_SHA256_ADAPTER);
    const diagnosticAssets = casePackage.visual_manifest.media_assets.filter(
      (asset) => asset.diagnostic_governance !== undefined
    );
    expect(diagnosticAssets).toHaveLength(4);
    expect(diagnosticAssets.every((asset) =>
      asset.diagnostic_governance?.rights_status === "UNRESOLVED"
      && asset.diagnostic_governance.clinical_review_status === "UNRESOLVED"
      && asset.diagnostic_governance.content_hash === undefined
      && asset.diagnostic_governance.clinical_review_id === undefined
    )).toBe(true);
    expect(casePackage.validation.sources.every((source) => source.status === "UNRESOLVED"))
      .toBe(true);
    expect(casePackage.validation.reviewers.every((reviewer) => reviewer.status === "UNCONFIRMED"))
      .toBe(true);
  });

  test("passes generated reachability/liveness with every reachable observation state mapped", async () => {
    const casePackage = await createStemiUnderReviewCase(PORTABLE_SHA256_ADAPTER);
    const analysis = analyzeRuleReachability(casePackage);
    expect(analysis.result).toBe("PASSED");
    expect(analysis.unreachable_rules).toEqual([]);
    expect(analysis.projection_coverage_issues).toEqual([]);
    expect(analysis.scheduler_liveness_findings).toEqual([]);
    expect(casePackage.validation.deferred_checks[0]).toMatchObject({
      status: "PASSED",
      required_for_publication: true,
      validated_review_subject_hash: expect.stringMatching(/^[a-f0-9]{64}$/)
    });
  });

  test("executes nitrate harm at +1 Clinical minute without automatic arrest", async () => {
    const trace = await runStemiGoldenTrace("UNSAFE_RECOVERABLE");
    expect(trace.session.patient_state.hemodynamic_state).toBe("hemodynamics.stemi-nitrate-harm");
    expect(trace.session.patient_state.cardiac_rhythm).toBe("rhythm.sinus-tachycardia");
    expect(trace.session.patient_state.active_complications.map((item) => item.complication_id))
      .toContain("complication.stemi.nitrate-hypotension");
    const harm = trace.session.committed_events.find((event) => event.event_type === "CRITICAL_EVENT_OCCURRED");
    expect(harm?.clinical_time).toBe(60);
    expect(trace.session.patient_state.outcome_flags.some((flag) => flag.includes("arrest"))).toBe(false);
    expect(trace.assessment.unsafe).toBe(true);
    expect(trace.assessment.applied_critical_effects).toContainEqual({
      rubric_item_id: "rubric-item.stemi.critical-nitrate-deduction",
      effect_type: "DEDUCT_OVERALL_SCORE",
      penalty_basis_points: 1000
    });
    expect(trace.assessment.applied_critical_effects.some(
      (effect) => effect.effect_type === "ZERO_DOMAIN_SCORE"
    )).toBe(false);
    expect(trace.assessment.criterion_results.find(
      (criterion) => criterion.rubric_item_id
        === "rubric-item.stemi.management-nitrate-safe-hemodynamics-forfeiture"
    )).toMatchObject({
      status: "TRIGGERED",
      awarded_points: 0,
      deducted_points: 5,
      occurrence_count: 1
    });
    expect(trace.assessment.domain_scores.find(
      (domain) => domain.domain_id === "domain.management"
    )?.earned_points).toBe(0);
  });

  test("executes deterministic T=10 deterioration and T=18 shock without routine VT/VF", async () => {
    const delayed = await runStemiClinicalProbe("DELAY_TEN");
    const shock = await runStemiClinicalProbe("SHOCK_EIGHTEEN");
    expect(delayed.patient_state).toMatchObject({
      clinical_time: 600,
      hemodynamic_state: "hemodynamics.stemi-delay-ten",
      perfusion: "perfusion.worsened",
      cardiac_rhythm: "rhythm.sinus-tachycardia"
    });
    expect(shock.patient_state).toMatchObject({
      clinical_time: 1080,
      hemodynamic_state: "hemodynamics.stemi-shock",
      oxygenation: "oxygenation.stemi-shock-hypoxemia",
      consciousness: "consciousness.gcs-14",
      cardiac_rhythm: "rhythm.sinus-tachycardia"
    });
    expect(JSON.stringify([delayed, shock]).match(/ventricular-fibrillation|ventricular-tachycardia/g)).toBeNull();
  });

  test("makes oxygen state-dependent and the single fluid challenge bounded", async () => {
    const baselineOxygen = await runStemiClinicalProbe("BASELINE_OXYGEN");
    const shockOxygen = await runStemiClinicalProbe("SHOCK_OXYGEN");
    const fluid = await runStemiClinicalProbe("BOUNDED_FLUID");
    expect(baselineOxygen.patient_state.active_interventions).toEqual([]);
    expect(shockOxygen.patient_state.active_interventions.map((item) => item.intervention_id))
      .toContain("intervention.stemi.supplemental-oxygen");
    expect(fluid.patient_state).toMatchObject({
      hemodynamic_state: "hemodynamics.stemi-modestly-supported",
      perfusion: "perfusion.modestly-improved",
      respiratory_state: "respiratory.stemi-supported-clear-lungs"
    });
    expect(fluid.patient_state.outcome_flags.filter((flag) => flag === "outcome.fluid-challenge-completed"))
      .toHaveLength(1);
  });

  test("does not let antithrombotics or Cath activation normalize vitals or cure the patient", async () => {
    const antithrombotics = await runStemiClinicalProbe("ANTITHROMBOTICS");
    const cath = await runStemiClinicalProbe("CATH_NO_CURE");
    expect(antithrombotics.patient_state.hemodynamic_state).toBe("hemodynamics.stemi-baseline-hypotension");
    expect(cath.patient_state.hemodynamic_state).toBe("hemodynamics.stemi-baseline-hypotension");
    expect(cath.patient_state.outcome_flags).toContain("outcome.cath-pathway-activated");
    expect(cath.patient_state.outcome_flags).not.toContain("outcome.reperfused");
    const cathRule = cath.pinned_case.clinical_policy.rules.find((rule) => rule.rule_id === "rule.stemi.cath-pathway-marker")!;
    expect(JSON.stringify(cathRule).includes("investigation.ecg-right-sided")).toBe(false);
    expect(JSON.stringify(cathRule).includes("investigation.hs-ctni")).toBe(false);
    expect(JSON.stringify(cath.pinned_case.clinical_policy.rules)).not.toMatch(
      /heart_rate_bpm|systolic_bp_mm_hg|diastolic_bp_mm_hg|respiratory_rate_per_minute|spo2_percent/
    );
  });

  test("uses exactly six domains totaling 100 percent and once-only therapy credit", async () => {
    const casePackage = await createStemiUnderReviewCase(PORTABLE_SHA256_ADAPTER);
    expect(casePackage.assessment_rubric.domains).toHaveLength(6);
    expect(casePackage.assessment_rubric.domains.reduce((sum, domain) => sum + domain.weight_basis_points, 0)).toBe(10_000);
    const p2y12 = casePackage.assessment_rubric.domains.flatMap((domain) => domain.criteria)
      .find((item) => item.rubric_item_id === "rubric-item.stemi.management-p2y12")!;
    expect(p2y12.repeat_policy).toEqual({ mode: "ONCE" });
    expect(p2y12.evidence.action_ids).toEqual(["medication.ticagrelor-180", "medication.clopidogrel-600"]);
  });

  test("does not farm P2Y12 credit when both accepted alternatives are executed", async () => {
    const { session, assessment } = await runStemiTherapyAlternativeRepeatProbe();
    const criterion = assessment.criterion_results.find(
      (entry) => entry.rubric_item_id === "rubric-item.stemi.management-p2y12"
    );
    expect(session.committed_events.filter((event) =>
      event.action_id === "medication.ticagrelor-180"
      || event.action_id === "medication.clopidogrel-600"
    )).toHaveLength(2);
    expect(criterion).toMatchObject({
      status: "SATISFIED",
      awarded_points: 4,
      occurrence_count: 1,
      trace_codes: ["EVIDENCE_MATCHED", "REPEAT_LIMIT_APPLIED"]
    });
  });

  test("forfeits only safe-hemodynamics credit while preserving independent Management evidence", async () => {
    const { assessment } = await runStemiNitrateIndependentManagementProbe();
    const criterionById = (criterionId: string) => assessment.criterion_results.find(
      (criterion) => criterion.rubric_item_id === criterionId
    );
    for (const [criterionId, points] of [
      ["rubric-item.stemi.management-aspirin", 5],
      ["rubric-item.stemi.management-p2y12", 4],
      ["rubric-item.stemi.management-ufh", 4],
      ["rubric-item.stemi.management-statin", 2],
      ["rubric-item.stemi.management-monitor", 1],
      ["rubric-item.stemi.management-iv", 2]
    ] as const) {
      expect(criterionById(criterionId)).toMatchObject({
        status: "SATISFIED",
        awarded_points: points
      });
    }
    expect(criterionById("rubric-item.stemi.management-safe-hemodynamics"))
      .toMatchObject({ status: "SATISFIED", awarded_points: 5 });
    expect(criterionById(
      "rubric-item.stemi.management-nitrate-safe-hemodynamics-forfeiture"
    )).toMatchObject({ status: "TRIGGERED", deducted_points: 5 });
    expect(assessment.domain_scores.find(
      (domain) => domain.domain_id === "domain.management"
    )?.earned_points).toBe(18);
    expect(assessment.applied_critical_effects).toContainEqual({
      rubric_item_id: "rubric-item.stemi.critical-nitrate-unsafe",
      effect_type: "MARK_UNSAFE"
    });
    expect(assessment.applied_critical_effects).toContainEqual({
      rubric_item_id: "rubric-item.stemi.critical-nitrate-deduction",
      effect_type: "DEDUCT_OVERALL_SCORE",
      penalty_basis_points: 1000
    });
    expect(assessment.applied_critical_effects.some(
      (effect) => effect.effect_type === "ZERO_DOMAIN_SCORE"
    )).toBe(false);
  });

  test("keeps the remaining authored critical effects distinct and non-duplicative", async () => {
    const casePackage = await createStemiUnderReviewCase(PORTABLE_SHA256_ADAPTER);
    const critical = casePackage.assessment_rubric.critical_items;
    expect(critical.filter((item) => item.evidence.action_ids.some(
      (actionId) => actionId === "medication.nitroglycerin"
    )))
      .toHaveLength(2);
    expect(critical.find((item) => item.rubric_item_id === "rubric-item.stemi.critical-beta-deduction")?.effect)
      .toEqual({ effect_type: "DEDUCT_OVERALL_SCORE", penalty_basis_points: 800 });
    expect(critical.find((item) => item.rubric_item_id === "rubric-item.stemi.critical-no-cath")?.effect)
      .toEqual({ effect_type: "CAP_OVERALL_SCORE", cap_basis_points: 6000 });
    expect(critical.find((item) => item.rubric_item_id === "rubric-item.stemi.critical-wrong-disposition-cap")?.effect)
      .toEqual({ effect_type: "CAP_OVERALL_SCORE", cap_basis_points: 4000 });
    expect(critical.some((item) =>
      item.effect.effect_type === "MARK_UNSAFE"
      && item.evidence.action_ids.some(
        (actionId) => actionId === "procedure.supplemental-oxygen"
      )
    )).toBe(false);
    expect(casePackage.assessment_rubric.domains.flatMap((domain) => domain.criteria)
      .filter((item) => item.rubric_item_id
        === "rubric-item.stemi.management-nitrate-safe-hemodynamics-forfeiture"))
      .toHaveLength(1);
  });

  test("runs Excellent, Delayed, and Unsafe Recoverable through authoritative review evidence", async () => {
    const excellent = await runStemiGoldenTrace("EXCELLENT");
    const delayed = await runStemiGoldenTrace("DELAYED");
    const unsafe = await runStemiGoldenTrace("UNSAFE_RECOVERABLE");
    expect(excellent.assessment.overall_score_basis_points).toBeGreaterThan(
      delayed.assessment.overall_score_basis_points
    );
    expect(unsafe.assessment.unsafe).toBe(true);
    expect([excellent, delayed, unsafe].every((trace) =>
      trace.assessment.execution_authority === "REVIEW_ONLY"
      && trace.session.pinned_case.execution_authority === "REVIEW_ONLY"
      && trace.session.committed_events.every((event) => event.status === "COMMITTED")
    )).toBe(true);
    expect(delayed.session.patient_state.outcome_flags).toContain("outcome.delay-ten-applied");
    expect(delayed.session.patient_state.outcome_flags).toContain("outcome.transfer-initiated");
    expect(unsafe.session.patient_state.outcome_flags).toContain("outcome.transfer-initiated");
  }, 30_000);

  test("keeps Practice/Assessment scoring truth identical while withholding active Assessment answers", async () => {
    const trace = await runStemiGoldenTrace("UNSAFE_RECOVERABLE");
    const assessmentProjection = projectAssessmentDisclosure({
      assessment_result: trace.assessment,
      disclosure_context: {
        context_schema_version: "1.0",
        authority: "TRUSTED_ASSESSMENT_DISCLOSURE",
        assessment_id: trace.assessment.assessment_id,
        session_id: trace.assessment.session_id,
        session_mode: "ASSESSMENT",
        disclosure_phase: "ACTIVE"
      }
    });
    const practiceProjection = projectAssessmentDisclosure({
      assessment_result: trace.assessment,
      disclosure_context: {
        context_schema_version: "1.0",
        authority: "TRUSTED_ASSESSMENT_DISCLOSURE",
        assessment_id: trace.assessment.assessment_id,
        session_id: trace.assessment.session_id,
        session_mode: "PRACTICE_DEMO",
        disclosure_phase: "ACTIVE"
      }
    });
    expect(assessmentProjection.success && practiceProjection.success).toBe(true);
    if (!assessmentProjection.success || !practiceProjection.success) return;
    expect(assessmentProjection.projection.projection_type).toBe("ACTIVE_ASSESSMENT_WITHHELD");
    expect(JSON.stringify(assessmentProjection.projection)).not.toContain("score");
    expect(practiceProjection.projection.projection_type).toBe("ACTIVE_PRACTICE_FEEDBACK");
    expect(trace.assessment.overall_score_basis_points).toBe(3200);
  });

  test("repeats all review traces byte-for-byte deterministically", async () => {
    const first = await createStemiPortabilitySnapshot();
    const second = await createStemiPortabilitySnapshot();
    expect(second).toBe(first);
    expect(await PORTABLE_SHA256_ADAPTER.sha256(first)).toBe(
      STEMI_PORTABILITY_SNAPSHOT_SHA256
    );
  }, 30_000);
});
