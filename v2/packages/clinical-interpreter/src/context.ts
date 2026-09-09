import {
  ClinicalInterpreterContextSchema,
  PatientLanguageSchema,
  SafeLearnerActionCatalogueSchema,
  type ClinicalInterpreterContext
} from "@ai-clinical-simulation/contracts";

export type ClinicalInterpreterContextIssueCode =
  | "INVALID_INTERPRETER_LOCALE"
  | "INVALID_ACTION_CATALOGUE"
  | "INVALID_INTERPRETER_CONTEXT";

export type ClinicalInterpreterContextResult =
  | Readonly<{ success: true; context: ClinicalInterpreterContext }>
  | Readonly<{
      success: false;
      code: ClinicalInterpreterContextIssueCode;
    }>;

export function buildClinicalInterpreterContext(input: {
  locale: unknown;
  learner_action_catalogue: unknown;
}): ClinicalInterpreterContextResult {
  const locale = PatientLanguageSchema.safeParse(input.locale);
  if (!locale.success) {
    return Object.freeze({ success: false, code: "INVALID_INTERPRETER_LOCALE" });
  }
  const catalogue = SafeLearnerActionCatalogueSchema.safeParse(
    input.learner_action_catalogue
  );
  if (!catalogue.success) {
    return Object.freeze({ success: false, code: "INVALID_ACTION_CATALOGUE" });
  }
  const actions = catalogue.data.actions
    .map((action) => ({
      ...action,
      labels: [...action.labels].sort((left, right) =>
        left.locale < right.locale ? -1 : left.locale > right.locale ? 1 : 0
      ),
      ...(action.aliases === undefined
        ? {}
        : {
            aliases: action.aliases
              .map((alias) => ({
                ...alias,
                phrases: [...alias.phrases].sort()
              }))
              .sort((left, right) =>
                left.locale < right.locale ? -1 : left.locale > right.locale ? 1 : 0
              )
          }),
      parameter_definitions: [...action.parameter_definitions].sort((left, right) =>
        left.parameter_code < right.parameter_code
          ? -1
          : left.parameter_code > right.parameter_code
            ? 1
            : 0
      )
    }))
    .sort((left, right) =>
      left.action_id < right.action_id ? -1 : left.action_id > right.action_id ? 1 : 0
    );
  const context = ClinicalInterpreterContextSchema.safeParse({
    context_schema_version: "1.0",
    locale: locale.data,
    learner_action_catalogue: {
      catalogue_schema_version: catalogue.data.catalogue_schema_version,
      actions
    }
  });
  return context.success
    ? Object.freeze({ success: true, context: context.data })
    : Object.freeze({ success: false, code: "INVALID_INTERPRETER_CONTEXT" });
}
