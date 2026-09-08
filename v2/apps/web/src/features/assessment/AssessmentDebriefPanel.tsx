import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";

import { useLocalization } from "../../app/localization";
import { formatClinicalTime } from "../../app/session-presentation";
import type {
  AuthSnapshot,
  SessionPresentationState,
  StudentAssessmentService,
  StudentFinalizationService
} from "../../app/types";
import { Button, Panel, SectionHeader, StatusBadge } from "../../components/ui";
import { learnerLocalizedText } from "../timeline/timeline-model";
import { assessmentFindingLabel, formatBasisPoints } from "./assessment-model";

type EndPhase = "IDLE" | "SUBMITTING" | "IN_DOUBT" | "FAILED";

export function AssessmentDebriefPanel({
  state,
  auth,
  assessmentService,
  finalizationService,
  onAuthoritativeRefresh
}: {
  state: SessionPresentationState;
  auth: Extract<AuthSnapshot, { status: "AUTHENTICATED" }>;
  assessmentService: StudentAssessmentService;
  finalizationService: StudentFinalizationService;
  onAuthoritativeRefresh(): Promise<unknown>;
}) {
  const { locale, t } = useLocalization();
  const [endPhase, setEndPhase] = useState<EndPhase>("IDLE");
  const ending = useRef(false);
  const current = state.mutation_authority === "SERVER_ONLY";
  const ended = state.projection.status === "ENDED";
  const assessment = useQuery({
    queryKey: [
      "learner-assessment",
      state.projection.session_id,
      state.projection.event_sequence_through,
      state.projection.status
    ],
    queryFn: () => assessmentService.load(state.projection.session_id),
    enabled: ended && current,
    retry: false,
    refetchOnWindowFocus: false
  });

  async function finalize() {
    if (ending.current || !current || ended) return;
    ending.current = true;
    setEndPhase("SUBMITTING");
    const result = await finalizationService.end({
      principal_user_id: auth.principal_user_id,
      session_id: state.projection.session_id,
      expected_state_version: state.projection.state_version,
      connectivity_state: "ONLINE"
    });
    if (result.kind === "COMMITTED") {
      await onAuthoritativeRefresh();
      setEndPhase("IDLE");
    } else if (result.kind === "IN_DOUBT" || result.kind === "STALE") {
      setEndPhase("IN_DOUBT");
      await onAuthoritativeRefresh();
    } else {
      setEndPhase("FAILED");
    }
    ending.current = false;
  }

  let content;
  if (!ended) {
    const disclosure = state.projection.assessment_disclosure;
    content = disclosure?.projection_type === "ACTIVE_PRACTICE_FEEDBACK"
      ? (
          <div className="assessment-active">
            <StatusBadge tone="information">{t("practiceMode")}</StatusBadge>
            <p>{t("practiceFeedbackBoundary")}</p>
            {disclosure.resolved_findings.length === 0 ? (
              <p className="surface-state">{t("practiceNoFindings")}</p>
            ) : (
              <ul className="practice-findings">
                {disclosure.resolved_findings.map((finding) => (
                  <li key={finding.finding_id}>
                    <strong>{assessmentFindingLabel(finding.category, locale)}</strong>
                    {finding.evidence.map((evidence) => (
                      <span key={evidence.event_id}>{t("clinicalTimeShort")} <b dir="ltr">{formatClinicalTime(evidence.clinical_time)}</b></span>
                    ))}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )
      : (
          <div className="assessment-active">
            <StatusBadge tone="warning">{t("assessmentInProgress")}</StatusBadge>
            <p>{t("assessmentWithheld")}</p>
          </div>
        );
  } else if (!current) {
    content = <p className="surface-state" role="status">{t("assessmentStaleUnavailable")}</p>;
  } else if (assessment.isPending) {
    content = <p className="surface-state" role="status">{t("assessmentLoading")}</p>;
  } else if (assessment.isError || assessment.data.kind !== "AVAILABLE") {
    content = <p className="surface-state surface-state--error" role="alert">{t("assessmentUnavailable")}</p>;
  } else if (assessment.data.projection.assessment_status !== "FINAL") {
    content = <p className="surface-state" role="status">{t("assessmentNotFinal")}</p>;
  } else {
    const result = assessment.data.projection;
    content = (
      <div className="final-assessment">
        <div className="final-assessment__summary">
          <div><span>{t("overallScore")}</span><strong>{formatBasisPoints(result.overall_score_basis_points)}</strong></div>
          <StatusBadge tone={result.unsafe ? "critical" : "neutral"}>
            {result.unsafe ? t("assessmentUnsafe") : t("assessmentComplete")}
          </StatusBadge>
        </div>
        <section aria-labelledby="domain-scores-title">
          <h3 id="domain-scores-title">{t("domainScores")}</h3>
          <div className="domain-score-grid">
            {result.domain_scores.map((domain) => (
              <article key={domain.domain_id}>
                <span>{learnerLocalizedText(domain.labels, locale) ?? t("assessmentDomain")}</span>
                <strong>{formatBasisPoints(domain.score_basis_points)}</strong>
              </article>
            ))}
          </div>
        </section>
        <section aria-labelledby="debrief-title">
          <h3 id="debrief-title">{t("debriefTitle")}</h3>
          {result.findings.length === 0 ? (
            <p className="surface-state">{t("debriefEmpty")}</p>
          ) : (
            <ul className="debrief-findings">
              {result.findings.map((finding) => (
                <li key={finding.finding_id}>
                  <strong>{assessmentFindingLabel(finding.category, locale)}</strong>
                  {finding.evidence.length === 0 ? null : (
                    <span>
                      {t("evidenceAt")} {finding.evidence.map((evidence) => formatClinicalTime(evidence.clinical_time)).join(", ")}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    );
  }

  const canFinalize = !ended
    && current
    && state.kind === "ACTIVE_ONLINE"
    && state.projection.pinned_case.execution_authority === "PUBLISHED_PRODUCTION"
    && endPhase !== "IN_DOUBT";

  return (
    <Panel className="assessment-slot" aria-labelledby="assessment-title">
      <SectionHeader
        id="assessment-title"
        title={t("assessmentTitle")}
        subtitle={ended ? t("assessmentFinalSubtitle") : t("assessmentActiveSubtitle")}
        action={canFinalize ? (
          <Button type="button" disabled={ending.current} onClick={() => void finalize()}>
            {endPhase === "SUBMITTING" ? t("endingSimulation") : t("endSimulation")}
          </Button>
        ) : undefined}
      />
      {endPhase === "IN_DOUBT" ? <p className="surface-state" role="status">{t("finalizationInDoubt")}</p> : null}
      {endPhase === "FAILED" ? <p className="surface-state surface-state--error" role="alert">{t("finalizationFailed")}</p> : null}
      {content}
    </Panel>
  );
}
