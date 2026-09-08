import { useQuery } from "@tanstack/react-query";

import { useLocalization } from "../../app/localization";
import { formatClinicalTime } from "../../app/session-presentation";
import type { SessionPresentationState, StudentTimelineService } from "../../app/types";
import { Panel, SectionHeader, StatusBadge } from "../../components/ui";
import { learnerLocalizedText } from "./timeline-model";

export function LearnerTimeline({
  state,
  service
}: {
  state: SessionPresentationState;
  service: StudentTimelineService;
}) {
  const { locale, t } = useLocalization();
  const current = state.mutation_authority === "SERVER_ONLY";
  const timeline = useQuery({
    queryKey: [
      "learner-timeline",
      state.projection.session_id,
      state.projection.event_sequence_through
    ],
    queryFn: () => service.load(state.projection.session_id),
    enabled: current,
    retry: false,
    refetchOnWindowFocus: false
  });

  let content;
  if (!current) {
    content = <p className="surface-state" role="status">{t("timelineStaleUnavailable")}</p>;
  } else if (timeline.isPending) {
    content = <p className="surface-state" role="status">{t("timelineLoading")}</p>;
  } else if (timeline.isError || timeline.data.kind !== "AVAILABLE") {
    content = <p className="surface-state surface-state--error" role="alert">{t("timelineUnavailable")}</p>;
  } else if (timeline.data.projection.items.length === 0) {
    content = <p className="surface-state" role="status">{t("timelineEmpty")}</p>;
  } else {
    content = (
      <ol className="learner-timeline">
        {timeline.data.projection.items.map((item) => (
          <li key={item.event_id}>
            <div className="timeline-sequence" aria-label={`${t("eventSequence")} ${item.sequence_no}`}>
              {item.sequence_no}
            </div>
            <div>
              <strong>{learnerLocalizedText(item.labels, locale) ?? t("timelineCommittedActivity")}</strong>
              <span>{t("clinicalTimeShort")} <b dir="ltr">{formatClinicalTime(item.clinical_time)}</b></span>
            </div>
            <StatusBadge tone="neutral">{t("timelineCommitted")}</StatusBadge>
          </li>
        ))}
      </ol>
    );
  }

  return (
    <Panel className="timeline-slot" aria-labelledby="timeline-title">
      <SectionHeader
        id="timeline-title"
        title={t("timelineTitle")}
        subtitle={t("timelineSafeSubtitle")}
      />
      {content}
    </Panel>
  );
}
