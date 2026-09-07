import {
  PatientLanguageSchema,
  SessionIdSchema,
  StartSessionRequestSchema,
  type SessionMode
} from "@ai-clinical-simulation/contracts";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { useLocalization } from "../../app/localization";
import type {
  AuthSnapshot,
  SessionEntryDefaults,
  StudentUiServices
} from "../../app/types";
import { AppFrame } from "../../components/AppFrame";
import { Button, Panel, StatusBadge } from "../../components/ui";

const DEFAULTS: SessionEntryDefaults = {
  mode: "PRACTICE_DEMO",
  patient_language: "en-US" as ReturnType<typeof PatientLanguageSchema.parse>
};

export function SessionEntryPage({
  services,
  auth,
  defaults = DEFAULTS
}: {
  services: StudentUiServices;
  auth: Extract<AuthSnapshot, { status: "AUTHENTICATED" }>;
  defaults?: SessionEntryDefaults;
}) {
  const { t } = useLocalization();
  const navigate = useNavigate();
  const [caseAccessCode, setCaseAccessCode] = useState("");
  const [resumeSessionId, setResumeSessionId] = useState("");
  const [mode, setMode] = useState<SessionMode>(defaults.mode);
  const [patientLanguage, setPatientLanguage] = useState(defaults.patient_language);
  const [formIssue, setFormIssue] = useState<string | undefined>();
  const start = useMutation({
    mutationFn: services.sessions.start,
    onSuccess: (result) => {
      if (result.success) {
        navigate(`/sessions/${encodeURIComponent(result.projection.session_id)}`);
        return;
      }
      setFormIssue(
        result.kind === "CONFLICT" ? t("stateChangedBody")
          : result.kind === "NOT_FOUND" ? t("notFoundBody")
            : result.kind === "UNAUTHORIZED" || result.kind === "UNAUTHENTICATED"
              ? t("unauthorizedBody")
              : result.kind === "IN_DOUBT" ? t("requestInDoubt")
                : result.kind === "INVALID" ? t("invalidRequestBody")
                  : t("unavailableBody")
      );
    },
    onError: () => setFormIssue(t("unavailableBody"))
  });
  function submitStart(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormIssue(undefined);
    const parsed = StartSessionRequestSchema.safeParse({
      case_id: caseAccessCode.trim(),
      patient_language: patientLanguage,
      mode,
      client_capabilities: {
        supports_static_visual_fallback: true,
        supports_audio: false
      }
    });
    if (!parsed.success) {
      setFormIssue(t("invalidRequestBody"));
      return;
    }
    start.mutate(parsed.data);
  }
  function submitResume(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = SessionIdSchema.safeParse(resumeSessionId.trim());
    if (!parsed.success) {
      setFormIssue(t("invalidSessionBody"));
      return;
    }
    navigate(`/sessions/${encodeURIComponent(parsed.data)}`);
  }
  return (
    <AppFrame auth={auth} onSignOut={services.auth.signOut === undefined ? undefined : () => void services.auth.signOut?.()}>
      <div className="entry-page">
        <header className="entry-header">
          <div>
            <p className="eyebrow">{t("patientOverview")}</p>
            <h1>{t("homeTitle")}</h1>
            <p>{t("homeIntro")}</p>
          </div>
          <StatusBadge tone="positive">{t("connectionOnline")}</StatusBadge>
        </header>
        <div className="entry-grid">
          <Panel className="entry-panel">
            <h2>{t("startSession")}</h2>
            <form onSubmit={submitStart} noValidate>
              <label>
                <span>{t("caseAccessCode")}</span>
                <input
                  name="case-access-code"
                  autoComplete="off"
                  value={caseAccessCode}
                  onChange={(event) => setCaseAccessCode(event.currentTarget.value)}
                  placeholder="case.…"
                  disabled={start.isPending}
                />
                <small>{t("caseAccessHint")}</small>
              </label>
              <fieldset disabled={start.isPending}>
                <legend>{t("simulationMode")}</legend>
                <label className="choice-card">
                  <input
                    type="radio"
                    name="mode"
                    value="PRACTICE_DEMO"
                    checked={mode === "PRACTICE_DEMO"}
                    onChange={() => setMode("PRACTICE_DEMO")}
                  />
                  <span><strong>{t("practiceMode")}</strong><small>{t("practiceDescription")}</small></span>
                </label>
                <label className="choice-card">
                  <input
                    type="radio"
                    name="mode"
                    value="ASSESSMENT"
                    checked={mode === "ASSESSMENT"}
                    onChange={() => setMode("ASSESSMENT")}
                  />
                  <span><strong>{t("assessmentMode")}</strong><small>{t("assessmentDescription")}</small></span>
                </label>
              </fieldset>
              <label>
                <span>{t("patientLanguage")}</span>
                <select
                  name="patient-language"
                  value={patientLanguage}
                  disabled={start.isPending}
                  onChange={(event) => {
                    const parsed = PatientLanguageSchema.safeParse(event.currentTarget.value);
                    if (parsed.success) setPatientLanguage(parsed.data);
                  }}
                >
                  <option value="ar-JO">العربية — الأردن</option>
                  <option value="en-US">English — United States</option>
                </select>
              </label>
              <Button type="submit" disabled={start.isPending || caseAccessCode.trim() === ""}>
                {start.isPending ? t("startingSession") : t("startSession")}
              </Button>
            </form>
          </Panel>
          <Panel className="entry-panel entry-panel--resume">
            <h2>{t("resumeTitle")}</h2>
            <form onSubmit={submitResume} noValidate>
              <label>
                <span>{t("sessionId")}</span>
                <input
                  name="session-id"
                  autoComplete="off"
                  value={resumeSessionId}
                  onChange={(event) => setResumeSessionId(event.currentTarget.value)}
                  placeholder="session.…"
                />
              </label>
              <Button type="submit" variant="secondary" disabled={resumeSessionId.trim() === ""}>
                {t("resumeSession")}
              </Button>
            </form>
            <div className="authority-note">
              <span aria-hidden="true">i</span>
              <p>{t("publicAuthorityBody")}</p>
            </div>
          </Panel>
        </div>
        {formIssue === undefined ? null : <p className="form-issue" role="alert">{formIssue}</p>}
      </div>
    </AppFrame>
  );
}
