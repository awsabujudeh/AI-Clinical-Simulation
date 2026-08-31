import { describe, expect, test } from "vitest";

import {
  ObservationProjectionDefinitionSchema,
  ObservationProjectionSchema
} from "../../packages/contracts/src/index.ts";
import {
  VALID_OBSERVATION_PROJECTION,
  VALID_OBSERVATION_PROJECTION_DEFINITION
} from "../fixtures/contracts-fixture.ts";

describe("shared observation contracts", () => {
  test("parses strict JSON-serializable definition and output contracts", () => {
    const definition = ObservationProjectionDefinitionSchema.parse(
      VALID_OBSERVATION_PROJECTION_DEFINITION
    );
    const observations = ObservationProjectionSchema.parse(VALID_OBSERVATION_PROJECTION);

    expect(JSON.parse(JSON.stringify(definition))).toEqual(definition);
    expect(JSON.parse(JSON.stringify(observations))).toEqual(observations);
    expect(ObservationProjectionDefinitionSchema.safeParse({
      ...VALID_OBSERVATION_PROJECTION_DEFINITION,
      hidden_default: true
    }).success).toBe(false);
    expect(ObservationProjectionSchema.safeParse({
      ...VALID_OBSERVATION_PROJECTION,
      internal_state: "not-public"
    }).success).toBe(false);
  });

  test.each(["999.0", "2.0", "1.0.0", "invalid"])(
    "rejects unsupported projection schema version %s",
    (projectionSchemaVersion) => {
      expect(ObservationProjectionDefinitionSchema.safeParse({
        ...VALID_OBSERVATION_PROJECTION_DEFINITION,
        projection_schema_version: projectionSchemaVersion
      }).success).toBe(false);
    }
  );

  test("accepts exactly projection schema version 1.0", () => {
    expect(ObservationProjectionDefinitionSchema.safeParse(
      VALID_OBSERVATION_PROJECTION_DEFINITION
    ).success).toBe(true);
  });
});
