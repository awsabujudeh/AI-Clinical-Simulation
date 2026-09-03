import {
  createPinnedReviewAssessmentContext,
  evaluateReviewAssessment
} from "../../../packages/assessment-engine/src/index.ts";
import {
  createPinnedReviewClinicalPolicy,
  prepareReviewExecutionArtifact,
  type ReviewExecutionArtifact
} from "../../../packages/case-schema/src/index.ts";
import {
  InMemorySessionCommitAdapter,
  createPinnedReviewSessionCaseContext,
  createSessionCoordinator,
  initializeReviewInMemorySession,
  projectAssessmentEvidenceFromSession,
  type EventIdFactory,
  type InMemorySessionAggregate,
  type SessionCoordinator
} from "../../../packages/session-engine/src/index.ts";
import type { AssessmentResult } from "../../../packages/contracts/src/index.ts";
import {
  createStemiUnderReviewCase
} from "../../../content/cases/stemi/v2-draft/stemi-case.ts";
import { PORTABLE_SHA256_ADAPTER } from "../portable-sha256.ts";

export type StemiGoldenTraceName = "EXCELLENT" | "DELAYED" | "UNSAFE_RECOVERABLE";
export type StemiClinicalProbeName =
  | "BASELINE_OXYGEN"
  | "SHOCK_OXYGEN"
  | "DELAY_TEN"
  | "SHOCK_EIGHTEEN"
  | "BOUNDED_FLUID"
  | "ANTITHROMBOTICS"
  | "CATH_NO_CURE";

export const STEMI_PORTABILITY_SNAPSHOT_SHA256 =
  "14fcf7de8a969fba49eb3d0d96db783f1c77e1fb2a89594c81f453495ace9a58" as const;

export const STEMI_REVIEW_EVENT_ID_FACTORY: EventIdFactory = {
  createEventId(input) {
    return `00000000-0000-4000-8000-${String(input.sequence_no).padStart(12, "0")}`;
  }
};

function trustedTime(clinicalSeconds: number): string {
  const hour = 12 + Math.floor(clinicalSeconds / 3600);
  const remainder = clinicalSeconds % 3600;
  const minute = Math.floor(remainder / 60);
  const second = remainder % 60;
  return `2026-09-03T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}Z`;
}

function expectSuccess<T extends { success: boolean }>(value: T): Extract<T, { success: true }> {
  if (!value.success) throw new Error(JSON.stringify(value));
  return value as Extract<T, { success: true }>;
}

export async function prepareStemiReviewArtifact(): Promise<ReviewExecutionArtifact> {
  const source = await createStemiUnderReviewCase(PORTABLE_SHA256_ADAPTER);
  const prepared = await prepareReviewExecutionArtifact(source, PORTABLE_SHA256_ADAPTER);
  if (!prepared.success) throw new Error(JSON.stringify(prepared.report));
  return prepared.artifact;
}

type TraceHarness = {
  artifact: ReviewExecutionArtifact;
  adapter: InMemorySessionCommitAdapter;
  coordinator: SessionCoordinator;
  sessionId: string;
  commandIndex: number;
};

async function createHarness(name: StemiGoldenTraceName): Promise<TraceHarness> {
  const artifact = await prepareStemiReviewArtifact();
  const sessionId = `session.stemi.${name.toLowerCase().replaceAll("_", "-")}`;
  const initialized = initializeReviewInMemorySession({
    session_id: sessionId,
    mode: "ASSESSMENT",
    review_execution_artifact: artifact,
    trusted_real_time_anchor_utc: trustedTime(0)
  });
  const session = expectSuccess(initialized).session;
  const adapter = new InMemorySessionCommitAdapter([session]);
  return {
    artifact,
    adapter,
    coordinator: createSessionCoordinator({
      adapter,
      hash_adapter: PORTABLE_SHA256_ADAPTER,
      event_id_factory: STEMI_REVIEW_EVENT_ID_FACTORY
    }),
    sessionId,
    commandIndex: 0
  };
}

async function load(harness: TraceHarness): Promise<InMemorySessionAggregate> {
  return expectSuccess(await harness.adapter.load(harness.sessionId)).session;
}

