import {
  PATIENT_CONVERSATION_HISTORY_MAX_CHARACTERS,
  PATIENT_CONVERSATION_HISTORY_MAX_TURNS,
  PatientConversationContextSchema,
  PatientConversationHistoryTurnSchema,
  PatientLanguageSchema,
  PatientStateSchema,
  type PatientConversationContext,
  type PatientConversationHistoryTurn,
  type PatientState
} from "@ai-clinical-simulation/contracts";
import {
  DraftCasePackageSchema,
  CompiledCasePackageSchema,
  type DraftCasePackage,
  type PatientManifestationSelector
} from "@ai-clinical-simulation/case-schema";

const PatientContextCasePackageSchema = DraftCasePackageSchema.or(
  CompiledCasePackageSchema
);

export type PatientContextIssueCode =
  | "INVALID_CASE_PACKAGE"
  | "INVALID_PATIENT_STATE"
  | "INVALID_PATIENT_LOCALE"
  | "CASE_STATE_VERSION_MISMATCH"
  | "PATIENT_AI_FORBIDDEN"
  | "PATIENT_LOCALE_UNSUPPORTED"
  | "PATIENT_LOCALIZATION_MISSING"
  | "INVALID_CONVERSATION_HISTORY"
  | "INVALID_PATIENT_CONTEXT";

export type PatientContextIssue = Readonly<{
  code: PatientContextIssueCode;
  path: string;
  message: string;
}>;

export type PatientContextResult =
  | Readonly<{ success: true; context: PatientConversationContext }>
  | Readonly<{ success: false; issues: readonly PatientContextIssue[] }>;

function failure(
  code: PatientContextIssueCode,
  path: string,
  message: string
): PatientContextResult {
  return Object.freeze({
    success: false,
    issues: Object.freeze([Object.freeze({ code, path, message })])
  });
}

function matchesSelector(
  state: PatientState,
  selector: PatientManifestationSelector
): boolean {
  if (selector.selector_type === "PAIN_SEVERITY_RANGE") {
    return state.pain_state.severity_0_10 >= selector.minimum
      && state.pain_state.severity_0_10 <= selector.maximum;
  }
  if (selector.selector_type === "PAIN_TREND_EQUALS") {
    return state.pain_state.trend === selector.state_value;
  }
  return state[selector.state_dimension] === selector.state_value;
}

function localizedText(
  casePackage: DraftCasePackage,
  key: string,
  locale: "ar-JO" | "en-US"
): string | undefined {
  return casePackage.localization.entries
    .find((entry) => entry.key === key)
    ?.translations.find((translation) => translation.locale === locale)
    ?.text;
}

export function boundPatientConversationHistory(
  input: readonly PatientConversationHistoryTurn[]
): readonly PatientConversationHistoryTurn[] {
  const ordered = [...input].sort(
    (left, right) => left.turn_sequence - right.turn_sequence
  );
  const bounded: PatientConversationHistoryTurn[] = [];
  let characters = 0;
  for (let index = ordered.length - 1; index >= 0; index -= 1) {
    const turn = ordered[index]!;
    const nextCharacters = turn.learner_utterance.length + turn.patient_utterance.length;
    if (bounded.length >= PATIENT_CONVERSATION_HISTORY_MAX_TURNS) break;
    if (characters + nextCharacters > PATIENT_CONVERSATION_HISTORY_MAX_CHARACTERS) break;
    bounded.unshift(turn);
    characters += nextCharacters;
  }
  return Object.freeze(bounded.map((turn) => Object.freeze({ ...turn })));
}

