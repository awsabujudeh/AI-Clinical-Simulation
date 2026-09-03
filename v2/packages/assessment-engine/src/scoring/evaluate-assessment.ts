import { z } from "zod";

import {
  ASSESSMENT_RESULT_SCHEMA_VERSION,
  AssessmentFinalizationBoundarySchema,
  AssessmentIdSchema,
  ReviewAssessmentSessionEvidenceSchema,
  AssessmentResultSchema,
  AssessmentSessionEvidenceSchema,
  ScoringEvidenceRefIdSchema,
  type AppliedCriticalEffect,
  type AssessmentCriterionResult,
  type AssessmentEvidenceReference,
  type AssessmentEvaluationPhase,
  type AssessmentFinalizationBoundary,
  type AssessmentResult,
  type CanonicalEventEnvelope
} from "../../../contracts/src/index.ts";
import {
  CompiledCasePackageSchema,
  ReviewExecutionArtifactSchema,
  type CriticalRubricItem,
  type ScoredRubricCriterion
} from "../../../case-schema/src/index.ts";

import {
  createPinnedAssessmentContext,
  createPinnedReviewAssessmentContext,
  type PinnedAssessmentContext,
  type PinnedReviewAssessmentContext
} from "../context/pinned-assessment.ts";
import { resolveRubricEvidence } from "../evidence/match-evidence.ts";
import {
  assessmentIssue,
  assessmentIssuesFromZodError,
  sortAssessmentIssues,
  type AssessmentIssue
} from "../validation/assessment-issues.ts";

export const ASSESSMENT_EVALUATION_SCHEMA_VERSION = "1.0" as const;

const assessmentEvaluationRequestShape = {
  evaluation_schema_version: z.literal(ASSESSMENT_EVALUATION_SCHEMA_VERSION),
  execution_authority: z.literal("PUBLISHED_PRODUCTION"),
  assessment_id: AssessmentIdSchema,
  compiled_case_package: CompiledCasePackageSchema,
  session_evidence: AssessmentSessionEvidenceSchema
} as const;

export const LiveAssessmentEvaluationRequestSchema = z.strictObject({
  ...assessmentEvaluationRequestShape,
  evaluation_phase: z.literal("LIVE")
});

export const FinalAssessmentEvaluationRequestSchema = z.strictObject({
  ...assessmentEvaluationRequestShape,
  evaluation_phase: z.literal("FINAL"),
  finalization_boundary: AssessmentFinalizationBoundarySchema
});

export const AssessmentEvaluationRequestSchema = z.discriminatedUnion(
  "evaluation_phase",
  [LiveAssessmentEvaluationRequestSchema, FinalAssessmentEvaluationRequestSchema]
);
export type AssessmentEvaluationRequest = z.infer<
  typeof AssessmentEvaluationRequestSchema
>;

export const ReviewAssessmentEvaluationRequestSchema = z.strictObject({
  evaluation_schema_version: z.literal(ASSESSMENT_EVALUATION_SCHEMA_VERSION),
  execution_authority: z.literal("REVIEW_ONLY"),
  evaluation_phase: z.literal("LIVE"),
  assessment_id: AssessmentIdSchema,
  review_execution_artifact: ReviewExecutionArtifactSchema,
  session_evidence: ReviewAssessmentSessionEvidenceSchema
});
export type ReviewAssessmentEvaluationRequest = z.infer<
  typeof ReviewAssessmentEvaluationRequestSchema
>;

const ExecutableAssessmentEvaluationRequestSchema = z.union([
  AssessmentEvaluationRequestSchema,
  ReviewAssessmentEvaluationRequestSchema
]);
type ExecutableAssessmentEvaluationRequest = z.infer<
  typeof ExecutableAssessmentEvaluationRequestSchema
>;
type ExecutablePinnedAssessmentContext =
  | PinnedAssessmentContext
  | PinnedReviewAssessmentContext;

export type AssessmentEvaluationResult =
  | { success: true; issues: []; result: AssessmentResult }
  | { success: false; issues: AssessmentIssue[] };

type CriterionEvaluation = {
  result: AssessmentCriterionResult;
  evidence: AssessmentEvidenceReference[];
  awardedPoints: number;
  deductedPoints: number;
};

