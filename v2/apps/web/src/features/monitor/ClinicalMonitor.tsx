import { useLocalization } from "../../app/localization";
import type { SessionPresentationState } from "../../app/types";
import { Panel, SectionHeader, StatusBadge } from "../../components/ui";
import { observationDescriptorLabel } from "./monitor-model";

export function ClinicalMonitor({ state }: { state: SessionPresentationState }) {
  const { locale, t } = useLocalization();
  const observation = state.projection.observations;
  const stale = state.mutation_authority === "NONE";
  return (
    <Panel className={`monitor-slot${stale ? " monitor-slot--stale" : ""}`} aria-labelledby="monitor-title">
      <SectionHeader
        id="monitor-title"
        title={t("monitorTitle")}
        subtitle={t("monitorSubtitle")}
        action={(
          <StatusBadge tone={stale ? "warning" : "positive"}>
            {stale ? t("monitorStale") : t("monitorCurrent")}
          </StatusBadge>
        )}
      />
      <div className="monitor-grid" aria-label={t("monitorVitals")}>
        <div><span>{t("heartRate")}</span><strong>{observation.heart_rate_bpm}</strong><small dir="ltr">bpm</small></div>
        <div><span>{t("bloodPressure")}</span><strong dir="ltr">{observation.systolic_bp_mm_hg}/{observation.diastolic_bp_mm_hg}</strong><small dir="ltr">mmHg</small></div>
        <div><span>{t("respiratoryRate")}</span><strong>{observation.respiratory_rate_per_minute}</strong><small dir="ltr">/min</small></div>
        <div><span>{t("oxygenSaturation")}</span><strong>{observation.spo2_percent}</strong><small dir="ltr">%</small></div>
        {observation.temperature_celsius === undefined ? null : (
          <div><span>{t("temperature")}</span><strong>{observation.temperature_celsius}</strong><small dir="ltr">°C</small></div>
        )}
      </div>
      <dl className="monitor-context">
        <div>
          <dt>{t("rhythm")}</dt>
          <dd>{observationDescriptorLabel("rhythm", observation.rhythm.cardiac_rhythm, locale)}</dd>
        </div>
        <div>
          <dt>{t("consciousness")}</dt>
          <dd>{observationDescriptorLabel("consciousness", observation.consciousness_display_code, locale)}</dd>
        </div>
      </dl>
      <p className="monitor-disclaimer" role="status">
        {stale ? t("staleDescription") : t("monitorNoWaveform")}
      </p>
    </Panel>
  );
}
