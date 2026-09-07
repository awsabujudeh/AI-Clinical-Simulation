import { useLocalization } from "../../app/localization";
import type { SessionPresentationState } from "../../app/types";

export function ConnectionBanner({ state }: { state: SessionPresentationState }) {
  const { t } = useLocalization();
  const configuration = state.kind === "ACTIVE_STALE"
    ? { tone: "critical", title: t("connectionOffline"), body: t("staleDescription") }
    : state.kind === "RECOVERING"
      ? { tone: "warning", title: t("connectionRecovering"), body: t("staleDescription") }
      : state.kind === "SYNC_REQUIRED"
        ? { tone: "warning", title: t("connectionSync"), body: t("stateChangedBody") }
        : { tone: "positive", title: t("connectionOnline"), body: undefined };
  const requestCopy = state.request_status === "IN_DOUBT"
    ? t("requestInDoubt")
    : state.request_status === "STALE_NOT_EXECUTED"
      ? t("requestStale")
      : undefined;
  return (
    <div
      className={`connection-banner connection-banner--${configuration.tone}`}
      role={configuration.tone === "positive" ? "status" : "alert"}
      aria-live="polite"
    >
      <span className="connection-banner__icon" aria-hidden="true" />
      <div>
        <strong>{configuration.title}</strong>
        {configuration.body === undefined ? null : <p>{configuration.body}</p>}
        {requestCopy === undefined ? null : <p>{requestCopy}</p>}
      </div>
    </div>
  );
}
