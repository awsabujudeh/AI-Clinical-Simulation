import { describe, expect, it } from "vitest";

import {
  LEARNER_ACTION_CATALOGUE_SCHEMA_VERSION,
  SafeLearnerActionCatalogueSchema,
  SafeLearnerActionSchema,
  SubmitClinicalActionRequestSchema
} from "../../packages/contracts/src/index.ts";
import { SYNTHETIC_SAFE_SESSION } from "../fixtures/student-ui/safe-session.ts";

const medication = SYNTHETIC_SAFE_SESSION.learner_action_catalogue.actions.find(
  (action) => action.action_type === "MEDICATION"
)!;

describe("V2-016 shared learner action contracts", () => {
  it("uses one strict versioned safe catalogue authority", () => {
    expect(LEARNER_ACTION_CATALOGUE_SCHEMA_VERSION).toBe("1.0");
    expect(SafeLearnerActionCatalogueSchema.safeParse(
      SYNTHETIC_SAFE_SESSION.learner_action_catalogue
    ).success).toBe(true);
    expect(SafeLearnerActionCatalogueSchema.safeParse({
      ...SYNTHETIC_SAFE_SESSION.learner_action_catalogue,
      catalogue_schema_version: "2.0"
    }).success).toBe(false);
  });

  it("rejects hidden or authority-bearing catalogue fields", () => {
    for (const forbidden of [
      { rubric: {} }, { expected_action: true }, { correct: true },
      { rule_ids: ["rule.hidden"] }, { effects: [] }, { hidden_facts: [] },
      { future_scheduler: [] }, { package_hash: "a".repeat(64) },
      { review_status: "APPROVED" }, { prerequisite_action_ids: [] },
      { source_ids: [] }, { investigation: {} }
    ]) {
      expect(SafeLearnerActionSchema.safeParse({ ...medication, ...forbidden }).success)
        .toBe(false);
    }
  });

  it("requires unique action, locale, and parameter identities", () => {
    expect(SafeLearnerActionCatalogueSchema.safeParse({
      catalogue_schema_version: "1.0",
      actions: [medication, medication]
    }).success).toBe(false);
    expect(SafeLearnerActionSchema.safeParse({
      ...medication,
      labels: [medication.labels[0], medication.labels[0]]
    }).success).toBe(false);
    expect(SafeLearnerActionSchema.safeParse({
      ...medication,
      parameter_definitions: [
        medication.parameter_definitions[0],
        medication.parameter_definitions[0]
      ]
    }).success).toBe(false);
  });

  it("keeps allowed codes and numeric bounds structurally coherent", () => {
    const dose = medication.parameter_definitions[0]!;
    expect(SafeLearnerActionSchema.safeParse({
      ...medication,
      parameter_definitions: [{ ...dose, minimum: 10, maximum: 1 }]
    }).success).toBe(false);
    expect(SafeLearnerActionSchema.safeParse({
      ...medication,
      parameter_definitions: [{ ...dose, allowed_codes: ["unit.invalid"] }]
    }).success).toBe(false);
  });

  it("strictly rejects client medical and authority injection", () => {
    const valid = {
      command_id: "command.ui.action",
      action_request_id: "action-request.ui.action",
      action_id: medication.action_id,
      expected_state_version: 3,
      parameters: {
        dose: 10,
        unit: "unit.synthetic-small",
        route: "route.synthetic-a"
      },
      source: "UI"
    };
    expect(SubmitClinicalActionRequestSchema.safeParse(valid).success).toBe(true);
    for (const forbidden of [
      "patient_state", "vitals", "effects", "score", "clinical_time",
      "event_sequence", "role", "institution_id", "artifact_authority",
      "package_hash"
    ]) {
      expect(SubmitClinicalActionRequestSchema.safeParse({
        ...valid,
        [forbidden]: forbidden === "score" ? 100 : {}
      }).success).toBe(false);
    }
  });

  it("is JSON serializable without methods or executable values", () => {
    const serialized = JSON.stringify(SYNTHETIC_SAFE_SESSION.learner_action_catalogue);
    expect(SafeLearnerActionCatalogueSchema.parse(JSON.parse(serialized)))
      .toEqual(SYNTHETIC_SAFE_SESSION.learner_action_catalogue);
    expect(serialized).not.toMatch(/rubric|rule_ids|effects|package_hash/iu);
  });
});
