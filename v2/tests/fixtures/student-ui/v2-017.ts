import {
  SafeFinalAssessmentProjectionSchema,
  SafeLearnerTimelineProjectionSchema,
  SafeSessionProjectionSchema
} from "../../../packages/contracts/src/index.ts";
import {
  SYNTHETIC_ASSESSMENT_SESSION,
  SYNTHETIC_SAFE_SESSION
} from "./safe-session.ts";

export const SYNTHETIC_LEARNER_TIMELINE = SafeLearnerTimelineProjectionSchema.parse({
  timeline_schema_version: "1.0",
  session_id: SYNTHETIC_SAFE_SESSION.session_id,
  event_sequence_through: 7,
  items: [
    {
      event_id: "00000000-0000-4000-8000-000000000001",
      sequence_no: 1,
      clinical_time: 0,
      item_type: "SESSION_STARTED",
      labels: [
        { locale: "ar-JO", text: "بدأت الجلسة" },
        { locale: "en-US", text: "Session started" }
      ]
    },
    {
      event_id: "00000000-0000-4000-8000-000000000007",
      sequence_no: 7,
      clinical_time: 125,
      item_type: "ACTION_COMMITTED",
      action_id: "examination.synthetic-check",
      labels: [
        { locale: "ar-JO", text: "إجراء فحص اصطناعي" },
        { locale: "en-US", text: "Perform synthetic examination" }
      ]
    }
  ]
});

export const SYNTHETIC_ENDED_ASSESSMENT_SESSION = SafeSessionProjectionSchema.parse({
  ...SYNTHETIC_ASSESSMENT_SESSION,
  status: "ENDED",
  clock_status: "PAUSED",
  assessment_disclosure: undefined
});

const domainDefinitions = [
  ["domain.synthetic-history", "القصة المرضية", "History", 7800],
  ["domain.synthetic-examination", "الفحص", "Examination", 7200],
  ["domain.synthetic-diagnostics", "الاستقصاءات", "Diagnostics", 6800],
  ["domain.synthetic-management", "التدبير", "Management", 7400],
  ["domain.synthetic-reasoning", "الاستدلال السريري", "Clinical reasoning", 7000],
  ["domain.synthetic-disposition", "الخطة النهائية", "Disposition", 7600]
] as const;

export const SYNTHETIC_FINAL_ASSESSMENT = SafeFinalAssessmentProjectionSchema.parse({
  assessment_id: "assessment.ui-final",
  session_id: SYNTHETIC_ENDED_ASSESSMENT_SESSION.session_id,
  assessment_status: "FINAL",
  overall_score_basis_points: 7317,
  maximum_score_basis_points: 10000,
  unsafe: false,
  assessed_through_clinical_time: 125,
  event_sequence_through: 7,
  domain_scores: domainDefinitions.map(([domain_id, ar, en, score]) => ({
    domain_id,
    labels: [
      { locale: "ar-JO", text: ar },
      { locale: "en-US", text: en }
    ],
    score_basis_points: score,
    weight_basis_points: 1667,
    weighted_contribution_basis_points: Math.floor(score / 6)
  })),
  findings: [
    {
      finding_id: "finding.ui-final.1",
      category: "CORRECT_ACTION",
      resolution: "RESOLVED",
      evidence: [
        {
          event_id: "00000000-0000-4000-8000-000000000007",
          sequence_no: 7,
          clinical_time: 125,
          action_id: "examination.synthetic-check"
        }
      ]
    }
  ]
});
