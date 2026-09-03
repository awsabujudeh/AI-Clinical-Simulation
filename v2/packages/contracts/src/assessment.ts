import { z } from "zod";

import { CanonicalEventEnvelopeSchema, EventTypeSchema } from "./events.ts";
import {
  ActionIdSchema,
  AssessmentDomainIdSchema,
  AssessmentIdSchema,
  CasePackageIdSchema,
  CaseVersionIdSchema,
  ClinicalTimeSchema,
  EventIdSchema,
  FeedbackFindingIdSchema,
  RubricIdSchema,
  RubricItemIdSchema,
  SchemaVersionSchema,
  ScoringEvidenceRefIdSchema,
  SemanticVersionSchema,
  SequenceNumberSchema,
  SessionIdSchema,
  Sha256DigestSchema
} from "./ids.ts";
import { SessionModeSchema } from "./lifecycle.ts";
import { FeedbackFindingCategorySchema } from "./lifecycle.ts";

export const ASSESSMENT_EVIDENCE_SCHEMA_VERSION = "1.0" as const;
export const ASSESSMENT_RESULT_SCHEMA_VERSION = "1.0" as const;
export const ASSESSMENT_FINALIZATION_BOUNDARY_SCHEMA_VERSION = "1.0" as const;
export const ASSESSMENT_DISCLOSURE_SCHEMA_VERSION = "1.0" as const;
export const ASSESSMENT_DEBRIEF_EVIDENCE_SCHEMA_VERSION = "1.0" as const;

export const AssessmentEvaluationPhaseSchema = z.enum(["LIVE", "FINAL"]);
export type AssessmentEvaluationPhase = z.infer<
  typeof AssessmentEvaluationPhaseSchema
>;

export const AssessmentFinalizationBoundarySchema = z.strictObject({
  boundary_schema_version: z.literal(ASSESSMENT_FINALIZATION_BOUNDARY_SCHEMA_VERSION),
  authority: z.literal("TRUSTED_SESSION_FINALIZATION"),
  assessment_id: AssessmentIdSchema,
  session_id: SessionIdSchema,
  case_package_id: CasePackageIdSchema,
  case_version_id: CaseVersionIdSchema,
  case_version: SemanticVersionSchema,
  package_hash: Sha256DigestSchema,
  rubric_id: RubricIdSchema,
  rubric_version: SemanticVersionSchema,
  rubric_module_hash: Sha256DigestSchema,
  event_sequence_through: z.number().int().nonnegative(),
  clinical_time_through: ClinicalTimeSchema
});
export type AssessmentFinalizationBoundary = z.infer<
  typeof AssessmentFinalizationBoundarySchema
>;

function roundAssessmentRatio(numerator: number, denominator: number): number {
  return Number((BigInt(numerator) + BigInt(denominator) / 2n) / BigInt(denominator));
}

export const ScoreBasisPointsSchema = z.number().int().min(0).max(10_000);
export type ScoreBasisPoints = z.infer<typeof ScoreBasisPointsSchema>;

const assessmentSessionEvidenceCommonShape = {
  evidence_schema_version: z.literal(ASSESSMENT_EVIDENCE_SCHEMA_VERSION),
  authority: z.literal("SESSION_ENGINE_COMMITTED_TIMELINE"),
  session_id: SessionIdSchema,
  session_mode: SessionModeSchema,
  case_package_id: CasePackageIdSchema,
  case_version_id: CaseVersionIdSchema,
  case_version: SemanticVersionSchema,
  assessed_through_clinical_time: ClinicalTimeSchema,
  committed_events: z.array(CanonicalEventEnvelopeSchema).max(4096)
} as const;

