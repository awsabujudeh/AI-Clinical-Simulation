import { z } from "zod";

/** Learner-safe, downstream presentation only. No medical facts or state writes. */
export const VisualPatientPresentationSchema = z.strictObject({
  presentation_schema_version: z.literal("1.0"),
  asset_id: z.literal("stemi.physical-exam-v02"),
  position: z.enum(["semi_fowler", "supine"]),
  face: z.enum(["neutral", "pain", "anxious", "relieved"]),
  body: z.enum(["pain_body", "calm_body", "none"]),
  breathing: z.boolean(),
  blink: z.boolean(),
  hand: z.boolean(),
  living: z.boolean()
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
