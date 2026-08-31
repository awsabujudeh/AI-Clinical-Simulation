import {
  CaseControlledValueSchema,
  RhythmObservationMappingsSchema,
  RhythmObservationSchema,
  type RhythmObservation
} from "../../../contracts/src/index.ts";

import {
  createProjectionIssue,
  issuesFromZodError,
  sortProjectionIssues,
  type ProjectionValidationIssue
} from "../validation/issues.ts";

export type RhythmProjectionResult =
  | {
      success: false;
      issues: ProjectionValidationIssue[];
    }
  | {
      success: true;
      issues: [];
      rhythm: RhythmObservation;
    };

export function projectRhythm(
  cardiacRhythmInput: unknown,
  mappingsInput: unknown
): RhythmProjectionResult {
  const cardiacRhythm = CaseControlledValueSchema.safeParse(cardiacRhythmInput);
  const mappings = RhythmObservationMappingsSchema.safeParse(mappingsInput);
  const issues: ProjectionValidationIssue[] = [];

  if (!cardiacRhythm.success) {
    issues.push(...issuesFromZodError(
      "INVALID_PATIENT_STATE",
      "$.state.cardiac_rhythm",
      cardiacRhythm.error
    ));
  }

  if (!mappings.success) {
    issues.push(...issuesFromZodError(
      "INVALID_PROJECTION_DEFINITION",
      "$.definition.rhythm_mappings",
      mappings.error
    ));
  }

  if (!cardiacRhythm.success || !mappings.success) {
    return { success: false, issues: sortProjectionIssues(issues) };
  }

  const definition = Object.hasOwn(mappings.data, cardiacRhythm.data)
    ? mappings.data[cardiacRhythm.data]
    : undefined;

  if (definition === undefined) {
    return {
      success: false,
      issues: [createProjectionIssue({
        code: "MISSING_RHYTHM_PROJECTION",
        path: "$.definition.rhythm_mappings",
        state_value: cardiacRhythm.data,
        message: "No rhythm projection is defined for the explicit cardiac rhythm."
      })]
    };
  }

  return {
    success: true,
    issues: [],
    rhythm: RhythmObservationSchema.parse({
      cardiac_rhythm: cardiacRhythm.data,
      display_code: definition.display_code,
      waveform_descriptor: definition.waveform_descriptor
    })
  };
}
