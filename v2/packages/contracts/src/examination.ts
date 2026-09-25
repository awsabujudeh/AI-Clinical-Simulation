import { z } from "zod";
import { ActionIdSchema, CaseVersionIdSchema, SemanticVersionSchema, SessionIdSchema, EventIdSchema, ClinicalTimeSchema } from "./ids.ts";

const Text = z.strictObject({locale:z.enum(["en-US","ar-JO"]),text:z.string().min(1).max(4000)});
export const ExamOptionSchema = z.strictObject({
  action_id:ActionIdSchema, labels:z.array(Text).length(2),
  region:z.enum(["GENERAL","AIRWAY","CHEST","ABDOMEN","SKIN","EXTREMITIES","NEUROLOGICAL"]),
  tool:z.enum(["inspection","stethoscope","clinical"]),
  duration_seconds:z.literal(30), repeat_policy:z.literal("REPEATABLE"),
});
export const ExamReceiptSchema = z.strictObject({
  session_id:SessionIdSchema, case_version_id:CaseVersionIdSchema, case_version:SemanticVersionSchema,
  event_id:EventIdSchema, sequence_no:z.number().int().positive(), clinical_time:ClinicalTimeSchema,
  action_id:ActionIdSchema, region:ExamOptionSchema.shape.region, tool:ExamOptionSchema.shape.tool,
  status:z.enum(["AVAILABLE","CURRENT_STATE_NOT_AUTHORED"]),
  findings:z.array(z.strictObject({fact_id:z.string().min(1).max(160),text:z.array(Text).length(2)})).max(8),
}).superRefine((r,c)=>{if((r.status==="AVAILABLE")!==(r.findings.length>0))c.addIssue({code:"custom",message:"Only an available examination may carry findings."});});
export const SafeExaminationProjectionSchema=z.strictObject({
  contract_version:z.literal("1.0.0"), options:z.array(ExamOptionSchema).max(32), receipts:z.array(ExamReceiptSchema).max(256),
});
export type ExamOption=z.infer<typeof ExamOptionSchema>;

/** Server-only pinned delivery binding, not a new clinical truth or client input. */
export const PinnedExamSchema=z.strictObject({
  option:ExamOptionSchema,
  baseline_state_signature:z.string(),
  findings:ExamReceiptSchema.shape.findings,
});