function roundHalfUp(numerator: number, denominator: number): number {
  const scaledNumerator = BigInt(numerator);
  const scaledDenominator = BigInt(denominator);
  return Number((scaledNumerator + scaledDenominator / 2n) / scaledDenominator);
}

function evidenceReferenceId(
  rubricItemId: string,
  event?: CanonicalEventEnvelope
) {
  const itemSuffix = rubricItemId.slice("rubric-item.".length);
  return ScoringEvidenceRefIdSchema.parse(
    event === undefined
      ? `scoring-evidence.${itemSuffix}.absence`
      : `scoring-evidence.${itemSuffix}.event-${event.sequence_no}`
  );
}

function eventEvidence(
  rubricItemId: string,
  event: CanonicalEventEnvelope
): AssessmentEvidenceReference {
  return {
    evidence_ref_id: evidenceReferenceId(rubricItemId, event),
    rubric_item_id: rubricItemId,
    evidence_kind: "COMMITTED_EVENT",
    event_id: event.event_id,
    sequence_no: event.sequence_no,
    clinical_time: event.clinical_time,
    event_type: event.event_type,
    ...(event.action_id === undefined ? {} : { action_id: event.action_id })
  } as AssessmentEvidenceReference;
}

function absentEvidence(rubricItemId: string): AssessmentEvidenceReference {
  return {
    evidence_ref_id: evidenceReferenceId(rubricItemId),
    rubric_item_id: rubricItemId,
    evidence_kind: "REQUIRED_EVIDENCE_ABSENT"
  } as AssessmentEvidenceReference;
}

function traceForResolution(input: {
  matchCount: number;
  outsideWindow: boolean;
  sequenceUnsatisfied: boolean;
  repeatLimited: boolean;
  pending: boolean;
  timingWindowExpired: boolean;
}): AssessmentCriterionResult["trace_codes"] {
  const trace: AssessmentCriterionResult["trace_codes"] = [];
  if (input.pending) trace.push("AWAITING_AUTHORITATIVE_EVIDENCE");
  else if (input.matchCount > 0) trace.push("EVIDENCE_MATCHED");
  else if (input.outsideWindow) trace.push("OUTSIDE_CLINICAL_TIME_WINDOW");
  else if (input.sequenceUnsatisfied) trace.push("SEQUENCE_CONSTRAINT_NOT_SATISFIED");
  else trace.push("EVIDENCE_MISSING");
  if (input.timingWindowExpired) trace.push("TIMING_WINDOW_EXPIRED");
  if (input.repeatLimited) trace.push("REPEAT_LIMIT_APPLIED");
  return trace;
}

function evidenceOpportunityClosed(input: {
  evidence: ScoredRubricCriterion["evidence"] | CriticalRubricItem["evidence"];
  assessedThroughClinicalTime: number;
  context: ExecutablePinnedAssessmentContext;
}): boolean {
  if (input.evidence.sequence_constraint !== undefined) return false;
  if (input.evidence.timing_window_id === undefined) return false;
  const timingWindow = input.context.timing_windows.find(
    (timingDefinition) =>
      timingDefinition.timing_window_id === input.evidence.timing_window_id
  );
  if (timingWindow === undefined) return false;
  return timingWindow.end_inclusive
    ? input.assessedThroughClinicalTime > timingWindow.ends_at_clinical_seconds
    : input.assessedThroughClinicalTime >= timingWindow.ends_at_clinical_seconds;
}

