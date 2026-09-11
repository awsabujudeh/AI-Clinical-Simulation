import { useMemo, useRef, useState } from "react";
import type { JsonObject, SafeLearnerAction } from "@ai-clinical-simulation/contracts";

import { useLocalization, type MessageKey } from "../../app/localization";
import type {
  AuthSnapshot,
  SessionPresentationState,
  StudentClinicalActionResult,
  StudentUiServices
} from "../../app/types";
import { Button, Panel, SectionHeader, StatusBadge } from "../../components/ui";
import {
  ACTION_DOMAINS,
  actionDomain,
  actionsForDomain,
  learnerActionLabel,
  validateLearnerActionParameters,
  type ActionDomain,
  type ActionParameterIssue
} from "./action-model";
import { PatientConversationPanel } from "../conversation/PatientConversationPanel";
import { ClinicalInterpreterPanel } from "./ClinicalInterpreterPanel";

const domainMessageKeys: Record<ActionDomain, MessageKey> = {
  HISTORY: "navHistory",
  EXAMINATION: "navExamination",
  INVESTIGATION: "navInvestigations",
  MEDICATION: "navMedications",
  PROCEDURE: "navProcedures",
  DIAGNOSIS_DISPOSITION: "navDiagnosis"
};

type SubmissionPhase =
  | "IDLE"
  | "AWAITING_CONFIRMATION"
  | "SUBMITTING"
  | "PROCESSING"
  | StudentClinicalActionResult["kind"];

function issueMessage(issue: ActionParameterIssue, t: (key: MessageKey) => string) {
  switch (issue.code) {
    case "REQUIRED": return t("actionFieldRequired");
    case "OUT_OF_RANGE": return t("actionFieldRange");
    case "UNSUPPORTED_CODE": return t("actionFieldUnsupported");
    case "TEXT_TOO_LONG": return t("actionFieldTooLong");
    case "UNKNOWN_FIELD":
    case "INVALID_TYPE": return t("actionFieldInvalid");
  }
}

function statusPresentation(phase: SubmissionPhase, t: (key: MessageKey) => string) {
  switch (phase) {
    case "SUBMITTING": return { tone: "information" as const, text: t("actionSubmitting") };
    case "PROCESSING": return { tone: "information" as const, text: t("actionProcessing") };
    case "AWAITING_CONFIRMATION": return { tone: "warning" as const, text: t("actionAwaitingConfirmation") };
    case "COMMITTED": return { tone: "positive" as const, text: t("actionCommitted") };
    case "IN_DOUBT": return { tone: "warning" as const, text: t("actionInDoubt") };
    case "NOT_SENT": return { tone: "critical" as const, text: t("actionNotSent") };
    case "STALE": return { tone: "warning" as const, text: t("actionStale") };
    case "IDEMPOTENCY_CONFLICT": return { tone: "critical" as const, text: t("actionIdempotencyConflict") };
    case "UNAUTHENTICATED": return { tone: "critical" as const, text: t("actionUnauthenticated") };
    case "UNAUTHORIZED": return { tone: "critical" as const, text: t("actionUnauthorized") };
    case "REJECTED": return { tone: "critical" as const, text: t("actionRejected") };
    case "INVALID": return { tone: "critical" as const, text: t("actionInvalid") };
    case "UNAVAILABLE": return { tone: "critical" as const, text: t("actionUnavailable") };
    case "IDLE": return undefined;
  }
}

