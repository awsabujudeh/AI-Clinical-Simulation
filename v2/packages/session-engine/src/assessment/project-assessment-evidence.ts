import {
  ASSESSMENT_EVIDENCE_SCHEMA_VERSION,
  AssessmentSessionEvidenceSchema,
  type AssessmentSessionEvidence
} from "../../../contracts/src/index.ts";

import { InMemorySessionAggregateSchema } from "../session/in-memory-session.ts";
import {
  createSessionCommandIssue,
  sessionCommandIssuesFromZodError,
  type SessionCommandIssue
} from "../validation/session-command-issues.ts";

export type AssessmentEvidenceProjectionResult =
  | { success: true; issues: []; evidence: AssessmentSessionEvidence }
  | { success: false; issues: SessionCommandIssue[] };

/**
 * Produces the only V2-007A scoring input from a validated authoritative Session.
 * It never accepts raw ActionRequest values or uncommitted Clinical proposals.
 */
export function projectAssessmentEvidenceFromSession(
  sessionInput: unknown
): AssessmentEvidenceProjectionResult {
  const session = InMemorySessionAggregateSchema.safeParse(sessionInput);
  if (!session.success) {
    return {
      success: false,
      issues: sessionCommandIssuesFromZodError(
        "INVALID_SESSION_AGGREGATE",
        "$.session",
        session.error
      )
    };
  }

  const evidence = AssessmentSessionEvidenceSchema.safeParse({
    evidence_schema_version: ASSESSMENT_EVIDENCE_SCHEMA_VERSION,
    authority: "SESSION_ENGINE_COMMITTED_TIMELINE",
    session_id: session.data.session_id,
    session_mode: session.data.mode,
    case_package_id: session.data.pinned_case.case_package_id,
    case_version_id: session.data.pinned_case.case_version_id,
    case_version: session.data.pinned_case.case_version,
    ...(session.data.pinned_case.execution_authority === "PUBLISHED_PRODUCTION"
      ? {
          execution_authority: "PUBLISHED_PRODUCTION" as const,
          package_hash: session.data.pinned_case.package_hash
        }
      : {
          execution_authority: "REVIEW_ONLY" as const,
          review_execution_hash: session.data.pinned_case.review_execution_hash,
          review_subject_hash: session.data.pinned_case.review_subject_hash
        }),
    assessed_through_clinical_time: session.data.patient_state.clinical_time,
    committed_events: session.data.committed_events
  });
  if (!evidence.success) {
    return {
      success: false,
      issues: [createSessionCommandIssue({
        code: "ASSESSMENT_EVIDENCE_PROJECTION_FAILED",
        path: "$.session",
        message: "Authoritative Session data could not form a strict assessment evidence projection."
      })]
    };
  }
  return { success: true, issues: [], evidence: evidence.data };
}