async function sync(harness: TraceHarness, clinicalSeconds: number): Promise<void> {
  const suffix = `sync-${clinicalSeconds}-${harness.commandIndex}`;
  const result = await harness.coordinator.syncRunningSession({
    coordinator_schema_version: "1.0",
    session_id: harness.sessionId,
    trusted_real_time_utc: trustedTime(clinicalSeconds),
    request_id: `request.stemi.${suffix}`,
    correlation_id: `correlation.stemi.${suffix}`,
    idempotency_key: `idempotency.stemi.${suffix}`
  });
  expectSuccess(result);
}

async function command(
  harness: TraceHarness,
  clinicalSeconds: number,
  actionId: string
): Promise<void> {
  await sync(harness, clinicalSeconds);
  const session = await load(harness);
  harness.commandIndex += 1;
  const suffix = `${harness.commandIndex}-${actionId.replaceAll(".", "-")}`;
  const commandInput = {
    command_schema_version: "1.0",
    request_id: `request.stemi.${suffix}`,
    correlation_id: `correlation.stemi.${suffix}`,
    learner_actor_id: "actor.stemi.review-learner",
    expected_case: {
      execution_authority: "REVIEW_ONLY",
      case_package_id: harness.artifact.source_identity.case_package_id,
      case_version_id: harness.artifact.source_identity.case_version_id,
      case_version: harness.artifact.source_identity.case_version,
      review_execution_hash: harness.artifact.review_execution_hash
    },
    action_request: {
      action_request_id: `action-request.stemi.${suffix}`,
      catalogue_membership: "UNVERIFIED",
      command_id: `command.stemi.${suffix}`,
      session_id: harness.sessionId,
      action_id: actionId,
      request_schema_version: "1.0",
      expected_state_version: session.patient_state.state_version,
      requested_at_clinical_time: session.patient_state.clinical_time,
      parameters: {},
      source: "UI",
      idempotency_key: `idempotency.stemi.${suffix}`
    }
  };
  const result = await harness.coordinator.submitExternalClinicalCommand({
    coordinator_schema_version: "1.0",
    session_id: harness.sessionId,
    trusted_real_time_utc: trustedTime(clinicalSeconds),
    request_id: `request.stemi.coordinator-${suffix}`,
    correlation_id: `correlation.stemi.coordinator-${suffix}`,
    idempotency_key: `idempotency.stemi.coordinator-${suffix}`,
    command: commandInput
  });
  expectSuccess(result);
}

async function assess(harness: TraceHarness): Promise<{ session: InMemorySessionAggregate; assessment: AssessmentResult }> {
  const session = await load(harness);
  const evidence = projectAssessmentEvidenceFromSession(session);
  const projected = expectSuccess(evidence);
  if (projected.evidence.execution_authority !== "REVIEW_ONLY") {
    throw new Error("Golden trace escaped review authority.");
  }
  const assessed = evaluateReviewAssessment({
    evaluation_schema_version: "1.0",
    execution_authority: "REVIEW_ONLY",
    evaluation_phase: "LIVE",
    assessment_id: `assessment.${harness.sessionId}`,
    review_execution_artifact: harness.artifact,
    session_evidence: projected.evidence
  });
  return { session, assessment: expectSuccess(assessed).result };
}

async function runExcellent(harness: TraceHarness) {
  for (const actionId of [
    "examination.focused-history",
    "examination.contraindication-review",
    "examination.risk-history",
    "examination.hemodynamic-perfusion",
    "examination.lungs-jvp",
    "examination.cardiac-neurologic",
    "procedure.cardiac-monitor",
    "procedure.peripheral-iv"
  ]) await command(harness, 0, actionId);
  await command(harness, 60, "investigation.ecg-standard");
  await sync(harness, 180);
  for (const actionId of [
    "diagnosis.inferior-stemi",
    "medication.aspirin-324-chewed",
    "consult.activate-cath-lab",
    "medication.ticagrelor-180",
    "medication.ufh-70-units-kg",
    "investigation.ecg-right-sided",
    "diagnosis.oxygen-not-indicated-baseline"
  ]) await command(harness, 180, actionId);
  await sync(harness, 300);
  for (const actionId of [
    "diagnosis.rv-involvement",
    "examination.hemodynamic-reassessment",
    "procedure.normal-saline-250",
    "medication.atorvastatin-80",
    "disposition.transfer-cath-lab"
  ]) await command(harness, 300, actionId);
  await sync(harness, 900);
}