function refineAssessmentSessionEvidence(
  value: {
    session_id: string;
    case_version: string;
    assessed_through_clinical_time: number;
    committed_events: z.infer<typeof CanonicalEventEnvelopeSchema>[];
  },
  context: z.RefinementCtx
): void {
  const eventIds = new Set<string>();
  for (const [index, event] of value.committed_events.entries()) {
    if (event.sequence_no !== index + 1) {
      context.addIssue({
        code: "custom",
        path: ["committed_events", index, "sequence_no"],
        message: "Assessment evidence requires the complete gap-free authoritative timeline."
      });
    }
    if (eventIds.has(event.event_id)) {
      context.addIssue({
        code: "custom",
        path: ["committed_events", index, "event_id"],
        message: "Assessment evidence cannot contain duplicate committed Event IDs."
      });
    }
    eventIds.add(event.event_id);
    if (event.session_id !== value.session_id) {
      context.addIssue({
        code: "custom",
        path: ["committed_events", index, "session_id"],
        message: "Every assessment event must belong to the authoritative Session."
      });
    }
    if (event.case_version !== value.case_version) {
      context.addIssue({
        code: "custom",
        path: ["committed_events", index, "case_version"],
        message: "Every assessment event must use the pinned semantic Case Version."
      });
    }
    if (event.clinical_time > value.assessed_through_clinical_time) {
      context.addIssue({
        code: "custom",
        path: ["committed_events", index, "clinical_time"],
        message: "Assessment evidence cannot include events beyond the authoritative Clinical Time."
      });
    }
  }
}

export const ProductionAssessmentSessionEvidenceSchema = z.strictObject({
  ...assessmentSessionEvidenceCommonShape,
  execution_authority: z.literal("PUBLISHED_PRODUCTION"),
  package_hash: Sha256DigestSchema
}).superRefine(refineAssessmentSessionEvidence);

export const ReviewAssessmentSessionEvidenceSchema = z.strictObject({
  ...assessmentSessionEvidenceCommonShape,
  execution_authority: z.literal("REVIEW_ONLY"),
  review_execution_hash: Sha256DigestSchema,
  review_subject_hash: Sha256DigestSchema
}).superRefine(refineAssessmentSessionEvidence);

export const AssessmentSessionEvidenceSchema = z.union([
  ProductionAssessmentSessionEvidenceSchema,
  ReviewAssessmentSessionEvidenceSchema
]);
export type AssessmentSessionEvidence = z.infer<typeof AssessmentSessionEvidenceSchema>;

export const AssessmentEventEvidenceSchema = z.strictObject({
  evidence_ref_id: ScoringEvidenceRefIdSchema,
  rubric_item_id: RubricItemIdSchema,
  evidence_kind: z.literal("COMMITTED_EVENT"),
  event_id: EventIdSchema,
  sequence_no: SequenceNumberSchema,
  clinical_time: ClinicalTimeSchema,
  event_type: EventTypeSchema,
  action_id: ActionIdSchema.optional()
});

export const AssessmentAbsentEvidenceSchema = z.strictObject({
  evidence_ref_id: ScoringEvidenceRefIdSchema,
  rubric_item_id: RubricItemIdSchema,
  evidence_kind: z.literal("REQUIRED_EVIDENCE_ABSENT")
});

export const AssessmentEvidenceReferenceSchema = z.discriminatedUnion("evidence_kind", [
  AssessmentEventEvidenceSchema,
  AssessmentAbsentEvidenceSchema
]);
export type AssessmentEvidenceReference = z.infer<
  typeof AssessmentEvidenceReferenceSchema
>;

export const AssessmentCriterionKindSchema = z.enum([
  "AWARD",
  "PENALTY",
  "CRITICAL_ACTION",
  "CRITICAL_ERROR"
]);
export type AssessmentCriterionKind = z.infer<typeof AssessmentCriterionKindSchema>;

export const AssessmentCriterionStatusSchema = z.enum([
  "PENDING",
  "SATISFIED",
  "MISSED",
  "TRIGGERED",
  "NOT_TRIGGERED"
]);

