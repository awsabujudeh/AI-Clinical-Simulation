import { describe, expect, test } from "vitest";

import {
  DraftCasePackageSchema,
  HashDigestSchema,
  PublicationApprovalRecordSchema,
  compileCasePackage,
  computeReviewSubjectHash,
  formatValidationReport,
  preparePublicationCandidate,
  validateDraftCase,
  validateForPublication,
  validateForPublicationCandidate
} from "../../packages/case-schema/src/index.ts";
import {
  MINIMAL_DRAFT_CASE,
  TEST_HASH_ADAPTER,
  bindSyntheticReviewAndReachabilityEvidence,
  createApprovedSourceCase,
  createCandidateReadyUnderReviewCase,
  createDanglingActionReferenceCase,
  createDanglingCurriculumObjectiveReferenceCase,
  createDanglingRubricActionReferenceCase,
  createDanglingRuleReferenceCase,
  createDanglingRuleSourceReferenceCase,
  createDanglingVisualFallbackCase,
  createDeferredRuleReachabilityEvidenceCase,
  createDuplicateActionCase,
  createDuplicateFactCase,
  createDuplicateMediaAssetCase,
  createDuplicateRuleCase,
  createFailedRuleReachabilityEvidenceCase,
  createFinalPublicationFixture,
  createIncompleteRuleReachabilityEvidenceCase,
  createInvalidTimingWindowCase,
  createLifecycleConflictCase,
  createManifestModuleMismatchCase,
  createMissingClinicalReviewCase,
  createMissingRequiredSourceCase,
  createMissingRuleReachabilityEvidenceCase,
  createMissingVisualFallbackCase,
  createModuleSchemaIncompatibilityCase,
  createOptionalRuleReachabilityEvidenceCase,
  createPublicationApprovalRecord,
  createRequiredDeferredValidationCase,
  createStaleRuleReachabilityEvidenceCase,
  createStudentValidationWithoutClinicalReviewCase,
  createUnresolvedRuleReachabilityEvidenceCase,
  createUnresolvedSourceCase
} from "../fixtures/cases/synthetic-case.ts";

function issueCodes(report: { issues: readonly { code: string }[] }): string[] {
  return report.issues.map((issue) => issue.code);
}

describe("Draft Case validation", () => {
  test("accepts an incomplete but structurally valid Draft and reports deterministic warnings", () => {
    const first = validateDraftCase(MINIMAL_DRAFT_CASE);
    const second = validateDraftCase(MINIMAL_DRAFT_CASE);

    expect(first.valid).toBe(true);
    expect(first.publishable).toBe(false);
    expect(issueCodes(first)).toContain("SOURCE_UNRESOLVED");
    expect(issueCodes(first)).toContain("CLINICAL_REVIEW_MISSING");
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(formatValidationReport(first)).toBe(formatValidationReport(second));
  });

  test("allows an incomplete Draft to omit observation policy but reports it", () => {
    const incomplete = DraftCasePackageSchema.parse(
      JSON.parse(JSON.stringify(MINIMAL_DRAFT_CASE))
    );
    delete incomplete.initial_state.observation_projection;

    const report = validateDraftCase(incomplete);
    expect(report.valid).toBe(true);
    expect(report.publishable).toBe(false);
    expect(issueCodes(report)).toContain("OBSERVATION_PROJECTION_MISSING");
    expect(report.issues.find(
      (item) => item.code === "OBSERVATION_PROJECTION_MISSING"
    )?.severity).toBe("WARNING");
  });

  test("rejects structurally invalid or unsupported observation definitions", () => {
    const unsupported = JSON.parse(JSON.stringify(MINIMAL_DRAFT_CASE));
    unsupported.initial_state.observation_projection.projection_schema_version = "999.0";
    const unknownField = JSON.parse(JSON.stringify(MINIMAL_DRAFT_CASE));
    unknownField.initial_state.observation_projection.unreviewed_default = true;

    for (const input of [unsupported, unknownField]) {
      const report = validateDraftCase(input);
      expect(report.valid).toBe(false);
      expect(issueCodes(report)).toContain("SCHEMA_INVALID");
    }
  });

  test.each([
    ["duplicate Action ID", createDuplicateActionCase, "DUPLICATE_ACTION_ID"],
    ["duplicate Rule ID", createDuplicateRuleCase, "DUPLICATE_RULE_ID"],
    ["duplicate Fact ID", createDuplicateFactCase, "DUPLICATE_FACT_ID"],
    ["duplicate Media Asset ID", createDuplicateMediaAssetCase, "DUPLICATE_MEDIA_ASSET_ID"],
    ["dangling Rule to Action", createDanglingActionReferenceCase, "DANGLING_ACTION_REFERENCE"],
    ["dangling Rule to Rule", createDanglingRuleReferenceCase, "DANGLING_RULE_REFERENCE"],
    ["dangling Rule to source", createDanglingRuleSourceReferenceCase, "DANGLING_SOURCE_REFERENCE"],
    ["dangling Rubric to action", createDanglingRubricActionReferenceCase, "DANGLING_ACTION_REFERENCE"],
    ["dangling curriculum objective", createDanglingCurriculumObjectiveReferenceCase, "DANGLING_CURRICULUM_OBJECTIVE_REFERENCE"],
    ["lifecycle conflict", createLifecycleConflictCase, "LIFECYCLE_STATUS_CONFLICT"]
  ])("reports %s without silently repairing it", (_label, fixtureFactory, expectedCode) => {
    const report = validateDraftCase(fixtureFactory());
    expect(report.valid).toBe(false);
    expect(issueCodes(report)).toContain(expectedCode);
  });
});

