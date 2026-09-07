import type {
  JsonObject,
  JsonValue,
  PatientLanguage,
  SafeLearnerAction
} from "@ai-clinical-simulation/contracts";

export const ACTION_DOMAINS = [
  "HISTORY",
  "EXAMINATION",
  "INVESTIGATION",
  "MEDICATION",
  "PROCEDURE",
  "DIAGNOSIS_DISPOSITION"
] as const;

export type ActionDomain = typeof ACTION_DOMAINS[number];

export type ActionParameterIssue = Readonly<{
  code:
    | "REQUIRED"
    | "INVALID_TYPE"
    | "OUT_OF_RANGE"
    | "UNSUPPORTED_CODE"
    | "UNKNOWN_FIELD"
    | "TEXT_TOO_LONG";
  parameter_code: string;
}>;

export type ActionParameterValidation =
  | Readonly<{ success: true; parameters: JsonObject; issues: readonly [] }>
  | Readonly<{
      success: false;
      issues: readonly ActionParameterIssue[];
    }>;

export function actionDomain(action: SafeLearnerAction): ActionDomain {
  switch (action.action_type) {
    case "EXAMINATION": return "EXAMINATION";
    case "INVESTIGATION": return "INVESTIGATION";
    case "MEDICATION": return "MEDICATION";
    case "PROCEDURE":
    case "CONSULT": return "PROCEDURE";
    case "DIAGNOSIS":
    case "DISPOSITION": return "DIAGNOSIS_DISPOSITION";
  }
}

export function learnerActionLabel(
  action: SafeLearnerAction,
  locale: PatientLanguage
): string {
  const exact = action.labels.find((label) => label.locale === locale);
  if (exact !== undefined) return exact.label;
  const english = action.labels.find((label) => label.locale === "en-US");
  return english?.label ?? action.action_id;
}

export function actionsForDomain(
  actions: readonly SafeLearnerAction[],
  domain: ActionDomain,
  locale: PatientLanguage,
  search: string
): readonly SafeLearnerAction[] {
  const normalized = search.trim().toLowerCase();
  return actions
    .filter((action) => actionDomain(action) === domain)
    .filter((action) => normalized.length === 0
      || learnerActionLabel(action, locale).toLowerCase().includes(normalized)
      || action.action_id.toLowerCase().includes(normalized))
    .toSorted((left, right) => {
      const leftLabel = learnerActionLabel(left, locale);
      const rightLabel = learnerActionLabel(right, locale);
      return leftLabel < rightLabel ? -1 : leftLabel > rightLabel ? 1 : 0;
    });
}

function rawValue(raw: Readonly<Record<string, unknown>>, key: string): unknown {
  return Object.hasOwn(raw, key) ? raw[key] : undefined;
}

export function validateLearnerActionParameters(
  action: SafeLearnerAction,
  raw: Readonly<Record<string, unknown>>
): ActionParameterValidation {
  const definitions = new Map<string, SafeLearnerAction["parameter_definitions"][number]>(
    action.parameter_definitions.map((definition) => [
      definition.parameter_code,
      definition
    ])
  );
  const issues: ActionParameterIssue[] = [];
  const parameters: Record<string, JsonValue> = Object.create(null) as Record<string, JsonValue>;

  for (const key of Object.keys(raw).sort()) {
    if (!definitions.has(key)) {
      issues.push({ code: "UNKNOWN_FIELD", parameter_code: key });
    }
  }

  for (const definition of action.parameter_definitions) {
    const value = rawValue(raw, definition.parameter_code);
    const missing = value === undefined || value === "";
    if (missing) {
      if (definition.required) {
        issues.push({ code: "REQUIRED", parameter_code: definition.parameter_code });
      }
      continue;
    }

    if (definition.value_type === "BOOLEAN") {
      if (typeof value !== "boolean") {
        issues.push({ code: "INVALID_TYPE", parameter_code: definition.parameter_code });
      } else {
        parameters[definition.parameter_code] = value;
      }
      continue;
    }

    if (definition.value_type === "NUMBER" || definition.value_type === "INTEGER") {
      const numberValue = typeof value === "number" ? value : Number(value);
      if (!Number.isFinite(numberValue)
        || (definition.value_type === "INTEGER" && !Number.isInteger(numberValue))) {
        issues.push({ code: "INVALID_TYPE", parameter_code: definition.parameter_code });
        continue;
      }
      if ((definition.minimum !== undefined && numberValue < definition.minimum)
        || (definition.maximum !== undefined && numberValue > definition.maximum)) {
        issues.push({ code: "OUT_OF_RANGE", parameter_code: definition.parameter_code });
        continue;
      }
      parameters[definition.parameter_code] = numberValue;
      continue;
    }

    if (typeof value !== "string") {
      issues.push({ code: "INVALID_TYPE", parameter_code: definition.parameter_code });
      continue;
    }
    if (value.length > 4_000) {
      issues.push({ code: "TEXT_TOO_LONG", parameter_code: definition.parameter_code });
      continue;
    }
    if (definition.value_type === "CODE"
      && definition.allowed_codes !== undefined
      && !definition.allowed_codes.some((code) => code === value)) {
      issues.push({ code: "UNSUPPORTED_CODE", parameter_code: definition.parameter_code });
      continue;
    }
    parameters[definition.parameter_code] = value;
  }

  return issues.length === 0
    ? { success: true, parameters, issues: [] }
    : { success: false, issues };
}