function ParameterControl({
  action,
  values,
  issues,
  disabled,
  onChange
}: {
  action: SafeLearnerAction;
  values: Readonly<Record<string, unknown>>;
  issues: readonly ActionParameterIssue[];
  disabled: boolean;
  onChange(code: string, value: string | boolean): void;
}) {
  const { t } = useLocalization();
  if (action.parameter_definitions.length === 0) {
    return <p className="action-form__no-fields">{t("actionNoParameters")}</p>;
  }
  return (
    <div className="action-fields">
      {action.parameter_definitions.map((definition) => {
        const issue = issues.find((candidate) => candidate.parameter_code === definition.parameter_code);
        const issueId = `action-field-${definition.parameter_code}-issue`;
        const label = (
          <span>
            {definition.parameter_code}
            {definition.required ? <small aria-hidden="true"> *</small> : null}
          </span>
        );
        if (definition.value_type === "BOOLEAN") {
          return (
            <label className="action-field action-field--check" key={definition.parameter_code}>
              <input
                type="checkbox"
                checked={values[definition.parameter_code] === true}
                disabled={disabled}
                aria-describedby={issue === undefined ? undefined : issueId}
                onChange={(event) => onChange(definition.parameter_code, event.currentTarget.checked)}
              />
              {label}
              {issue === undefined ? null : <small id={issueId} role="alert">{issueMessage(issue, t)}</small>}
            </label>
          );
        }
        const common = {
          id: `action-field-${definition.parameter_code}`,
          name: definition.parameter_code,
          disabled,
          required: definition.required,
          "aria-invalid": issue === undefined ? undefined : true,
          "aria-describedby": issue === undefined ? undefined : issueId
        } as const;
        return (
          <label className="action-field" key={definition.parameter_code} htmlFor={common.id}>
            {label}
            {definition.value_type === "CODE" && definition.allowed_codes !== undefined
              ? (
                  <select
                    {...common}
                    value={typeof values[definition.parameter_code] === "string"
                      ? values[definition.parameter_code] as string
                      : ""}
                    onChange={(event) => onChange(definition.parameter_code, event.currentTarget.value)}
                  >
                    <option value="">{t("actionChooseValue")}</option>
                    {definition.allowed_codes.map((code) => <option value={code} key={code}>{code}</option>)}
                  </select>
                )
              : (
                  <input
                    {...common}
                    type={definition.value_type === "NUMBER" || definition.value_type === "INTEGER" ? "number" : "text"}
                    step={definition.value_type === "INTEGER" ? 1 : definition.value_type === "NUMBER" ? "any" : undefined}
                    min={definition.minimum}
                    max={definition.maximum}
                    maxLength={definition.value_type === "STRING" ? 4_000 : undefined}
                    value={typeof values[definition.parameter_code] === "string"
                      ? values[definition.parameter_code] as string
                      : ""}
                    onChange={(event) => onChange(definition.parameter_code, event.currentTarget.value)}
                  />
                )}
            {issue === undefined ? null : <small id={issueId} role="alert">{issueMessage(issue, t)}</small>}
          </label>
        );
      })}
    </div>
  );
}

