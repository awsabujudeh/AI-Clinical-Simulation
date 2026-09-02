import { z } from "zod";

import {
  ASSESSMENT_DISCLOSURE_SCHEMA_VERSION,
  AssessmentDisclosureProjectionSchema,
  AssessmentResultSchema,
  FeedbackFindingIdSchema,
  TrustedAssessmentDisclosureContextSchema,
  type AssessmentDisclosureProjection,
  type AssessmentEvidenceReference,
  type AssessmentResult,
  type ResolvedPracticeFinding
} from "../../../contracts/src/index.ts";

import { createDebriefEvidencePackage } from "../debrief/create-debrief-evidence.ts";
import {
  assessmentIssue,
  assessmentIssuesFromZodError,
  type AssessmentIssue
} from "../validation/assessment-issues.ts";

export const AssessmentDisclosureRequestSchema = z.strictObject({
  assessment_result: AssessmentResultSchema,
  disclosure_context: TrustedAssessmentDisclosureContextSchema
});

export type AssessmentDisclosureResult =
  | { success: true; issues: []; projection: AssessmentDisclosureProjection }
  | { success: false; issues: AssessmentIssue[] };

function practiceFindingCategory(
  criterion: AssessmentResult["criterion_results"][number]
): ResolvedPracticeFinding["category"] | undefined {
  if (criterion.status === "PENDING" || criterion.status === "NOT_TRIGGERED") {
    return undefined;
  }
  if (criterion.criterion_kind === "AWARD") {
    if (criterion.status === "SATISFIED") return "CORRECT_ACTION";
    return criterion.trace_codes.includes("OUTSIDE_CLINICAL_TIME_WINDOW")
      ? "IMPORTANT_DELAY"
      : "MISSED_OPPORTUNITY";
  }
  return "UNSAFE_ACTION";
}

function resolvedPracticeFindings(result: AssessmentResult): ResolvedPracticeFinding[] {
  const evidenceById = new Map<string, AssessmentEvidenceReference>(
    result.evidence_records.map((evidence) => [evidence.evidence_ref_id, evidence])
  );
  const findings: ResolvedPracticeFinding[] = [];
  for (const criterion of result.criterion_results) {
    const category = practiceFindingCategory(criterion);
    if (category === undefined) continue;
    const ordinal = findings.length + 1;
    findings.push({
      finding_id: FeedbackFindingIdSchema.parse(
        `finding:${result.assessment_id}:${ordinal}`
      ),
      category,
      resolution: "RESOLVED",
      evidence: criterion.evidence_ref_ids.flatMap((referenceId) => {
        const evidence = evidenceById.get(referenceId);
        return evidence?.evidence_kind === "COMMITTED_EVENT"
          ? [{
              event_id: evidence.event_id,
              sequence_no: evidence.sequence_no,
              clinical_time: evidence.clinical_time,
              ...(evidence.action_id === undefined ? {} : { action_id: evidence.action_id })
            }]
          : [];
      })
    });
  }
  return findings;
}

/** Projects internal assessment truth into a structurally safe learner boundary. */
export function projectAssessmentDisclosure(input: unknown): AssessmentDisclosureResult {
  const request = AssessmentDisclosureRequestSchema.safeParse(input);
  if (!request.success) {
    return {
      success: false,
      issues: assessmentIssuesFromZodError("$.disclosure", request.error)
    };
  }
  const { assessment_result: result, disclosure_context: context } = request.data;
  if (context.assessment_id !== result.assessment_id || context.session_id !== result.session_id) {
    return {
      success: false,
      issues: [assessmentIssue({
        code: "DISCLOSURE_PROVENANCE_MISMATCH",
        path: "$.disclosure_context",
        message: "Disclosure authority must bind the exact Assessment and Session result.",
        related_ids: [context.assessment_id, context.session_id]
      })]
    };
  }

  let projectionInput: z.input<typeof AssessmentDisclosureProjectionSchema>;
  if (context.disclosure_phase === "ACTIVE") {
    if (result.evaluation_phase !== "LIVE") {
      return {
        success: false,
        issues: [assessmentIssue({
          code: "DISCLOSURE_CONTEXT_INVALID",
          path: "$.disclosure_context.disclosure_phase",
          message: "Active disclosure requires a live internal Assessment Result.",
          related_ids: [result.assessment_id]
        })]
      };
    }
    projectionInput = context.session_mode === "ASSESSMENT"
      ? {
          projection_schema_version: ASSESSMENT_DISCLOSURE_SCHEMA_VERSION,
          projection_type: "ACTIVE_ASSESSMENT_WITHHELD",
          assessment_id: result.assessment_id,
          session_id: result.session_id,
          session_mode: "ASSESSMENT",
          assessment_status: "ACTIVE"
        }
      : {
          projection_schema_version: ASSESSMENT_DISCLOSURE_SCHEMA_VERSION,
          projection_type: "ACTIVE_PRACTICE_FEEDBACK",
          assessment_id: result.assessment_id,
          session_id: result.session_id,
          session_mode: "PRACTICE_DEMO",
          assessment_status: "ACTIVE",
          resolved_findings: resolvedPracticeFindings(result)
        };
  } else {
    const debrief = createDebriefEvidencePackage(result);
    if (!debrief.success) return debrief;
    projectionInput = {
      projection_schema_version: ASSESSMENT_DISCLOSURE_SCHEMA_VERSION,
      projection_type: "FINAL_DEBRIEF",
      assessment_id: result.assessment_id,
      session_id: result.session_id,
      session_mode: context.session_mode,
      assessment_status: "FINAL",
      debrief_evidence: debrief.evidence
    };
  }

  const projection = AssessmentDisclosureProjectionSchema.safeParse(projectionInput);
  if (!projection.success) {
    return {
      success: false,
      issues: [assessmentIssue({
        code: "DISCLOSURE_CONTEXT_INVALID",
        path: "$.disclosure",
        message: "Assessment disclosure failed closed without returning a partial projection.",
        related_ids: [result.assessment_id]
      })]
    };
  }
  return { success: true, issues: [], projection: projection.data };
}
