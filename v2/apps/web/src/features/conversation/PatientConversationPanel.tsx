import { useEffect, useRef, useState } from "react";

import { useLocalization } from "../../app/localization";
import type {
  PatientConversationLoadResult,
  PatientQuestionResult,
  SessionPresentationState,
  StudentPatientConversationService
} from "../../app/types";
import { Button, StatusBadge } from "../../components/ui";

type Phase = "LOADING" | "READY" | "SUBMITTING" | "UNAVAILABLE" | "INVALID" | "ENDED";

export function PatientConversationPanel({
  state,
  service,
  enabled
}: {
  state: SessionPresentationState;
  service?: StudentPatientConversationService;
  enabled: boolean;
}) {
  const { locale, t } = useLocalization();
  const [transcript, setTranscript] = useState<Extract<PatientConversationLoadResult, { kind: "AVAILABLE" }>["transcript"]>();
  const [question, setQuestion] = useState("");
  const [phase, setPhase] = useState<Phase>(state.kind === "ENDED" ? "ENDED" : "LOADING");
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    if (state.kind === "ENDED" || !enabled || service === undefined) {
      setPhase(state.kind === "ENDED" ? "ENDED" : "UNAVAILABLE");
      return () => { mounted.current = false; };
    }
    setPhase("LOADING");
    void service.load(state.projection.session_id)
      .then((result) => {
        if (!mounted.current) return;
        if (result.kind === "AVAILABLE") {
          setTranscript(result.transcript);
          setPhase("READY");
        } else setPhase("UNAVAILABLE");
      })
      .catch(() => {
        if (mounted.current) setPhase("UNAVAILABLE");
      });
    return () => { mounted.current = false; };
  }, [enabled, service, state.kind, state.projection.session_id]);

  async function submit() {
    const text = question.trim();
    if (service === undefined || phase !== "READY" || text.length === 0 || text.length > 4_000) {
      setPhase("INVALID");
      return;
    }
    setPhase("SUBMITTING");
    let result: PatientQuestionResult;
    try {
      result = await service.submit({
        session_id: state.projection.session_id,
        locale,
        text,
        source: "TEXT"
      });
    } catch {
      setPhase("UNAVAILABLE");
      return;
    }
    if (result.kind === "COMMITTED") {
      setTranscript((current) => ({
        conversation_schema_version: "1.0",
        session_id: state.projection.session_id,
        turns: [...(current?.turns ?? []), result.turn]
      }));
      setQuestion("");
      setPhase("READY");
    } else if (result.kind === "ENDED") setPhase("ENDED");
    else if (result.kind === "INVALID") setPhase("INVALID");
    else setPhase("UNAVAILABLE");
  }

  const blocked = !enabled || phase === "LOADING" || phase === "SUBMITTING" || phase === "UNAVAILABLE" || phase === "ENDED";
  return (
    <section className="patient-conversation" aria-labelledby="patient-conversation-title">
      <div className="patient-conversation__heading">
        <div>
          <h3 id="patient-conversation-title">{t("patientConversationTitle")}</h3>
          <p>{t("patientConversationBoundary")}</p>
        </div>
        <StatusBadge tone={phase === "READY" ? "positive" : phase === "SUBMITTING" ? "information" : "warning"}>
          {phase === "SUBMITTING" ? t("patientResponding") : phase === "READY" ? t("patientConversationReady") : t("patientConversationUnavailable")}
        </StatusBadge>
      </div>
      <div className="patient-conversation__transcript" aria-live="polite" aria-label={t("patientConversationTranscript")}>
        {(transcript?.turns ?? []).length === 0
          ? <p>{t("patientConversationEmpty")}</p>
          : transcript?.turns.map((turn) => (
              <article key={turn.turn_id} className="patient-conversation__turn">
                <p><strong>{t("learnerSaid")}</strong> {turn.learner_utterance}</p>
                <p><strong>{t("patientSaid")}</strong> {turn.patient_utterance}</p>
              </article>
            ))}
      </div>
      {phase === "UNAVAILABLE" ? <p role="alert">{t("patientConversationOffline")}</p> : null}
      {phase === "ENDED" ? <p role="status">{t("patientConversationEnded")}</p> : null}
      {phase === "INVALID" ? <p role="alert">{t("patientConversationInvalid")}</p> : null}
      <form onSubmit={(event) => { event.preventDefault(); void submit(); }}>
        <label>
          <span>{t("patientQuestionLabel")}</span>
          <textarea
            value={question}
            maxLength={4_000}
            disabled={blocked}
            onChange={(event) => { setQuestion(event.currentTarget.value); if (phase === "INVALID") setPhase("READY"); }}
          />
        </label>
        <Button type="submit" disabled={blocked || question.trim().length === 0}>{t("patientQuestionSubmit")}</Button>
      </form>
    </section>
  );
}
