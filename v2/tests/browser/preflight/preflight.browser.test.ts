import { describe, it, expect } from "vitest";
import { aggregateReadiness, visualReadiness, HostReadinessSchema } from "../../../runtime/preflight-model.ts";
import { inspectDomain, inspectReviewCase } from "../../../runtime/preflight-domain.ts";
import { prepareDanaReview } from "../../../content/cases/anaphylaxis/dana-case.ts";
import { PORTABLE_SHA256_ADAPTER } from "../../fixtures/portable-sha256.ts";

describe("operator readiness, downstream only", () => {
  it("aggregates READY, DEGRADED, BLOCKED without an empty false green", () => {
    expect(aggregateReadiness([{ status: "READY" }])).toEqual({ overall: "READY", blockers: 0, degraded: 0 });
    expect(aggregateReadiness([{ status: "READY" }, { status: "DEGRADED" }])).toEqual({ overall: "DEGRADED", blockers: 0, degraded: 1 });
    expect(aggregateReadiness([{ status: "BLOCKED" }, { status: "DEGRADED" }])).toEqual({ overall: "BLOCKED", blockers: 1, degraded: 1 });
    expect(aggregateReadiness([]).overall).toBe("BLOCKED");
  });
  it.each([[true, true, "READY"], [false, true, "DEGRADED"], [true, false, "DEGRADED"], [false, false, "BLOCKED"]] as const)
    ("visual primary %s and fallback %s => %s", (primary, fallback, status) => expect(visualReadiness(primary, fallback)).toBe(status));
  it("validates both actual cases, local Clinical Engine, six-domain assessment, Tutor fallback, RAG and Faculty", async () => {
    const checks = await inspectDomain();
    expect(checks).toHaveLength(8); expect(checks.every(c => c.status === "READY")).toBe(true);
    expect(checks.find(c => c.id === "stemi")!.detail).toContain("2.0.1");
    expect(checks.find(c => c.id === "dana")!.detail).toContain("1.0.0");
    expect(checks.find(c => c.id === "knowledge")!.detail).toContain("0 trusted real documents");
    expect(checks.find(c => c.id === "faculty")!.detail).toContain("SERVER-MEMORY DEMO");
    expect(checks.find(c => c.id === "assessment")!.detail).toContain("SNAPSHOT");
    expect(JSON.stringify(checks)).not.toMatch(/fact\.dana|fact\.stemi|patient_state|instructions|Authorization/);
    expect(await inspectDomain()).toEqual(checks);
    expect(await PORTABLE_SHA256_ADAPTER.sha256(JSON.stringify(checks))).toBe("ea126ec5c885747ae4005ff1cac481b61986aa6466e1da5331b416be5bcf5f17");
  });
  it("does not mutate the Case, initial state, review status or accept a swapped Case pin", async () => {
    const prepared = await prepareDanaReview(PORTABLE_SHA256_ADAPTER); if (!prepared.success) throw Error();
    const before = JSON.stringify(prepared.artifact);
    expect(await inspectReviewCase("dana", prepared.artifact)).toMatchObject({ patient: true, unchanged: true });
    expect(JSON.stringify(prepared.artifact)).toBe(before);
    await expect(inspectReviewCase("stemi", prepared.artifact)).rejects.toThrow("CASE_HASH_MISMATCH");
    const changed = structuredClone(prepared.artifact); changed.review_execution_hash = "0".repeat(64) as never;
    await expect(inspectReviewCase("dana", changed)).rejects.toThrow("CASE_HASH_MISMATCH");
  });
  it("host heartbeat accepts boolean-only capabilities, never credentials or profile objects", () => {
    const safe = { schema_version: "1.0", host: "dana", boot_id: "11111111-1111-4111-8111-111111111111", commit: null,
      source_hash: "a".repeat(64), hardening_baseline: false, patient: false, voice: false, tutor: false, locale: "ar-JO", provider_calls: "NOT_PROBED" };
    expect(HostReadinessSchema.safeParse(safe).success).toBe(true);
    for (const extra of [{ api_key: "synthetic-secret" }, { token: "synthetic-token" }, { voice_profile: {} }, { prompt: "hidden" }])
      expect(HostReadinessSchema.safeParse({ ...safe, ...extra }).success).toBe(false);
  });
});
