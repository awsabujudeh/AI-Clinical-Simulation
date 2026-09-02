import { describe, expect, test } from "vitest";

import {
  ActionIdSchema,
  DiagnosticAnalyteSchema,
  DiagnosticResultIdSchema,
  DiagnosticResultSchema,
  EventTypeSchema,
  InvestigationDefinitionSchema,
  PatientLanguageSchema
} from "../../packages/contracts/src/index.ts";
import { createDiagnosticCandidateReadyCase } from "../fixtures/cases/synthetic-diagnostic-case.ts";

describe("shared diagnostic investigation contracts", () => {
  test("parse all five bounded result discriminators as strict JSON data", async () => {
    const casePackage = await createDiagnosticCandidateReadyCase();
    const results = casePackage.action_catalogue.actions
      .filter((action) => action.investigation !== undefined)
      .map((action) => DiagnosticResultSchema.parse(action.investigation!.result));

    expect(results.map((result) => result.result_type)).toEqual([
      "STRUCTURED_LAB",
      "ECG",
      "IMAGING",
      "ULTRASOUND",
      "TEXT_REPORT"
    ]);
    expect(JSON.parse(JSON.stringify(results))).toEqual(results);
  });

  test("rejects unknown discriminators, unsupported versions, and unknown fields", async () => {
    const casePackage = await createDiagnosticCandidateReadyCase();
    const definition = casePackage.action_catalogue.actions[1]!.investigation!;

    expect(InvestigationDefinitionSchema.safeParse({
      ...definition,
      investigation_schema_version: "2.0"
    }).success).toBe(false);
    expect(DiagnosticResultSchema.safeParse({
      ...definition.result,
      result_type: "EXECUTABLE_SCRIPT"
    }).success).toBe(false);
    expect(InvestigationDefinitionSchema.safeParse({
      ...definition,
      runtime_visibility_override: true
    }).success).toBe(false);
  });

  test("validates structured analyte values, units, and reference intervals", () => {
    const valid = {
      analyte_id: "analyte.synthetic.component",
      analyte_code: "analyte-code.synthetic-neutral",
      display_label_key: "diagnostic.synthetic.analyte",
      value: 1,
      unit_code: "unit.synthetic-neutral",
      reference_interval: {
        lower_bound: 0,
        upper_bound: 2,
        lower_inclusive: true,
        upper_inclusive: true
      },
      abnormal_flag: "NORMAL"
    };

    expect(DiagnosticAnalyteSchema.safeParse(valid).success).toBe(true);
    expect(DiagnosticAnalyteSchema.safeParse({ ...valid, value: Number.NaN }).success).toBe(false);
    expect(DiagnosticAnalyteSchema.safeParse({ ...valid, unit_code: "" }).success).toBe(false);
    expect(DiagnosticAnalyteSchema.safeParse({
      ...valid,
      reference_interval: {
        lower_bound: 2,
        upper_bound: 1,
        lower_inclusive: true,
        upper_inclusive: true
      }
    }).success).toBe(false);
  });

  test("keeps clinical findings independent from optional diagnostic media", async () => {
    const casePackage = await createDiagnosticCandidateReadyCase();
    const ecg = casePackage.action_catalogue.actions[2]!.investigation!.result;
    if (ecg.result_type !== "ECG") throw new Error("Expected synthetic ECG result.");

    const mediaFree = DiagnosticResultSchema.parse({
      ...ecg,
      asset_references: []
    });
    expect(mediaFree.finding_fact_ids).toEqual(["fact.synthetic.ecg-finding"]);
    expect(mediaFree).not.toHaveProperty("asset_content");
  });

  test("accepts only stable diagnostic identifiers and remains prototype-name safe", () => {
    expect(DiagnosticResultIdSchema.safeParse("diagnostic-result.constructor").success).toBe(true);
    expect(ActionIdSchema.safeParse("investigation.constructor").success).toBe(true);
    expect(DiagnosticResultIdSchema.safeParse("constructor").success).toBe(false);
    expect(DiagnosticResultIdSchema.safeParse("diagnostic-result.__proto__").success).toBe(false);
  });

  test("exports generic committed diagnostic milestone event types", () => {
    expect(EventTypeSchema.parse("INVESTIGATION_PERFORMED")).toBe("INVESTIGATION_PERFORMED");
    expect(EventTypeSchema.parse("INVESTIGATION_IMAGE_AVAILABLE")).toBe(
      "INVESTIGATION_IMAGE_AVAILABLE"
    );
    expect(EventTypeSchema.parse("INVESTIGATION_FORMAL_REPORT_AVAILABLE")).toBe(
      "INVESTIGATION_FORMAL_REPORT_AVAILABLE"
    );
  });

  test("preserves the exact patient-language locale boundary", () => {
    expect(PatientLanguageSchema.safeParse("ar-JO").success).toBe(true);
    expect(PatientLanguageSchema.safeParse("en-US").success).toBe(true);
    expect(PatientLanguageSchema.safeParse("en").success).toBe(false);
  });
});
