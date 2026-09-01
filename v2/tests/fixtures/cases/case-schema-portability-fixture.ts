import {
  DraftCasePackageSchema,
  canonicalSerialize,
  compileCasePackage,
  computeReviewSubjectHash,
  formatValidationReport,
  preparePublicationCandidate,
  validateForPublication,
  validateForPublicationCandidate
} from "../../../packages/case-schema/src/index.ts";

import {
  TEST_HASH_ADAPTER,
  bindSyntheticReviewAndReachabilityEvidence,
  createDanglingActionReferenceCase,
  createFinalPublicationFixture
} from "./synthetic-case.ts";

export async function createCaseSchemaPortabilitySnapshot() {
  const fixture = await createFinalPublicationFixture();
  const candidate = await preparePublicationCandidate(
    fixture.underReview,
    TEST_HASH_ADAPTER
  );
  const report = await validateForPublication(
    fixture.approved,
    fixture.approval,
    TEST_HASH_ADAPTER
  );
  const invalid = DraftCasePackageSchema.parse(
    JSON.parse(JSON.stringify(fixture.approved))
  );
  invalid.action_catalogue.actions.push({ ...invalid.action_catalogue.actions[0]! });
  invalid.rules.rules[0] = createDanglingActionReferenceCase().rules.rules[0]!;
  const invalidReviewHash = await computeReviewSubjectHash(invalid, TEST_HASH_ADAPTER);
  for (const review of invalid.validation.reviews) {
    review.reviewed_content_hash = invalidReviewHash;
  }
  await bindSyntheticReviewAndReachabilityEvidence(invalid);
  const invalidReport = await validateForPublicationCandidate(
    invalid,
    TEST_HASH_ADAPTER
  );
  const compilation = await compileCasePackage(
    fixture.approved,
    fixture.approval,
    TEST_HASH_ADAPTER
  );

  if (!candidate.success || !compilation.success) {
    throw new Error("Synthetic publication-ready fixture did not compile.");
  }

  return {
    canonical_sample: canonicalSerialize({ z: 3, a: { z: 2, a: 1 }, items: [2, 1] }),
    candidate_report: candidate.report,
    report,
    human_report: formatValidationReport(report),
    invalid_report: invalidReport,
    invalid_human_report: formatValidationReport(invalidReport),
    review_subject_hash: await computeReviewSubjectHash(fixture.approved, TEST_HASH_ADAPTER),
    candidate_package_hash: candidate.candidate.candidate_package_hash,
    module_hashes: compilation.package.manifest.module_hashes,
    package_hash: compilation.package.package_hash
  };
}

export const CASE_SCHEMA_PORTABILITY_EXPECTED = JSON.stringify({
  canonical_sample: '{"a":{"a":1,"z":2},"items":[2,1],"z":3}',
  candidate_report: {
    mode: "CANDIDATE",
    valid: true,
    publishable: false,
    issues: []
  },
  report: {
    mode: "PUBLICATION",
    valid: true,
    publishable: true,
    issues: []
  },
  human_report: [
    "CASE_SCHEMA_VALIDATION_REPORT",
    "mode=PUBLICATION",
    "valid=true",
    "publishable=true",
    "issue_count=0",
    "NO_ISSUES"
  ].join("\n"),
  invalid_report: {
    mode: "CANDIDATE",
    valid: false,
    publishable: false,
    issues: [
      {
        code: "DUPLICATE_ACTION_ID",
        severity: "ERROR",
        module: "action_catalogue",
        path: "$.action_catalogue.actions",
        related_ids: ["examination.synthetic-check"],
        message: "Duplicate Action ID: examination.synthetic-check"
      },
      {
        code: "DANGLING_ACTION_REFERENCE",
        severity: "ERROR",
        module: "rules",
        path: "$.rules.rules",
        related_ids: ["procedure.synthetic-missing"],
        message: "Dangling Action ID reference: procedure.synthetic-missing"
      }
    ]
  },
  invalid_human_report: [
    "CASE_SCHEMA_VALIDATION_REPORT",
    "mode=CANDIDATE",
    "valid=false",
    "publishable=false",
    "issue_count=2",
    "[ERROR] DUPLICATE_ACTION_ID module=action_catalogue path=$.action_catalogue.actions related=examination.synthetic-check :: Duplicate Action ID: examination.synthetic-check",
    "[ERROR] DANGLING_ACTION_REFERENCE module=rules path=$.rules.rules related=procedure.synthetic-missing :: Dangling Action ID reference: procedure.synthetic-missing"
  ].join("\n"),
  review_subject_hash: "88c25b91fe813747d1574c590dacfc53b97882a17f95519ff71dbcd9b912ca83",
  candidate_package_hash: "a5e4e54c3553e226cf8f754080dd85ee1338a074cf04f78ee394da00ac3b6726",
  module_hashes: {
    manifest: "92b579f434f9ed8628713d0c0c2dd23291b1940c4b51771e025bd5c4837dfc52",
    classification: "d6959d05e12cfd5e94172e97c3a1d128077420693300ecca35450d3b85d62114",
    localization: "2f4ae4ceaca3b7da9a5ae09af690bf16266aabf62975aafab755fe6a283d018e",
    patient_profile: "3b6b53f2b81109175ec7614ce18ec3d9b5899a76ae7985db977261e0042cea0d",
    presentation: "d7ee67c0812242a8f0ffc3ac2fef3db4835ecda8b804bb00e4dbb6fc381af894",
    initial_state: "870732bc9d2e0981ee7f817667768c33ccf5fd786e3dc5ed26320152567f09bf",
    clinical_facts: "ef8197a2530ccb9d9a719a844fd25ddfbd17cfc6c814ba0152bf5248e72ee0c3",
    action_catalogue: "fff90d1704adf94029fcd7352d4254ce8c59a8b385b670140eb108511df9c022",
    rules: "3483f4c6bcf7010506236da46c0d508b17c4e9fa6d67c3f1f96312e88f5e58d7",
    timeline_policy: "1c51132a3bd1a0f0401bf706951c1b403ae92cc20a0f22b0b43941969e0bfe80",
    assessment_rubric: "abd81d62264540f3b929151c9c47833dc78fd7dec5bb3ac7f3994b08a35b04a1",
    dialogue_policy: "d13009f1610061df79f9757d642113b7fcc16db1252ed007b3c93045efcb855f",
    visual_manifest: "369da0920414f9db45e3d9a03da7ba31acd3e98e3aef8c77c98ff9ecc328748d",
    curriculum_mappings: "4c41e7f792c6974fd06d0c97ed6e488f904b8bcfbb5eee4f20953a5fa1859eaf",
    validation: "f2f2ebc87c010920976e767435bd69140dec64f0a2c921180030eee47976fce4",
    instructor_notes: "ac4aa6c3c43cf33e60f8ee41ca74e2249995c2ef9dd6795ace0d20ddf8689a60"
  },
  package_hash: "a5e4e54c3553e226cf8f754080dd85ee1338a074cf04f78ee394da00ac3b6726"
});
