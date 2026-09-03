import { describe, expect, test } from "vitest";

import { projectObservations } from "../../../packages/clinical-engine/src/index.ts";
import {
  createStemiUnderReviewCase
} from "../../../content/cases/stemi/v2-draft/stemi-case.ts";
import { PORTABLE_SHA256_ADAPTER } from "../../fixtures/portable-sha256.ts";
import {
  prepareStemiReviewArtifact,
  runStemiGoldenTrace,
  STEMI_PORTABILITY_SNAPSHOT_SHA256
} from "../../fixtures/cases/stemi-review.ts";

const EXPECTED_REVIEW_SUBJECT_HASH =
  "46388c32e3ef74db413228adf837e90e828913a7db996a3ba57d181a2cbab11f";
const EXPECTED_REVIEW_EXECUTION_HASH =
  "a8e76e5cd96c8b29461968796d295674f8de1ab3630a55a5568a25664c2b7ab7";

function actionIdsByType(
  casePackage: Awaited<ReturnType<typeof createStemiUnderReviewCase>>,
  actionType: string
): string[] {
  return casePackage.action_catalogue.actions
    .filter((action) => action.action_type === actionType)
    .map((action) => action.action_id)
    .sort();
}

describe("V2-010 Acute Inferior STEMI functional parity", () => {
  test("preserves structured bilingual presentation, history, and examination truth", async () => {
    const casePackage = await createStemiUnderReviewCase(PORTABLE_SHA256_ADAPTER);
    expect(casePackage.patient_profile.extensions?.["stemi.patient-demographics"]).toMatchObject({
      age_years: 58,
      sex: "male",
      occupation: "taxi-driver"
    });
    expect(casePackage.presentation).toMatchObject({
      chief_complaint_fact_id: "fact.stemi.chief-complaint",
      arrival_context_code: "arrival.ed-resuscitation"
    });
    for (const factId of [
      "fact.stemi.chief-complaint",
      "fact.stemi.symptom-onset",
      "fact.stemi.past-medical-history",
      "fact.stemi.home-medications",
      "fact.stemi.contraindications",
      "fact.stemi.social-risk",
      "fact.stemi.family-history"
    ]) {
      expect(casePackage.clinical_facts.facts.find(
        (fact) => fact.fact_id === factId
      )?.disclosure_mode).toBe("on_direct_question");
    }
    for (const factId of [
      "fact.stemi.general-appearance",
      "fact.stemi.cardiac-exam",
      "fact.stemi.jvp-exam",
      "fact.stemi.perfusion-exam",
      "fact.stemi.respiratory-exam",
      "fact.stemi.other-exam"
    ]) {
      expect(casePackage.clinical_facts.facts.find(
        (fact) => fact.fact_id === factId
      )?.disclosure_mode).toBe("after_exam");
    }
    const localizedFact = casePackage.localization.entries.find(
      (entry) => entry.key === "fact.stemi.chief-complaint"
    );
    expect(localizedFact?.translations.map((translation) => translation.locale).sort())
      .toEqual(["ar-JO", "en-US"]);
  });

  test("keeps future free-text dialogue grounded in Case facts and non-authoritative", async () => {
    const casePackage = await createStemiUnderReviewCase(PORTABLE_SHA256_ADAPTER);
    const policy = casePackage.dialogue_policy;
    expect(policy.question_concept_codes).toEqual(expect.arrayContaining([
      "question.chest-pain",
      "question.onset",
      "question.past-medical-history",
      "question.home-medications",
      "question.allergies",
      "question.bleeding",
      "question.pde5"
    ]));
    expect(policy.disclosable_fact_ids).toContain("fact.stemi.contraindications");
    expect(policy.forbidden_fact_ids).toContain("fact.stemi.hidden-diagnosis");
    expect(casePackage.instructor_notes.patient_ai_access).toBe("FORBIDDEN");
    expect(JSON.stringify(policy)).not.toMatch(/execute|state_write|clinical_effect/i);
  });

  test("represents all nine diagnostics as independent asynchronous Case-owned actions", async () => {
    const casePackage = await createStemiUnderReviewCase(PORTABLE_SHA256_ADAPTER);
    const investigations = casePackage.action_catalogue.actions.filter(
      (action) => action.action_type === "INVESTIGATION"
    );
    expect(investigations.map((action) => action.action_id).sort()).toEqual([
      "investigation.cbc",
      "investigation.chemistry",
      "investigation.chest-xray",
      "investigation.coagulation",
      "investigation.ecg-right-sided",
      "investigation.ecg-standard",
      "investigation.focused-echo",
      "investigation.hs-ctni",
      "investigation.poc-glucose"
    ]);
    expect(investigations.every(
      (action) => action.investigation?.execution_mode === "ASYNC_PARALLEL"
    )).toBe(true);
    expect(investigations.every(
      (action) => action.investigation?.milestones[0]?.milestone_type === "ORDERED"
        && action.investigation.milestones[0].offset_clinical_seconds === 0
    )).toBe(true);
    expect(investigations.every(
      (action) => action.investigation?.result.finding_fact_ids.length === 1
    )).toBe(true);
    expect(new Set(investigations.map(
      (action) => action.investigation?.result.diagnostic_result_id
    )).size).toBe(9);
  });

  test("pins the reconciled action, diagnosis, and disposition catalogue without V1 action sidecars", async () => {
    const casePackage = await createStemiUnderReviewCase(PORTABLE_SHA256_ADAPTER);
    expect(actionIdsByType(casePackage, "MEDICATION")).toEqual([
      "medication.aspirin-324-chewed",
      "medication.atorvastatin-80",
      "medication.clopidogrel-600",
      "medication.iv-beta-blocker",
      "medication.nitroglycerin",
      "medication.norepinephrine-rescue",
      "medication.ticagrelor-180",
      "medication.ufh-70-units-kg"
    ]);
    expect(actionIdsByType(casePackage, "DIAGNOSIS")).toEqual([
      "diagnosis.inferior-stemi",
      "diagnosis.oxygen-not-indicated-baseline",
      "diagnosis.rv-involvement"
    ]);
    expect(actionIdsByType(casePackage, "DISPOSITION")).toEqual([
      "disposition.discharge-home",
      "disposition.transfer-cath-lab",
      "disposition.ward-admission"
    ]);
    expect(actionIdsByType(casePackage, "CONSULT")).toEqual([
      "consult.activate-cath-lab"
    ]);
  });

  test("keeps Patient State authoritative and rhythm explicit without direct vital mutation rules", async () => {
    const casePackage = await createStemiUnderReviewCase(PORTABLE_SHA256_ADAPTER);
    const state = casePackage.initial_state.patient_state;
    const projected = projectObservations(
      { ...state, session_id: "session.stemi.v2-010-parity" },
      casePackage.initial_state.observation_projection
    );
    expect(projected.success).toBe(true);
    if (!projected.success) return;
    expect(projected.observations.rhythm.cardiac_rhythm).toBe(state.cardiac_rhythm);
    expect(JSON.stringify(casePackage.rules.rules)).not.toMatch(
      /heart_rate_bpm|systolic_bp_mm_hg|diastolic_bp_mm_hg|respiratory_rate_per_minute|spo2_percent/
    );
    expect(casePackage.rules.rules.some((rule) =>
      rule.effects.some((effect) => effect.effect_type === "SET_STATE")
    )).toBe(true);
  });

  test("executes the end-to-end review journey through committed evidence and six-domain scoring", async () => {
    const excellent = await runStemiGoldenTrace("EXCELLENT");
    const unsafe = await runStemiGoldenTrace("UNSAFE_RECOVERABLE");
    const executedActionIds = excellent.session.committed_events
      .filter((event) => event.status === "COMMITTED")
      .map((event) => event.action_id);

    expect(executedActionIds).toEqual(expect.arrayContaining([
      "investigation.ecg-standard",
      "investigation.ecg-right-sided",
      "medication.aspirin-324-chewed",
      "medication.ticagrelor-180",
      "medication.ufh-70-units-kg",
      "diagnosis.inferior-stemi",
      "consult.activate-cath-lab",
      "disposition.transfer-cath-lab"
    ]));
    expect(excellent.session.patient_state.outcome_flags).toEqual(expect.arrayContaining([
      "outcome.cath-pathway-activated",
      "outcome.transfer-initiated"
    ]));
    expect(excellent.assessment.domain_scores).toHaveLength(6);
    expect(excellent.assessment.evidence_records.every(
      (evidence) => evidence.evidence_kind === "REQUIRED_EVIDENCE_ABSENT"
        || excellent.session.committed_events.some((event) => event.event_id === evidence.event_id)
    )).toBe(true);
    expect(unsafe.assessment.unsafe).toBe(true);
    expect(unsafe.assessment.criterion_results.some(
      (criterion) => criterion.status === "TRIGGERED"
    )).toBe(true);
  }, 30_000);

  test("keeps structured diagnostic and visual fallback truth usable without media generation", async () => {
    const casePackage = await createStemiUnderReviewCase(PORTABLE_SHA256_ADAPTER);
    expect(casePackage.visual_manifest.required_static_fallback_asset_id)
      .toBe("asset.stemi.static-fallback-pending");
    expect(casePackage.visual_manifest.recipes.every(
      (recipe) => recipe.fallback_asset_id === "asset.stemi.static-fallback-pending"
    )).toBe(true);
    const imageDiagnostics = casePackage.action_catalogue.actions.filter(
      (action) => action.action_type === "INVESTIGATION"
        && action.investigation?.result.result_type !== "STRUCTURED_LAB"
    );
    expect(imageDiagnostics.every((action) => {
      const result = action.investigation?.result;
      return result !== undefined
        && "fallback_fact_ids" in result
        && result.fallback_fact_ids.length > 0;
    })).toBe(true);
    expect(JSON.stringify(casePackage.visual_manifest)).not.toMatch(
      /video_generation|text_to_video|provider_sdk|generated_media/i
    );
  });

  test("preserves the exact reviewed hashes and review-only lifecycle", async () => {
    const artifact = await prepareStemiReviewArtifact();
    expect(artifact.source_case.manifest.status).toBe("UNDER_REVIEW");
    expect(artifact.execution_authority).toBe("REVIEW_ONLY");
    expect(artifact.review_subject_hash).toBe(EXPECTED_REVIEW_SUBJECT_HASH);
    expect(artifact.review_execution_hash).toBe(EXPECTED_REVIEW_EXECUTION_HASH);
    expect(STEMI_PORTABILITY_SNAPSHOT_SHA256)
      .toBe("14fcf7de8a969fba49eb3d0d96db783f1c77e1fb2a89594c81f453495ace9a58");
  });
});