describe("Publication candidate readiness", () => {
  test("prepares an exact PUBLISHED candidate from UNDER_REVIEW without mutating source lifecycle", async () => {
    const source = await createCandidateReadyUnderReviewCase();
    const sourceBefore = JSON.stringify(source);
    const prepared = await preparePublicationCandidate(source, TEST_HASH_ADAPTER);

    expect(prepared.success).toBe(true);
    expect(JSON.stringify(source)).toBe(sourceBefore);
    expect(source.manifest.status).toBe("UNDER_REVIEW");
    if (!prepared.success) return;
    expect(prepared.report).toEqual({
      mode: "CANDIDATE",
      valid: true,
      publishable: false,
      issues: []
    });
    expect(prepared.candidate.package.manifest.status).toBe("PUBLISHED");
    expect(prepared.candidate.package.package_hash).toBe(
      prepared.candidate.candidate_package_hash
    );
  });

  test("does not prepare an approval-ready candidate from DRAFT", async () => {
    const prepared = await preparePublicationCandidate(MINIMAL_DRAFT_CASE, TEST_HASH_ADAPTER);

    expect(prepared.success).toBe(false);
    expect(issueCodes(prepared.report)).toContain("PUBLICATION_CANDIDATE_LIFECYCLE_INVALID");
  });

  test("requires inline observation policy for candidate readiness", async () => {
    const source = await createCandidateReadyUnderReviewCase();
    delete source.initial_state.observation_projection;
    const prepared = await preparePublicationCandidate(source, TEST_HASH_ADAPTER);

    expect(prepared.success).toBe(false);
    expect(issueCodes(prepared.report)).toContain("OBSERVATION_PROJECTION_MISSING");
  });

  test("fails candidate readiness for unsupported observation schema version", async () => {
    const source = JSON.parse(JSON.stringify(await createCandidateReadyUnderReviewCase()));
    source.initial_state.observation_projection.projection_schema_version = "2.0";
    const prepared = await preparePublicationCandidate(source, TEST_HASH_ADAPTER);

    expect(prepared.success).toBe(false);
    expect(issueCodes(prepared.report)).toContain("SCHEMA_INVALID");
    expect(prepared.report.issues.some(
      (item) => item.path === "$.initial_state.observation_projection.projection_schema_version"
    )).toBe(true);
  });

  test.each([
    ["hemodynamic_mappings", "hemodynamic_state", "OBSERVATION_HEMODYNAMIC_MAPPING_MISSING"],
    ["respiratory_mappings", "respiratory_state", "OBSERVATION_RESPIRATORY_MAPPING_MISSING"],
    ["oxygenation_mappings", "oxygenation", "OBSERVATION_OXYGENATION_MAPPING_MISSING"],
    ["consciousness_mappings", "consciousness", "OBSERVATION_CONSCIOUSNESS_MAPPING_MISSING"],
    ["rhythm_mappings", "cardiac_rhythm", "OBSERVATION_RHYTHM_MAPPING_MISSING"]
  ] as const)(
    "requires the initial-state %s mapping selected by %s",
    async (mappingName, stateName, expectedCode) => {
      const source = await createCandidateReadyUnderReviewCase();
      const definition = source.initial_state.observation_projection!;
      const stateValue = source.initial_state.patient_state[stateName];
      delete definition[mappingName][stateValue];
      const report = await validateForPublicationCandidate(source, TEST_HASH_ADAPTER);

      expect(report.valid).toBe(false);
      expect(issueCodes(report)).toContain(expectedCode);
    }
  );

  test("allows temperature omission but fails when configured temperature cannot resolve", async () => {
    const withoutTemperature = await createCandidateReadyUnderReviewCase();
    delete withoutTemperature.initial_state.observation_projection!.temperature_mappings;
    await bindSyntheticReviewAndReachabilityEvidence(withoutTemperature);
    const omittedReport = await validateForPublicationCandidate(
      withoutTemperature,
      TEST_HASH_ADAPTER
    );

    const missingTemperature = await createCandidateReadyUnderReviewCase();
    const currentTemperature = missingTemperature.initial_state.patient_state.temperature_state;
    delete missingTemperature.initial_state.observation_projection!.temperature_mappings![
      currentTemperature
    ];
    const missingReport = await validateForPublicationCandidate(
      missingTemperature,
      TEST_HASH_ADAPTER
    );

    expect(omittedReport.valid).toBe(true);
    expect(missingReport.valid).toBe(false);
    expect(issueCodes(missingReport)).toContain("OBSERVATION_TEMPERATURE_MAPPING_MISSING");
  });

  test("invalidates Clinical Review and reachability evidence when reviewed content changes", async () => {
    const source = await createCandidateReadyUnderReviewCase();
    source.localization.entries[0]!.translations[0]!.text = "Changed after Clinical Review";
    const prepared = await preparePublicationCandidate(source, TEST_HASH_ADAPTER);

    expect(prepared.success).toBe(false);
    expect(issueCodes(prepared.report)).toContain("REVIEW_CONTENT_HASH_MISMATCH");
    expect(issueCodes(prepared.report)).toContain("RULE_REACHABILITY_EVIDENCE_STALE");
  });

  test.each([
    ["missing Clinical Review", createMissingClinicalReviewCase, "CLINICAL_REVIEW_MISSING"],
    ["student validation without Clinical Review", createStudentValidationWithoutClinicalReviewCase, "CLINICAL_REVIEW_MISSING"],
    ["missing required source", createMissingRequiredSourceCase, "REQUIRED_SOURCE_MISSING"],
    ["unresolved source", createUnresolvedSourceCase, "SOURCE_UNRESOLVED"],
    ["missing visual fallback", createMissingVisualFallbackCase, "MISSING_VISUAL_FALLBACK"],
    ["dangling visual fallback", createDanglingVisualFallbackCase, "DANGLING_MEDIA_REFERENCE"],
    ["invalid timing window", createInvalidTimingWindowCase, "INVALID_TIMING_WINDOW"],
    ["manifest/module mismatch", createManifestModuleMismatchCase, "MANIFEST_MODULE_MISMATCH"],
    ["module schema incompatibility", createModuleSchemaIncompatibilityCase, "MODULE_SCHEMA_INCOMPATIBLE"],
    ["required generic deferred validation", createRequiredDeferredValidationCase, "DEFERRED_VALIDATION_UNRESOLVED"]
  ])("fails candidate readiness for %s", async (_label, fixtureFactory, expectedCode) => {
    const report = await validateForPublicationCandidate(
      await fixtureFactory(),
      TEST_HASH_ADAPTER
    );
    expect(report.valid).toBe(false);
    expect(issueCodes(report)).toContain(expectedCode);
  });

  test.each([
    ["missing", createMissingRuleReachabilityEvidenceCase, "RULE_REACHABILITY_EVIDENCE_MISSING"],
    ["deferred", createDeferredRuleReachabilityEvidenceCase, "RULE_REACHABILITY_DEFERRED"],
    ["unresolved", createUnresolvedRuleReachabilityEvidenceCase, "RULE_REACHABILITY_UNRESOLVED"],
    ["failed", createFailedRuleReachabilityEvidenceCase, "RULE_REACHABILITY_FAILED"],
    ["incomplete passed evidence", createIncompleteRuleReachabilityEvidenceCase, "RULE_REACHABILITY_EVIDENCE_INCOMPLETE"],
    ["stale evidence", createStaleRuleReachabilityEvidenceCase, "RULE_REACHABILITY_EVIDENCE_STALE"],
    ["authored optional downgrade", createOptionalRuleReachabilityEvidenceCase, "RULE_REACHABILITY_POLICY_INVALID"]
  ])("fails closed for %s Rule Reachability evidence", async (_label, fixtureFactory, expectedCode) => {
    const prepared = await preparePublicationCandidate(
      await fixtureFactory(),
      TEST_HASH_ADAPTER
    );
    expect(prepared.success).toBe(false);
    expect(issueCodes(prepared.report)).toContain(expectedCode);
  });
});

