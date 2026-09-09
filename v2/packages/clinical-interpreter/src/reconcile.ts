import {
  ClinicalInterpretationSchema,
  ClinicalInterpreterModelOutputSchema,
  type ClinicalInterpretation,
  type ClinicalInterpreterContext,
  type JsonObject,
  type JsonValue,
  type SafeLearnerAction
} from "@ai-clinical-simulation/contracts";

export type ClinicalInterpreterReconciliationIssueCode =
  | "INTERPRETER_OUTPUT_INVALID"
  | "INTERPRETER_PARAMETER_INVALID";

export type ClinicalInterpreterReconciliationResult =
  | Readonly<{ success: true; interpretation: ClinicalInterpretation }>
  | Readonly<{
      success: false;
      code: ClinicalInterpreterReconciliationIssueCode;
    }>;

function parameterMatches(
  value: JsonValue,
  definition: SafeLearnerAction["parameter_definitions"][number]
): boolean {
  if (definition.value_type === "STRING") return typeof value === "string";
  if (definition.value_type === "BOOLEAN") return typeof value === "boolean";
  if (definition.value_type === "INTEGER") {
    return typeof value === "number" && Number.isInteger(value);
  }
  if (definition.value_type === "NUMBER") {
    return typeof value === "number" && Number.isFinite(value);
  }
  return typeof value === "string"
    && (definition.allowed_codes === undefined
      || definition.allowed_codes.some((code) => code === value));
}

function reconcileCandidate(
  candidate: { action_id: string; parameters: JsonObject },
  action: SafeLearnerAction
) {
  const definitions = new Map<string, SafeLearnerAction["parameter_definitions"][number]>(
    action.parameter_definitions.map((definition) => [
      definition.parameter_code,
      definition
    ])
  );
  for (const key of Object.keys(candidate.parameters)) {
    if (!definitions.has(key)) return undefined;
  }
  for (const [key, value] of Object.entries(candidate.parameters)) {
    const definition = definitions.get(key);
    if (definition === undefined || !parameterMatches(value, definition)) return undefined;
    if (typeof value === "number"
      && ((definition.minimum !== undefined && value < definition.minimum)
        || (definition.maximum !== undefined && value > definition.maximum))) {
      return undefined;
    }
  }
  const unresolved = action.parameter_definitions
    .filter((definition) => definition.required
      && !Object.hasOwn(candidate.parameters, definition.parameter_code))
    .map((definition) => definition.parameter_code)
    .sort();
  return {
    action_id: action.action_id,
    parameters: candidate.parameters,
    unresolved_required_parameters: unresolved,
    confirmation_policy: action.confirmation_policy
  };
}

export function reconcileClinicalInterpretation(input: {
  model_output: unknown;
  context: ClinicalInterpreterContext;
}): ClinicalInterpreterReconciliationResult {
  const modelOutput = ClinicalInterpreterModelOutputSchema.safeParse(
    input.model_output
  );
  if (!modelOutput.success) {
    return Object.freeze({ success: false, code: "INTERPRETER_OUTPUT_INVALID" });
  }
  if (modelOutput.data.status === "NO_MATCH") {
    return Object.freeze({
      success: true,
      interpretation: ClinicalInterpretationSchema.parse({
        interpretation_schema_version: "1.0",
        authority: "NON_AUTHORITATIVE",
        status: "NO_MATCH",
        no_match_reason: modelOutput.data.no_match_reason
      })
    });
  }

  const actions = new Map<string, SafeLearnerAction>(
    input.context.learner_action_catalogue.actions.map((action) => [
      action.action_id,
      action
    ])
  );
  const reconciled = [];
  for (const candidate of modelOutput.data.candidates) {
    const action = actions.get(candidate.action_id);
    if (action === undefined) {
      return Object.freeze({
        success: true,
        interpretation: ClinicalInterpretationSchema.parse({
          interpretation_schema_version: "1.0",
          authority: "NON_AUTHORITATIVE",
          status: "NO_MATCH",
          no_match_reason: "UNAVAILABLE_ACTION"
        })
      });
    }
    const value = reconcileCandidate(candidate, action);
    if (value === undefined) {
      return Object.freeze({ success: false, code: "INTERPRETER_PARAMETER_INVALID" });
    }
    reconciled.push(value);
  }

  const interpretation = modelOutput.data.status === "MATCH"
    ? {
        interpretation_schema_version: "1.0",
        authority: "NON_AUTHORITATIVE",
        status: "MATCH",
        candidate: reconciled[0]
      }
    : {
        interpretation_schema_version: "1.0",
        authority: "NON_AUTHORITATIVE",
        status: "AMBIGUOUS",
        ambiguity_reason: modelOutput.data.ambiguity_reason,
        candidates: reconciled
      };
  const parsed = ClinicalInterpretationSchema.safeParse(interpretation);
  return parsed.success
    ? Object.freeze({ success: true, interpretation: parsed.data })
    : Object.freeze({ success: false, code: "INTERPRETER_OUTPUT_INVALID" });
}
