import {
  PINNED_CLINICAL_POLICY_SCHEMA_VERSION,
  PinnedClinicalPolicyEnvelopeSchema,
  type PinnedClinicalPolicyEnvelope
} from "../../contracts/src/index.ts";

import { CompiledCasePackageSchema } from "./schemas.ts";

/**
 * Derives the complete V2-005 execution policy from one immutable compiled
 * Case Package. The envelope is an architectural binding, not a client
 * authentication token: trusted Session infrastructure must load the
 * authoritative package before calling this extractor.
 */
export function createPinnedClinicalPolicy(
  compiledCasePackageInput: unknown
): PinnedClinicalPolicyEnvelope {
  const casePackage = CompiledCasePackageSchema.parse(compiledCasePackageInput);
  const approvedClinicalReviewHashes = casePackage.validation.reviews
    .filter((review) => review.review_type === "CLINICAL" && review.status === "APPROVED")
    .map((review) => review.reviewed_content_hash)
    .filter((hash): hash is NonNullable<typeof hash> => hash !== undefined);
  const uniqueReviewHashes = [...new Set(approvedClinicalReviewHashes)].sort();

  if (uniqueReviewHashes.length !== 1) {
    throw new Error(
      "A compiled Case Package must contain one unambiguous approved Clinical Review hash."
    );
  }

  return PinnedClinicalPolicyEnvelopeSchema.parse({
    policy_schema_version: PINNED_CLINICAL_POLICY_SCHEMA_VERSION,
    case_package_id: casePackage.manifest.case_package_id,
    case_version_id: casePackage.manifest.case_version_id,
    case_version: casePackage.manifest.case_version,
    package_hash: casePackage.package_hash,
    review_subject_hash: uniqueReviewHashes[0],
    rule_schema_version: casePackage.rules.rule_schema_version,
    rules: casePackage.rules.rules,
    timeline_policy: {
      scheduler_schema_version: casePackage.timeline_policy.scheduler_schema_version,
      time_ratio: casePackage.timeline_policy.time_ratio,
      pause_policy: casePackage.timeline_policy.pause_policy,
      max_derived_evaluations: casePackage.timeline_policy.max_derived_evaluations,
      interrupting_event_types: casePackage.timeline_policy.interrupting_event_types,
      initial_scheduled_items: casePackage.timeline_policy.initial_scheduled_items
    },
    observation_projection: casePackage.initial_state.observation_projection,
    approved_case_fact_ids: casePackage.clinical_facts.facts
      .map((fact) => fact.fact_id)
      .sort(),
    module_hashes: {
      rules: casePackage.manifest.module_hashes.rules,
      timeline_policy: casePackage.manifest.module_hashes.timeline_policy,
      initial_state: casePackage.manifest.module_hashes.initial_state,
      clinical_facts: casePackage.manifest.module_hashes.clinical_facts
    }
  });
}
