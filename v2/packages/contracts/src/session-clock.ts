import { z } from "zod";

import { ClinicalTimeSchema } from "./ids.ts";

export const SESSION_CLOCK_SCHEMA_VERSION = "1.0" as const;

export const ClinicalTimeRatioSchema = z.number().finite().positive().max(100);
export type ClinicalTimeRatio = z.infer<typeof ClinicalTimeRatioSchema>;

export const TimelinePausePolicySchema = z.enum([
  "PAUSE_CLINICAL_TIME",
  "CASE_DEFINED"
]);
export type TimelinePausePolicy = z.infer<typeof TimelinePausePolicySchema>;

export const SessionClinicalClockStatusSchema = z.enum(["RUNNING", "PAUSED"]);
export type SessionClinicalClockStatus = z.infer<
  typeof SessionClinicalClockStatusSchema
>;

export const SessionClinicalClockSchema = z.strictObject({
  clock_schema_version: z.literal(SESSION_CLOCK_SCHEMA_VERSION),
  status: SessionClinicalClockStatusSchema,
  clinical_time: ClinicalTimeSchema
});
export type SessionClinicalClock = z.infer<typeof SessionClinicalClockSchema>;

// Normal clock input is quantized to whole elapsed wall seconds. The Expo
// ratio is 1.0; no runtime clock or fractional accumulation belongs here.
export const ElapsedRealSecondsSchema = z.number().int().nonnegative().max(
  Number.MAX_SAFE_INTEGER
);
export type ElapsedRealSeconds = z.infer<typeof ElapsedRealSecondsSchema>;

export const SameTimeOrderingSchema = z.literal(
  "DUE_WORK_BEFORE_EXTERNAL_COMMAND"
);
export type SameTimeOrdering = z.infer<typeof SameTimeOrderingSchema>;

export const SAME_TIME_ORDERING = SameTimeOrderingSchema.value;
