import { z } from "zod";

/** Operator-only metadata. Never a clinical receipt or authority to execute. */
export const ReadinessSchema = z.enum(["READY", "DEGRADED", "BLOCKED"]);
export type Readiness = z.infer<typeof ReadinessSchema>;
export const CheckIdSchema = z.enum([
  "build", "clinical", "stemi", "dana", "stemi_visual", "dana_visual", "shared_ed",
  "diagnostics", "patient_stemi", "patient_dana", "assessment", "knowledge", "faculty",
  "ai_config", "voice_stemi", "voice_dana", "hosts", "cache"
]);
export type CheckId = z.infer<typeof CheckIdSchema>;
export const CheckSchema = z.strictObject({
  id: CheckIdSchema, status: ReadinessSchema,
  code: z.string().regex(/^[A-Z][A-Z0-9_]{1,79}$/),
  detail: z.string().max(650)
});
export type Check = z.infer<typeof CheckSchema>;
export const HostReadinessSchema = z.strictObject({
  schema_version: z.literal("1.0"), host: z.enum(["stemi", "dana", "tutor", "faculty"]),
  boot_id: z.string().uuid(), commit: z.string().regex(/^[a-f0-9]{40}$/).nullable(),
  source_hash: z.string().regex(/^[a-f0-9]{64}$/), hardening_baseline: z.boolean(),
  patient: z.boolean(), voice: z.boolean(), tutor: z.boolean(),
  locale: z.literal("ar-JO"), provider_calls: z.literal("NOT_PROBED")
});
export type HostReadiness = z.infer<typeof HostReadinessSchema>;
export const PreflightReportSchema = z.strictObject({
  schema_version: z.literal("1.0"), scope: z.literal("TRUSTED_LOCAL_SYNTHETIC_EXPO"),
  run_id: z.string().uuid(), checked_at: z.string().datetime(), duration_ms: z.number().int().nonnegative(),
  build: z.strictObject({ version: z.string().max(40), commit: z.string().regex(/^[a-f0-9]{40}$/).nullable(),
    source_hash: z.string().regex(/^[a-f0-9]{64}$/), working_tree: z.enum(["CLEAN", "MODIFIED", "UNKNOWN"]) }),
  overall: ReadinessSchema, blockers: z.number().int().nonnegative(), degraded: z.number().int().nonnegative(),
  checks: z.array(CheckSchema).length(CheckIdSchema.options.length),
  information: z.array(z.strictObject({
    id: z.enum(["stemi_review", "dana_review", "media_review", "clinical_sources", "ju", "just", "live", "production"]),
    status: z.enum(["REVIEW_PENDING", "SOURCE_PENDING", "NOT_PROBED", "PRODUCTION_PENDING"]),
    detail: z.string().max(650)
  })).max(8),
  hosts: z.array(z.strictObject({ port: z.number().int().min(4186).max(4199),
    state: z.enum(["CURRENT", "STALE_REVIEW_HOST", "NOT_RUNNING", "UNVERIFIABLE"]),
    host: HostReadinessSchema.nullable() })).max(9),
  provider_requests: z.literal(0), clinical_mutations: z.literal(0)
}).superRefine((v, c) => {
  const s = aggregateReadiness(v.checks);
  if (new Set(v.checks.map(i => i.id)).size !== CheckIdSchema.options.length
    || s.overall !== v.overall || s.blockers !== v.blockers || s.degraded !== v.degraded)
    c.addIssue({ code: "custom", message: "Incomplete or inconsistent readiness report." });
});
export type PreflightReport = z.infer<typeof PreflightReportSchema>;
export function aggregateReadiness(checks: readonly Pick<Check, "status">[]) {
  const blockers = checks.filter(c => c.status === "BLOCKED").length;
  const degraded = checks.filter(c => c.status === "DEGRADED").length;
  return { overall: (blockers || checks.length === 0 ? "BLOCKED" : degraded ? "DEGRADED" : "READY") as Readiness, blockers, degraded };
}
export function visualReadiness(primary: boolean, fallback: boolean): Readiness {
  return primary && fallback ? "READY" : fallback ? "DEGRADED" : primary ? "DEGRADED" : "BLOCKED";
}
