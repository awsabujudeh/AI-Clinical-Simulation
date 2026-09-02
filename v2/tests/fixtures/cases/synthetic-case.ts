import type { HashAdapter } from "../../../packages/contracts/src/index.ts";
import {
  ActionIdSchema,
  CaseControlledValueSchema,
  CurriculumObjectiveIdSchema,
  MediaAssetIdSchema,
  RuleIdSchema,
  SchemaVersionSchema,
  SourceIdSchema
} from "../../../packages/contracts/src/index.ts";
import {
  CASE_MODULE_NAMES,
  DraftCasePackageSchema,
  HashDigestSchema,
  PublicationApprovalRecordSchema,
  RULE_REACHABILITY_VALIDATION_CODE,
  ReviewRecordSchema,
  ValidationEvidenceSchema,
  computeReviewSubjectHash,
  generateRuleReachabilityEvidence,
  preparePublicationCandidate,
  type DraftCasePackage,
  type PublicationApprovalRecord
} from "../../../packages/case-schema/src/index.ts";

function deterministicTestDigest(value: string | Uint8Array): string {
  const units = typeof value === "string"
    ? Array.from(value, (character) => character.charCodeAt(0))
    : Array.from(value);
  const chunks: string[] = [];

  for (let round = 0; round < 8; round += 1) {
    let hash = (2166136261 ^ Math.imul(round + 1, 2654435761)) >>> 0;

    for (const unit of units) {
      hash ^= (unit + round) & 0xff_ff;
      hash = Math.imul(hash, 16777619) >>> 0;
    }

    chunks.push(hash.toString(16).padStart(8, "0"));
  }

  return chunks.join("");
}

// Test-only deterministic adapter. It exercises the portable HashAdapter boundary;
// production cryptography remains outside the Case Schema package.
export const TEST_HASH_ADAPTER: HashAdapter = {
  async sha256(value) {
    return deterministicTestDigest(value);
  }
};

const moduleDeclarations = CASE_MODULE_NAMES.map((moduleName) => ({
  module_name: moduleName,
  schema_version: "2.0",
  compatible_package_schema_versions: ["2.0"],
  required: true,
  approval_status: "DRAFT"
}));