function evaluateScoredCriterion(input: {
  criterion: ScoredRubricCriterion;
  domainId: string;
  events: readonly CanonicalEventEnvelope[];
  context: ExecutablePinnedAssessmentContext;
  evaluationPhase: AssessmentEvaluationPhase;
  assessedThroughClinicalTime: number;
}): CriterionEvaluation | AssessmentIssue {
  const timingWindows = new Map(
    input.context.timing_windows.map((timingDefinition) => [
      timingDefinition.timing_window_id,
      timingDefinition
    ])
  );
  const resolved = resolveRubricEvidence(
    input.criterion.evidence,
    input.events,
    timingWindows
  );
  if (!resolved.success) {
    return assessmentIssue({
      code: "TIMING_WINDOW_REFERENCE_INVALID",
      path: "$.compiled_case_package.assessment_rubric",
      message: "Rubric criterion references a timing window absent from its pinned Case Package.",
      related_ids: [input.criterion.rubric_item_id, resolved.missing_timing_window_id]
    });
  }

  const occurrenceLimit = input.criterion.repeat_policy.mode === "ONCE"
    ? 1
    : input.criterion.repeat_policy.maximum_occurrences;
  const matchedEvents = resolved.events.slice(0, occurrenceLimit);
  const repeatLimited = resolved.events.length > occurrenceLimit;
  const timingWindowExpired = evidenceOpportunityClosed({
    evidence: input.criterion.evidence,
    assessedThroughClinicalTime: input.assessedThroughClinicalTime,
    context: input.context
  });
  const pending = matchedEvents.length === 0
    && input.evaluationPhase === "LIVE"
    && !timingWindowExpired;
  const evidence = matchedEvents.length > 0
    ? matchedEvents.map((event) => eventEvidence(input.criterion.rubric_item_id, event))
    : [absentEvidence(input.criterion.rubric_item_id)];
  const awardedPoints = input.criterion.kind === "AWARD"
    ? input.criterion.points * matchedEvents.length
    : 0;
  const deductedPoints = input.criterion.kind === "PENALTY"
    ? input.criterion.points * matchedEvents.length
    : 0;
  return {
    result: {
      rubric_item_id: input.criterion.rubric_item_id,
      domain_id: input.domainId,
      criterion_kind: input.criterion.kind,
      status: pending
        ? "PENDING"
        : input.criterion.kind === "AWARD"
          ? matchedEvents.length > 0 ? "SATISFIED" : "MISSED"
          : matchedEvents.length > 0 ? "TRIGGERED" : "NOT_TRIGGERED",
      awarded_points: awardedPoints,
      deducted_points: deductedPoints,
      occurrence_count: matchedEvents.length,
      evidence_ref_ids: evidence.map((item) => item.evidence_ref_id),
      trace_codes: traceForResolution({
        matchCount: matchedEvents.length,
        outsideWindow: resolved.outside_timing_window,
        sequenceUnsatisfied: resolved.sequence_constraint_unsatisfied,
        repeatLimited,
        pending,
        timingWindowExpired
      })
    } as AssessmentCriterionResult,
    evidence,
    awardedPoints,
    deductedPoints
  };
}

function evaluateCriticalItem(input: {
  item: CriticalRubricItem;
  events: readonly CanonicalEventEnvelope[];
  context: ExecutablePinnedAssessmentContext;
  evaluationPhase: AssessmentEvaluationPhase;
  assessedThroughClinicalTime: number;
}): {
  result: AssessmentCriterionResult;
  evidence: AssessmentEvidenceReference[];
  appliedEffect?: AppliedCriticalEffect;
} | AssessmentIssue {
  const timingWindows = new Map(
    input.context.timing_windows.map((timingDefinition) => [
      timingDefinition.timing_window_id,
      timingDefinition
    ])
  );
  const resolved = resolveRubricEvidence(input.item.evidence, input.events, timingWindows);
  if (!resolved.success) {
    return assessmentIssue({
      code: "TIMING_WINDOW_REFERENCE_INVALID",
      path: "$.compiled_case_package.assessment_rubric.critical_items",
      message: "Critical rubric item references a timing window absent from its pinned Case Package.",
      related_ids: [input.item.rubric_item_id, resolved.missing_timing_window_id]
    });
  }
  const matchedEvent = resolved.events[0];
  const timingWindowExpired = evidenceOpportunityClosed({
    evidence: input.item.evidence,
    assessedThroughClinicalTime: input.assessedThroughClinicalTime,
    context: input.context
  });
  const pending = input.evaluationPhase === "LIVE"
    && matchedEvent === undefined
    && !timingWindowExpired;
  const triggered = !pending && (input.item.kind === "CRITICAL_ACTION"
    ? matchedEvent === undefined
    : matchedEvent !== undefined);
  const evidence = matchedEvent === undefined
    ? [absentEvidence(input.item.rubric_item_id)]
    : [eventEvidence(input.item.rubric_item_id, matchedEvent)];
  const trace = traceForResolution({
    matchCount: matchedEvent === undefined ? 0 : 1,
    outsideWindow: resolved.outside_timing_window,
    sequenceUnsatisfied: resolved.sequence_constraint_unsatisfied,
    repeatLimited: false,
    pending,
    timingWindowExpired
  });
  if (triggered) trace.push("CRITICAL_EFFECT_APPLIED");

  return {
    result: {
      rubric_item_id: input.item.rubric_item_id,
      criterion_kind: input.item.kind,
      status: pending ? "PENDING" : triggered ? "TRIGGERED" : "NOT_TRIGGERED",
      awarded_points: 0,
      deducted_points: 0,
      occurrence_count: matchedEvent === undefined ? 0 : 1,
      evidence_ref_ids: evidence.map((item) => item.evidence_ref_id),
      trace_codes: trace
    } as AssessmentCriterionResult,
    evidence,
    ...(triggered
      ? { appliedEffect: { rubric_item_id: input.item.rubric_item_id, ...input.item.effect } as AppliedCriticalEffect }
      : {})
  };
}

