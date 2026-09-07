import { useLocalization } from "../../app/localization";
import { formatClinicalTime, isSessionMutationEntryEnabled } from "../../app/session-presentation";
import type { AuthSnapshot, SessionPresentationState, StudentUiServices } from "../../app/types";
import { AppFrame } from "../../components/AppFrame";
import { EmptyState, Panel, SectionHeader, StatusBadge } from "../../components/ui";
import { ClinicalActionsPanel } from "../actions/ClinicalActionsPanel";
import { ConnectionBanner } from "./ConnectionBanner";

function PatientHeader({ state }: { state: SessionPresentationState }) {
  const { t } = useLocalization();
  const { projection } = state;
  return (
    <header className="patient-header">
      <div className="patient-header__identity">
        <span className="patient-avatar" aria-hidden="true">P</span>
        <div>
          <p className="eyebrow">{t("patientOverview")}</p>
          <h1>{t("currentPatient")}</h1>
          <div className="patient-header__meta">
            <StatusBadge tone={projection.status === "ACTIVE" ? "positive" : "neutral"}>
              {projection.status === "ACTIVE" ? t("sessionActive") : t("sessionEnded")}
            </StatusBadge>
            <StatusBadge tone={projection.mode === "ASSESSMENT" ? "warning" : "information"}>
              {projection.mode === "ASSESSMENT" ? t("assessmentMode") : t("practiceMode")}
            </StatusBadge>
          </div>
        </div>
      </div>
      <div className="clinical-time" aria-label={t("clinicalTime")}>
        <span>{t("clinicalTime")}</span>
        <strong>{formatClinicalTime(projection.clinical_time)}</strong>
        <small>{projection.clock_status}</small>
      </div>
    </header>
  );
}

function MonitorSlot({ state }: { state: SessionPresentationState }) {
  const { t } = useLocalization();
  const observation = state.projection.observations;
  return (
    <Panel className="monitor-slot" aria-labelledby="monitor-title">
      <SectionHeader id="monitor-title" title={t("monitorTitle")} subtitle={t("monitorSubtitle")} />
      <div className="monitor-grid">
        <div><span>{t("heartRate")}</span><strong>{observation.heart_rate_bpm}</strong><small>bpm</small></div>
        <div><span>{t("bloodPressure")}</span><strong>{observation.systolic_bp_mm_hg}/{observation.diastolic_bp_mm_hg}</strong><small>mmHg</small></div>
        <div><span>{t("respiratoryRate")}</span><strong>{observation.respiratory_rate_per_minute}</strong><small>/min</small></div>
        <div><span>{t("oxygenSaturation")}</span><strong>{observation.spo2_percent}</strong><small>%</small></div>
        {observation.temperature_celsius === undefined ? null : (
          <div><span>{t("temperature")}</span><strong>{observation.temperature_celsius}</strong><small>°C</small></div>
        )}
      </div>
      <dl className="monitor-context">
        <div><dt>{t("rhythm")}</dt><dd>{observation.rhythm.cardiac_rhythm}</dd></div>
        <div><dt>{t("consciousness")}</dt><dd>{observation.consciousness_display_code}</dd></div>
      </dl>
      <p className="monitor-disclaimer">{state.kind === "ACTIVE_STALE" ? t("staleDescription") : t("connectionOnline")}</p>
    </Panel>
  );
}

export function VisualPatientSlot() {
  const { t } = useLocalization();
  return (
    <Panel className="visual-patient-slot" aria-labelledby="visual-patient-title">
      <span className="viewport-grid" aria-hidden="true" />
      <div className="visual-patient-slot__status">
        <StatusBadge tone="neutral">{t("visualStatus")}</StatusBadge>
        <StatusBadge tone="information">{t("visualFallback")}</StatusBadge>
      </div>
      <div className="visual-patient-slot__content">
        <span className="visual-patient-slot__mark" aria-hidden="true">VP</span>
        <h2 id="visual-patient-title">{t("visualTitle")}</h2>
        <p>{t("visualBody")}</p>
      </div>
    </Panel>
  );
}

function InvestigationSlot() {
  const { t } = useLocalization();
  return (
    <Panel className="investigation-slot" aria-labelledby="investigation-title">
      <SectionHeader id="investigation-title" title={t("investigationsTitle")} />
      <EmptyState title={t("investigationsTitle")} body={t("investigationsBody")} />
    </Panel>
  );
}

function TimelineStatusSlot({ state }: { state: SessionPresentationState }) {
  const { t } = useLocalization();
  return (
    <Panel className="timeline-slot" aria-labelledby="timeline-title">
      <SectionHeader id="timeline-title" title={t("timelineTitle")} subtitle={t("timelineBody")} />
      <div className="timeline-metadata">
        <span>{t("eventSequence")}</span>
        <strong>{state.projection.event_sequence_through}</strong>
      </div>
    </Panel>
  );
}

export function SimulationWorkspace({
  services,
  auth,
  state,
  onAuthoritativeRefresh
}: {
  services: StudentUiServices;
  auth: Extract<AuthSnapshot, { status: "AUTHENTICATED" }>;
  state: SessionPresentationState;
  onAuthoritativeRefresh(): Promise<unknown>;
}) {
  const enabled = isSessionMutationEntryEnabled(state);
  return (
    <AppFrame auth={auth} onSignOut={services.auth.signOut === undefined ? undefined : () => void services.auth.signOut?.()}>
      <div className={`simulation-workspace simulation-workspace--${state.kind.toLowerCase()}`}>
        <ConnectionBanner state={state} />
        <PatientHeader state={state} />
        <div className="workspace-grid">
          <MonitorSlot state={state} />
          <VisualPatientSlot />
          <ClinicalActionsPanel
            services={services}
            auth={auth}
            state={state}
            enabled={enabled}
            onAuthoritativeRefresh={onAuthoritativeRefresh}
          />
          <InvestigationSlot />
          <TimelineStatusSlot state={state} />
        </div>
      </div>
    </AppFrame>
  );
}
