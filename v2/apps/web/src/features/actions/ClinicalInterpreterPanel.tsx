import { useRef, useState } from "react";
import type {
  JsonObject,
  PatientLanguage,
  SafeLearnerAction
} from "@ai-clinical-simulation/contracts";

import { useLocalization } from "../../app/localization";
import type {
  StudentClinicalInterpreterService
} from "../../app/types";
import { Button, StatusBadge } from "../../components/ui";
import { learnerActionLabel } from "./action-model";

type InterpreterPhase =
  | "IDLE"
  | "INTERPRETING"
  | "MATCH"
  | "AMBIGUOUS"
  | "NO_MATCH"
  | "STALE"
  | "UNAVAILABLE";

export function ClinicalInterpreterPanel({
  service,
  sessionId,
  stateVersion,
  locale,
  actions,
  enabled,
  onRecognized
}: {
  service?: StudentClinicalInterpreterService;
  sessionId: string;
  stateVersion: number;
  locale: PatientLanguage;
  actions: readonly SafeLearnerAction[];
  enabled: boolean;
  onRecognized(action: SafeLearnerAction, parameters: JsonObject): void;
}) {
  const { t } = useLocalization();
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<InterpreterPhase>("IDLE");
  const [ambiguousActionIds, setAmbiguousActionIds] = useState<readonly string[]>([]);
  const pending = useRef(false);

  async function interpret() {
    const utterance = text.trim();
    if (!enabled || service === undefined || pending.current
      || utterance.length === 0 || utterance.length > 4_000) {
      setPhase(service === undefined ? "UNAVAILABLE" : "NO_MATCH");
      return;
    }
    pending.current = true;
    setPhase("INTERPRETING");
    setAmbiguousActionIds([]);
    const result = await service.interpret({ session_id: sessionId, locale, text: utterance });
    if (result.kind !== "COMPLETED") {
      setPhase(result.kind === "ENDED" ? "STALE" : "UNAVAILABLE");
      pending.current = false;
      return;
    }
    if (result.grounded_state_version !== stateVersion) {
      setPhase("STALE");
      pending.current = false;
      return;
    }
    if (result.interpretation.status === "NO_MATCH") {
      setPhase("NO_MATCH");
      pending.current = false;
      return;
    }
    if (result.interpretation.status === "AMBIGUOUS") {
      setAmbiguousActionIds(result.interpretation.candidates.map((candidate) => candidate.action_id));
      setPhase("AMBIGUOUS");
      pending.current = false;
      return;
    }
    const interpretation = result.interpretation;
    if (interpretation.status !== "MATCH") {
      setPhase("NO_MATCH");
      pending.current = false;
      return;
    }
    const action = actions.find(
      (candidate) => candidate.action_id === interpretation.candidate.action_id
    );
    if (action === undefined) {
      setPhase("STALE");
      pending.current = false;
      return;
    }
    onRecognized(action, interpretation.candidate.parameters);
    setPhase("MATCH");
    pending.current = false;
  }

  const status = phase === "INTERPRETING" ? t("interpreterInterpreting")
    : phase === "MATCH" ? t("interpreterMatched")
      : phase === "AMBIGUOUS" ? t("interpreterAmbiguous")
        : phase === "NO_MATCH" ? t("interpreterNoMatch")
          : phase === "STALE" ? t("interpreterStale")
            : phase === "UNAVAILABLE" ? t("interpreterUnavailable")
              : undefined;

  return (
    <section className="clinical-interpreter" aria-labelledby="clinical-interpreter-title">
      <div>
        <h3 id="clinical-interpreter-title">{t("interpreterTitle")}</h3>
        <p>{t("interpreterBoundary")}</p>
      </div>
      <label>
        <span>{t("interpreterInputLabel")}</span>
        <textarea
          value={text}
          maxLength={4_000}
          disabled={!enabled || phase === "INTERPRETING"}
          placeholder={t("interpreterPlaceholder")}
          onChange={(event) => {
            setText(event.currentTarget.value);
            setPhase("IDLE");
          }}
        />
      </label>
      <Button
        type="button"
        variant="secondary"
        disabled={!enabled || phase === "INTERPRETING"}
        onClick={() => void interpret()}
      >
        {t("interpreterAction")}
      </Button>
      {status === undefined ? null : (
        <div role="status" aria-live="polite">
          <StatusBadge tone={phase === "MATCH" ? "positive" : phase === "INTERPRETING" ? "information" : "warning"}>
            {status}
          </StatusBadge>
        </div>
      )}
      {phase === "AMBIGUOUS" ? (
        <ul aria-label={t("interpreterCandidates")}>
          {ambiguousActionIds.map((actionId) => {
            const action = actions.find((candidate) => candidate.action_id === actionId);
            return <li key={actionId}>{action === undefined ? actionId : learnerActionLabel(action, locale)}</li>;
          })}
        </ul>
      ) : null}
      {service === undefined ? <p>{t("interpreterManualFallback")}</p> : null}
    </section>
  );
}