function pinnedIdentityIssues(
  request: ExecutableAssessmentEvaluationRequest,
  context: ExecutablePinnedAssessmentContext
): AssessmentIssue[] {
  const evidence = request.session_evidence;
  const comparisons = [
    ["case_package_id", evidence.case_package_id, context.case_package_id],
    ["case_version_id", evidence.case_version_id, context.case_version_id],
    ["case_version", evidence.case_version, context.case_version],
    ["execution_authority", evidence.execution_authority, context.execution_authority]
  ] as const;
  const issues = comparisons.flatMap(([field, actual, expected]) => actual === expected
    ? []
    : [assessmentIssue({
        code: "PINNED_ASSESSMENT_MISMATCH",
        path: `$.session_evidence.${field}`,
        message: "Session assessment evidence must match the exact compiled Case Package.",
        related_ids: [String(actual), String(expected)]
      })]);
  if (
    evidence.execution_authority === "PUBLISHED_PRODUCTION"
    && context.execution_authority === "PUBLISHED_PRODUCTION"
    && evidence.package_hash !== context.package_hash
  ) {
    issues.push(assessmentIssue({
      code: "PINNED_ASSESSMENT_MISMATCH",
      path: "$.session_evidence.package_hash",
      message: "Session evidence must match the exact compiled Case Package.",
      related_ids: [evidence.package_hash, context.package_hash]
    }));
  }
  if (
    evidence.execution_authority === "REVIEW_ONLY"
    && context.execution_authority === "REVIEW_ONLY"
    && (
      evidence.review_execution_hash !== context.review_execution_hash
      || evidence.review_subject_hash !== context.review_subject_hash
    )
  ) {
    issues.push(assessmentIssue({
      code: "PINNED_ASSESSMENT_MISMATCH",
      path: "$.session_evidence.review_execution_hash",
      message: "Session evidence must match the exact review execution artifact.",
      related_ids: [evidence.review_execution_hash, context.review_execution_hash]
    }));
  }
  return issues;
}

function finalizationBoundaryIssues(input: {
  boundary: AssessmentFinalizationBoundary;
  assessmentId: string;
  evidence: AssessmentEvaluationRequest["session_evidence"];
  context: PinnedAssessmentContext;
}): AssessmentIssue[] {
  const eventSequenceThrough = input.evidence.committed_events.at(-1)?.sequence_no ?? 0;
  const comparisons = [
    ["assessment_id", input.boundary.assessment_id, input.assessmentId],
    ["session_id", input.boundary.session_id, input.evidence.session_id],
    ["case_package_id", input.boundary.case_package_id, input.context.case_package_id],
    ["case_version_id", input.boundary.case_version_id, input.context.case_version_id],
    ["case_version", input.boundary.case_version, input.context.case_version],
    ["package_hash", input.boundary.package_hash, input.context.package_hash],
    ["rubric_id", input.boundary.rubric_id, input.context.rubric_id],
    ["rubric_version", input.boundary.rubric_version, input.context.rubric_version],
    ["rubric_module_hash", input.boundary.rubric_module_hash, input.context.rubric_module_hash],
    ["event_sequence_through", input.boundary.event_sequence_through, eventSequenceThrough],
    [
      "clinical_time_through",
      input.boundary.clinical_time_through,
      input.evidence.assessed_through_clinical_time
    ]
  ] as const;
  return comparisons.flatMap(([field, actual, expected]) => actual === expected
    ? []
    : [assessmentIssue({
        code: "FINALIZATION_BOUNDARY_INVALID",
        path: `$.finalization_boundary.${field}`,
        message: "Trusted finalization must bind the exact authoritative assessment evidence boundary.",
        related_ids: [String(actual), String(expected)]
      })]);
}