export const MINIMAL_DRAFT_CASE = DraftCasePackageSchema.parse({
  manifest: {
    case_id: "case.synthetic.neutral.001",
    case_version_id: "case-version.synthetic.neutral.001",
    case_package_id: "case-package.synthetic.neutral.001",
    case_version: "2.0.0",
    schema_version: "2.0",
    status: "DRAFT",
    modules: moduleDeclarations
  },
  classification: {
    module_schema_version: "2.0",
    setting_code: "setting.simulation-lab",
    specialty_codes: ["specialty.synthetic"],
    acuity_code: "acuity.neutral",
    difficulty_code: "difficulty.introductory",
    target_level_codes: ["level.synthetic"],
    estimated_duration_minutes: 15,
    tag_codes: ["tag.fixture-only"]
  },
  localization: {
    module_schema_version: "2.0",
    fallback_locale: "en-US",
    entries: [
      {
        key: "case.synthetic.title",
        translations: [
          { locale: "en-US", text: "Synthetic validation case" },
          { locale: "ar-JO", text: "حالة اصطناعية للتحقق" }
        ]
      },
      {
        key: "case.synthetic.triage",
        translations: [{ locale: "en-US", text: "Synthetic triage summary" }]
      },
      {
        key: "fact.synthetic.concern",
        translations: [{ locale: "en-US", text: "Synthetic presenting concern" }]
      },
      {
        key: "dialogue.synthetic.fallback",
        translations: [{ locale: "en-US", text: "Synthetic fallback response" }]
      },
      {
        key: "domain.synthetic.title",
        translations: [{ locale: "en-US", text: "Synthetic rubric domain" }]
      },
      {
        key: "instructor.synthetic.note",
        translations: [{ locale: "en-US", text: "Fixture only; no medical claim." }]
      }
    ]
  },
  patient_profile: {
    module_schema_version: "2.0",
    patient_id: "patient.synthetic.001",
    default_language: "en-US",
    supported_languages: ["ar-JO", "en-US"],
    persona_code: "persona.synthetic-neutral",
    conversational_style_code: "style.concise",
    disclosure_policy_id: "dialogue.synthetic.001"
  },
  presentation: {
    module_schema_version: "2.0",
    chief_complaint_fact_id: "fact.synthetic.concern",
    arrival_context_code: "arrival.synthetic",
    triage_summary_key: "case.synthetic.triage",
    initial_public_fact_ids: ["fact.synthetic.concern"]
  },
  initial_state: {
    module_schema_version: "2.0",
    patient_state: {
      state_schema_version: "1.0",
      state_version: 0,
      case_version: "2.0.0",
      clinical_time: 0,
      clinical_phase: "phase.initial",
      hemodynamic_state: "hemodynamics.neutral",
      cardiac_rhythm: "rhythm.neutral",
      perfusion: "perfusion.neutral",
      respiratory_state: "respiratory.neutral",
      oxygenation: "oxygenation.neutral",
      consciousness: "consciousness.alert",
      neurologic_state: "neurologic.neutral",
      temperature_state: "temperature.neutral",
      metabolic_state: "metabolic.neutral",
      pain_state: {
        severity_0_10: 0,
        location_codes: ["location.unspecified"],
        quality_codes: ["quality.none"],
        trend: "trend.none"
      },
      active_interventions: [],
      active_complications: [],
      outcome_flags: []
    },
    observation_projection: {
      projection_schema_version: "1.0",
      projection_definition_id: "projection.synthetic-case-v1",
      hemodynamic_mappings: {
        "hemodynamics.neutral": {
          heart_rate_bpm: 70,
          systolic_bp_mm_hg: 110,
          diastolic_bp_mm_hg: 70
        },
        "hemodynamics.alternate": {
          heart_rate_bpm: 76,
          systolic_bp_mm_hg: 112,
          diastolic_bp_mm_hg: 72
        }
      },
      respiratory_mappings: {
        "respiratory.neutral": { respiratory_rate_per_minute: 15 }
      },
      oxygenation_mappings: {
        "oxygenation.neutral": { spo2_percent: 97 }
      },
      temperature_mappings: {
        "temperature.neutral": { temperature_celsius: 36.5 }
      },
      consciousness_mappings: {
        "consciousness.alert": { display_code: "display.consciousness-alert" }
      },
      rhythm_mappings: {
        "rhythm.neutral": {
          display_code: "display.rhythm-neutral",
          waveform_descriptor: "waveform.synthetic-neutral"
        }
      }
    }
  },
  clinical_facts: {
    module_schema_version: "2.0",
    facts: [
      {
        fact_id: "fact.synthetic.concern",
        fact_type: "SYMPTOM",
        clinical_code: "finding.synthetic",
        content_key: "fact.synthetic.concern",
        disclosure_mode: "on_direct_question",
        source_ids: ["source.synthetic.001"]
      }
    ]
  },
  action_catalogue: {
    module_schema_version: "2.0",
    actions: [
      {
        action_id: "examination.synthetic-check",
        action_type: "EXAMINATION",
        parameter_definitions: [],
        aliases: [
          {
            locale: "en-US",
            phrases: ["perform synthetic check"],
            authority: "INTERPRETATION_ONLY"
          }
        ],
        prerequisite_action_ids: [],
        confirmation_policy: "NONE",
        repeat_policy: "NOT_REPEATABLE",
        source_ids: ["source.synthetic.001"]
      }
    ]
  },
  rules: {
    module_schema_version: "2.0",
    rule_schema_version: "1.0",
    rules: [
      {
        rule_schema_version: "1.0",
        rule_id: "rule.synthetic.observation",
        rule_version: "1.0.0",
        trigger: {
          trigger_type: "COMMITTED_EVENT",
          event_type: "EXAM_PERFORMED",
          action_id: "examination.synthetic-check"
        },
        preconditions: [],
        exclusions: [],
        priority: 10,
        conflict_policy: "REPLACE",
        effects: [
          {
            effect_type: "SET_STATE",
            effect_id: "effect.synthetic.observation-marker",
            target: "hemodynamic_state",
            value: "hemodynamics.alternate"
          }
        ],
        emitted_events: [],
        referenced_action_ids: ["examination.synthetic-check"],
        referenced_rule_ids: [],
        referenced_fact_ids: ["fact.synthetic.concern"],
        source_ids: ["source.synthetic.001"],
        timing_window_ids: ["window.synthetic.response"],
        scoring_evidence_refs: []
      }
    ]
  },
  timeline_policy: {
    module_schema_version: "2.0",
    scheduler_schema_version: "1.0",
    time_ratio: 1,
    pause_policy: "PAUSE_CLINICAL_TIME",
    deterministic_seed_policy: "REQUIRED",
    max_derived_evaluations: 16,
    timing_windows: [
      {
        timing_window_id: "window.synthetic.response",
        starts_at_clinical_seconds: 0,
        ends_at_clinical_seconds: 60,
        start_inclusive: true,
        end_inclusive: true,
        reference_event_type: "EXAM_PERFORMED",
        reference_action_id: "examination.synthetic-check"
      }
    ],
    initial_scheduled_event_types: [],
    interrupting_event_types: [],
    initial_scheduled_items: []
  },
  assessment_rubric: {
    module_schema_version: "2.0",
    assessment_schema_version: "1.0",
    rubric_id: "rubric.synthetic.001",
    rubric_version: "1.0.0",
    domains: [
      { code: "history", weight: 1667 },
      { code: "examination", weight: 1667 },
      { code: "investigations", weight: 1667 },
      { code: "treatment", weight: 1667 },
      { code: "diagnosis", weight: 1666 },
      { code: "disposition", weight: 1666 }
    ].map(({ code, weight }) => ({
      domain_code: `domain.${code}`,
      title_key: "domain.synthetic.title",
      weight_basis_points: weight,
      criteria: [
        {
          rubric_item_id: `rubric-item.synthetic.${code}`,
          kind: "AWARD",
          points: 10,
          evidence: {
            authority: "COMMITTED_LEARNER_EXECUTION",
            action_ids: ["examination.synthetic-check"],
            event_types: ["EXAM_PERFORMED"],
            timing_window_id: "window.synthetic.response"
          },
          repeat_policy: { mode: "ONCE" }
        }
      ]
    })),
    critical_items: [
      {
        rubric_item_id: "rubric-item.synthetic.check",
        kind: "CRITICAL_ACTION",
        evidence: {
          authority: "COMMITTED_LEARNER_EXECUTION",
          action_ids: ["examination.synthetic-check"],
          event_types: ["EXAM_PERFORMED"],
          timing_window_id: "window.synthetic.response"
        },
        effect: {
          effect_type: "CAP_OVERALL_SCORE",
          cap_basis_points: 5000
        }
      }
    ],
    source_ids: ["source.synthetic.001"]
  },
  dialogue_policy: {
    module_schema_version: "2.0",
    dialogue_policy_id: "dialogue.synthetic.001",
    disclosable_fact_ids: ["fact.synthetic.concern"],
    forbidden_fact_ids: [],
    question_concept_codes: ["question.synthetic-concern"],
    emotional_tone_code: "tone.neutral",
    deterministic_fallback_key: "dialogue.synthetic.fallback"
  },
  visual_manifest: {
    module_schema_version: "2.0",
    visual_manifest_id: "visual.synthetic.001",
    visual_manifest_version: "1.0.0",
    media_assets: [
      {
        media_asset_id: "asset.synthetic.fallback",
        media_kind: "STATIC_IMAGE",
        required: true,
        static_fallback: true
      }
    ],
    recipes: [
      {
        recipe_id: "recipe.synthetic.baseline",
        media_asset_ids: ["asset.synthetic.fallback"],
        fallback_asset_id: "asset.synthetic.fallback"
      }
    ],
    required_static_fallback_asset_id: "asset.synthetic.fallback",
    preload_groups: [
      {
        preload_group_id: "preload.synthetic.required",
        media_asset_ids: ["asset.synthetic.fallback"]
      }
    ]
  },
  curriculum_mappings: {
    module_schema_version: "2.0",
    objectives: [
      {
        objective_id: "objective.synthetic.001",
        institution: {
          institution_id: "synthetic-university",
          institution_code: "SYNTH",
          institution_name: "Synthetic University (fixture only)"
        },
        objective_code: "objective-code.synthetic",
        source_id: "source.synthetic.001",
        status: "UNKNOWN"
      }
    ],
    mappings: [
      {
        mapping_id: "mapping.synthetic.001",
        competency_code: "competency.synthetic",
        institution_id: "synthetic-university",
        objective_id: "objective.synthetic.001",
        status: "UNKNOWN"
      }
    ],
    official_alignment_claimed: false
  },
  validation: {
    module_schema_version: "2.0",
    required_source_ids: ["source.synthetic.001"],
    sources: [
      {
        source_id: "source.synthetic.001",
        source_version_id: "source-version.synthetic.001",
        status: "UNRESOLVED",
        required: true
      }
    ],
    reviewers: [
      {
        reviewer_ref_id: "reviewer.synthetic.clinical",
        reviewer_role_code: "role.synthetic-clinical-reviewer",
        status: "UNCONFIRMED"
      },
      {
        reviewer_ref_id: "reviewer.synthetic.technical",
        reviewer_role_code: "role.synthetic-technical-reviewer",
        status: "UNCONFIRMED"
      },
      {
        reviewer_ref_id: "reviewer.synthetic.student",
        reviewer_role_code: "role.synthetic-student-validator",
        status: "UNCONFIRMED"
      }
    ],
    reviews: [],
    deferred_checks: [],
    review_status: "DRAFT",
    approval_status: "DRAFT"
  },
  instructor_notes: {
    module_schema_version: "2.0",
    facilitation_note_keys: ["instructor.synthetic.note"],
    teaching_point_codes: ["teaching.synthetic"],
    patient_ai_access: "FORBIDDEN"
  }
});

