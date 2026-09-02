import { describe, expect, test } from "vitest";

import {
  ActionIdSchema,
  DiagnosticResultIdSchema,
  MediaAssetIdSchema,
  ScheduleRelativeEffectSchema
} from "../../packages/contracts/src/index.ts";
import {
  CASE_MODULE_NAMES,
  DraftCasePackageSchema,
  compileCasePackage,
  computeModuleHashes,
  computeReviewSubjectHash,
  preparePublicationCandidate,
  validateDraftCase,
  validateForPublicationCandidate
} from "../../packages/case-schema/src/index.ts";
import {
  PinnedSessionCaseContextSchema,
  createPinnedSessionCaseContext
} from "../../packages/session-engine/src/index.ts";
import {
  TEST_HASH_ADAPTER,
  bindSyntheticReviewAndReachabilityEvidence,
  createPublicationApprovalRecord
} from "../fixtures/cases/synthetic-case.ts";
import {
  cloneDiagnosticCase,
  createDiagnosticCandidateReadyCase,
  createDiagnosticPublicationFixture
} from "../fixtures/cases/synthetic-diagnostic-case.ts";

type DiagnosticCase = Awaited<ReturnType<typeof createDiagnosticCandidateReadyCase>>;
type DiagnosticAction = DiagnosticCase["action_catalogue"]["actions"][number];

function issueCodes(report: { issues: ReadonlyArray<{ code: string }> }) {
  return report.issues.map((entry) => entry.code);
}

function findAction(casePackage: DiagnosticCase, actionId: string): DiagnosticAction {
  const action = casePackage.action_catalogue.actions.find(
    (candidate) => candidate.action_id === actionId
  );
  if (action?.investigation === undefined) {
    throw new Error(`Missing synthetic investigation action: ${actionId}`);
  }
  return action;
}

async function candidateReportAfterMutation(
  mutate: (casePackage: DiagnosticCase) => void
) {
  const casePackage = await createDiagnosticCandidateReadyCase();
  mutate(casePackage);
  await bindSyntheticReviewAndReachabilityEvidence(casePackage);
  return validateForPublicationCandidate(casePackage, TEST_HASH_ADAPTER);
}

