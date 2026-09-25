import { describe, expect, it } from "vitest";
import { EXPO_SHARED_CATALOGUE as C } from "../../../content/cases/shared-catalogue/expo-catalogue.ts";
import {
  createExpoCatalogueCase,
  prepareExpoCatalogueCase,
} from "../../../content/cases/shared-catalogue/expo-cases.ts";
import {
  createObservationCase,
  prepareObservationCase,
} from "../../../content/cases/observations/wp1-cases.ts";
import { validateDraftCase } from "../../../packages/case-schema/src/index.ts";
import { SafeLearnerActionCatalogueSchema } from "../../../packages/contracts/src/index.ts";
import { PORTABLE_SHA256_ADAPTER as hash } from "../../fixtures/portable-sha256.ts";
import {
  WP2_PORTABLE_SHA256,
  wp2Fixture,
  wp2PortableSnapshot,
} from "../../fixtures/wp2.ts";

describe("WP2 closed, versioned shared catalogue", () => {
  it("has 21 unique neutral bilingual concepts and seven medication orders", () => {
    expect(C.identity).toEqual({
      catalogue_id: "catalogue.balsim.expo-clinical",
      version: "1.0.0",
    });
    expect(new Set(C.actions.map((a) => a.action_id)).size).toBe(21);
    expect(C.actions.filter((a) => a.category === "MEDICATIONS")).toHaveLength(
      7,
    );
    expect(C.actions.filter((a) => a.category === "OBSERVATIONS")).toHaveLength(
      5,
    );
    expect(
      C.actions.every((a) => a.labels.length === 2 && a.aliases?.length === 2),
    ).toBe(true);
    expect(JSON.stringify(C)).not.toMatch(
      /stemi|anaphylaxis|rubric|outcome|critical|beneficial|incorrect|no-modeled|weight_basis|diagnosis/iu,
    );
  });
  it("serves byte-identical safe metadata from both actual pinned Cases", async () => {
    const k = await wp2Fixture("khalid"), d = await wp2Fixture("dana");
    expect(JSON.stringify((await k.state()).learner_action_catalogue)).toBe(
      JSON.stringify((await d.state()).learner_action_catalogue),
    );
    expect((await k.state()).learner_action_catalogue).toEqual(C);
  });
  it("rejects secret outcome/correctness fields in public catalogue", () => {
    for (
      const key of [
        "outcome",
        "correct",
        "critical_action",
        "score",
        "case_action_id",
      ]
    ) {
      const copy = structuredClone(C) as any;
      copy.actions[0][key] = "forged";
      expect(SafeLearnerActionCatalogueSchema.safeParse(copy).success).toBe(
        false,
      );
    }
  });
  for (const patient of ["khalid", "dana"] as const) {
    it(`${patient}: 100% coverage, pending review, hash-bound successor and unchanged clinical/dialogue/rubric truth`, async () => {
      const c = await createExpoCatalogueCase(patient, hash),
        p = await createObservationCase(patient, hash);
      expect(validateDraftCase(c).valid).toBe(true);
      expect(c.manifest.status).toBe("UNDER_REVIEW");
      expect(c.action_catalogue.shared?.bindings).toHaveLength(21);
      for (const b of c.action_catalogue.shared!.bindings) {
        expect(
          c.action_catalogue.actions.find((a) =>
            a.action_id === b.case_action_id
          )?.outcome_policy?.review_status,
        ).toBe("PENDING_PHYSICIAN_REVIEW");
      }
      for (
        const key of [
          "rules",
          "clinical_facts",
          "dialogue_policy",
          "assessment_rubric",
          "patient_profile",
        ] as const
      ) expect(c[key]).toEqual(p[key]);
      const a = await prepareExpoCatalogueCase(patient, hash),
        old = await prepareObservationCase(patient, hash);
      expect(a.review_execution_hash).not.toBe(old.review_execution_hash);
      expect(old.review_execution_hash).toBe(
        patient === "khalid"
          ? "245d740fc945e684def834c5ec2e469170d3b3b6d7dbf176f341939e1010afa8"
          : "46febaff5a13cdd8565922f3c65a48edd14a9ca1cd4b3d748996cb55a865eb2d",
      );
    });
  }
  for (
    const mutation of [
      "missing",
      "duplicate",
      "unknown-action",
      "outcome",
      "source",
      "rule",
      "alias",
      "parameters",
      "prerequisite",
      "duration",
      "no-effect-lie",
    ] as const
  ) {
    it(`blocks invalid ${mutation} configuration before pinning`, async () => {
      const c = await createExpoCatalogueCase("dana", hash),
        s = c.action_catalogue.shared!;
      const a = c.action_catalogue.actions.find((a) =>
        a.action_id === "medication.expo.aspirin-324-chewed"
      )!;
      switch (mutation) {
        case "missing":
          s.bindings.pop();
          break;
        case "duplicate":
          s.bindings[1] = { ...s.bindings[0]! };
          break;
        case "unknown-action":
          s.bindings[0]!.case_action_id = "procedure.unknown" as never;
          break;
        case "outcome":
          delete a.outcome_policy;
          break;
        case "source":
          a.outcome_policy!.source_ids = ["source.missing" as never];
          break;
        case "rule":
          a.outcome_policy!.rule_ids = ["rule.missing" as never];
          break;
        case "alias":
          s.catalogue.actions[1]!.aliases = s.catalogue.actions[0]!.aliases;
          break;
        case "parameters":
          s.catalogue.actions[0]!.parameter_definitions = [{
            parameter_code: "dose.mg" as never,
            value_type: "NUMBER",
            required: true,
          }];
          break;
        case "prerequisite":
          s.catalogue.actions[0]!.prerequisite_concept_ids = [
            "concept.unknown" as never,
          ];
          break;
        case "duration":
          c.action_catalogue.actions.find((a) =>
            a.observation_acquisition && a.outcome_policy
          )!.outcome_policy!.duration_seconds = 299;
          break;
        case "no-effect-lie":
          c.action_catalogue.actions.find((a) =>
            a.action_id === "medication.dana.epinephrine-im-05"
          )!.outcome_policy!.behavior = "NO_MODELED_BENEFIT";
          break;
      }
      expect(validateDraftCase(c).valid).toBe(false);
    });
  }
  it("repeats identical portable serialized evidence without a provider", async () => {
    expect(await wp2PortableSnapshot()).toBe(await wp2PortableSnapshot());
    expect(await hash.sha256(await wp2PortableSnapshot())).toBe(
      WP2_PORTABLE_SHA256,
    );
  });
});
