import { describe, expect, test } from "vitest";

import {
  initializePatientState,
  validateAuthoritativePatientState
} from "../../packages/clinical-engine/src/index.ts";
import { MINIMAL_DRAFT_CASE } from "../fixtures/cases/synthetic-case.ts";
import {
  BASELINE_PATIENT_STATE,
  STATE_WITH_ACTIVE_ITEMS,
  SYNTHETIC_SESSION_ID
} from "../fixtures/clinical-engine/synthetic-state.ts";

describe("authoritative Patient State foundation", () => {
  test("reuses and validates the shared Patient State contract", () => {
    const result = validateAuthoritativePatientState(BASELINE_PATIENT_STATE);

    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.state).toEqual(BASELINE_PATIENT_STATE);
  });

  test("rejects malformed Patient State", () => {
    const malformed = { ...BASELINE_PATIENT_STATE } as Record<string, unknown>;
    delete malformed.cardiac_rhythm;
    const result = validateAuthoritativePatientState(malformed);

    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues.map((issue) => issue.code)).toContain("INVALID_PATIENT_STATE");
  });

  test("rejects duplicate active structural identities", () => {
    const duplicateIntervention = STATE_WITH_ACTIVE_ITEMS.active_interventions[0]!;
    const duplicateComplication = STATE_WITH_ACTIVE_ITEMS.active_complications[0]!;
    const result = validateAuthoritativePatientState({
      ...STATE_WITH_ACTIVE_ITEMS,
      active_interventions: [duplicateIntervention, duplicateIntervention],
      active_complications: [duplicateComplication, duplicateComplication]
    });

    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues.map((issue) => issue.code)).toEqual([
      "DUPLICATE_ACTIVE_COMPLICATION_ID",
      "DUPLICATE_ACTIVE_INTERVENTION_ID"
    ]);
  });

  test("rejects duplicate intervention identity independently", () => {
    const intervention = STATE_WITH_ACTIVE_ITEMS.active_interventions[0]!;
    const result = validateAuthoritativePatientState({
      ...STATE_WITH_ACTIVE_ITEMS,
      active_interventions: [intervention, { ...intervention, parameters: { changed: true } }]
    });

    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual([
      "DUPLICATE_ACTIVE_INTERVENTION_ID"
    ]);
  });

  test("rejects duplicate complication identity independently", () => {
    const complication = STATE_WITH_ACTIVE_ITEMS.active_complications[0]!;
    const result = validateAuthoritativePatientState({
      ...STATE_WITH_ACTIVE_ITEMS,
      active_complications: [complication, { ...complication, attributes: { changed: true } }]
    });

    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual([
      "DUPLICATE_ACTIVE_COMPLICATION_ID"
    ]);
  });

  test("accepts intervention, complication, and outcome presence without interpreting them", () => {
    const result = validateAuthoritativePatientState(STATE_WITH_ACTIVE_ITEMS);

    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.state.active_interventions).toHaveLength(1);
    expect(result.state.active_complications).toHaveLength(1);
    expect(result.state.outcome_flags).toEqual(["outcome.synthetic-marker"]);
  });

  test("initializes the V2-003 authored initial state by attaching only supplied session identity", () => {
    const authoredInitialState = MINIMAL_DRAFT_CASE.initial_state.patient_state;
    const authoredBefore = JSON.stringify(authoredInitialState);
    const initialized = initializePatientState(authoredInitialState, SYNTHETIC_SESSION_ID);

    expect("session_id" in authoredInitialState).toBe(false);
    expect(JSON.stringify(authoredInitialState)).toBe(authoredBefore);
    expect(initialized.success).toBe(true);
    if (!initialized.success) return;
    expect(initialized.state.session_id).toBe(SYNTHETIC_SESSION_ID);
    expect(initialized.state.state_version).toBe(0);
    expect(initialized.state.clinical_time).toBe(0);
    expect(initialized.state.cardiac_rhythm).toBe(authoredInitialState.cardiac_rhythm);
  });

  test("rejects invalid authored initial state and invalid SessionId deterministically", () => {
    const invalidInitialState = structuredClone(MINIMAL_DRAFT_CASE.initial_state.patient_state) as
      Record<string, unknown>;
    delete invalidInitialState.cardiac_rhythm;

    const invalidInitial = initializePatientState(invalidInitialState, SYNTHETIC_SESSION_ID);
    const invalidSession = initializePatientState(
      MINIMAL_DRAFT_CASE.initial_state.patient_state,
      "invalid session id"
    );
    const bothInvalid = initializePatientState(invalidInitialState, "invalid session id");

    expect(invalidInitial.success).toBe(false);
    expect(invalidSession.success).toBe(false);
    expect(bothInvalid.success).toBe(false);
    expect(bothInvalid.issues.map((issue) => issue.path)).toEqual([
      "$.initial_state.cardiac_rhythm",
      "$.session_id"
    ]);
  });

  test("repeats initialization exactly and deep-clones all nested authored state data", () => {
    const authoredWithSession = structuredClone(STATE_WITH_ACTIVE_ITEMS);
    const { session_id: _sessionId, ...authoredWithoutSession } = authoredWithSession;
    const authored = {
      ...authoredWithoutSession,
      state_version: 0,
      clinical_time: 0
    };
    const first = initializePatientState(authored, SYNTHETIC_SESSION_ID);
    const second = initializePatientState(authored, SYNTHETIC_SESSION_ID);

    expect(first).toEqual(second);
    expect(first.success).toBe(true);
    if (!first.success) return;

    expect(first.state).not.toBe(authored);
    expect(first.state.pain_state).not.toBe(authored.pain_state);
    expect(first.state.pain_state.location_codes).not.toBe(authored.pain_state.location_codes);
    expect(first.state.pain_state.quality_codes).not.toBe(authored.pain_state.quality_codes);
    expect(first.state.active_interventions).not.toBe(authored.active_interventions);
    expect(first.state.active_interventions[0]).not.toBe(authored.active_interventions[0]);
    expect(first.state.active_interventions[0]!.parameters).not.toBe(
      authored.active_interventions[0]!.parameters
    );
    expect(first.state.active_complications).not.toBe(authored.active_complications);
    expect(first.state.active_complications[0]).not.toBe(authored.active_complications[0]);
    expect(first.state.active_complications[0]!.attributes).not.toBe(
      authored.active_complications[0]!.attributes
    );
    expect(first.state.outcome_flags).not.toBe(authored.outcome_flags);

    first.state.pain_state.severity_0_10 = 4;
    expect(authored.pain_state.severity_0_10).toBe(0);
  });

  test("contains duplicate identities discovered after initial-state parsing", () => {
    const authoredWithSession = structuredClone(STATE_WITH_ACTIVE_ITEMS);
    const { session_id: _sessionId, ...authoredWithoutSession } = authoredWithSession;
    const authored = {
      ...authoredWithoutSession,
      state_version: 0,
      clinical_time: 0
    };
    authored.active_interventions.push(structuredClone(authored.active_interventions[0]!));

    const result = initializePatientState(authored, SYNTHETIC_SESSION_ID);
    expect(result.success).toBe(false);
    expect(result.issues.map((item) => item.code)).toEqual([
      "DUPLICATE_ACTIVE_INTERVENTION_ID"
    ]);
  });
});