async function runDelayed(harness: TraceHarness) {
  for (const actionId of [
    "investigation.cbc",
    "investigation.chemistry",
    "investigation.coagulation",
    "investigation.chest-xray"
  ]) await command(harness, 0, actionId);
  await command(harness, 180, "investigation.hs-ctni");
  await command(harness, 500, "investigation.ecg-standard");
  await sync(harness, 620);
  await command(harness, 620, "diagnosis.inferior-stemi");
  await sync(harness, 780);
  await command(harness, 780, "consult.activate-cath-lab");
  await command(harness, 780, "disposition.transfer-cath-lab");
  await sync(harness, 900);
}

async function runUnsafeRecoverable(harness: TraceHarness) {
  await command(harness, 0, "medication.nitroglycerin");
  await sync(harness, 60);
  await command(harness, 60, "examination.hemodynamic-reassessment");
  await command(harness, 60, "investigation.ecg-standard");
  await sync(harness, 180);
  await command(harness, 180, "diagnosis.inferior-stemi");
  await command(harness, 180, "consult.activate-cath-lab");
  await command(harness, 180, "disposition.transfer-cath-lab");
  await sync(harness, 300);
}

export async function runStemiGoldenTrace(name: StemiGoldenTraceName) {
  const harness = await createHarness(name);
  if (name === "EXCELLENT") await runExcellent(harness);
  else if (name === "DELAYED") await runDelayed(harness);
  else await runUnsafeRecoverable(harness);
  const result = await assess(harness);
  return { artifact: harness.artifact, ...result };
}

export async function runStemiTherapyAlternativeRepeatProbe() {
  const harness = await createHarness("EXCELLENT");
  await command(harness, 0, "medication.ticagrelor-180");
  await command(harness, 0, "medication.clopidogrel-600");
  return assess(harness);
}

export async function runStemiNitrateIndependentManagementProbe() {
  const harness = await createHarness("UNSAFE_RECOVERABLE");
  await command(harness, 0, "medication.nitroglycerin");
  await sync(harness, 60);
  for (const actionId of [
    "examination.hemodynamic-reassessment",
    "medication.aspirin-324-chewed",
    "medication.ticagrelor-180",
    "medication.ufh-70-units-kg",
    "medication.atorvastatin-80",
    "procedure.cardiac-monitor",
    "procedure.peripheral-iv"
  ]) await command(harness, 60, actionId);
  return assess(harness);
}

export async function runStemiClinicalProbe(name: StemiClinicalProbeName) {
  const harness = await createHarness("EXCELLENT");
  if (name === "BASELINE_OXYGEN") {
    await command(harness, 0, "procedure.supplemental-oxygen");
  } else if (name === "SHOCK_OXYGEN") {
    await sync(harness, 1080);
    await command(harness, 1080, "procedure.supplemental-oxygen");
  } else if (name === "DELAY_TEN") {
    await sync(harness, 600);
  } else if (name === "SHOCK_EIGHTEEN") {
    await sync(harness, 1080);
  } else if (name === "BOUNDED_FLUID") {
    await command(harness, 0, "consult.activate-cath-lab");
    await command(harness, 0, "procedure.normal-saline-250");
    await sync(harness, 600);
  } else if (name === "ANTITHROMBOTICS") {
    await command(harness, 0, "medication.aspirin-324-chewed");
    await command(harness, 0, "medication.ticagrelor-180");
    await command(harness, 0, "medication.ufh-70-units-kg");
  } else {
    await command(harness, 0, "consult.activate-cath-lab");
  }
  return load(harness);
}

export async function createStemiPortabilitySnapshot(): Promise<string> {
  const traces = await Promise.all([
    runStemiGoldenTrace("EXCELLENT"),
    runStemiGoldenTrace("DELAYED"),
    runStemiGoldenTrace("UNSAFE_RECOVERABLE")
  ]);
  return JSON.stringify(traces.map(({ artifact, session, assessment }) => ({
    review_execution_hash: artifact.review_execution_hash,
    review_subject_hash: artifact.review_subject_hash,
    module_hashes: artifact.module_hashes,
    clinical_time: session.patient_state.clinical_time,
    state_version: session.patient_state.state_version,
    hemodynamic_state: session.patient_state.hemodynamic_state,
    cardiac_rhythm: session.patient_state.cardiac_rhythm,
    event_count: session.committed_events.length,
    event_types: session.committed_events.map((event) => [
      event.sequence_no,
      event.clinical_time,
      event.event_type,
      event.action_id ?? null
    ]),
    score: assessment.overall_score_basis_points,
    unsafe: assessment.unsafe,
    critical_effects: assessment.applied_critical_effects
  })));
}
