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
  invalid.validation.deferred_checks[0]!.validated_review_subject_hash = invalidReviewHash;
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
  review_subject_hash: "233b80f71a1b8c880560f13d07558746c55258632dc1eb6c12e4a2495c03f5da",
  candidate_package_hash: "e588c583a0db3b8992dcb4abf35c364db03a431bb8b4caa1e80b4cb3d77aca7d",
  module_hashes: {
    manifest: "92b579f434f9ed8628713d0c0c2dd23291b1940c4b51771e025bd5c4837dfc52",
    classification: "d6959d05e12cfd5e94172e97c3a1d128077420693300ecca35450d3b85d62114",
    localization: "2f4ae4ceaca3b7da9a5ae09af690bf16266aabf62975aafab755fe6a283d018e",
    patient_profile: "3b6b53f2b81109175ec7614ce18ec3d9b5899a76ae7985db977261e0042cea0d",
    presentation: "d7ee67c0812242a8f0ffc3ac2fef3db4835ecda8b804bb00e4dbb6fc381af894",
    initial_state: "fc74a0e495e29cfc68b4b024cac31c1c15ac1ae47fe16ad488d2144496b1a8c4",
    clinical_facts: "ef8197a2530ccb9d9a719a844fd25ddfbd17cfc6c814ba0152bf5248e72ee0c3",
    action_catalogue: "fff90d1704adf94029fcd7352d4254ce8c59a8b385b670140eb108511df9c022",
    rules: "677fe0c9029113218ce74631cb0a3a5943163c919be0281149bd12b94b2ba859",
    timeline_policy: "5df7dcb1611df7aefb47f51f2c5f35dc5e3a5df5e4c8d1fa3d2014c3eaca7308",
    assessment_rubric: "abd81d62264540f3b929151c9c47833dc78fd7dec5bb3ac7f3994b08a35b04a1",
    dialogue_policy: "d13009f1610061df79f9757d642113b7fcc16db1252ed007b3c93045efcb855f",
    visual_manifest: "369da0920414f9db45e3d9a03da7ba31acd3e98e3aef8c77c98ff9ecc328748d",
    curriculum_mappings: "4c41e7f792c6974fd06d0c97ed6e488f904b8bcfbb5eee4f20953a5fa1859eaf",
    validation: "7316db0cfa7746f1a32db532e4ea8a774fe22070b1c1b57d9df5edd6f04123f3",
    instructor_notes: "ac4aa6c3c43cf33e60f8ee41ca74e2249995c2ef9dd6795ace0d20ddf8689a60"
  },
  package_hash: "e588c583a0db3b8992dcb4abf35c364db03a431bb8b4caa1e80b4cb3d77aca7d"
});