describe("diagnostic Case Package publication gates", () => {
  test("preserves 16 modules and publishes all bounded synthetic result forms", async () => {
    const fixture = await createDiagnosticPublicationFixture();
    const compilation = await compileCasePackage(
      fixture.approved,
      fixture.approval,
      TEST_HASH_ADAPTER
    );

    expect(CASE_MODULE_NAMES).toHaveLength(16);
    expect(compilation.success).toBe(true);
    if (!compilation.success) return;
    expect(compilation.package.action_catalogue.actions
      .flatMap((action) => action.investigation === undefined
        ? []
        : [action.investigation.result.result_type]))
      .toEqual(["STRUCTURED_LAB", "ECG", "IMAGING", "ULTRASOUND", "TEXT_REPORT"]);
    expect(compilation.package).not.toHaveProperty("diagnostics");
  });

  test("reports duplicate investigation action, result, analyte, measurement, and asset identities", async () => {
    const casePackage = await createDiagnosticCandidateReadyCase();
    const lab = findAction(casePackage, "investigation.synthetic-laboratory");
    const ecg = findAction(casePackage, "investigation.synthetic-ecg");
    const imaging = findAction(casePackage, "investigation.synthetic-imaging");
    const ultrasound = findAction(casePackage, "investigation.synthetic-ultrasound");
    if (lab.investigation!.result.result_type !== "STRUCTURED_LAB"
      || ecg.investigation!.result.result_type !== "ECG"
      || imaging.investigation!.result.result_type !== "IMAGING"
      || ultrasound.investigation!.result.result_type !== "ULTRASOUND") {
      throw new Error("Unexpected synthetic diagnostic discriminator.");
    }

    casePackage.action_catalogue.actions.push({ ...lab });
    ecg.investigation!.result.diagnostic_result_id = lab.investigation!.result.diagnostic_result_id;
    lab.investigation!.result.analytes.push({ ...lab.investigation!.result.analytes[0]! });
    ultrasound.investigation!.result.structured_measurements.push({
      ...ultrasound.investigation!.result.structured_measurements[0]!
    });
    imaging.investigation!.result.asset_references.push({
      ...imaging.investigation!.result.asset_references[0]!
    });
    await bindSyntheticReviewAndReachabilityEvidence(casePackage);

    const report = await validateForPublicationCandidate(casePackage, TEST_HASH_ADAPTER);
    expect(issueCodes(report)).toEqual(expect.arrayContaining([
      "DUPLICATE_ACTION_ID",
      "DUPLICATE_DIAGNOSTIC_RESULT_ID",
      "DUPLICATE_DIAGNOSTIC_ANALYTE_ID",
      "DUPLICATE_DIAGNOSTIC_MEASUREMENT_ID",
      "DUPLICATE_DIAGNOSTIC_ASSET_REFERENCE"
    ]));
  });

  test("rejects malformed discriminators and runtime visibility sidecars", async () => {
    const casePackage = await createDiagnosticCandidateReadyCase();
    const raw = JSON.parse(JSON.stringify(casePackage));
    raw.action_catalogue.actions[1].investigation.result.result_type = "SCRIPT";
    raw.diagnostic_visibility = { show_result: true };

    const report = await validateDraftCase(raw);
    expect(report.valid).toBe(false);
    expect(issueCodes(report)).toEqual(["SCHEMA_INVALID", "SCHEMA_INVALID"]);
  });

  test("rejects unknown asset references and modality, role, or media-kind mismatches", async () => {
    const unknown = await candidateReportAfterMutation((casePackage) => {
      const imaging = findAction(casePackage, "investigation.synthetic-imaging");
      if (imaging.investigation!.result.result_type !== "IMAGING") return;
      imaging.investigation!.result.asset_references[0]!.media_asset_id =
        MediaAssetIdSchema.parse("asset.synthetic.unknown");
    });
    const modality = await candidateReportAfterMutation((casePackage) => {
      casePackage.visual_manifest.media_assets.find(
        (asset) => asset.media_asset_id === "asset.synthetic.ecg-tracing"
      )!.diagnostic_governance!.diagnostic_modality = "XRAY";
    });
    const role = await candidateReportAfterMutation((casePackage) => {
      const ecg = findAction(casePackage, "investigation.synthetic-ecg");
      if (ecg.investigation!.result.result_type !== "ECG") return;
      ecg.investigation!.result.asset_references[0]!.asset_role = "LOOP";
    });
    const mediaKind = await candidateReportAfterMutation((casePackage) => {
      casePackage.visual_manifest.media_assets.find(
        (asset) => asset.media_asset_id === "asset.synthetic.ecg-tracing"
      )!.media_kind = "VIDEO";
    });

    expect(issueCodes(unknown)).toContain("DIAGNOSTIC_ASSET_REFERENCE_UNKNOWN");
    expect(issueCodes(modality)).toContain("DIAGNOSTIC_ASSET_MODALITY_MISMATCH");
    expect(issueCodes(role)).toContain("DIAGNOSTIC_ASSET_ROLE_MISMATCH");
    expect(issueCodes(mediaKind)).toContain("DIAGNOSTIC_ASSET_MEDIA_KIND_MISMATCH");
  });

  test.each([
    ["identity", (asset: DiagnosticCase["visual_manifest"]["media_assets"][number]) => {
      delete asset.diagnostic_governance!.content_hash;
    }, "DIAGNOSTIC_ASSET_IDENTITY_INCOMPLETE"],
    ["provenance", (asset: DiagnosticCase["visual_manifest"]["media_assets"][number]) => {
      asset.diagnostic_governance!.provenance_source_ids = [];
    }, "DIAGNOSTIC_ASSET_PROVENANCE_MISSING"],
    ["rights", (asset: DiagnosticCase["visual_manifest"]["media_assets"][number]) => {
      asset.diagnostic_governance!.rights_status = "UNRESOLVED";
    }, "DIAGNOSTIC_ASSET_RIGHTS_INCOMPLETE"],
    ["Clinical Review", (asset: DiagnosticCase["visual_manifest"]["media_assets"][number]) => {
      asset.diagnostic_governance!.clinical_review_status = "UNRESOLVED";
    }, "DIAGNOSTIC_ASSET_REVIEW_INCOMPLETE"]
  ])("fails publication when diagnostic asset %s governance is incomplete", async (
    _label,
    mutate,
    expectedCode
  ) => {
    const report = await candidateReportAfterMutation((casePackage) => {
      mutate(casePackage.visual_manifest.media_assets.find(
        (asset) => asset.media_asset_id === "asset.synthetic.ecg-tracing"
      )!);
    });
    expect(report.valid).toBe(false);
    expect(issueCodes(report)).toContain(expectedCode);
  });

  test("requires approved diagnostic result and asset provenance sources", async () => {
    const report = await candidateReportAfterMutation((casePackage) => {
      casePackage.validation.sources[0]!.status = "UNRESOLVED";
      casePackage.validation.sources[0]!.required = false;
    });

    expect(issueCodes(report)).toContain("DIAGNOSTIC_RESULT_SOURCE_UNAPPROVED");
    expect(issueCodes(report)).toContain("DIAGNOSTIC_ASSET_PROVENANCE_UNAPPROVED");
  });

  test("requires Case-authored non-media fallback while retaining clinical truth", async () => {
    const missing = await candidateReportAfterMutation((casePackage) => {
      const ecg = findAction(casePackage, "investigation.synthetic-ecg");
      if (ecg.investigation!.result.result_type !== "ECG") return;
      ecg.investigation!.result.fallback_fact_ids = [];
    });
    const valid = await createDiagnosticCandidateReadyCase();
    const ecg = findAction(valid, "investigation.synthetic-ecg");
    if (ecg.investigation!.result.result_type !== "ECG") return;

    expect(issueCodes(missing)).toContain("DIAGNOSTIC_FALLBACK_MISSING");
    expect(ecg.investigation!.result.fallback_fact_ids).toEqual([
      "fact.synthetic.ecg-finding"
    ]);
    expect(ecg.investigation!.result.finding_fact_ids).toContain(
      "fact.synthetic.ecg-finding"
    );
  });

  test("enforces deterministic milestone chronology and separate image/report availability", async () => {
    const valid = await createDiagnosticCandidateReadyCase();
    const ecg = findAction(valid, "investigation.synthetic-ecg").investigation!;
    const image = ecg.milestones.find((entry) => entry.milestone_type === "IMAGE_AVAILABLE")!;
    const report = ecg.milestones.find(
      (entry) => entry.milestone_type === "FORMAL_REPORT_AVAILABLE"
    )!;
    const invalid = await candidateReportAfterMutation((casePackage) => {
      const definition = findAction(casePackage, "investigation.synthetic-ecg").investigation!;
      definition.milestones.find(
        (entry) => entry.milestone_type === "FORMAL_REPORT_AVAILABLE"
      )!.offset_clinical_seconds = 1.5;
    });

    expect(image.offset_clinical_seconds).not.toBe(report.offset_clinical_seconds);
    expect(issueCodes(invalid)).toContain("INVALID_DIAGNOSTIC_MILESTONE_CHRONOLOGY");
  });

  test("keeps parallel investigation timing independent and never sums durations", async () => {
    const casePackage = await createDiagnosticCandidateReadyCase();
    const resultOffsets = [
      "investigation.synthetic-laboratory",
      "investigation.synthetic-imaging",
      "investigation.synthetic-ultrasound"
    ].map((actionId) => findAction(casePackage, actionId).investigation!.milestones.find(
      (entry) => entry.milestone_type === "RESULT_AVAILABLE"
    )!.offset_clinical_seconds);

    expect(resultOffsets).toEqual([7, 9, 15]);
    expect(Math.max(...resultOffsets)).toBe(15);
    expect(Math.max(...resultOffsets)).not.toBe(resultOffsets.reduce((sum, value) => sum + value, 0));
    expect(casePackage.action_catalogue.actions
      .filter((action) => action.investigation !== undefined)
      .every((action) => action.investigation!.execution_mode === "ASYNC_PARALLEL"))
      .toBe(true);
  });

  test("maps every post-order milestone onto the existing generic relative scheduler shape", async () => {
    const casePackage = await createDiagnosticCandidateReadyCase();
    const action = findAction(casePackage, "investigation.synthetic-ecg");
    const eventByMilestone = {
      PERFORMED: "INVESTIGATION_PERFORMED",
      RESULT_AVAILABLE: "INVESTIGATION_RESULT_AVAILABLE",
      IMAGE_AVAILABLE: "INVESTIGATION_IMAGE_AVAILABLE",
      FORMAL_REPORT_AVAILABLE: "INVESTIGATION_FORMAL_REPORT_AVAILABLE"
    } as const;
    const scheduled = action.investigation!.milestones.flatMap((entry) => {
      if (entry.milestone_type === "ORDERED") return [];
      return [ScheduleRelativeEffectSchema.parse({
        effect_type: "SCHEDULE_RELATIVE",
        effect_id: `effect.synthetic-diagnostic.${entry.milestone_type.toLowerCase().replaceAll("_", "-")}`,
        scheduled_item_id: `scheduled-item.synthetic-diagnostic.${entry.milestone_type.toLowerCase().replaceAll("_", "-")}`,
        category: "schedule.synthetic-diagnostic",
        priority: 10,
        conflict_policy: "REPLACE",
        effects: [],
        emitted_events: [{
          event_type: eventByMilestone[entry.milestone_type],
          action_id: action.action_id,
          parameters: {},
          payload: {
            diagnostic_result_id: action.investigation!.result.diagnostic_result_id,
            milestone_type: entry.milestone_type
          },
          clinical_effect_ids: []
        }],
        delay_clinical_seconds: entry.offset_clinical_seconds
      })];
    });

    expect(scheduled.map((effect) => effect.delay_clinical_seconds)).toEqual([1, 2, 3, 5]);
    expect(scheduled.every((effect) => effect.effect_type === "SCHEDULE_RELATIVE")).toBe(true);
  });

  test.each([
    ["result", "RESULT_AVAILABLE", "DIAGNOSTIC_RESULT_MILESTONE_MISSING"],
    ["image", "IMAGE_AVAILABLE", "DIAGNOSTIC_IMAGE_MILESTONE_MISSING"],
    ["formal report", "FORMAL_REPORT_AVAILABLE", "DIAGNOSTIC_FORMAL_REPORT_MILESTONE_MISSING"]
  ])("fails publication when required %s availability is absent", async (
    _label,
    milestoneType,
    expectedCode
  ) => {
    const report = await candidateReportAfterMutation((casePackage) => {
      const definition = findAction(casePackage, "investigation.synthetic-ecg").investigation!;
      definition.milestones = definition.milestones.filter(
        (entry) => entry.milestone_type !== milestoneType
      );
    });
    expect(issueCodes(report)).toContain(expectedCode);
  });

  test("represents blocking execution in Draft but fails it closed for publication", async () => {
    const casePackage = await createDiagnosticCandidateReadyCase();
    findAction(casePackage, "investigation.synthetic-laboratory")
      .investigation!.execution_mode = "BLOCKING_PATIENT_UNAVAILABLE";
    await bindSyntheticReviewAndReachabilityEvidence(casePackage);

    const draft = await validateDraftCase(casePackage);
    const candidate = await validateForPublicationCandidate(casePackage, TEST_HASH_ADAPTER);
    expect(issueCodes(draft)).toContain("DIAGNOSTIC_EXECUTION_MODE_UNSUPPORTED");
    expect(draft.issues.find((entry) => entry.code === "DIAGNOSTIC_EXECUTION_MODE_UNSUPPORTED")
      ?.severity).toBe("WARNING");
    expect(candidate.valid).toBe(false);
    expect(candidate.issues.find((entry) => entry.code === "DIAGNOSTIC_EXECUTION_MODE_UNSUPPORTED")
      ?.severity).toBe("ERROR");
  });

  test("validates Case-owned component visibility against authored components", async () => {
    const report = await candidateReportAfterMutation((casePackage) => {
      findAction(casePackage, "investigation.synthetic-laboratory")
        .investigation!.learner_visibility.media = "AT_COMPONENT_AVAILABILITY";
    });
    expect(issueCodes(report)).toContain("DIAGNOSTIC_VISIBILITY_COMPONENT_MISSING");
  });

  test("keeps investigation ActionId compatible with assessment evidence", async () => {
    const casePackage = await createDiagnosticCandidateReadyCase();
    casePackage.assessment_rubric.domains[2]!.criteria[0]!.evidence.action_ids = [
      findAction(casePackage, "investigation.synthetic-laboratory").action_id
    ];
    casePackage.assessment_rubric.domains[2]!.criteria[0]!.evidence.event_types = [
      "INVESTIGATION_ORDERED"
    ];
    await bindSyntheticReviewAndReachabilityEvidence(casePackage);

    const report = await validateForPublicationCandidate(casePackage, TEST_HASH_ADAPTER);
    expect(report.valid).toBe(true);
  });

  test("derives diagnostic policy from the exact compiled package with no runtime sidecar", async () => {
    const fixture = await createDiagnosticPublicationFixture();
    const compilation = await compileCasePackage(
      fixture.approved,
      fixture.approval,
      TEST_HASH_ADAPTER
    );
    expect(compilation.success).toBe(true);
    if (!compilation.success) return;

    const pinned = createPinnedSessionCaseContext(compilation.package);
    expect(pinned.success).toBe(true);
    if (!pinned.success) return;
    const diagnosticAction = pinned.context.action_catalogue.find(
      (action) => action.action_id === "investigation.synthetic-ecg"
    );
    expect(diagnosticAction?.investigation?.result.result_type).toBe("ECG");
    expect(pinned.context).not.toHaveProperty("diagnostic_policy");
    expect(PinnedSessionCaseContextSchema.safeParse({
      ...pinned.context,
      case_package_id: "case-package.synthetic.foreign.001"
    }).success).toBe(false);
    expect(PinnedSessionCaseContextSchema.safeParse({
      ...pinned.context,
      diagnostic_visibility: { show_result: true }
    }).success).toBe(false);
    const blockingContext = JSON.parse(JSON.stringify(pinned.context));
    blockingContext.action_catalogue.find(
      (action: { action_id: string }) => action.action_id === "investigation.synthetic-ecg"
    ).investigation.execution_mode = "BLOCKING_PATIENT_UNAVAILABLE";
    expect(PinnedSessionCaseContextSchema.safeParse(blockingContext).success).toBe(false);
  });

  test("handles prototype-style diagnostic identities with Map/Set-safe validation", async () => {
    const report = await candidateReportAfterMutation((casePackage) => {
      const action = findAction(casePackage, "investigation.synthetic-laboratory");
      action.action_id = ActionIdSchema.parse("investigation.constructor");
      action.investigation!.result.diagnostic_result_id =
        DiagnosticResultIdSchema.parse("diagnostic-result.constructor");
    });
    expect(report.valid).toBe(true);
  });
});