export function buildPatientConversationContext(input: {
  case_package: unknown;
  patient_state: unknown;
  locale: unknown;
  history: unknown;
}): PatientContextResult {
  const casePackage = PatientContextCasePackageSchema.safeParse(input.case_package);
  if (!casePackage.success) {
    return failure("INVALID_CASE_PACKAGE", "$.case_package", "Patient context requires a valid pinned Case Package.");
  }
  const state = PatientStateSchema.safeParse(input.patient_state);
  if (!state.success) {
    return failure("INVALID_PATIENT_STATE", "$.patient_state", "Patient context requires authoritative Patient State.");
  }
  const locale = PatientLanguageSchema.safeParse(input.locale);
  if (!locale.success) {
    return failure("INVALID_PATIENT_LOCALE", "$.locale", "Patient language must be ar-JO or en-US.");
  }
  if (state.data.case_version !== casePackage.data.manifest.case_version) {
    return failure("CASE_STATE_VERSION_MISMATCH", "$.patient_state.case_version", "Patient State and Case version do not match.");
  }
  if (casePackage.data.instructor_notes.patient_ai_access !== "ALLOWED") {
    return failure("PATIENT_AI_FORBIDDEN", "$.instructor_notes.patient_ai_access", "Patient conversation is not enabled by the pinned Case.");
  }
  if (!casePackage.data.patient_profile.supported_languages.includes(locale.data)) {
    return failure("PATIENT_LOCALE_UNSUPPORTED", "$.locale", "The pinned Case does not support this patient language.");
  }
  const history = PatientConversationHistoryTurnSchema.array().safeParse(input.history);
  if (!history.success) {
    return failure("INVALID_CONVERSATION_HISTORY", "$.history", "Conversation history is malformed.");
  }

  const forbidden = new Set<string>(casePackage.data.dialogue_policy.forbidden_fact_ids);
  const disclosable = new Set<string>(casePackage.data.dialogue_policy.disclosable_fact_ids);
  const matchingRules = (casePackage.data.dialogue_policy.patient_state_manifestations ?? [])
    .filter((rule) => matchesSelector(state.data, rule.selector))
    .sort((left, right) => left.manifestation_id < right.manifestation_id ? -1 : left.manifestation_id > right.manifestation_id ? 1 : 0);
  const replacedFactIds = new Set(
    matchingRules.flatMap((rule) => rule.replaces_fact_ids)
  );

  const facts = casePackage.data.clinical_facts.facts
    .filter((fact) => disclosable.has(fact.fact_id))
    .filter((fact) => !forbidden.has(fact.fact_id))
    .filter((fact) => fact.disclosure_mode === "on_direct_question")
    .filter((fact) => !replacedFactIds.has(fact.fact_id))
    .sort((left, right) => left.fact_id < right.fact_id ? -1 : left.fact_id > right.fact_id ? 1 : 0)
    .map((fact) => {
      const text = localizedText(casePackage.data, fact.content_key, locale.data);
      return text === undefined
        ? undefined
        : {
            fact_id: fact.fact_id,
            clinical_code: fact.clinical_code,
            truth_status: fact.patient_truth_status ?? "AUTHORED_STATEMENT" as const,
            text
          };
    });
  if (facts.some((fact) => fact === undefined)) {
    return failure("PATIENT_LOCALIZATION_MISSING", "$.clinical_facts", "A patient-known fact is missing requested-locale copy.");
  }

  const currentManifestations = matchingRules.map((rule) => {
    const text = localizedText(casePackage.data, rule.content_key, locale.data);
    return text === undefined
      ? undefined
      : {
          manifestation_id: rule.manifestation_id,
          truth_status: rule.truth_status,
          text
        };
  });
  if (currentManifestations.some((manifestation) => manifestation === undefined)) {
    return failure("PATIENT_LOCALIZATION_MISSING", "$.dialogue_policy.patient_state_manifestations", "A current patient manifestation is missing requested-locale copy.");
  }
  const fallback = localizedText(
    casePackage.data,
    casePackage.data.dialogue_policy.deterministic_fallback_key,
    locale.data
  );
  if (fallback === undefined) {
    return failure("PATIENT_LOCALIZATION_MISSING", "$.dialogue_policy.deterministic_fallback_key", "Patient fallback copy is missing requested-locale localization.");
  }

  const context = PatientConversationContextSchema.safeParse({
    context_schema_version: "1.0",
    locale: locale.data,
    persona_code: casePackage.data.patient_profile.persona_code,
    conversational_style_code: casePackage.data.patient_profile.conversational_style_code,
    emotional_tone_code: casePackage.data.dialogue_policy.emotional_tone_code,
    facts,
    current_manifestations: currentManifestations,
    history: boundPatientConversationHistory(history.data),
    deterministic_fallback_text: fallback,
    grounded_state_version: state.data.state_version,
    grounded_clinical_time: state.data.clinical_time
  });
  return context.success
    ? Object.freeze({ success: true, context: context.data })
    : failure("INVALID_PATIENT_CONTEXT", "$.context", "Patient-safe context projection failed validation.");
}
