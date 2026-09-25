import {z} from 'zod';
import {SubmitClinicalInterpretationRequestSchema, ClinicalInterpretationSchema} from './clinical-interpreter.ts';
export const QuickOrderRequestSchema=SubmitClinicalInterpretationRequestSchema;
export const QuickOrderPlanSchema=z.strictObject({
  plan_id:z.string(), session_id:z.string(), grounded_state_version:z.number().int(),
  fragments:z.array(z.strictObject({text:z.string(),interpretation:ClinicalInterpretationSchema})).min(1).max(8),
  execution_policy:z.literal('CONFIRMED_SEQUENTIAL_STOP_ON_FAILURE'),
});
export const QuickOrderConfirmSchema=z.strictObject({plan_id:z.string().max(128),confirmed:z.literal(true),
  selected_indexes:z.array(z.number().int().min(0).max(7)).min(1).max(8)});
export type QuickOrderPlan=z.infer<typeof QuickOrderPlanSchema>;
export type QuickOrderConfirm=z.infer<typeof QuickOrderConfirmSchema>;
