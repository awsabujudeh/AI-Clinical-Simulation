import { useLocalization } from "../../app/localization";
import type { SessionPresentationState } from "../../app/types";
import { Panel, SectionHeader, StatusBadge } from "../../components/ui";
import { observationDescriptorLabel } from "./monitor-model";
import { formatClinicalTime } from "../../app/session-presentation";
import type { ObservationChannel } from "@ai-clinical-simulation/contracts";

export function ClinicalMonitor({ state }: { state: SessionPresentationState }) {
  const { locale, t } = useLocalization();
  const observation = state.projection.observations;
  const stale = state.mutation_authority === "NONE";
  const acquired = (ch:ObservationChannel) => observation.acquired.find(a=>a.measurement.channel===ch);
  const value = (ch:ObservationChannel) => {
    const m=acquired(ch)?.measurement;
    return !m ? "—" : m.channel==="BP" ? `${m.systolic}/${m.diastolic}` : m.value;
  };
  const stamp = (ch:ObservationChannel) => {
    const a=acquired(ch);
    return a ? `${a.status} · ${formatClinicalTime(a.sampled_at)}` : (locale==="ar-JO"?"لم تُقَس":"Not measured");
  };
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
        {([ ["HR","heartRate","bpm"],["BP","bloodPressure","mmHg"],["RR","respiratoryRate","/min"],["SPO2","oxygenSaturation","%"],["TEMPERATURE","temperature","°C"] ] as const).map(([ch,label,unit])=>
          <div key={ch} data-observation={ch}><span>{t(label)}</span><strong dir="ltr">{value(ch)}</strong><small dir="ltr">{unit}</small><small>{stamp(ch)}</small></div>)}
      </div>
      <dl className="monitor-context">
        <div>
          <dt>{t("rhythm")}</dt>
          <dd>{acquired("RHYTHM") ? observationDescriptorLabel("rhythm",String(value("RHYTHM")),locale) : "—"}</dd>
        </div>
        <div>
          <dt>{t("consciousness")}</dt>
          <dd>{acquired("CONSCIOUSNESS") ? observationDescriptorLabel("consciousness",String(value("CONSCIOUSNESS")),locale) : "—"}</dd>
        </div>
      </dl>
      <p className="monitor-disclaimer" role="status">
        {stale ? t("staleDescription") : t("monitorNoWaveform")}
      </p>
    </Panel>
  );
}