export const AssessmentTraceCodeSchema = z.enum([
  "AWAITING_AUTHORITATIVE_EVIDENCE",
  "EVIDENCE_MATCHED",
  "EVIDENCE_MISSING",
  "TIMING_WINDOW_EXPIRED",
  "OUTSIDE_CLINICAL_TIME_WINDOW",
  "SEQUENCE_CONSTRAINT_NOT_SATISFIED",
  "REPEAT_LIMIT_APPLIED",
  "CRITICAL_EFFECT_APPLIED"
]);

export const AssessmentCriterionResultSchema = z.strictObject({
  rubric_item_id: RubricItemIdSchema,
  domain_id: AssessmentDomainIdSchema.optional(),
  criterion_kind: AssessmentCriterionKindSchema,
  status: AssessmentCriterionStatusSchema,
  awarded_points: z.number().int().nonnegative(),
  deducted_points: z.number().int().nonnegative(),
  occurrence_count: z.number().int().nonnegative(),
  evidence_ref_ids: z.array(ScoringEvidenceRefIdSchema).min(1).max(33),
  trace_codes: z.array(AssessmentTraceCodeSchema).min(1).max(8)
});
export type AssessmentCriterionResult = z.infer<
  typeof AssessmentCriterionResultSchema
>;

export const AssessmentDomainScoreSchema = z.strictObject({
  domain_id: AssessmentDomainIdSchema,
  earned_points: z.number().int().nonnegative(),
  maximum_points: z.number().int().positive(),
  score_basis_points: ScoreBasisPointsSchema,
  weight_basis_points: z.number().int().min(1).max(10_000),
  weighted_contribution_basis_points: ScoreBasisPointsSchema
});
export type AssessmentDomainScore = z.infer<typeof AssessmentDomainScoreSchema>;

export const AppliedCriticalEffectSchema = z.discriminatedUnion("effect_type", [
  z.strictObject({
    rubric_item_id: RubricItemIdSchema,
    effect_type: z.literal("CAP_OVERALL_SCORE"),
    cap_basis_points: ScoreBasisPointsSchema
  }),
  z.strictObject({
    rubric_item_id: RubricItemIdSchema,
    effect_type: z.literal("ZERO_DOMAIN_SCORE"),
    domain_id: AssessmentDomainIdSchema
  }),
  z.strictObject({
    rubric_item_id: RubricItemIdSchema,
    effect_type: z.literal("DEDUCT_OVERALL_SCORE"),
    penalty_basis_points: z.number().int().min(1).max(10_000)
  }),
  z.strictObject({
    rubric_item_id: RubricItemIdSchema,
    effect_type: z.literal("MARK_UNSAFE")
  })
]);
export type AppliedCriticalEffect = z.infer<typeof AppliedCriticalEffectSchema>;

const assessmentResultCommonShape = {
  result_schema_version: z.literal(ASSESSMENT_RESULT_SCHEMA_VERSION),
  trace_version: z.literal("1.0"),
  assessment_id: AssessmentIdSchema,
  session_id: SessionIdSchema,
  evaluation_phase: AssessmentEvaluationPhaseSchema,
  case_package_id: CasePackageIdSchema,
  case_version_id: CaseVersionIdSchema,
  case_version: SemanticVersionSchema,
  rubric_id: RubricIdSchema,
  rubric_version: SemanticVersionSchema,
  rubric_module_schema_version: SchemaVersionSchema,
  rubric_module_hash: Sha256DigestSchema,
  assessed_through_clinical_time: ClinicalTimeSchema,
  event_sequence_through: z.number().int().nonnegative(),
  domain_scores: z.array(AssessmentDomainScoreSchema).length(6),
  overall_score_basis_points: ScoreBasisPointsSchema,
  maximum_score_basis_points: z.literal(10_000),
  criterion_results: z.array(AssessmentCriterionResultSchema).max(1024),
  evidence_records: z.array(AssessmentEvidenceReferenceSchema).max(4096),
  applied_critical_effects: z.array(AppliedCriticalEffectSchema).max(128),
  unsafe: z.boolean(),
  finalization_boundary: AssessmentFinalizationBoundarySchema.optional()
} as const;

