import { z } from "zod";

import {
  PatientStateSchema,
  SessionIdSchema,
  type PatientState
} from "../../../contracts/src/index.ts";

import {
  createProjectionIssue,
  issuesFromZodError,
  sortProjectionIssues,
  type ProjectionValidationIssue
} from "../validation/issues.ts";

// This is derived from the shared Patient State contract. It is not a second
// state model: it removes only runtime session identity and fixes initial counters.
export const InitialPatientStateInputSchema = PatientStateSchema
  .omit({ session_id: true })
  .extend({
    state_version: z.literal(0),
    clinical_time: z.literal(0)
  });
export type InitialPatientStateInput = z.infer<typeof InitialPatientStateInputSchema>;

export type PatientStateValidationResult =
  | {
      valid: false;
      issues: ProjectionValidationIssue[];
    }
  | {
      valid: true;
      issues: [];
      state: PatientState;
    };

export type PatientStateInitializationResult =
  | {
      success: false;
      issues: ProjectionValidationIssue[];
    }
  | {
      success: true;
      issues: [];
      state: PatientState;
    };

function duplicateValues(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
    } else {
      seen.add(value);
    }
  }

  return [...duplicates].sort();
}

export function validateAuthoritativePatientState(
  input: unknown
): PatientStateValidationResult {
  const parsed = PatientStateSchema.safeParse(input);

  if (!parsed.success) {
    return {
      valid: false,
      issues: sortProjectionIssues(
        issuesFromZodError("INVALID_PATIENT_STATE", "$.state", parsed.error)
      )
    };
  }

  const issues: ProjectionValidationIssue[] = [];

  for (const interventionId of duplicateValues(
    parsed.data.active_interventions.map((item) => item.intervention_id)
  )) {
    issues.push(createProjectionIssue({
      code: "DUPLICATE_ACTIVE_INTERVENTION_ID",
      path: "$.state.active_interventions",
      message: `Active intervention identity is duplicated: ${interventionId}`
    }));
  }

  for (const complicationId of duplicateValues(
    parsed.data.active_complications.map((item) => item.complication_id)
  )) {
    issues.push(createProjectionIssue({
      code: "DUPLICATE_ACTIVE_COMPLICATION_ID",
      path: "$.state.active_complications",
      message: `Active complication identity is duplicated: ${complicationId}`
    }));
  }

  if (issues.length > 0) {
    return { valid: false, issues: sortProjectionIssues(issues) };
  }

  return { valid: true, issues: [], state: parsed.data };
}

export function initializePatientState(
  initialStateInput: unknown,
  sessionIdInput: unknown
): PatientStateInitializationResult {
  const initialState = InitialPatientStateInputSchema.safeParse(initialStateInput);
  const sessionId = SessionIdSchema.safeParse(sessionIdInput);
  const issues: ProjectionValidationIssue[] = [];

  if (!initialState.success) {
    issues.push(...issuesFromZodError(
      "INVALID_PATIENT_STATE",
      "$.initial_state",
      initialState.error
    ));
  }

  if (!sessionId.success) {
    issues.push(...issuesFromZodError(
      "INVALID_PATIENT_STATE",
      "$.session_id",
      sessionId.error
    ));
  }

  if (!initialState.success || !sessionId.success) {
    return { success: false, issues: sortProjectionIssues(issues) };
  }

  const runtimeState = validateAuthoritativePatientState({
    ...initialState.data,
    session_id: sessionId.data
  });

  if (!runtimeState.valid) {
    return { success: false, issues: runtimeState.issues };
  }

  return { success: true, issues: [], state: runtimeState.state };
}
