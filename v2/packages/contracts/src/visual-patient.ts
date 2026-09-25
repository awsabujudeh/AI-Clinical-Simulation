import { z } from "zod";

/** Learner-safe, downstream presentation only. No medical facts or state writes. */
export const VisualPatientPresentationSchema = z.strictObject({
  presentation_schema_version: z.literal("1.0"),
  asset_id: z.enum(["stemi.physical-exam-v02", "dana.review-v01"]),
  position: z.enum(["semi_fowler", "supine"]),
  face: z.enum(["neutral", "pain", "anxious", "relieved"]),
  body: z.enum(["pain_body", "itch_body", "calm_body", "none"]),
  breathing: z.boolean(),
  blink: z.boolean(),
  hand: z.boolean(),
  living: z.boolean(),
  // Downstream display only. Absence means no attached equipment.
  equipment: z.strictObject({ bp_cuff: z.boolean(), iv_access: z.boolean(), iv_tubing: z.boolean(), pulse_ox: z.enum(["ABSENT","APPLIED_VISUAL_PENDING"]).optional() })
    .refine(v => !v.iv_tubing || v.iv_access, "IV tubing requires established access.").optional()
}).superRefine((value, context) => {
  if ((value.asset_id === "stemi.physical-exam-v02" && value.body === "itch_body")
    || (value.asset_id === "dana.review-v01" && value.body === "pain_body")) {
    context.addIssue({ code: "custom", path: ["body"], message: "Body overlay is not supported by this patient asset." });
  }
});
export type VisualPatientPresentation = z.infer<typeof VisualPatientPresentationSchema>;

/** Local interaction intent; never a finding, execution receipt, or clinical effect. */
export const VisualExamRequestSchema = z.strictObject({
  type: z.literal("visual_exam_request"),
  tool: z.enum(["inspection", "stethoscope", "penlight"]),
  exam_mode: z.string().min(1).max(64),
  region_id: z.string().regex(/^[A-Z_]{1,48}$/),
  anchor_id: z.string().regex(/^[A-Za-z0-9_.-]{1,128}$/),
  patient_position: z.literal("supine")
});
export type VisualExamRequest = z.infer<typeof VisualExamRequestSchema>;