describe("diagnostic review and package hash binding", () => {
  test.each([
    ["result", "action_catalogue", (casePackage: DiagnosticCase) => {
      const lab = findAction(casePackage, "investigation.synthetic-laboratory");
      if (lab.investigation!.result.result_type === "STRUCTURED_LAB") {
        lab.investigation!.result.analytes[0]!.value = 2;
      }
    }],
    ["timing", "action_catalogue", (casePackage: DiagnosticCase) => {
      findAction(casePackage, "investigation.synthetic-laboratory")
        .investigation!.milestones[2]!.offset_clinical_seconds = 8;
    }],
    ["report", "localization", (casePackage: DiagnosticCase) => {
      casePackage.localization.entries.find(
        (entry) => entry.key === "diagnostic.synthetic.text-report"
      )!.translations[0]!.text = "Changed synthetic text report";
    }],
    ["visibility", "action_catalogue", (casePackage: DiagnosticCase) => {
      findAction(casePackage, "investigation.synthetic-ecg")
        .investigation!.learner_visibility.formal_report = "NEVER";
    }],
    ["asset reference", "action_catalogue", (casePackage: DiagnosticCase) => {
      const ultrasound = findAction(casePackage, "investigation.synthetic-ultrasound");
      if (ultrasound.investigation!.result.result_type === "ULTRASOUND") {
        ultrasound.investigation!.result.asset_references[0]!.media_asset_id =
          MediaAssetIdSchema.parse("asset.synthetic.echo-still-secondary");
      }
    }],
    ["fallback", "action_catalogue", (casePackage: DiagnosticCase) => {
      const imaging = findAction(casePackage, "investigation.synthetic-imaging");
      if (imaging.investigation!.result.result_type === "IMAGING") {
        imaging.investigation!.result.fallback_fact_ids = [
          imaging.investigation!.result.finding_fact_ids[1]!
        ];
      }
    }],
    ["asset governance", "visual_manifest", (casePackage: DiagnosticCase) => {
      casePackage.visual_manifest.media_assets.find(
        (asset) => asset.media_asset_id === "asset.synthetic.ecg-tracing"
      )!.diagnostic_governance!.rights_reference_code =
        casePackage.visual_manifest.media_assets.find(
          (asset) => asset.media_asset_id === "asset.synthetic.xray-image"
        )!.diagnostic_governance!.rights_reference_code;
    }]
  ])("changes review and candidate hashes when reviewed diagnostic %s changes", async (
    _label,
    expectedModule,
    mutate
  ) => {
    const baseline = await createDiagnosticCandidateReadyCase();
    const changed = cloneDiagnosticCase(baseline);
    const baselineReviewHash = await computeReviewSubjectHash(baseline, TEST_HASH_ADAPTER);
    const baselineModules = await computeModuleHashes(baseline, TEST_HASH_ADAPTER);
    const baselineCandidate = await preparePublicationCandidate(baseline, TEST_HASH_ADAPTER);
    mutate(changed);
    await bindSyntheticReviewAndReachabilityEvidence(changed);
    const changedReviewHash = await computeReviewSubjectHash(changed, TEST_HASH_ADAPTER);
    const changedModules = await computeModuleHashes(changed, TEST_HASH_ADAPTER);
    const changedCandidate = await preparePublicationCandidate(changed, TEST_HASH_ADAPTER);

    expect(baselineCandidate.success).toBe(true);
    expect(changedCandidate.success).toBe(true);
    if (!baselineCandidate.success || !changedCandidate.success) return;
    expect(changedReviewHash).not.toBe(baselineReviewHash);
    expect(changedCandidate.candidate.candidate_package_hash)
      .not.toBe(baselineCandidate.candidate.candidate_package_hash);
    const expectedModuleName = expectedModule as keyof typeof changedModules;
    expect(changedModules[expectedModuleName]).not.toBe(baselineModules[expectedModuleName]);
  });

  test("invalidates exact-package approval after diagnostic content changes", async () => {
    const fixture = await createDiagnosticPublicationFixture();
    const changed = cloneDiagnosticCase(fixture.approved);
    const lab = findAction(changed, "investigation.synthetic-laboratory");
    if (lab.investigation!.result.result_type !== "STRUCTURED_LAB") return;
    lab.investigation!.result.analytes[0]!.value = 2;
    await bindSyntheticReviewAndReachabilityEvidence(changed);
    const prepared = await preparePublicationCandidate(changed, TEST_HASH_ADAPTER);
    expect(prepared.success).toBe(true);
    if (!prepared.success) return;
    const compilation = await compileCasePackage(
      changed,
      createPublicationApprovalRecord(changed, fixture.approval.approved_package_hash),
      TEST_HASH_ADAPTER
    );

    expect(prepared.candidate.candidate_package_hash)
      .not.toBe(fixture.approval.approved_package_hash);
    expect(compilation.success).toBe(false);
    expect(issueCodes(compilation.report)).toContain("PACKAGE_APPROVAL_HASH_MISMATCH");
  });
});
