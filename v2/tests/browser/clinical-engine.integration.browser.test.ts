import { expect, test } from "vitest";

import {
  initializePatientState,
  projectObservations
} from "../../packages/clinical-engine/src/index.ts";
import { preparePublicationCandidate } from "../../packages/case-schema/src/index.ts";
import {
  TEST_HASH_ADAPTER,
  createCandidateReadyUnderReviewCase
} from "../fixtures/cases/synthetic-case.ts";
import { SYNTHETIC_SESSION_ID } from "../fixtures/clinical-engine/synthetic-state.ts";

test("projects observations only from the pinned Case Package initial_state policy", async () => {
  const source = await createCandidateReadyUnderReviewCase();
  const prepared = await preparePublicationCandidate(source, TEST_HASH_ADAPTER);

  expect(prepared.success).toBe(true);
  if (!prepared.success) return;

  const pinnedCase = prepared.candidate.package;
  const inlineProjection = pinnedCase.initial_state.observation_projection;
  expect(inlineProjection).toBeDefined();
  if (inlineProjection === undefined) return;

  const initialized = initializePatientState(
    pinnedCase.initial_state.patient_state,
    SYNTHETIC_SESSION_ID
  );
  expect(initialized.success).toBe(true);
  if (!initialized.success) return;

  const projected = projectObservations(initialized.state, inlineProjection);
  expect(projected.success).toBe(true);
  if (!projected.success) return;

  expect(projected.observations).toMatchObject({
    projection_definition_id: "projection.synthetic-case-v1",
    heart_rate_bpm: 70,
    systolic_bp_mm_hg: 110,
    diastolic_bp_mm_hg: 70,
    respiratory_rate_per_minute: 15,
    spo2_percent: 97,
    rhythm: {
      cardiac_rhythm: "rhythm.neutral",
      waveform_descriptor: "waveform.synthetic-neutral"
    }
  });
});
