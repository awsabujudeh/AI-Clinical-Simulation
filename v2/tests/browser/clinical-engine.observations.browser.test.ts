import { describe, expect, test } from "vitest";

import {
  projectObservations,
  projectRhythm
} from "../../packages/clinical-engine/src/index.ts";
import {
  ALTERED_HEMODYNAMIC_STATE,
  ALTERED_RESPIRATORY_STATE,
  BASELINE_PATIENT_STATE,
  CHANGED_CONSCIOUSNESS_STATE,
  EXPLICIT_ALTERNATIVE_RHYTHM_STATE,
  HIGH_RATE_PATIENT_STATE,
  LOW_PRESSURE_PATIENT_STATE,
  SYNTHETIC_OBSERVATION_DEFINITION
} from "../fixtures/clinical-engine/synthetic-state.ts";

function issueCodes(result: ReturnType<typeof projectObservations>): string[] {
  return result.issues.map((issue) => issue.code);
}

function expectProjectionFailureWithoutObservations(
  result: ReturnType<typeof projectObservations>
): void {
  expect(result.success).toBe(false);
  expect("observations" in result).toBe(false);
}

describe("deterministic observation projection", () => {
  test("produces identical output for the same state and definition", () => {
    const first = projectObservations(BASELINE_PATIENT_STATE, SYNTHETIC_OBSERVATION_DEFINITION);
    const second = projectObservations(BASELINE_PATIENT_STATE, SYNTHETIC_OBSERVATION_DEFINITION);

    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });

  test("projects only the configured values for altered state dimensions", () => {
    const baseline = projectObservations(BASELINE_PATIENT_STATE, SYNTHETIC_OBSERVATION_DEFINITION);
    const hemodynamic = projectObservations(
      ALTERED_HEMODYNAMIC_STATE,
      SYNTHETIC_OBSERVATION_DEFINITION
    );
    const respiratory = projectObservations(
      ALTERED_RESPIRATORY_STATE,
      SYNTHETIC_OBSERVATION_DEFINITION
    );
    const consciousness = projectObservations(
      CHANGED_CONSCIOUSNESS_STATE,
      SYNTHETIC_OBSERVATION_DEFINITION
    );

    expect(baseline.success && baseline.observations.heart_rate_bpm).toBe(72);
    expect(hemodynamic.success && hemodynamic.observations.heart_rate_bpm).toBe(88);
    expect(hemodynamic.success && hemodynamic.observations.systolic_bp_mm_hg).toBe(104);
    expect(respiratory.success && respiratory.observations.respiratory_rate_per_minute).toBe(24);
    expect(respiratory.success && respiratory.observations.spo2_percent).toBe(91);
    expect(consciousness.success && consciousness.observations.consciousness_display_code).toBe(
      "display.consciousness-changed"
    );
  });

  test("reports a missing case-controlled mapping explicitly", () => {
    const definition = structuredClone(SYNTHETIC_OBSERVATION_DEFINITION);
    delete definition.oxygenation_mappings[BASELINE_PATIENT_STATE.oxygenation];
    const result = projectObservations(BASELINE_PATIENT_STATE, definition);

    expect(result.success).toBe(false);
    expect(issueCodes(result)).toContain("MISSING_OXYGENATION_PROJECTION");
  });

  test.each([
    ["hemodynamic_mappings", "hemodynamic_state", "MISSING_HEMODYNAMIC_PROJECTION"],
    ["respiratory_mappings", "respiratory_state", "MISSING_RESPIRATORY_PROJECTION"],
    ["oxygenation_mappings", "oxygenation", "MISSING_OXYGENATION_PROJECTION"],
    ["consciousness_mappings", "consciousness", "MISSING_CONSCIOUSNESS_PROJECTION"]
  ] as const)("fails when %s lacks the current %s", (mappingName, stateName, expectedCode) => {
    const definition = structuredClone(SYNTHETIC_OBSERVATION_DEFINITION);
    const stateValue = BASELINE_PATIENT_STATE[stateName];
    delete definition[mappingName][stateValue];
    const result = projectObservations(BASELINE_PATIENT_STATE, definition);

    expectProjectionFailureWithoutObservations(result);
    expect(issueCodes(result)).toContain(expectedCode);
  });

  test("rejects malformed Patient State and definition together with deterministic issues", () => {
    const malformedState = structuredClone(BASELINE_PATIENT_STATE) as Record<string, unknown>;
    delete malformedState.cardiac_rhythm;
    const malformedDefinition = {
      ...structuredClone(SYNTHETIC_OBSERVATION_DEFINITION),
      unsupported_field: true
    };
    const first = projectObservations(malformedState, malformedDefinition);
    const second = projectObservations(malformedState, malformedDefinition);

    expectProjectionFailureWithoutObservations(first);
    expect(issueCodes(first)).toEqual([
      "INVALID_PROJECTION_DEFINITION",
      "INVALID_PATIENT_STATE"
    ]);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });

  test("contains standalone malformed state and top-level definition failures in Result values", () => {
    const malformedState = structuredClone(BASELINE_PATIENT_STATE) as Record<string, unknown>;
    delete malformedState.cardiac_rhythm;
    const invalidStateResult = projectObservations(
      malformedState,
      SYNTHETIC_OBSERVATION_DEFINITION
    );
    const invalidDefinitionResult = projectObservations(BASELINE_PATIENT_STATE, {
      ...SYNTHETIC_OBSERVATION_DEFINITION,
      unsupported_field: true
    });

    expectProjectionFailureWithoutObservations(invalidStateResult);
    expect(issueCodes(invalidStateResult)).toEqual(["INVALID_PATIENT_STATE"]);
    expectProjectionFailureWithoutObservations(invalidDefinitionResult);
    expect(issueCodes(invalidDefinitionResult)).toEqual(["INVALID_PROJECTION_DEFINITION"]);
  });

  test("rejects unsupported projection versions at runtime", () => {
    for (const projectionSchemaVersion of ["999.0", "2.0", "1.0.0", "invalid"]) {
      const result = projectObservations(BASELINE_PATIENT_STATE, {
        ...SYNTHETIC_OBSERVATION_DEFINITION,
        projection_schema_version: projectionSchemaVersion
      });
      expectProjectionFailureWithoutObservations(result);
      expect(issueCodes(result)).toContain("INVALID_PROJECTION_DEFINITION");
    }
  });

  test("treats constructor as a missing own mapping instead of Object.prototype data", () => {
    const result = projectObservations({
      ...BASELINE_PATIENT_STATE,
      hemodynamic_state: "constructor"
    }, SYNTHETIC_OBSERVATION_DEFINITION);

    expectProjectionFailureWithoutObservations(result);
    expect(issueCodes(result)).toEqual(["MISSING_HEMODYNAMIC_PROJECTION"]);
  });

  test("orders multiple missing mappings deterministically", () => {
    const state = {
      ...BASELINE_PATIENT_STATE,
      hemodynamic_state: "constructor",
      respiratory_state: "constructor",
      oxygenation: "constructor",
      temperature_state: "constructor",
      consciousness: "constructor",
      cardiac_rhythm: "constructor"
    };
    const first = projectObservations(state, SYNTHETIC_OBSERVATION_DEFINITION);
    const second = projectObservations(state, SYNTHETIC_OBSERVATION_DEFINITION);

    expectProjectionFailureWithoutObservations(first);
    expect(issueCodes(first)).toEqual([
      "MISSING_CONSCIOUSNESS_PROJECTION",
      "MISSING_HEMODYNAMIC_PROJECTION",
      "MISSING_OXYGENATION_PROJECTION",
      "MISSING_RESPIRATORY_PROJECTION",
      "MISSING_RHYTHM_PROJECTION",
      "MISSING_TEMPERATURE_PROJECTION"
    ]);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });

  test("uses explicit cardiac rhythm as the sole rhythm descriptor input", () => {
    const baseline = projectObservations(BASELINE_PATIENT_STATE, SYNTHETIC_OBSERVATION_DEFINITION);
    const alternative = projectObservations(
      EXPLICIT_ALTERNATIVE_RHYTHM_STATE,
      SYNTHETIC_OBSERVATION_DEFINITION
    );

    expect(baseline.success && baseline.observations.rhythm).toEqual({
      cardiac_rhythm: "rhythm.synthetic-regular",
      display_code: "display.rhythm-regular",
      waveform_descriptor: "waveform.synthetic-regular"
    });
    expect(alternative.success && alternative.observations.rhythm).toEqual({
      cardiac_rhythm: "rhythm.synthetic-alternative",
      display_code: "display.rhythm-alternative",
      waveform_descriptor: "waveform.synthetic-alternative"
    });
  });

  test("does not infer VT from a high configured heart rate", () => {
    const result = projectObservations(HIGH_RATE_PATIENT_STATE, SYNTHETIC_OBSERVATION_DEFINITION);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.observations.heart_rate_bpm).toBe(190);
    expect(result.observations.rhythm.cardiac_rhythm).toBe("rhythm.synthetic-regular");
    expect(result.observations.rhythm.waveform_descriptor).toBe("waveform.synthetic-regular");
  });

  test("does not change rhythm because blood pressure projection is low", () => {
    const result = projectObservations(LOW_PRESSURE_PATIENT_STATE, SYNTHETIC_OBSERVATION_DEFINITION);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.observations.systolic_bp_mm_hg).toBe(76);
    expect(result.observations.rhythm.cardiac_rhythm).toBe("rhythm.synthetic-regular");
  });

  test("changing displayed heart rate configuration does not mutate or reinterpret rhythm", () => {
    const stateBefore = JSON.stringify(BASELINE_PATIENT_STATE);
    const definition = structuredClone(SYNTHETIC_OBSERVATION_DEFINITION);
    definition.hemodynamic_mappings[BASELINE_PATIENT_STATE.hemodynamic_state]!.heart_rate_bpm = 240;
    const result = projectObservations(BASELINE_PATIENT_STATE, definition);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.observations.heart_rate_bpm).toBe(240);
    expect(result.observations.rhythm.cardiac_rhythm).toBe(BASELINE_PATIENT_STATE.cardiac_rhythm);
    expect(result.observations.rhythm.waveform_descriptor).toBe("waveform.synthetic-regular");
    expect(JSON.stringify(BASELINE_PATIENT_STATE)).toBe(stateBefore);
  });

  test("handles optional temperature mappings without a hidden default", () => {
    const withoutTemperature = structuredClone(SYNTHETIC_OBSERVATION_DEFINITION);
    delete withoutTemperature.temperature_mappings;
    const omitted = projectObservations(BASELINE_PATIENT_STATE, withoutTemperature);
    const resolved = projectObservations(
      BASELINE_PATIENT_STATE,
      SYNTHETIC_OBSERVATION_DEFINITION
    );
    const missingDefinition = structuredClone(SYNTHETIC_OBSERVATION_DEFINITION);
    delete missingDefinition.temperature_mappings![BASELINE_PATIENT_STATE.temperature_state];
    const missing = projectObservations(BASELINE_PATIENT_STATE, missingDefinition);

    expect(omitted.success).toBe(true);
    expect(resolved.success).toBe(true);
    if (omitted.success) expect("temperature_celsius" in omitted.observations).toBe(false);
    if (resolved.success) expect(resolved.observations.temperature_celsius).toBe(36.8);
    expectProjectionFailureWithoutObservations(missing);
    expect(issueCodes(missing)).toEqual(["MISSING_TEMPERATURE_PROJECTION"]);
  });
});

