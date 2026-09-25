import { OwnerAttestedMedicalReviewSchema, type HashAdapter } from "../../../packages/contracts/src/index.ts";
import { approveExpoExecution, generateRuleReachabilityEvidence, prepareReviewExecutionArtifact } from "../../../packages/case-schema/src/index.ts";
import { prepareCurrentCompleteExpoCase } from "./dana-history-exam.ts";

// Trusted content registry, not a browser flag. The owner's recorded attestation
// covers the medical content of these exact successors. Parent bytes are retained.
// Hashes are intentionally pinned constants: changing content requires new review.
export const EXPO_MEDICAL_APPROVAL_BINDINGS = {
  khalid: { version: "2.4.0", id: "stemi.inferior-rv.006", execution: "e212c36090b59a4d324348c85fd1f5f7a0dbff02b1710a4e360a135e060760d7", subject: "2e09cc954facbe91983decc60da03948ee0e012de8b16361e9b7d291f841386e" },
  dana: { version: "1.5.0", id: "anaphylaxis.dana.006", execution: "0cc26e1bad72fd44f84afe9f11832789cc60fd8408c9b13e1276c9fbf2a0dd65", subject: "bc2ea75e05a4c58f8ec6e4fea6e280190fca85dc3a1e8ed6753abbd8b7e51022" },
} as const;

export async function prepareExpoApprovalCandidate(patient: "khalid" | "dana", hash: HashAdapter) {
  const parent = await prepareCurrentCompleteExpoCase(patient, hash);
  const c = structuredClone(parent.source_case), b = EXPO_MEDICAL_APPROVAL_BINDINGS[patient];
  c.manifest.case_version = b.version as typeof c.manifest.case_version;
  c.manifest.case_version_id = `case-version.${b.id}` as typeof c.manifest.case_version_id;
  c.manifest.case_package_id = `case-package.${b.id}` as typeof c.manifest.case_package_id;
  c.initial_state.patient_state.case_version = c.manifest.case_version;
  // Only medical-review metadata changes. All clinical values/labels/effects,
  // sources, curriculum and asset rights remain byte-for-byte inherited.
  for (const action of c.action_catalogue.actions) {
    if (action.outcome_policy) action.outcome_policy.review_status="APPROVED_FOR_EXPO";
    if (action.investigation?.authoring) action.investigation.authoring.review_status="APPROVED_FOR_EXPO";
  }
  const provenance=c.clinical_facts.extensions?.["balsim.authoring"] as {facts:{review_status:string}[]} | undefined;
  for (const fact of provenance?.facts??[]) fact.review_status="APPROVED_FOR_EXPO";
  // Source lifecycle remains an unpublished snapshot. Medical status does not
  // fabricate formal reviewer/source/publication records or alter prior versions.
  c.validation.deferred_checks = [(await generateRuleReachabilityEvidence(c, "2026-09-25T00:00:00Z", hash)).evidence];
  const result = await prepareReviewExecutionArtifact(c, hash);
  if (!result.success) throw Error("EXPO_APPROVAL_CANDIDATE_INVALID");
  return result.artifact;
}

export async function prepareApprovedExpoCase(patient: "khalid" | "dana", hash: HashAdapter) {
  const a = await prepareExpoApprovalCandidate(patient, hash), b = EXPO_MEDICAL_APPROVAL_BINDINGS[patient];
  if (a.review_execution_hash !== b.execution || a.review_subject_hash !== b.subject) throw Error("EXPO_MEDICAL_APPROVAL_HASH_MISMATCH");
  const identity = a.source_case.action_catalogue.shared!.catalogue.identity!;
  const approval = OwnerAttestedMedicalReviewSchema.parse({
    evidence_schema_version:"1.0", review_evidence_type:"OWNER_ATTESTED_PHYSICIAN_REVIEW",
    medical_review_status:"APPROVED_FOR_EXPO", reviewer_role:"PHYSICIAN",
    reviewer_identity_status:"NOT_FORMALLY_RECORDED", review_timestamp_status:"NOT_FORMALLY_RECORDED",
    attested_by:"OWNER", attestation_status:"CONFIRMED", production_publication:"NOT_PUBLISHED",
    case_id:a.source_case.manifest.case_id, case_version_id:a.source_identity.case_version_id,
    case_version:a.source_identity.case_version, reviewed_execution_hash:b.execution, review_subject_hash:b.subject,
    shared_catalogue_id:identity.catalogue_id, shared_catalogue_version:identity.version,
  });
  return approveExpoExecution(a, approval, hash);
}