const ProductionAssessmentResultSchema = z.strictObject({
  ...assessmentResultCommonShape,
  execution_authority: z.literal("PUBLISHED_PRODUCTION"),
  package_hash: Sha256DigestSchema
});

const ReviewAssessmentResultSchema = z.strictObject({
  ...assessmentResultCommonShape,
  execution_authority: z.literal("REVIEW_ONLY"),
  review_execution_hash: Sha256DigestSchema,
  review_subject_hash: Sha256DigestSchema
});

export const AssessmentResultSchema = z.union([
  ProductionAssessmentResultSchema,
  ReviewAssessmentResultSchema
]).superRefine((value, context) => {
  if (value.evaluation_phase === "FINAL" && value.finalization_boundary === undefined) {
    context.addIssue({
      code: "custom",
      path: ["finalization_boundary"],
      message: "A final Assessment Result requires its exact trusted finalization boundary."
    });
  }
  if (value.evaluation_phase === "LIVE" && value.finalization_boundary !== undefined) {
    context.addIssue({
      code: "custom",
      path: ["finalization_boundary"],
      message: "A live Assessment Result cannot claim a finalization boundary."
    });
  }
  if (
    value.evaluation_phase === "FINAL"
    && value.criterion_results.some((criterion) => criterion.status === "PENDING")
  ) {
    context.addIssue({
      code: "custom",
      path: ["criterion_results"],
      message: "A final Assessment Result cannot contain unresolved criteria."
    });
  }
  if (
    value.execution_authority === "REVIEW_ONLY"
    && value.finalization_boundary !== undefined
  ) {
    context.addIssue({
      code: "custom",
      path: ["finalization_boundary"],
      message: "Review-only scoring cannot claim a production finalization boundary."
    });
  }
  if (
    value.execution_authority === "PUBLISHED_PRODUCTION"
    && value.finalization_boundary !== undefined
  ) {
    const boundaryComparisons = [
      ["assessment_id", value.finalization_boundary.assessment_id, value.assessment_id],
      ["session_id", value.finalization_boundary.session_id, value.session_id],
      ["case_package_id", value.finalization_boundary.case_package_id, value.case_package_id],
      ["case_version_id", value.finalization_boundary.case_version_id, value.case_version_id],
      ["case_version", value.finalization_boundary.case_version, value.case_version],
      ["package_hash", value.finalization_boundary.package_hash, value.package_hash],
      ["rubric_id", value.finalization_boundary.rubric_id, value.rubric_id],
      ["rubric_version", value.finalization_boundary.rubric_version, value.rubric_version],
      ["rubric_module_hash", value.finalization_boundary.rubric_module_hash, value.rubric_module_hash],
      ["event_sequence_through", value.finalization_boundary.event_sequence_through, value.event_sequence_through],
      ["clinical_time_through", value.finalization_boundary.clinical_time_through, value.assessed_through_clinical_time]
    ] as const;
    for (const [field, actual, expected] of boundaryComparisons) {
      if (actual !== expected) {
        context.addIssue({
          code: "custom",
          path: ["finalization_boundary", field],
          message: "Finalization boundary must bind the exact Assessment Result evidence boundary."
        });
      }
    }
  }
  const domainIds = new Set<string>();
  let weightedTotal = 0;
  let weightTotal = 0;
  const zeroedDomains = new Set(
    value.applied_critical_effects
      .filter((effect) => effect.effect_type === "ZERO_DOMAIN_SCORE")
      .map((effect) => effect.effect_type === "ZERO_DOMAIN_SCORE" ? effect.domain_id : "")
  );
  for (const [index, domain] of value.domain_scores.entries()) {
    if (domainIds.has(domain.domain_id)) {
      context.addIssue({
        code: "custom",
        path: ["domain_scores", index, "domain_id"],
        message: "Assessment result domain identities must be unique."
      });
    }
    domainIds.add(domain.domain_id);
    weightedTotal += domain.weighted_contribution_basis_points;
    weightTotal += domain.weight_basis_points;
    const expectedScore = roundAssessmentRatio(
      domain.earned_points * 10_000,
      domain.maximum_points
    );
    const expectedContribution = roundAssessmentRatio(
      expectedScore * domain.weight_basis_points,
      10_000
    );
    if (domain.score_basis_points !== expectedScore
      || domain.weighted_contribution_basis_points !== expectedContribution) {
      context.addIssue({
        code: "custom",
        path: ["domain_scores", index],
        message: "Domain score and weighted contribution must match deterministic half-up arithmetic."
      });
    }
    if (zeroedDomains.has(domain.domain_id) && domain.earned_points !== 0) {
      context.addIssue({
        code: "custom",
        path: ["domain_scores", index, "earned_points"],
        message: "A ZERO_DOMAIN_SCORE critical effect requires a zero final domain score."
      });
    }
  }
  if (weightTotal !== 10_000) {
    context.addIssue({
      code: "custom",
      path: ["domain_scores"],
      message: "Assessment result domain weights must total exactly 10000 basis points."
    });
  }

  const evidenceById = new Map(
    value.evidence_records.map((evidence) => [evidence.evidence_ref_id, evidence])
  );
  if (evidenceById.size !== value.evidence_records.length) {
    context.addIssue({
      code: "custom",
      path: ["evidence_records"],
      message: "Assessment evidence reference identities must be unique."
    });
  }
  const criterionIds = new Set<string>();
  for (const [index, criterion] of value.criterion_results.entries()) {
    if (criterionIds.has(criterion.rubric_item_id)) {
      context.addIssue({
        code: "custom",
        path: ["criterion_results", index, "rubric_item_id"],
        message: "Assessment criterion result identities must be unique."
      });
    }
    criterionIds.add(criterion.rubric_item_id);
    for (const referenceId of criterion.evidence_ref_ids) {
      const evidence = evidenceById.get(referenceId);
      if (evidence === undefined || evidence.rubric_item_id !== criterion.rubric_item_id) {
        context.addIssue({
          code: "custom",
          path: ["criterion_results", index, "evidence_ref_ids"],
          message: "Criterion evidence references must resolve to that exact rubric item."
        });
      }
    }
  }
  const totalPenalty = value.applied_critical_effects.reduce(
    (total, effect) => effect.effect_type === "DEDUCT_OVERALL_SCORE"
      ? total + effect.penalty_basis_points
      : total,
    0
  );
  const cap = value.applied_critical_effects.reduce(
    (current, effect) => effect.effect_type === "CAP_OVERALL_SCORE"
      ? Math.min(current, effect.cap_basis_points)
      : current,
    10_000
  );
  const expectedOverall = Math.min(
    cap,
    Math.max(0, Math.min(10_000, weightedTotal) - totalPenalty)
  );
  if (value.overall_score_basis_points !== expectedOverall) {
    context.addIssue({
      code: "custom",
      path: ["overall_score_basis_points"],
      message: "Overall score must match weighted domains, fixed penalties, and caps exactly."
    });
  }
  const expectedUnsafe = value.applied_critical_effects.some(
    (effect) => effect.effect_type === "MARK_UNSAFE"
  );
  if (value.unsafe !== expectedUnsafe) {
    context.addIssue({
      code: "custom",
      path: ["unsafe"],
      message: "Unsafe status must be derived only from an applied MARK_UNSAFE effect."
    });
  }
});
export type AssessmentResult = z.infer<typeof AssessmentResultSchema>;

