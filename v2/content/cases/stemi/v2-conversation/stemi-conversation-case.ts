import type { HashAdapter } from "../../../../packages/contracts/src/index.ts";
import { DraftCasePackageSchema, generateRuleReachabilityEvidence,
  prepareReviewExecutionArtifact } from "../../../../packages/case-schema/src/index.ts";
import { createStemiUnderReviewCase } from "../v2-draft/stemi-case.ts";

/** Explicit successor, not a mutable runtime overlay or a medical approval. */
export const STEMI_CONVERSATION_VERSION = "2.0.1" as const;
export const STEMI_CONVERSATION_VERSION_ID = "case-version.stemi.inferior-rv.002" as const;
export const STEMI_CONVERSATION_PACKAGE_ID = "case-package.stemi.inferior-rv.002" as const;
export const STEMI_CONVERSATION_PARENT = Object.freeze({
  case_version: "2.0.0",
  case_version_id: "case-version.stemi.inferior-rv.001",
  review_subject_hash: "46388c32e3ef74db413228adf837e90e828913a7db996a3ba57d181a2cbab11f",
  review_execution_hash: "a8e76e5cd96c8b29461968796d295674f8de1ab3630a55a5568a25664c2b7ab7"
});

export async function createStemiConversationCase(hashAdapter: HashAdapter) {
  const parent = await createStemiUnderReviewCase(hashAdapter);
  const source = DraftCasePackageSchema.parse({
    ...parent,
    manifest: { ...parent.manifest, case_version: STEMI_CONVERSATION_VERSION,
      case_version_id: STEMI_CONVERSATION_VERSION_ID, case_package_id: STEMI_CONVERSATION_PACKAGE_ID },
    initial_state: { ...parent.initial_state,
      patient_state: { ...parent.initial_state.patient_state, case_version: STEMI_CONVERSATION_VERSION } },
    // Existing V2-019 capability contract. This does NOT disclose instructor notes:
    // the unchanged context projector selects only allowlisted dialogue facts.
    instructor_notes: { ...parent.instructor_notes, patient_ai_access: "ALLOWED" }
  });
  const generated = await generateRuleReachabilityEvidence(source, "2026-09-20T00:00:00Z", hashAdapter);
  source.validation.deferred_checks = [generated.evidence];
  return DraftCasePackageSchema.parse(source);
}

export async function prepareStemiConversationArtifact(hashAdapter: HashAdapter) {
  const result = await prepareReviewExecutionArtifact(await createStemiConversationCase(hashAdapter), hashAdapter);
  if (!result.success) throw new Error("STEMI_CONVERSATION_REVIEW_VALIDATION_FAILED");
  return result.artifact;
}