describe("Final publication validation", () => {
  test("requires APPROVED source plus exact external approval and returns the candidate artifact", async () => {
    const fixture = await createFinalPublicationFixture();
    const report = await validateForPublication(
      fixture.approved,
      fixture.approval,
      TEST_HASH_ADAPTER
    );
    const compilation = await compileCasePackage(
      fixture.approved,
      fixture.approval,
      TEST_HASH_ADAPTER
    );

    expect(report).toEqual({
      mode: "PUBLICATION",
      valid: true,
      publishable: true,
      issues: []
    });
    expect(compilation.success).toBe(true);
    if (!compilation.success) return;
    expect(compilation.package.manifest.status).toBe("PUBLISHED");
    expect(compilation.package.package_hash).toBe(fixture.approval.approved_package_hash);
    expect(compilation.package).not.toHaveProperty("approval");
    expect(compilation.package).not.toHaveProperty("approved_package_hash");
    expect(fixture.approved.manifest.status).toBe("APPROVED");
  });

  test("Clinical Review without exact-package approval is insufficient", async () => {
    const approved = await createApprovedSourceCase();
    const report = await validateForPublication(approved, undefined, TEST_HASH_ADAPTER);

    expect(report.publishable).toBe(false);
    expect(issueCodes(report)).toContain("PACKAGE_APPROVAL_MISSING");
  });

  test("fails final publication when inline observation policy is missing", async () => {
    const fixture = await createFinalPublicationFixture();
    delete fixture.approved.initial_state.observation_projection;
    const report = await validateForPublication(
      fixture.approved,
      fixture.approval,
      TEST_HASH_ADAPTER
    );

    expect(report.publishable).toBe(false);
    expect(issueCodes(report)).toContain("OBSERVATION_PROJECTION_MISSING");
  });

  test("exact-package approval cannot replace Clinical Review", async () => {
    const fixture = await createFinalPublicationFixture();
    fixture.approved.validation.reviews = fixture.approved.validation.reviews.filter(
      (review) => review.review_type !== "CLINICAL"
    );
    const report = await validateForPublication(
      fixture.approved,
      fixture.approval,
      TEST_HASH_ADAPTER
    );

    expect(report.publishable).toBe(false);
    expect(issueCodes(report)).toContain("CLINICAL_REVIEW_MISSING");
  });

  test("requires source APPROVED for final publication", async () => {
    const fixture = await createFinalPublicationFixture();
    const report = await validateForPublication(
      fixture.underReview,
      fixture.approval,
      TEST_HASH_ADAPTER
    );

    expect(report.publishable).toBe(false);
    expect(issueCodes(report)).toContain("FINAL_PUBLICATION_SOURCE_NOT_APPROVED");
  });

  test("requires exact approval to reference both Clinical and Technical reviews", async () => {
    const fixture = await createFinalPublicationFixture();
    const approval = PublicationApprovalRecordSchema.parse({
      ...fixture.approval,
      required_review_ids: [
        "review.synthetic.clinical",
        "review.synthetic.curriculum"
      ]
    });
    const report = await validateForPublication(
      fixture.approved,
      approval,
      TEST_HASH_ADAPTER
    );

    expect(report.publishable).toBe(false);
    expect(issueCodes(report)).toContain("PACKAGE_APPROVAL_REQUIRED_REVIEW_MISSING");
  });

  test.each([
    [
      "hash mismatch",
      (approval: ReturnType<typeof createPublicationApprovalRecord>) =>
        PublicationApprovalRecordSchema.parse({
          ...approval,
          approved_package_hash: HashDigestSchema.parse("f".repeat(64))
        }),
      "PACKAGE_APPROVAL_HASH_MISMATCH"
    ],
    [
      "Case Version identity mismatch",
      (approval: ReturnType<typeof createPublicationApprovalRecord>) =>
        PublicationApprovalRecordSchema.parse({
          ...approval,
          case_version_id: "case-version.synthetic.other.001"
        }),
      "PACKAGE_APPROVAL_VERSION_ID_MISMATCH"
    ],
    [
      "semantic version mismatch",
      (approval: ReturnType<typeof createPublicationApprovalRecord>) =>
        PublicationApprovalRecordSchema.parse({ ...approval, case_version: "2.0.1" }),
      "PACKAGE_APPROVAL_VERSION_MISMATCH"
    ],
    [
      "rejected approval",
      (approval: ReturnType<typeof createPublicationApprovalRecord>) =>
        PublicationApprovalRecordSchema.parse({ ...approval, status: "REJECTED" }),
      "PACKAGE_APPROVAL_NOT_APPROVED"
    ],
    [
      "approval still under review",
      (approval: ReturnType<typeof createPublicationApprovalRecord>) =>
        PublicationApprovalRecordSchema.parse({ ...approval, status: "UNDER_REVIEW" }),
      "PACKAGE_APPROVAL_NOT_APPROVED"
    ]
  ])("rejects external approval for %s", async (_label, mutateApproval, expectedCode) => {
    const fixture = await createFinalPublicationFixture();
    const report = await validateForPublication(
      fixture.approved,
      mutateApproval(fixture.approval),
      TEST_HASH_ADAPTER
    );

    expect(report.publishable).toBe(false);
    expect(issueCodes(report)).toContain(expectedCode);
  });

  test("invalidates exact-package approval when candidate content changes", async () => {
    const fixture = await createFinalPublicationFixture();
    const changed = DraftCasePackageSchema.parse(JSON.parse(JSON.stringify(fixture.approved)));
    changed.localization.entries[0]!.translations[0]!.text = "Changed after exact approval";
    const reviewSubjectHash = await computeReviewSubjectHash(changed, TEST_HASH_ADAPTER);
    for (const review of changed.validation.reviews) {
      review.reviewed_content_hash = reviewSubjectHash;
    }
    changed.validation.deferred_checks[0]!.validated_review_subject_hash = reviewSubjectHash;

    const report = await validateForPublication(
      changed,
      fixture.approval,
      TEST_HASH_ADAPTER
    );

    expect(report.publishable).toBe(false);
    expect(issueCodes(report)).toContain("PACKAGE_APPROVAL_HASH_MISMATCH");
  });
});