export const AssessmentDisclosurePhaseSchema = z.enum(["ACTIVE", "FINAL_DEBRIEF"]);
export type AssessmentDisclosurePhase = z.infer<
  typeof AssessmentDisclosurePhaseSchema
>;

export const TrustedAssessmentDisclosureContextSchema = z.strictObject({
  context_schema_version: z.literal(ASSESSMENT_DISCLOSURE_SCHEMA_VERSION),
  authority: z.literal("TRUSTED_ASSESSMENT_DISCLOSURE"),
  assessment_id: AssessmentIdSchema,
  session_id: SessionIdSchema,
  session_mode: SessionModeSchema,
  disclosure_phase: AssessmentDisclosurePhaseSchema
});
export type TrustedAssessmentDisclosureContext = z.infer<
  typeof TrustedAssessmentDisclosureContextSchema
>;

export const LearnerVisibleEventEvidenceSchema = z.strictObject({
  event_id: EventIdSchema,
  sequence_no: SequenceNumberSchema,
  clinical_time: ClinicalTimeSchema,
  action_id: ActionIdSchema.optional()
});

export const ResolvedPracticeFindingSchema = z.strictObject({
  finding_id: FeedbackFindingIdSchema,
  category: FeedbackFindingCategorySchema,
  resolution: z.literal("RESOLVED"),
  evidence: z.array(LearnerVisibleEventEvidenceSchema).max(32)
});
export type ResolvedPracticeFinding = z.infer<
  typeof ResolvedPracticeFindingSchema