function cloneCase(casePackage: DraftCasePackage): DraftCasePackage {
  return DraftCasePackageSchema.parse(JSON.parse(JSON.stringify(casePackage)));
}

export async function bindSyntheticReviewAndReachabilityEvidence(
  casePackage: DraftCasePackage,
  hashAdapter: HashAdapter = TEST_HASH_ADAPTER
) {
  const reviewSubjectHash = await computeReviewSubjectHash(casePackage, hashAdapter);

  for (const review of casePackage.validation.reviews) {
    review.reviewed_content_hash = reviewSubjectHash;
  }

  const reachabilityEvidence = casePackage.validation.deferred_checks.find(
    (evidence) => evidence.validation_code === RULE_REACHABILITY_VALIDATION_CODE
  );

  if (reachabilityEvidence !== undefined) {
    const generated = await generateRuleReachabilityEvidence(
      casePackage,
      reachabilityEvidence.completed_at_utc,
      hashAdapter
    );
    Object.assign(reachabilityEvidence, generated.evidence);
  }

  return reviewSubjectHash;
}

export async function createCandidateReadyUnderReviewCase(
  hashAdapter: HashAdapter = TEST_HASH_ADAPTER
): Promise<DraftCasePackage> {
  const casePackage = cloneCase(MINIMAL_DRAFT_CASE);
  casePackage.manifest.status = "UNDER_REVIEW";
  for (const declaration of casePackage.manifest.modules) {
    declaration.approval_status = "APPROVED";
  }
  for (const source of casePackage.validation.sources) {
    source.status = "APPROVED";
  }
  for (const reviewer of casePackage.validation.reviewers) {
    reviewer.status = "CONFIRMED";
  }
  for (const objective of casePackage.curriculum_mappings.objectives) {
    objective.status = "APPROVED";
  }
  for (const mapping of casePackage.curriculum_mappings.mappings) {
    mapping.status = "APPROVED";
  }
  casePackage.validation.review_status = "APPROVED";
  casePackage.validation.approval_status = "APPROVED";
  casePackage.validation.reviews = [
    ReviewRecordSchema.parse({
      review_id: "review.synthetic.clinical",
      review_type: "CLINICAL",
      reviewer_ref_id: "reviewer.synthetic.clinical",
      status: "APPROVED",
      reviewed_case_version: casePackage.manifest.case_version,
      reviewed_at_utc: "2026-08-30T12:00:00Z"
    }),
    ReviewRecordSchema.parse({
      review_id: "review.synthetic.technical",
      review_type: "TECHNICAL",
      reviewer_ref_id: "reviewer.synthetic.technical",
      status: "APPROVED",
      reviewed_case_version: casePackage.manifest.case_version,
      reviewed_at_utc: "2026-08-30T12:01:00Z"
    }),
    ReviewRecordSchema.parse({
      review_id: "review.synthetic.curriculum",
      review_type: "CURRICULUM_UX",
      reviewer_ref_id: "reviewer.synthetic.student",
      status: "APPROVED",
      reviewed_case_version: casePackage.manifest.case_version,
      reviewed_at_utc: "2026-08-30T12:02:00Z"
    })
  ];

  casePackage.validation.deferred_checks = [
    ValidationEvidenceSchema.parse({
      validation_code: RULE_REACHABILITY_VALIDATION_CODE,
      status: "PASSED",
      required_for_publication: true,
      validator_id: "validator.synthetic.rule-reachability",
      validator_version: "1.0.0",
      evidence_hash: "0000000000000000000000000000000000000000000000000000000000000000",
      validated_case_version_id: casePackage.manifest.case_version_id,
      validated_case_version: casePackage.manifest.case_version,
      validated_review_subject_hash: "0000000000000000000000000000000000000000000000000000000000000000",
      completed_at_utc: "2026-08-30T12:03:00Z"
    })
  ];
  await bindSyntheticReviewAndReachabilityEvidence(casePackage, hashAdapter);

  return DraftCasePackageSchema.parse(casePackage);
}