describe("generic observation numeric safety", () => {
  test("rejects invalid SpO2 percentage", () => {
    const definition = structuredClone(SYNTHETIC_OBSERVATION_DEFINITION);
    definition.oxygenation_mappings[BASELINE_PATIENT_STATE.oxygenation]!.spo2_percent = 101;
    const result = projectObservations(BASELINE_PATIENT_STATE, definition);

    expectProjectionFailureWithoutObservations(result);
    expect(issueCodes(result)).toContain("INVALID_PROJECTION_DEFINITION");
  });

  test("rejects blood pressure where systolic is not greater than diastolic", () => {
    const definition = structuredClone(SYNTHETIC_OBSERVATION_DEFINITION);
    const hemodynamic = definition.hemodynamic_mappings[
      BASELINE_PATIENT_STATE.hemodynamic_state
    ]!;
    hemodynamic.systolic_bp_mm_hg = 50;
    hemodynamic.diastolic_bp_mm_hg = 60;
    const result = projectObservations(BASELINE_PATIENT_STATE, definition);

    expect(result.success).toBe(false);
    expect(issueCodes(result)).toContain("INVALID_PROJECTION_DEFINITION");
  });

  test("rejects non-finite observation values", () => {
    const definition = structuredClone(SYNTHETIC_OBSERVATION_DEFINITION);
    definition.hemodynamic_mappings[
      BASELINE_PATIENT_STATE.hemodynamic_state
    ]!.heart_rate_bpm = Number.POSITIVE_INFINITY;
    const result = projectObservations(BASELINE_PATIENT_STATE, definition);

    expect(result.success).toBe(false);
    expect(issueCodes(result)).toContain("INVALID_PROJECTION_DEFINITION");
  });
});