>;

export const DebriefEvidencePackageSchema = z.strictObject({
  debrief_schema_version: z.literal(ASSESSMENT_DEBRIEF_EVIDENCE_SCHEMA_VERSION),
  authority: z.literal("DETERMINISTIC_ASSESSMENT_EVIDENCE"),
  finalization_boundary: AssessmentFinalizationBoundarySchema,
  assessment_result: AssessmentResultSchema
}).superRefine((value, context) => {
  if (value.assessment_result.evaluation_phase !== "FINAL") {
    context.addIssue({
      code: "custom",
      path: ["assessment_result", "evaluation_phase"],
      message: "Debrief evidence requires a final deterministic Assessment Result."
    });
  }
  if (
    value.assessment_result.finalization_boundary === undefined
    || JSON.stringify(value.assessment_result.finalization_boundary)
      !== JSON.stringify(value.finalization_boundary)
  ) {
    context.addIssue({
      code: "custom",
      path: ["finalization_boundary"],
      message: "Debrief evidence must preserve the exact Assessment Result boundary."
    });
  }
});
export type DebriefEvidencePackage = z.infer<typeof DebriefEvidencePackageSchema>;

export const ActiveAssessmentDisclosureSchema = z.strictObject({
  projection_schema_version: z.literal(ASSESSMENT_DISCLOSURE_SCHEMA_VERSION),
  projection_type: z.literal("ACTIVE_ASSESSMENT_WITHHELD"),
  assessment_id: AssessmentIdSchema,
  session_id: SessionIdSchema,
  session_mode: z.literal("ASSESSMENT"),
  assessment_status: z.literal("ACTIVE")
});

export const ActivePracticeDisclosureSchema = z.strictObject({
  projection_schema_version: z.literal(ASSESSMENT_DISCLOSURE_SCHEMA_VERSION),
  projection_type: z.literal("ACTIVE_PRACTICE_FEEDBACK"),
  assessment_id: AssessmentIdSchema,
  session_id: SessionIdSchema,
  session_mode: z.literal("PRACTICE_DEMO"),
  assessment_status: z.literal("ACTIVE"),
  resolved_findings: z.array(ResolvedPracticeFindingSchema).max(1024)
});

export const FinalDebriefDisclosureSchema = z.strictObject({
  projection_schema_version: z.literal(ASSESSMENT_DISCLOSURE_SCHEMA_VERSION),
  projection_type: z.literal("FINAL_DEBRIEF"),
  assessment_id: AssessmentIdSchema,
  session_id: SessionIdSchema,
  session_mode: SessionModeSchema,
  assessment_status: z.literal("FINAL"),
  debrief_evidence: DebriefEvidencePackageSchema
});

export const AssessmentDisclosureProjectionSchema = z.discriminatedUnion(
  "projection_type",
  [
    ActiveAssessmentDisclosureSchema,
    ActivePracticeDisclosureSchema,
    FinalDebriefDisclosureSchema
  ]
);
export type AssessmentDisclosureProjection = z.infer<
  typeof AssessmentDisclosureProjectionSchema
>;