export async function createApprovedSourceCase(
  hashAdapter: HashAdapter = TEST_HASH_ADAPTER
): Promise<DraftCasePackage> {
  const casePackage = await createCandidateReadyUnderReviewCase(hashAdapter);
  casePackage.manifest.status = "APPROVED";
  return DraftCasePackageSchema.parse(casePackage);
}

export function createPublicationApprovalRecord(
  casePackage: DraftCasePackage,
  candidatePackageHash: string,
  status: PublicationApprovalRecord["status"] = "APPROVED"
): PublicationApprovalRecord {
  return PublicationApprovalRecordSchema.parse({
    approval_schema_version: "1.0",
    approval_id: "approval.synthetic.publication.001",
    approval_scope: "CASE_PACKAGE_PUBLICATION",
    case_version_id: casePackage.manifest.case_version_id,
    case_version: casePackage.manifest.case_version,
    approved_package_hash: candidatePackageHash,
    required_review_ids: [
      "review.synthetic.clinical",
      "review.synthetic.technical"
    ],
    status,
    approver_ref_id: "approver.synthetic.001",
    approver_role_code: "role.synthetic-publication-approver",
    approved_at_utc: "2026-08-30T12:04:00Z"
  });
}

export async function createFinalPublicationFixture(
  hashAdapter: HashAdapter = TEST_HASH_ADAPTER
): Promise<{
  underReview: DraftCasePackage;
  approved: DraftCasePackage;
  approval: PublicationApprovalRecord;
}> {
  const underReview = await createCandidateReadyUnderReviewCase(hashAdapter);
  const prepared = await preparePublicationCandidate(underReview, hashAdapter);

  if (!prepared.success) {
    throw new Error("Synthetic UNDER_REVIEW fixture did not produce a publication candidate.");
  }

  const approved = cloneCase(underReview);
  approved.manifest.status = "APPROVED";

  return {
    underReview,
    approved: DraftCasePackageSchema.parse(approved),
    approval: createPublicationApprovalRecord(
      approved,
      prepared.candidate.candidate_package_hash
    )
  };
}

