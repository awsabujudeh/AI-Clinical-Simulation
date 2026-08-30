import { z } from "zod";

import {
  ClinicalTimeSchema,
  ComplicationIdSchema,
  InterventionIdSchema,
  SchemaVersionSchema,
  SemanticVersionSchema,
  SessionIdSchema,
  StateVersionSchema
} from "./ids.ts";
import { JsonObjectSchema } from "./json.ts";

export const CaseControlledValueSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(
    /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u,
    "Expected a language-neutral case-controlled value"
  )
  .brand<"CaseControlledValue">();
export type CaseControlledValue = z.infer<typeof CaseControlledValueSchema>;

export const PainStateSchema = z.strictObject({
  severity_0_10: z.number().int().min(0).max(10),
  location_codes: z.array(CaseControlledValueSchema),
  quality_codes: z.array(CaseControlledValueSchema),
  trend: CaseControlledValueSchema
});
export type PainState = z.infer<typeof PainStateSchema>;

export const ActiveInterventionSchema = z.strictObject({
  intervention_id: InterventionIdSchema,
  intervention_type: CaseControlledValueSchema,
  started_at_clinical_time: ClinicalTimeSchema,
  parameters: JsonObjectSchema
});
export type ActiveIntervention = z.infer<typeof ActiveInterventionSchema>;

export const ActiveComplicationSchema = z.strictObject({
  complication_id: ComplicationIdSchema,
  complication_type: CaseControlledValueSchema,
  activated_at_clinical_time: ClinicalTimeSchema,
  attributes: JsonObjectSchema
});
export type ActiveComplication = z.infer<typeof ActiveComplicationSchema>;

export const PatientStateSchema = z.strictObject({
  state_schema_version: SchemaVersionSchema,
  state_version: StateVersionSchema,
  session_id: SessionIdSchema,
  case_version: SemanticVersionSchema,
  clinical_time: ClinicalTimeSchema,
  clinical_phase: CaseControlledValueSchema,
  hemodynamic_state: CaseControlledValueSchema,
  cardiac_rhythm: CaseControlledValueSchema,
  perfusion: CaseControlledValueSchema,
  respiratory_state: CaseControlledValueSchema,
  oxygenation: CaseControlledValueSchema,
  consciousness: CaseControlledValueSchema,
  neurologic_state: CaseControlledValueSchema,
  temperature_state: CaseControlledValueSchema,
  metabolic_state: CaseControlledValueSchema,
  pain_state: PainStateSchema,
  active_interventions: z.array(ActiveInterventionSchema),
  active_complications: z.array(ActiveComplicationSchema),
  outcome_flags: z.array(CaseControlledValueSchema)
});
export type PatientState = z.infer<typeof PatientStateSchema>;
