import { describe, expect, test } from "vitest";

import {
  CASE_MODULE_NAMES,
  CompiledCasePackageSchema,
  DraftCasePackageSchema,
  FactDisclosureModeSchema
} from "../../packages/case-schema/src/index.ts";
import { JsonValueSchema } from "../../packages/contracts/src/index.ts";
import { MINIMAL_DRAFT_CASE } from "../fixtures/cases/synthetic-case.ts";

describe("Case Schema module contracts", () => {
  test("parses the structurally valid minimal Draft and preserves every frozen module", () => {
    const parsed = DraftCasePackageSchema.parse(MINIMAL_DRAFT_CASE);

    expect(Object.keys(parsed).sort()).toEqual([...CASE_MODULE_NAMES].sort());
    expect(parsed.manifest.schema_version).toBe("2.0");
    expect(parsed.manifest.case_version).toBe("2.0.0");
    expect(parsed.initial_state.patient_state.state_version).toBe(0);
    expect(parsed.initial_state.patient_state.clinical_time).toBe(0);
  });

  test("keeps observation policy optional in Draft but required in compiled packages", () => {
    const draftWithoutProjection = JSON.parse(JSON.stringify(MINIMAL_DRAFT_CASE));
    delete draftWithoutProjection.initial_state.observation_projection;
    expect(DraftCasePackageSchema.safeParse(draftWithoutProjection).success).toBe(true);

    const compiledShapeWithoutProjection = {
      ...draftWithoutProjection,
      manifest: {
        ...draftWithoutProjection.manifest,
        status: "PUBLISHED",
        hash_algorithm: "SHA-256",
        module_hashes: Object.fromEntries(
          CASE_MODULE_NAMES.map((moduleName) => [moduleName, "0".repeat(64)])
        )
      },
      package_hash: "0".repeat(64)
    };
    expect(CompiledCasePackageSchema.safeParse(compiledShapeWithoutProjection).success).toBe(false);
  });

  test("reuses frozen disclosure values and treats aliases as interpretation-only", () => {
    expect(FactDisclosureModeSchema.options).toEqual([
      "on_direct_question",
      "after_exam",
      "after_result",
      "never_to_patient"
    ]);
    expect(MINIMAL_DRAFT_CASE.action_catalogue.actions[0]?.aliases[0]?.authority).toBe(
      "INTERPRETATION_ONLY"
    );
  });

  test("rejects unknown core fields and executable/non-JSON extension values", () => {
    expect(DraftCasePackageSchema.safeParse({
      ...MINIMAL_DRAFT_CASE,
      execute_case: "not allowed"
    }).success).toBe(false);

    expect(DraftCasePackageSchema.safeParse({
      ...MINIMAL_DRAFT_CASE,
      classification: {
        ...MINIMAL_DRAFT_CASE.classification,
        extensions: {
          "fixture.valid": { enabled: true },
          setting_code: "cannot-overwrite-core"
        }
      }
    }).success).toBe(false);

    expect(JsonValueSchema.safeParse({ execute: () => true }).success).toBe(false);
  });
});
