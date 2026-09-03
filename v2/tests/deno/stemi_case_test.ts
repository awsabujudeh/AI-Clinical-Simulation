import {
  createStemiPortabilitySnapshot,
  prepareStemiReviewArtifact,
  runStemiClinicalProbe,
  runStemiGoldenTrace,
  STEMI_PORTABILITY_SNAPSHOT_SHA256
} from "../fixtures/cases/stemi-review.ts";
import { PORTABLE_SHA256_ADAPTER } from "../fixtures/portable-sha256.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("V2-009 Deno prepares the exact REVIEW_ONLY STEMI artifact", async () => {
  const artifact = await prepareStemiReviewArtifact();
  assert(artifact.execution_authority === "REVIEW_ONLY", "Expected review authority.");
  assert(artifact.source_case.manifest.status === "UNDER_REVIEW", "Expected source review lifecycle.");
  assert(Object.keys(artifact.module_hashes).length === 16, "Expected all 16 module hashes.");
  assert(artifact.source_case.validation.reviews.length === 0, "Clinical approval must remain absent.");
});

Deno.test("V2-009 Deno executes the three authoritative golden traces", async () => {
  const excellent = await runStemiGoldenTrace("EXCELLENT");
  const delayed = await runStemiGoldenTrace("DELAYED");
  const unsafe = await runStemiGoldenTrace("UNSAFE_RECOVERABLE");
  assert(excellent.assessment.overall_score_basis_points === 10_000, "Excellent score changed.");
  assert(delayed.assessment.overall_score_basis_points === 2_800, "Delayed score changed.");
  assert(unsafe.assessment.overall_score_basis_points === 3_200, "Unsafe score changed.");
  assert(unsafe.assessment.unsafe, "Unsafe trace must remain MARK_UNSAFE.");
  assert(delayed.session.patient_state.outcome_flags.some(
    (flag) => flag === "outcome.delay-ten-applied"
  ), "Delay transition did not execute.");
});

Deno.test("V2-009 Deno executes T=18 shock without inferred malignant rhythm", async () => {
  const shock = await runStemiClinicalProbe("SHOCK_EIGHTEEN");
  assert(shock.patient_state.hemodynamic_state === "hemodynamics.stemi-shock", "Shock state missing.");
  assert(shock.patient_state.cardiac_rhythm === "rhythm.sinus-tachycardia", "Rhythm authority changed.");
  assert(shock.patient_state.oxygenation === "oxygenation.stemi-shock-hypoxemia", "Shock oxygenation missing.");
});

Deno.test("V2-009 Browser/Deno canonical review snapshot has one exact SHA-256", async () => {
  const snapshot = await createStemiPortabilitySnapshot();
  const digest = await PORTABLE_SHA256_ADAPTER.sha256(snapshot);
  assert(digest === STEMI_PORTABILITY_SNAPSHOT_SHA256, `Unexpected STEMI snapshot hash: ${digest}`);
});
