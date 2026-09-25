import { z } from "zod";
import {
  ActionIdSchema,
  ClinicalTimeSchema,
  EventIdSchema,
  SequenceNumberSchema,
  SessionIdSchema,
} from "./ids.ts";

export const ObservationChannelSchema = z.enum([
  "HR",
  "BP",
  "RR",
  "SPO2",
  "TEMPERATURE",
  "RHYTHM",
  "CONSCIOUSNESS",
]);
export type ObservationChannel = z.infer<typeof ObservationChannelSchema>;
export const ObservationAcquisitionPolicySchema = z.strictObject({
  channels: z.array(ObservationChannelSchema).min(1).max(7),
  mode: z.enum(["SAMPLE", "CONTINUOUS"]),
  sample_channels: z.array(ObservationChannelSchema).max(7).optional(),
  duration_seconds: z.number().int().min(1).max(300),
}).superRefine((p, c) => {
  if (new Set(p.channels).size !== p.channels.length) {
    c.addIssue({ code: "custom", message: "Duplicate acquisition channel" });
  }
  const all = [...p.channels, ...(p.sample_channels ?? [])];
  if (new Set(all).size !== all.length) {
    c.addIssue({ code: "custom", message: "Duplicate sample/monitor channel" });
  }
  if (
    p.mode === "CONTINUOUS" &&
    p.channels.some((ch) => !["HR", "SPO2", "RHYTHM"].includes(ch))
  ) {
    c.addIssue({
      code: "custom",
      message:
        "Continuous acquisition supports HR, SpO2 and rhythm only; not continuous NIBP.",
    });
  }
});
export const ObservationValueSchema = z.discriminatedUnion("channel", [
  z.strictObject({
    channel: z.literal("HR"),
    value: z.number().finite().nonnegative(),
    unit: z.literal("bpm"),
  }),
  z.strictObject({
    channel: z.literal("BP"),
    systolic: z.number().finite().nonnegative(),
    diastolic: z.number().finite().nonnegative(),
    unit: z.literal("mmHg"),
  }),
  z.strictObject({
    channel: z.literal("RR"),
    value: z.number().finite().nonnegative(),
    unit: z.literal("/min"),
  }),
  z.strictObject({
    channel: z.literal("SPO2"),
    value: z.number().finite().min(0).max(100),
    unit: z.literal("%"),
  }),
  z.strictObject({
    channel: z.literal("TEMPERATURE"),
    value: z.number().finite(),
    unit: z.literal("C"),
  }),
  z.strictObject({
    channel: z.literal("RHYTHM"),
    value: z.string().min(1).max(120),
    unit: z.literal("code"),
  }),
  z.strictObject({
    channel: z.literal("CONSCIOUSNESS"),
    value: z.string().min(1).max(120),
    unit: z.literal("code"),
  }),
]).superRefine((v, c) => {
  if (v.channel === "BP" && v.systolic <= v.diastolic) {
    c.addIssue({ code: "custom", message: "Invalid BP sample" });
  }
});
export type ObservationValue = z.infer<typeof ObservationValueSchema>;
export const AcquiredObservationSchema = z.strictObject({
  measurement: ObservationValueSchema,
  status: z.enum(["MEASURED", "MONITORING", "PRE_OBSERVED"]),
  acquired_at: ClinicalTimeSchema,
  sampled_at: ClinicalTimeSchema,
  source_action: ActionIdSchema.optional(),
  source_event: EventIdSchema.optional(),
  source_sequence: SequenceNumberSchema.optional(),
}).superRefine((v, c) => {
  if (
    v.sampled_at < v.acquired_at ||
    (v.status !== "PRE_OBSERVED" &&
      (!v.source_action || !v.source_event || !v.source_sequence))
  ) {
    c.addIssue({
      code: "custom",
      message:
        "Acquisition needs monotonic timing and committed event provenance",
    });
  }
});
export const LearnerObservationsSchema = z.strictObject({
  observation_schema_version: z.literal("2.0"),
  session_id: SessionIdSchema,
  clinical_time: ClinicalTimeSchema,
  // A missing channel is NOT_MEASURED. No hidden value, descriptor or truth version.
  acquired: z.array(AcquiredObservationSchema).max(7),
}).superRefine((v, c) => {
  if (
    new Set(v.acquired.map((a) => a.measurement.channel)).size !==
      v.acquired.length ||
    v.acquired.some((a) => a.sampled_at > v.clinical_time)
  ) {
    c.addIssue({
      code: "custom",
      message: "Duplicate or future acquired observation",
    });
  }
});
export type LearnerObservations = z.infer<typeof LearnerObservationsSchema>;