describe("explicit rhythm projection failures", () => {
  test("returns Result failures for invalid rhythm code and invalid mapping data", () => {
    const invalidRhythm = projectRhythm("Invalid Rhythm", SYNTHETIC_OBSERVATION_DEFINITION.rhythm_mappings);
    const invalidMappings = projectRhythm("rhythm.synthetic-regular", {
      "rhythm.synthetic-regular": {
        display_code: "Invalid Display",
        waveform_descriptor: "waveform.synthetic-regular"
      }
    });

    expect(invalidRhythm.success).toBe(false);
    expect(invalidRhythm.issues.map((issue) => issue.code)).toEqual(["INVALID_PATIENT_STATE"]);
    expect(invalidMappings.success).toBe(false);
    expect(invalidMappings.issues.map((issue) => issue.code)).toEqual([
      "INVALID_PROJECTION_DEFINITION"
    ]);
  });

  test("orders simultaneous invalid rhythm and mapping issues deterministically", () => {
    const first = projectRhythm("Invalid Rhythm", { invalid: true });
    const second = projectRhythm("Invalid Rhythm", { invalid: true });

    expect(first.success).toBe(false);
    expect(first.issues.map((issue) => issue.code)).toEqual([
      "INVALID_PROJECTION_DEFINITION",
      "INVALID_PATIENT_STATE"
    ]);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });

  test("returns missing-mapping Result failures, including constructor", () => {
    for (const rhythm of ["rhythm.synthetic-unmapped", "constructor"]) {
      const result = projectRhythm(rhythm, SYNTHETIC_OBSERVATION_DEFINITION.rhythm_mappings);
      expect(result.success).toBe(false);
      expect(result.issues.map((issue) => issue.code)).toEqual(["MISSING_RHYTHM_PROJECTION"]);
    }
  });

  test("does not return partial observations when rhythm mapping is missing", () => {
    const definition = structuredClone(SYNTHETIC_OBSERVATION_DEFINITION);
    delete definition.rhythm_mappings[BASELINE_PATIENT_STATE.cardiac_rhythm];
    const result = projectObservations(BASELINE_PATIENT_STATE, definition);

    expectProjectionFailureWithoutObservations(result);
    expect(issueCodes(result)).toEqual(["MISSING_RHYTHM_PROJECTION"]);
  });
});