export function createLifecycleConflictCase(): DraftCasePackage {
  const casePackage = cloneCase(MINIMAL_DRAFT_CASE);
  casePackage.manifest.status = "APPROVED";
  return casePackage;
}

export function createDuplicateActionCase(): DraftCasePackage {
  const casePackage = cloneCase(MINIMAL_DRAFT_CASE);
  casePackage.action_catalogue.actions.push({ ...casePackage.action_catalogue.actions[0]! });
  return casePackage;
}

export function createDuplicateRuleCase(): DraftCasePackage {
  const casePackage = cloneCase(MINIMAL_DRAFT_CASE);
  casePackage.rules.rules.push({ ...casePackage.rules.rules[0]! });
  return casePackage;
}

export function createDuplicateFactCase(): DraftCasePackage {
  const casePackage = cloneCase(MINIMAL_DRAFT_CASE);
  casePackage.clinical_facts.facts.push({ ...casePackage.clinical_facts.facts[0]! });
  return casePackage;
}

export function createDuplicateMediaAssetCase(): DraftCasePackage {
  const casePackage = cloneCase(MINIMAL_DRAFT_CASE);
  casePackage.visual_manifest.media_assets.push({
    ...casePackage.visual_manifest.media_assets[0]!
  });
  return casePackage;
}