export function ClinicalActionsPanel({
  services,
  auth,
  state,
  enabled,
  onAuthoritativeRefresh
}: {
  services: StudentUiServices;
  auth: Extract<AuthSnapshot, { status: "AUTHENTICATED" }>;
  state: SessionPresentationState;
  enabled: boolean;
  onAuthoritativeRefresh(): Promise<unknown>;
}) {
  const { locale, t } = useLocalization();
  const [domain, setDomain] = useState<ActionDomain>("HISTORY");
  const [search, setSearch] = useState("");
  const [selectedActionId, setSelectedActionId] = useState<string>();
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [issues, setIssues] = useState<readonly ActionParameterIssue[]>([]);
  const [phase, setPhase] = useState<SubmissionPhase>("IDLE");
  const submitting = useRef(false);

  const actions = state.projection.learner_action_catalogue.actions;
  const visibleActions = useMemo(
    () => actionsForDomain(actions, domain, locale, search),
    [actions, domain, locale, search]
  );
  const selectedAction = actions.find((action) => action.action_id === selectedActionId);
  const status = statusPresentation(phase, t);
  const locked = !enabled || submitting.current
    || ["SUBMITTING", "PROCESSING", "IN_DOUBT"].includes(phase);

  function chooseDomain(next: ActionDomain) {
    setDomain(next);
    setSelectedActionId(undefined);
    setValues({});
    setIssues([]);
    setPhase("IDLE");
  }

  function chooseAction(action: SafeLearnerAction) {
    if (locked) return;
    setSelectedActionId(action.action_id);
    setValues({});
    setIssues([]);
    setPhase("IDLE");
  }

  function useInterpretedAction(action: SafeLearnerAction, parameters: JsonObject) {
    if (locked) return;
    setDomain(actionDomain(action));
    setSelectedActionId(action.action_id);
    setValues({ ...parameters });
    setIssues([]);
    setPhase("IDLE");
  }

  async function submitValidated(action: SafeLearnerAction, parameters: JsonObject) {
    if (submitting.current) return;
    submitting.current = true;
    setPhase("SUBMITTING");
    const result = await services.actions.submit({
      principal_user_id: auth.principal_user_id,
      session_id: state.projection.session_id,
      expected_state_version: state.projection.state_version,
      action,
      parameters,
      connectivity_state: "ONLINE"
    });
    if (result.kind === "COMMITTED") {
      setPhase("PROCESSING");
      await onAuthoritativeRefresh();
      setPhase("COMMITTED");
      setValues({});
    } else {
      setPhase(result.kind);
      if (result.kind === "STALE" || result.kind === "IN_DOUBT") {
        await onAuthoritativeRefresh();
      }
    }
    submitting.current = false;
  }

  async function validateAndContinue(confirmed: boolean) {
    if (selectedAction === undefined || locked) return;
    const validated = validateLearnerActionParameters(selectedAction, values);
    if (!validated.success) {
      setIssues(validated.issues);
      setPhase("INVALID");
      return;
    }
    setIssues([]);
    if (selectedAction.confirmation_policy !== "NONE" && !confirmed) {
      setPhase("AWAITING_CONFIRMATION");
      return;
    }
    await submitValidated(selectedAction, validated.parameters);
  }

  return (
    <Panel className="interaction-shell" aria-labelledby="interaction-title">
      <SectionHeader
        id="interaction-title"
        title={t("interactionTitle")}
        subtitle={t("interactionSubtitle")}
        action={state.projection.pinned_case.execution_authority === "REVIEW_ONLY"
          ? <StatusBadge tone="warning">{t("reviewOnly")}</StatusBadge>
          : undefined}
      />
      <div className="clinical-tabs" role="tablist" aria-label={t("interactionTitle")}>
        {ACTION_DOMAINS.map((candidate) => (
          <button
            key={candidate}
            type="button"
            role="tab"
            aria-selected={domain === candidate}
            aria-controls="clinical-domain-panel"
            id={`tab-${candidate.toLowerCase()}`}
            onClick={() => chooseDomain(candidate)}
          >
            <span className="clinical-tab__mark" aria-hidden="true" />
            {t(domainMessageKeys[candidate])}
          </button>
        ))}
      </div>
      <div
        className="action-domain"
        id="clinical-domain-panel"
        role="tabpanel"
        aria-labelledby={`tab-${domain.toLowerCase()}`}
      >
        {domain === "HISTORY" ? (
          <PatientConversationPanel
            voice={services.voice}
            state={state}
            service={services.patient_conversation}
            enabled={enabled}
          />
        ) : (
          <>
            <ClinicalInterpreterPanel
              voice={services.voice}
              service={services.clinical_interpreter}
              sessionId={state.projection.session_id}
              stateVersion={state.projection.state_version}
              locale={locale}
              actions={actions}
              enabled={enabled && state.kind !== "ENDED"}
              onRecognized={useInterpretedAction}
            />
            <label className="action-search">
              <span>{t("actionSearch")}</span>
              <input
                type="search"
                value={search}
                disabled={!enabled}
                onChange={(event) => setSearch(event.currentTarget.value)}
                placeholder={t("actionSearchPlaceholder")}
              />
            </label>
            {visibleActions.length === 0 ? (
              <p className="action-unavailable" role="status">{t("actionNoneAvailable")}</p>
            ) : (
              <div className="action-catalogue" aria-label={t("actionAvailable")}>
                {visibleActions.map((action) => (
                  <button
                    key={action.action_id}
                    type="button"
                    disabled={locked}
                    aria-pressed={selectedActionId === action.action_id}
                    onClick={() => chooseAction(action)}
                  >
                    <strong>{learnerActionLabel(action, locale)}</strong>
                    <small>{action.action_type}</small>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {selectedAction === undefined ? null : (
          <form
            className="action-form"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              void validateAndContinue(false);
            }}
          >
            <h3>{learnerActionLabel(selectedAction, locale)}</h3>
            <p className="action-form__authority">{t("actionIntentOnly")}</p>
            <ParameterControl
              action={selectedAction}
              values={values}
              issues={issues}
              disabled={locked}
              onChange={(code, value) => setValues((current) => ({ ...current, [code]: value }))}
            />
            <Button type="submit" disabled={locked}>{t("actionPropose")}</Button>
          </form>
        )}

        {phase === "AWAITING_CONFIRMATION" && selectedAction !== undefined ? (
          <div
            className="action-confirmation"
            role="dialog"
            aria-modal="true"
            aria-labelledby="action-confirmation-title"
            onKeyDown={(event) => {
              if (event.key === "Escape") setPhase("IDLE");
            }}
          >
            <h3 id="action-confirmation-title">{t("actionConfirmTitle")}</h3>
            <p>{t("actionConfirmBody")}</p>
            <div>
              <Button type="button" autoFocus onClick={() => void validateAndContinue(true)}>
                {t("actionConfirm")}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setPhase("IDLE")}>
                {t("actionCancel")}
              </Button>
            </div>
          </div>
        ) : null}

        <div className="action-status" role="status" aria-live="polite" aria-atomic="true">
          {status === undefined ? null : <StatusBadge tone={status.tone}>{status.text}</StatusBadge>}
          {phase === "NOT_SENT" || phase === "STALE" || phase === "IN_DOUBT" ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => void onAuthoritativeRefresh()}
            >
              {t("actionReviewState")}
            </Button>
          ) : null}
        </div>
      </div>
    </Panel>
  );
}
