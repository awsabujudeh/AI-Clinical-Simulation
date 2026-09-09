import { describe, expect, it } from "vitest";

import { validateDraftCase } from "../../packages/case-schema/src/index.ts";
import { createPatientConversationCase } from "../fixtures/patient-conversation.ts";

describe("Case-owned Patient Conversation policy", () => {
  it("accepts explicit patient truth and state-manifestation policy", () => {
    const report = validateDraftCase(createPatientConversationCase());
    expect(report.issues.filter((issue) => issue.code.includes("PATIENT_"))).toEqual([]);
  });

  it("reports duplicate manifestation identities and dangling references deterministically", () => {
    const fixture: any = JSON.parse(JSON.stringify(createPatientConversationCase()));
    fixture.dialogue_policy.patient_state_manifestations.push({
      ...fixture.dialogue_policy.patient_state_manifestations[0],
      content_key: "localization.missing",
      replaces_fact_ids: ["fact.missing.patient"]
    });
    const codes = validateDraftCase(fixture).issues.map((issue) => issue.code);
    expect(codes).toContain("DUPLICATE_PATIENT_MANIFESTATION_ID");
    expect(codes).toContain("DANGLING_PATIENT_MANIFESTATION_FACT_REFERENCE");
    expect(codes).toContain("DANGLING_PATIENT_MANIFESTATION_LOCALIZATION_KEY");
  });

  it("fails a contradictory patient disclosure policy", () => {
    const fixture: any = JSON.parse(JSON.stringify(createPatientConversationCase()));
    fixture.dialogue_policy.forbidden_fact_ids = [fixture.dialogue_policy.disclosable_fact_ids[0]];
    expect(validateDraftCase(fixture).issues.map((issue) => issue.code))
      .toContain("PATIENT_DISCLOSURE_POLICY_CONFLICT");
  });
});