export function createDanglingActionReferenceCase(): DraftCasePackage {
  const casePackage = cloneCase(MINIMAL_DRAFT_CASE);
  casePackage.rules.rules[0]!.referenced_action_ids = [
    ActionIdSchema.parse("procedure.synthetic-missing")
  ];
  return casePackage;
}

export function createDanglingRuleReferenceCase(): DraftCasePackage {
  const casePackage = cloneCase(MINIMAL_DRAFT_CASE);
  casePackage.rules.rules[0]!.referenced_rule_ids = [
    RuleIdSchema.parse("rule.synthetic.missing")
  ];
  return casePackage;
}

export function createDanglingRuleSourceReferenceCase(): DraftCasePackage {
  const casePackage = cloneCase(MINIMAL_DRAFT_CASE);
  casePackage.rules.rules[0]!.source_ids = [SourceIdSchema.parse("source.synthetic.missing")];
  return casePackage;
}

export function createDanglingRubricActionReferenceCase(): DraftCasePackage {
  const casePackage = cloneCase(MINIMAL_DRAFT_CASE);
  casePackage.assessment_rubric.critical_items[0]!.evidence.action_ids = [
    ActionIdSchema.parse("procedure.synthetic-missing")
  ];
  return casePackage;
}

export function createDanglingCurriculumObjectiveReferenceCase(): DraftCasePackage {
  const casePackage = cloneCase(MINIMAL_DRAFT_CASE);
  casePackage.curriculum_mappings.mappings[0]!.objective_id =
    CurriculumObjectiveIdSchema.parse("objective.synthetic.missing");
  return casePackage;
}

export async function createMissingClinicalReviewCase(): Promise<DraftCasePackage> {
  const casePackage = await createCandidateReadyUnderReviewCase();
  casePackage.validation.reviews = casePackage.validation.reviews.filter(
    (review) => review.review_type !== "CLINICAL"
  );
  return casePackage;
}

export async function createStudentValidationWithoutClinicalReviewCase(): Promise<DraftCasePackage> {
  return createMissingClinicalReviewCase();
}

export async function createMissingRequiredSourceCase(): Promise<DraftCasePackage> {
  const casePackage = await createCandidateReadyUnderReviewCase();
  casePackage.validation.required_source_ids.push(
    SourceIdSchema.parse("source.synthetic.missing")
  );
  return casePackage;
}

export async function createUnresolvedSourceCase(): Promise<DraftCasePackage> {
  const casePackage = await createCandidateReadyUnderReviewCase();
  casePackage.validation.sources[0]!.status = "UNRESOLVED";
  return casePackage;
}

export async function createMissingVisualFallbackCase(): Promise<DraftCasePackage> {
  const casePackage = await createCandidateReadyUnderReviewCase();
  delete casePackage.visual_manifest.required_static_fallback_asset_id;
  return casePackage;
}

