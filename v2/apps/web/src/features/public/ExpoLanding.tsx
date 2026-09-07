import { Link } from "react-router-dom";

import { useLocalization } from "../../app/localization";
import { AppFrame } from "../../components/AppFrame";
import { StatusBadge } from "../../components/ui";

export function ExpoLanding() {
  const { t } = useLocalization();
  return (
    <AppFrame>
      <div className="expo-page">
        <section className="expo-intro">
          <div>
            <p className="eyebrow">{t("expoLabel")}</p>
            <h1>{t("expoTitle")}</h1>
            <p>{t("expoBody")}</p>
          </div>
          <StatusBadge tone="information">{t("practiceMode")}</StatusBadge>
        </section>
        <div className="expo-route-preview" aria-label={t("visualTitle")}>
          <div className="expo-route-preview__monitor">
            <span>HR</span><strong>—</strong>
            <span>BP</span><strong>— / —</strong>
            <span>SpO₂</span><strong>—</strong>
          </div>
          <div className="expo-route-preview__patient">
            <span className="viewport-grid" aria-hidden="true" />
            <p>{t("visualTitle")}</p>
            <small>{t("visualStatus")}</small>
          </div>
          <div className="expo-route-preview__actions">
            <span>{t("navHistory")}</span>
            <span>{t("navExamination")}</span>
            <span>{t("navInvestigations")}</span>
          </div>
        </div>
        <div className="expo-actions">
          <Link
            className="button button--primary"
            to="/login"
            state={{ returnTo: "/app", entryDefaults: { mode: "PRACTICE_DEMO", patient_language: "en-US" } }}
          >
            {t("loginAction")}
          </Link>
          <p>{t("caseAccessHint")}</p>
        </div>
      </div>
    </AppFrame>
  );
}
