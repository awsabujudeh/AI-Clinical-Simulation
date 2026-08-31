import {
  OBSERVATION_OUTPUT_SCHEMA_VERSION,
  ObservationProjectionDefinitionSchema,
  ObservationProjectionSchema,
  type ObservationProjection
} from "../../../contracts/src/observations.ts";
import {
  validateAuthoritativePatientState
} from "../state/patient-state.ts";
import { projectRhythm } from "../rhythm/rhythm-projection.ts";
import {
  createProjectionIssue,
  issuesFromZodError,
  sortProjectionIssues,
  type ProjectionIssueCode,
  type ProjectionValidationIssue
} from "../validation/issues.ts";
export type ObservationProjectionResult =
  | {
      success: false;
      issues: ProjectionValidationIssue[];
    }
  | {
      success: true;
      issues: [];
      observations: ObservationProjection;
    };

function requireMapping<T>(
  mappings: Readonly<Record<string, T>>,
  stateValue: string,
  code: ProjectionIssueCode,
  path: string,
  label: string,
  issues: ProjectionValidationIssue[]
): T | undefined {
  const definition = Object.hasOwn(mappings, stateValue)
    ? mappings[stateValue]
    : undefined;

  if (definition === undefined) {
    issues.push(createProjectionIssue({
      code,
      path,
      state_value: stateValue,
      message: `No ${label} projection is defined for the explicit state value.`
    }));
  }

  return definition;
}

export function projectObservations(
  stateInput: unknown,
  projectionDefinitionInput: unknown
): ObservationProjectionResult {
  const stateResult = validateAuthoritativePatientState(stateInput);
  const definitionResult = ObservationProjectionDefinitionSchema.safeParse(
    projectionDefinitionInput
  );
  const issues: ProjectionValidationIssue[] = [];

  if (!stateResult.valid) {
    issues.push(...stateResult.issues);
  }

  if (!definitionResult.success) {
    issues.push(...issuesFromZodError(
      "INVALID_PROJECTION_DEFINITION",
      "$.definition",
      definitionResult.error
    ));
  }

  if (!stateResult.valid || !definitionResult.success) {
    return { success: false, issues: sortProjectionIssues(issues) };
  }

  const state = stateResult.state;
  const definition = definitionResult.data;
  const hemodynamic = requireMapping(
    definition.hemodynamic_mappings,
    state.hemodynamic_state,
    "MISSING_HEMODYNAMIC_PROJECTION",
    "$.definition.hemodynamic_mappings",
    "hemodynamic observation",
    issues
  );
  const respiratory = requireMapping(
    definition.respiratory_mappings,
    state.respiratory_state,
    "MISSING_RESPIRATORY_PROJECTION",
    "$.definition.respiratory_mappings",
    "respiratory observation",
    issues
  );
  const oxygenation = requireMapping(
    definition.oxygenation_mappings,
    state.oxygenation,
    "MISSING_OXYGENATION_PROJECTION",
    "$.definition.oxygenation_mappings",
    "oxygenation observation",
    issues
  );
  const consciousness = requireMapping(
    definition.consciousness_mappings,
    state.consciousness,
    "MISSING_CONSCIOUSNESS_PROJECTION",
    "$.definition.consciousness_mappings",
    "consciousness observation",
    issues
  );
  const temperature = definition.temperature_mappings === undefined
    ? undefined
    : requireMapping(
      definition.temperature_mappings,
      state.temperature_state,
      "MISSING_TEMPERATURE_PROJECTION",
      "$.definition.temperature_mappings",
      "temperature observation",
      issues
    );
  const rhythmResult = projectRhythm(state.cardiac_rhythm, definition.rhythm_mappings);

  if (!rhythmResult.success) {
    issues.push(...rhythmResult.issues);
  }

  if (
    hemodynamic === undefined
    || respiratory === undefined
    || oxygenation === undefined
    || consciousness === undefined
    || !rhythmResult.success
    || (definition.temperature_mappings !== undefined && temperature === undefined)
  ) {
    return { success: false, issues: sortProjectionIssues(issues) };
  }

  return {
    success: true,
    issues: [],
    observations: ObservationProjectionSchema.parse({
      observation_schema_version: OBSERVATION_OUTPUT_SCHEMA_VERSION,
      projection_definition_id: definition.projection_definition_id,
      session_id: state.session_id,
      case_version: state.case_version,
      state_version: state.state_version,
      clinical_time: state.clinical_time,
      heart_rate_bpm: hemodynamic.heart_rate_bpm,
      systolic_bp_mm_hg: hemodynamic.systolic_bp_mm_hg,
      diastolic_bp_mm_hg: hemodynamic.diastolic_bp_mm_hg,
      respiratory_rate_per_minute: respiratory.respiratory_rate_per_minute,
      spo2_percent: oxygenation.spo2_percent,
      ...(temperature === undefined
        ? {}
        : { temperature_celsius: temperature.temperature_celsius }),
      consciousness_display_code: consciousness.display_code,
      rhythm: rhythmResult.rhythm
    })
  };
}