export async function createDanglingVisualFallbackCase(): Promise<DraftCasePackage> {
  const casePackage = await createCandidateReadyUnderReviewCase();
  casePackage.visual_manifest.required_static_fallback_asset_id = MediaAssetIdSchema.parse(
    "asset.synthetic.missing"
  );
  return casePackage;
}

export async function createInvalidTimingWindowCase(): Promise<DraftCasePackage> {
  const casePackage = await createCandidateReadyUnderReviewCase();
  casePackage.timeline_policy.timing_windows[0]!.ends_at_clinical_seconds = 0;
  return casePackage;
}

export async function createManifestModuleMismatchCase(): Promise<DraftCasePackage> {
  const casePackage = await createCandidateReadyUnderReviewCase();
  casePackage.manifest.modules = casePackage.manifest.modules.filter(
    (declaration) => declaration.module_name !== "rules"
  );
  return casePackage;
}

export async function createModuleSchemaIncompatibilityCase(): Promise<DraftCasePackage> {
  const casePackage = await createCandidateReadyUnderReviewCase();
  casePackage.manifest.modules.find(
    (declaration) => declaration.module_name === "rules"
  )!.compatible_package_schema_versions = [SchemaVersionSchema.parse("3.0")];
  return casePackage;
}

export async function createRequiredDeferredValidationCase(): Promise<DraftCasePackage> {
  const casePackage = await createCandidateReadyUnderReviewCase();
  casePackage.validation.deferred_checks.push({
    validation_code: CaseControlledValueSchema.parse("validation.future-engine-check"),
    status: "DEFERRED",
    required_for_publication: true
  });
  return casePackage;
}

export async function createMissingRuleReachabilityEvidenceCase(): Promise<DraftCasePackage> {
  const casePackage = await createCandidateReadyUnderReviewCase();
  casePackage.validation.deferred_checks = casePackage.validation.deferred_checks.filter(
    (check) => check.validation_code !== RULE_REACHABILITY_VALIDATION_CODE
  );
  return casePackage;
}

export async function createDeferredRuleReachabilityEvidenceCase(): Promise<DraftCasePackage> {
  const casePackage = await createCandidateReadyUnderReviewCase();
  casePackage.validation.deferred_checks[0]!.status = "DEFERRED";
  return casePackage;
}

export async function createUnresolvedRuleReachabilityEvidenceCase(): Promise<DraftCasePackage> {
  const casePackage = await createCandidateReadyUnderReviewCase();
  casePackage.validation.deferred_checks[0]!.status = "UNRESOLVED";
  return casePackage;
}

export async function createFailedRuleReachabilityEvidenceCase(): Promise<DraftCasePackage> {
  const casePackage = await createCandidateReadyUnderReviewCase();
  casePackage.validation.deferred_checks[0]!.status = "FAILED";
  return casePackage;
}

export async function createIncompleteRuleReachabilityEvidenceCase(): Promise<DraftCasePackage> {
  const casePackage = await createCandidateReadyUnderReviewCase();
  delete casePackage.validation.deferred_checks[0]!.evidence_hash;
  return casePackage;
}

export async function createStaleRuleReachabilityEvidenceCase(): Promise<DraftCasePackage> {
  const casePackage = await createCandidateReadyUnderReviewCase();
  casePackage.validation.deferred_checks[0]!.validated_review_subject_hash =
    HashDigestSchema.parse("0".repeat(64));
  return casePackage;
}

export async function createOptionalRuleReachabilityEvidenceCase(): Promise<DraftCasePackage> {
  const casePackage = await createCandidateReadyUnderReviewCase();
  casePackage.validation.deferred_checks[0]!.required_for_publication = false;
  return casePackage;
}

export function reverseObjectKeyInsertionOrder(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(reverseObjectKeyInsertionOrder);
  }

  if (value !== null && typeof value === "object") {
    const reversedEntries = Object.entries(value).reverse();
    return Object.fromEntries(
      reversedEntries.map(([key, child]) => [key, reverseObjectKeyInsertionOrder(child)])
    );
  }

  return value;
}
