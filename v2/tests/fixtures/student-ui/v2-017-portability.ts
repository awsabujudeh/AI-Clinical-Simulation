import {
  SafeFinalAssessmentProjectionSchema,
  SafeLearnerTimelineProjectionSchema
} from "../../../packages/contracts/src/index.ts";

const timeline = {
  timeline_schema_version: "1.0",
  session_id: "session.v2-017-portability",
  event_sequence_through: 2,
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
      event_id: "00000000-0000-4000-8000-000000000002",
      sequence_no: 2,
      clinical_time: 45,
      item_type: "ACTION_COMMITTED",
      labels: [
        { locale: "ar-JO", text: "إجراء اصطناعي" },
        { locale: "en-US", text: "Synthetic action" }
      ],
      action_id: "examination.synthetic-check"
    }
  ]
} as const;

const domains = ["history", "examination", "diagnostics", "management", "reasoning", "disposition"];

const assessment = {
  assessment_id: "assessment.v2-017-portability",
  session_id: "session.v2-017-portability",
  assessment_status: "FINAL",
  overall_score_basis_points: 7500,
  maximum_score_basis_points: 10000,
  unsafe: false,
  assessed_through_clinical_time: 45,
  event_sequence_through: 2,
  domain_scores: domains.map((domain, index) => ({
    domain_id: `domain.synthetic-${domain}`,
    labels: [
      { locale: "ar-JO", text: `مجال اصطناعي ${index + 1}` },
      { locale: "en-US", text: `Synthetic domain ${index + 1}` }
    ],
    score_basis_points: 7500,
    weight_basis_points: index === 5 ? 1665 : 1667,
    weighted_contribution_basis_points: 1250
  })),
  findings: []
} as const;

export function createV2017PortabilitySnapshot() {
  return {
    timeline: SafeLearnerTimelineProjectionSchema.parse(timeline),
    assessment: SafeFinalAssessmentProjectionSchema.parse(assessment)
  };
}

export const V2_017_PORTABILITY_EXPECTED =
  '{"timeline":{"timeline_schema_version":"1.0","session_id":"session.v2-017-portability","event_sequence_through":2,"items":[{"event_id":"00000000-0000-4000-8000-000000000001","sequence_no":1,"clinical_time":0,"item_type":"SESSION_STARTED","labels":[{"locale":"ar-JO","text":"بدأت الجلسة"},{"locale":"en-US","text":"Session started"}]},{"event_id":"00000000-0000-4000-8000-000000000002","sequence_no":2,"clinical_time":45,"item_type":"ACTION_COMMITTED","labels":[{"locale":"ar-JO","text":"إجراء اصطناعي"},{"locale":"en-US","text":"Synthetic action"}],"action_id":"examination.synthetic-check"}]},"assessment":{"assessment_id":"assessment.v2-017-portability","session_id":"session.v2-017-portability","assessment_status":"FINAL","overall_score_basis_points":7500,"maximum_score_basis_points":10000,"unsafe":false,"assessed_through_clinical_time":45,"event_sequence_through":2,"domain_scores":[{"domain_id":"domain.synthetic-history","labels":[{"locale":"ar-JO","text":"مجال اصطناعي 1"},{"locale":"en-US","text":"Synthetic domain 1"}],"score_basis_points":7500,"weight_basis_points":1667,"weighted_contribution_basis_points":1250},{"domain_id":"domain.synthetic-examination","labels":[{"locale":"ar-JO","text":"مجال اصطناعي 2"},{"locale":"en-US","text":"Synthetic domain 2"}],"score_basis_points":7500,"weight_basis_points":1667,"weighted_contribution_basis_points":1250},{"domain_id":"domain.synthetic-diagnostics","labels":[{"locale":"ar-JO","text":"مجال اصطناعي 3"},{"locale":"en-US","text":"Synthetic domain 3"}],"score_basis_points":7500,"weight_basis_points":1667,"weighted_contribution_basis_points":1250},{"domain_id":"domain.synthetic-management","labels":[{"locale":"ar-JO","text":"مجال اصطناعي 4"},{"locale":"en-US","text":"Synthetic domain 4"}],"score_basis_points":7500,"weight_basis_points":1667,"weighted_contribution_basis_points":1250},{"domain_id":"domain.synthetic-reasoning","labels":[{"locale":"ar-JO","text":"مجال اصطناعي 5"},{"locale":"en-US","text":"Synthetic domain 5"}],"score_basis_points":7500,"weight_basis_points":1667,"weighted_contribution_basis_points":1250},{"domain_id":"domain.synthetic-disposition","labels":[{"locale":"ar-JO","text":"مجال اصطناعي 6"},{"locale":"en-US","text":"Synthetic domain 6"}],"score_basis_points":7500,"weight_basis_points":1665,"weighted_contribution_basis_points":1250}],"findings":[]}}' as const;
