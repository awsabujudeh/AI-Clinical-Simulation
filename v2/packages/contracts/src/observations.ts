import { z } from "zod";

import {
  ClinicalTimeSchema,
  SemanticVersionSchema,
  SessionIdSchema,
  StateVersionSchema
} from "./ids.ts";
import { CaseControlledValueSchema } from "./patient-state.ts";

export const OBSERVATION_PROJECTION_SCHEMA_VERSION = "1.0" as const;
export const OBSERVATION_OUTPUT_SCHEMA_VERSION = "1.0" as const;

const NonnegativeFiniteNumberSchema = z.number().finite().nonnegative();

export const RhythmObservationDefinitionSchema = z.strictObject({
  display_code: CaseControlledValueSchema,
  waveform_descriptor: CaseControlledValueSchema
});
export type RhythmObservationDefinition = z.infer<typeof RhythmObservationDefinitionSchema>;

export const RhythmObservationMappingsSchema = z.record(
  CaseControlledValueSchema,
  RhythmObservationDefinitionSchema
);
export type RhythmObservationMappings = z.infer<typeof RhythmObservationMappingsSchema>;

export const RhythmObservationSchema = z.strictObject({
  cardiac_rhythm: CaseControlledValueSchema,
  display_code: CaseControlledValueSchema,
  waveform_descriptor: CaseControlledValueSchema
});
export type RhythmObservation = z.infer<typeof RhythmObservationSchema>;

export const HemodynamicObservationDefinitionSchema = z.strictObject({
  heart_rate_bpm: NonnegativeFiniteNumberSchema,
  systolic_bp_mm_hg: NonnegativeFiniteNumberSchema,
  diastolic_bp_mm_hg: NonnegativeFiniteNumberSchema
}).superRefine((value, context) => {
  if (value.systolic_bp_mm_hg <= value.diastolic_bp_mm_hg) {
    context.addIssue({
      code: "custom",
      path: ["systolic_bp_mm_hg"],
      message: "Systolic blood pressure must be greater than diastolic blood pressure"
    });
  }
});
export type HemodynamicObservationDefinition = z.infer<
  typeof HemodynamicObservationDefinitionSchema
>;

export const RespiratoryObservationDefinitionSchema = z.strictObject({
  respiratory_rate_per_minute: NonnegativeFiniteNumberSchema
});
export type RespiratoryObservationDefinition = z.infer<
  typeof RespiratoryObservationDefinitionSchema
>;

export const OxygenationObservationDefinitionSchema = z.strictObject({
  spo2_percent: z.number().finite().min(0).max(100)
});
export type OxygenationObservationDefinition = z.infer<
  typeof OxygenationObservationDefinitionSchema
>;

export const TemperatureObservationDefinitionSchema = z.strictObject({
  temperature_celsius: z.number().finite()
});
export type TemperatureObservationDefinition = z.infer<
  typeof TemperatureObservationDefinitionSchema
>;

export const ConsciousnessObservationDefinitionSchema = z.strictObject({
  display_code: CaseControlledValueSchema
});
export type ConsciousnessObservationDefinition = z.infer<
  typeof ConsciousnessObservationDefinitionSchema
>;

export const ObservationProjectionDefinitionSchema = z.strictObject({
  projection_schema_version: z.literal(OBSERVATION_PROJECTION_SCHEMA_VERSION),
  projection_definition_id: CaseControlledValueSchema,
  hemodynamic_mappings: z.record(
    CaseControlledValueSchema,
    HemodynamicObservationDefinitionSchema
  ),
  respiratory_mappings: z.record(
    CaseControlledValueSchema,
    RespiratoryObservationDefinitionSchema
  ),
  oxygenation_mappings: z.record(
    CaseControlledValueSchema,
    OxygenationObservationDefinitionSchema
  ),
  temperature_mappings: z.record(
    CaseControlledValueSchema,
    TemperatureObservationDefinitionSchema
  ).optional(),
  consciousness_mappings: z.record(
    CaseControlledValueSchema,
    ConsciousnessObservationDefinitionSchema
  ),
  rhythm_mappings: RhythmObservationMappingsSchema
});
export type ObservationProjectionDefinition = z.infer<
  typeof ObservationProjectionDefinitionSchema
>;

export const ObservationProjectionSchema = z.strictObject({
  observation_schema_version: z.literal(OBSERVATION_OUTPUT_SCHEMA_VERSION),
  projection_definition_id: CaseControlledValueSchema,
  session_id: SessionIdSchema,
  case_version: SemanticVersionSchema,
  state_version: StateVersionSchema,
  clinical_time: ClinicalTimeSchema,
  heart_rate_bpm: NonnegativeFiniteNumberSchema,
  systolic_bp_mm_hg: NonnegativeFiniteNumberSchema,
  diastolic_bp_mm_hg: NonnegativeFiniteNumberSchema,
  respiratory_rate_per_minute: NonnegativeFiniteNumberSchema,
  spo2_percent: z.number().finite().min(0).max(100),
  temperature_celsius: z.number().finite().optional(),
  consciousness_display_code: CaseControlledValueSchema,
  rhythm: RhythmObservationSchema
}).superRefine((value, context) => {
  if (value.systolic_bp_mm_hg <= value.diastolic_bp_mm_hg) {
    context.addIssue({
      code: "custom",
      path: ["systolic_bp_mm_hg"],
      message: "Systolic blood pressure must be greater than diastolic blood pressure"
    });
  }
});
export type ObservationProjection = z.infer<typeof ObservationProjectionSchema>;