/**
 * Deterministically evaluates a compiled Case-owned rubric against only the
 * Session Engine's committed authoritative timeline projection.
 */
export function evaluateAssessment(input: unknown): AssessmentEvaluationResult {
  const request = AssessmentEvaluationRequestSchema.safeParse(input);
  if (!request.success) {
    return {
      success: false,
      issues: assessmentIssuesFromZodError("$.assessment", request.error)
    };
  }

  return evaluateExecutableAssessment(request.data);
}

/** Scores a trusted review Session without granting production authority. */
export function evaluateReviewAssessment(input: unknown): AssessmentEvaluationResult {
  const request = ReviewAssessmentEvaluationRequestSchema.safeParse(input);
  if (!request.success) {
    return {
      success: false,
      issues: assessmentIssuesFromZodError("$.assessment", request.error)
    };
  }
  return evaluateExecutableAssessment(request.data);
}

function evaluateExecutableAssessment(
  requestData: ExecutableAssessmentEvaluationRequest
): AssessmentEvaluationResult {
  const request = ExecutableAssessmentEvaluationRequestSchema.safeParse(requestData);
  if (!request.success) {
    return {
      success: false,
      issues: assessmentIssuesFromZodError("$.assessment", request.error)
    };
  }

  try {
    const pinned = request.data.execution_authority === "PUBLISHED_PRODUCTION"
      ? createPinnedAssessmentContext(request.data.compiled_case_package)
      : createPinnedReviewAssessmentContext(request.data.review_execution_artifact);
    if (!pinned.success) return pinned;
    const identityIssues = pinnedIdentityIssues(request.data, pinned.context);
    if (identityIssues.length > 0) {
      return { success: false, issues: sortAssessmentIssues(identityIssues) };
    }
    if (
      request.data.execution_authority === "PUBLISHED_PRODUCTION"
      && pinned.context.execution_authority === "PUBLISHED_PRODUCTION"
      && request.data.evaluation_phase === "FINAL"
    ) {
      const boundaryIssues = finalizationBoundaryIssues({
        boundary: request.data.finalization_boundary,
        assessmentId: request.data.assessment_id,
        evidence: request.data.session_evidence,
        context: pinned.context
      });
      if (boundaryIssues.length > 0) {
        return { success: false, issues: sortAssessmentIssues(boundaryIssues) };
      }
    }

    const criterionResults: AssessmentCriterionResult[] = [];
    const evidenceRecords: AssessmentEvidenceReference[] = [];
    const domainRaw = new Map<string, {
      awarded: number;
      deducted: number;
      maximum: number;
      weight: number;
    }>();

    for (const domain of pinned.context.rubric.domains) {
      let awarded = 0;
      let deducted = 0;
      let maximum = 0;
      for (const criterion of domain.criteria) {
        if (criterion.kind === "AWARD") {
          maximum += criterion.points * (
            criterion.repeat_policy.mode === "ONCE"
              ? 1
              : criterion.repeat_policy.maximum_occurrences
          );
        }
        const evaluated = evaluateScoredCriterion({
          criterion,
          domainId: domain.domain_code,
          events: request.data.session_evidence.committed_events,
          context: pinned.context,
          evaluationPhase: request.data.evaluation_phase,
          assessedThroughClinicalTime:
            request.data.session_evidence.assessed_through_clinical_time
        });
        if ("code" in evaluated) return { success: false, issues: [evaluated] };
        awarded += evaluated.awardedPoints;
        deducted += evaluated.deductedPoints;
        criterionResults.push(evaluated.result);
        evidenceRecords.push(...evaluated.evidence);
      }
      domainRaw.set(domain.domain_code, {
        awarded,
        deducted,
        maximum,
        weight: domain.weight_basis_points
      });
    }

    const appliedCriticalEffects: AppliedCriticalEffect[] = [];
    for (const item of pinned.context.rubric.critical_items) {
      const evaluated = evaluateCriticalItem({
        item,
        events: request.data.session_evidence.committed_events,
        context: pinned.context,
        evaluationPhase: request.data.evaluation_phase,
        assessedThroughClinicalTime:
          request.data.session_evidence.assessed_through_clinical_time
      });
      if ("code" in evaluated) return { success: false, issues: [evaluated] };
      criterionResults.push(evaluated.result);
      evidenceRecords.push(...evaluated.evidence);
      if (evaluated.appliedEffect !== undefined) {
        appliedCriticalEffects.push(evaluated.appliedEffect);
      }
    }

    const zeroedDomains = new Set(
      appliedCriticalEffects
        .filter((effect) => effect.effect_type === "ZERO_DOMAIN_SCORE")
        .map((effect) => effect.effect_type === "ZERO_DOMAIN_SCORE" ? effect.domain_id : "")
    );
    const domainScores = pinned.context.rubric.domains.map((domain) => {
      const raw = domainRaw.get(domain.domain_code)!;
      const earnedPoints = zeroedDomains.has(domain.domain_code)
        ? 0
        : Math.max(0, raw.awarded - raw.deducted);
      const scoreBasisPoints = roundHalfUp(earnedPoints * 10_000, raw.maximum);
      return {
        domain_id: domain.domain_code,
        earned_points: earnedPoints,
        maximum_points: raw.maximum,
        score_basis_points: scoreBasisPoints,
        weight_basis_points: raw.weight,
        weighted_contribution_basis_points: roundHalfUp(
          scoreBasisPoints * raw.weight,
          10_000
        )
      };
    });

    const weightedScore = Math.min(10_000, domainScores.reduce(
      (total, domain) => total + domain.weighted_contribution_basis_points,
      0
    ));
    const totalPenalty = appliedCriticalEffects.reduce(
      (total, effect) => effect.effect_type === "DEDUCT_OVERALL_SCORE"
        ? total + effect.penalty_basis_points
        : total,
      0
    );
    const cap = appliedCriticalEffects.reduce(
      (current, effect) => effect.effect_type === "CAP_OVERALL_SCORE"
        ? Math.min(current, effect.cap_basis_points)
        : current,
      10_000
    );
    const overallScore = Math.min(cap, Math.max(0, weightedScore - totalPenalty));

    const result = AssessmentResultSchema.safeParse({
      result_schema_version: ASSESSMENT_RESULT_SCHEMA_VERSION,
      trace_version: "1.0",
      assessment_id: request.data.assessment_id,
      session_id: request.data.session_evidence.session_id,
      evaluation_phase: request.data.evaluation_phase,
      case_package_id: pinned.context.case_package_id,
      case_version_id: pinned.context.case_version_id,
      case_version: pinned.context.case_version,
      ...(pinned.context.execution_authority === "PUBLISHED_PRODUCTION"
        ? {
            execution_authority: "PUBLISHED_PRODUCTION" as const,
            package_hash: pinned.context.package_hash
          }
        : {
            execution_authority: "REVIEW_ONLY" as const,
            review_execution_hash: pinned.context.review_execution_hash,
            review_subject_hash: pinned.context.review_subject_hash
          }),
      rubric_id: pinned.context.rubric_id,
      rubric_version: pinned.context.rubric_version,
      rubric_module_schema_version: pinned.context.rubric_module_schema_version,
      rubric_module_hash: pinned.context.rubric_module_hash,
      assessed_through_clinical_time:
        request.data.session_evidence.assessed_through_clinical_time,
      event_sequence_through:
        request.data.session_evidence.committed_events.at(-1)?.sequence_no ?? 0,
      domain_scores: domainScores,
      overall_score_basis_points: overallScore,
      maximum_score_basis_points: 10_000,
      criterion_results: criterionResults,
      evidence_records: evidenceRecords,
      applied_critical_effects: appliedCriticalEffects,
      unsafe: appliedCriticalEffects.some((effect) => effect.effect_type === "MARK_UNSAFE"),
      ...(request.data.evaluation_phase === "FINAL"
        ? { finalization_boundary: request.data.finalization_boundary }
        : {})
    });
    if (!result.success) {
      return {
        success: false,
        issues: [assessmentIssue({
          code: "ASSESSMENT_RESULT_INVALID",
          path: "$.result",
          message: "Deterministic assessment output failed its strict result contract.",
          related_ids: [pinned.context.rubric_id]
        })]
      };
    }
    return { success: true, issues: [], result: result.data };
  } catch {
    return {
      success: false,
      issues: [assessmentIssue({
        code: "ASSESSMENT_EVALUATION_FAILED",
        path: "$.assessment",
        message: "Assessment evaluation failed closed without producing a partial score.",
        related_ids: []
      })]
    };
  }
}
