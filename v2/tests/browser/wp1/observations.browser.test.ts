import { describe, expect, it } from "vitest";
import {
  WP1_PORTABLE_EXPECTED,
  wp1Fixture,
  wp1PortableSnapshot,
} from "../../fixtures/wp1.ts";
import {
  createObservationCase,
  WP1_ACTIONS as O,
} from "../../../content/cases/observations/wp1-cases.ts";
import { DANA_ACTIONS as A } from "../../../content/cases/anaphylaxis/dana-case.ts";
import { projectObservations } from "../../../packages/clinical-engine/src/index.ts";
import {
  projectAcquiredObservations,
  projectAssessmentEvidenceFromSession,
} from "../../../packages/session-engine/src/index.ts";
import {
  LearnerObservationsSchema,
  ObservationAcquisitionPolicySchema,
  SafeSessionProjectionSchema,
} from "../../../packages/contracts/src/index.ts";
import { PORTABLE_SHA256_ADAPTER } from "../../fixtures/portable-sha256.ts";
import { apiHeaders } from "../../fixtures/api/secure-api.ts";
import { validateDraftCase } from "../../../packages/case-schema/src/index.ts";

for (const patient of ["khalid", "dana"] as const) {
  describe(`WP1 ${patient}`, () => {
    it("starts at zero with absent learner vitals and no attached equipment; internal truth survives", async () => {
      const f = await wp1Fixture(patient), s = await f.state();
      expect(s.clinical_time).toBe(0);
      expect(s.observations.acquired).toEqual([]);
      expect(s.visual_patient?.equipment).toEqual({
        bp_cuff: false,
        iv_access: false,
        iv_tubing: false,
        pulse_ox: "ABSENT",
      });
      const truth = projectObservations(
        f.raw().patient_state,
        f.raw().pinned_case.clinical_policy.observation_projection,
      );
      expect(truth.success && truth.observations.heart_rate_bpm).toBe(
        patient === "dana" ? 126 : 112,
      );
      expect(JSON.stringify(s)).not.toMatch(
        /heart_rate_bpm|systolic_bp_mm_hg|respiratory_rate_per_minute|waveform_descriptor|hemodynamics\./,
      );
    });
    it("acquires only BP at completion with cuff, provenance, replay and no duplicate duration", async () => {
      const f = await wp1Fixture(patient), r = await f.action(O.bp);
      expect(r.response.status).toBe(200);
      const s = r.body.data.session, a = s.observations.acquired[0];
      expect(s.clinical_time).toBe(30);
      expect(s.observations.acquired).toHaveLength(1);
      expect(a).toMatchObject({
        measurement: { channel: "BP", systolic: patient === "dana" ? 82 : 88 },
        acquired_at: 30,
        sampled_at: 30,
        status: "MEASURED",
        source_action: O.bp,
        source_sequence: 1,
      });
      expect(s.visual_patient.equipment.bp_cuff).toBe(true);
      expect((await r.retry()).status).toBe(200);
      expect((await f.state()).clinical_time).toBe(30);
      expect(f.raw().committed_events).toHaveLength(1);
      expect(projectAssessmentEvidenceFromSession(f.raw()).success).toBe(true);
      expect(f.raw().committed_events[0]?.clinical_time).toBe(30);
    });
    it("acquires HR+SpO2 only through authored pulse-ox, leaves RR hidden despite breathing", async () => {
      const f = await wp1Fixture(patient);
      expect((await f.action(O.spo2)).response.status).toBe(200);
      const s = await f.state();
      expect(s.observations.acquired.map((a) => a.measurement.channel)).toEqual(
        ["HR", "SPO2"],
      );
      expect(s.visual_patient?.breathing).toBe(true);
      expect(s.visual_patient?.equipment?.pulse_ox).toBe(
        "APPLIED_VISUAL_PENDING",
      );
    });
    it("supports distinct pulse, RR and temperature samples with explicit time cost", async () => {
      const f = await wp1Fixture(patient);
      for (const id of [O.hr, O.rr, O.temperature]) {
        expect((await f.action(id)).response.status).toBe(200);
      }
      const s = await f.state();
      expect(s.clinical_time).toBe(90);
      expect(s.observations.acquired.map((a) => a.measurement.channel)).toEqual(
        ["HR", "RR", "TEMPERATURE"],
      );
    });
    it("rejects forged observations/time, cross-owner reads and stale expected versions", async () => {
      const f = await wp1Fixture(patient);
      expect(
        (await f.action(O.bp, { clinical_time: 900, observations: { BP: 1 } }))
          .response.status,
      ).toBe(400);
      expect(
        (await f.action(O.bp, { parameters: { observed_bp: 999 } })).response
          .status,
      ).toBe(422);
      expect((await f.response("/state", undefined, "other_learner")).status)
        .not.toBe(200);
      await f.action(O.bp);
      expect(
        (await f.action(O.rr, { expected_state_version: 0 })).response.status,
      ).toBe(409);
    });
    it("trusted elapsed time plus bounded compressed work is counted once; reload never resets", async () => {
      const f = await wp1Fixture(patient);
      f.elapsed(10);
      expect((await f.state()).clinical_time).toBe(10);
      await f.action(O.bp);
      expect((await f.state()).clinical_time).toBe(40);
      f.elapsed(15);
      expect((await f.state()).clinical_time).toBe(45);
      expect((await f.state()).clinical_time).toBe(45);
      f.elapsed(14);
      expect((await f.response("/state")).status).not.toBe(200);
      expect(f.raw().patient_state.clinical_time).toBe(45);
      expect(f.h.getPatientProviderCalls()).toBe(0);
      expect(f.h.getInterpreterProviderCalls()).toBe(0);
    });
    it("adapter failure rolls back time, samples, events and equipment atomically", async () => {
      const f = await wp1Fixture(patient);
      f.h.store.failNextCommit = true;
      expect((await f.action(O.bp)).response.status).not.toBe(200);
      expect((await f.state()).observations.acquired).toEqual([]);
      expect(f.raw().patient_state.clinical_time).toBe(0);
    });
  });
}

describe("WP1 lifecycle safety", () => {
  it("maximum-length valid request identities still synchronize", async () => {
    const f = await wp1Fixture();
    f.elapsed(1);
    const response = await f.h.app.request(f.path + "/state", {
      headers: {
        ...apiHeaders({ token: "faculty" }),
        "X-Request-Id": "r".repeat(128),
      },
    });
    expect(response.status).toBe(200);
    expect((await response.json()).data.clinical_time).toBe(1);
  });
  it("Khalid keeps a measured BP through delayed fluid support, then acquires improved BP", async () => {
    const f = await wp1Fixture("khalid");
    await f.action(O.bp);
    expect((await f.action("procedure.peripheral-iv")).response.status).toBe(
      200,
    );
    expect((await f.action("procedure.normal-saline-250")).response.status)
      .toBe(200);
    f.elapsed(600);
    const before = await f.state();
    expect(f.raw().patient_state.hemodynamic_state).toBe(
      "hemodynamics.stemi-modestly-supported",
    );
    expect(before.observations.acquired[0]?.measurement).toMatchObject({
      systolic: 88,
      diastolic: 60,
    });
    expect(before.visual_patient?.equipment).toMatchObject({
      bp_cuff: true,
      iv_access: true,
      iv_tubing: true,
    });
    const truth = projectObservations(
      f.raw().patient_state,
      f.raw().pinned_case.clinical_policy.observation_projection,
    );
    if (!truth.success) throw Error("Invalid case truth");
    await f.action(O.bp);
    const after = await f.state();
    expect(after.observations.acquired[0]?.measurement).toMatchObject({
      systolic: truth.observations.systolic_bp_mm_hg,
      diastolic: truth.observations.diastolic_bp_mm_hg,
    });
    expect(after.observations.acquired[0]?.sampled_at).toBe(660);
  });
  it("observation receipts are bound to Session identity and authoritative time", async () => {
    const f = await wp1Fixture();
    await f.action(O.bp);
    const s = await f.state();
    expect(
      SafeSessionProjectionSchema.safeParse({
        ...s,
        observations: { ...s.observations, session_id: "session.other" },
      }).success,
    ).toBe(false);
    expect(
      SafeSessionProjectionSchema.safeParse({
        ...s,
        observations: { ...s.observations, clinical_time: 31 },
      }).success,
    ).toBe(false);
  });
  it("invalid acquisition policy cannot enter a validated Case", async () => {
    const c = await createObservationCase("dana", PORTABLE_SHA256_ADAPTER);
    const a = c.action_catalogue.actions.find((a) => a.action_id === O.bp)!;
    a.action_type = "MEDICATION";
    expect(validateDraftCase(c).valid).toBe(false);
    a.action_type = "EXAMINATION";
    delete c.initial_state.observation_projection!.temperature_mappings;
    expect(validateDraftCase(c).valid).toBe(false);
  });
  it("matches the exact portable Deno evidence/time snapshot", async () => {
    expect(await wp1PortableSnapshot()).toBe(WP1_PORTABLE_EXPECTED);
    expect(await wp1PortableSnapshot()).toBe(WP1_PORTABLE_EXPECTED);
  });
  it("explicit handoff is allowed; unacquired legacy physiology is not", async () => {
    const f = await wp1Fixture();
    const s = structuredClone(f.raw());
    s.pinned_case.clinical_policy.observation_projection.pre_observed = [{
      channel: "BP",
      systolic: 82,
      diastolic: 48,
      unit: "mmHg",
    }];
    expect(projectAcquiredObservations(s).acquired).toEqual([{
      measurement: { channel: "BP", systolic: 82, diastolic: 48, unit: "mmHg" },
      status: "PRE_OBSERVED",
      acquired_at: 0,
      sampled_at: 0,
    }]);
  });
  it("replays after trusted time progresses without repeating acquisition", async () => {
    const f = await wp1Fixture();
    const r = await f.action(O.bp);
    f.elapsed(9);
    await f.state();
    expect((await r.retry()).status).toBe(200);
    expect(f.raw().committed_events).toHaveLength(1);
    expect((await f.state()).observations.acquired[0]?.sampled_at).toBe(30);
  });
  async function treat(f: Awaited<ReturnType<typeof wp1Fixture>>) {
    for (const id of [A.epi, A.oxygen, A.iv, A.fluids]) {
      expect((await f.action(id)).response.status).toBe(200);
    }
  }
  it("Dana one-time readings remain fixed after real delayed improvement; remeasure captures new truth", async () => {
    const f = await wp1Fixture();
    await f.action(O.bp);
    await f.action(O.spo2);
    await treat(f);
    f.elapsed(180);
    let s = await f.state();
    expect(f.raw().patient_state.hemodynamic_state).toBe(
      "hemodynamics.dana.improved",
    );
    expect(s.visual_patient?.face).toBe("relieved");
    expect(
      s.observations.acquired.find((a) => a.measurement.channel === "BP")
        ?.measurement,
    ).toMatchObject({ systolic: 82, diastolic: 48 });
    expect(
      s.observations.acquired.find((a) => a.measurement.channel === "SPO2")
        ?.measurement,
    ).toMatchObject({ value: 93 });
    await f.action(O.bp);
    s = await f.state();
    expect(
      s.observations.acquired.find((a) => a.measurement.channel === "BP")
        ?.measurement,
    ).toMatchObject({ systolic: 104, diastolic: 66 });
    expect(s.visual_patient?.equipment).toMatchObject({
      iv_access: true,
      iv_tubing: true,
    });
  });
  it("monitor refreshes HR/SpO2/rhythm, NOT BP; monitor survives remeasurement", async () => {
    const f = await wp1Fixture();
    await f.action(A.monitor);
    await f.action(O.hr);
    await treat(f);
    f.elapsed(180);
    const s = await f.state();
    expect(s.observations.acquired.find((a) => a.measurement.channel === "HR"))
      .toMatchObject({
        status: "MONITORING",
        measurement: { value: 98 },
        sampled_at: 240,
      });
    expect(s.observations.acquired.find((a) => a.measurement.channel === "BP"))
      .toMatchObject({
        status: "MEASURED",
        measurement: { systolic: 82 },
        sampled_at: 30,
      });
  });
  it("independent investigations complete without another action, never early", async () => {
    const f = await wp1Fixture();
    await f.action(A.epi);
    await f.action("investigation.dana.ecg");
    await f.action("investigation.dana.cxr");
    expect(f.raw().patient_state.clinical_time).toBe(0);
    expect(
      f.raw().scheduler_state.pending_items.filter((i) =>
        i.category.includes("diagnostic")
      ),
    ).toHaveLength(2);
    f.elapsed(59);
    await f.state();
    expect(
      f.raw().committed_events.filter((e) =>
        e.event_type === "INVESTIGATION_RESULT_AVAILABLE"
      ),
    ).toHaveLength(0);
    f.elapsed(60);
    await f.state();
    expect(
      f.raw().committed_events.filter((e) =>
        e.event_type === "INVESTIGATION_RESULT_AVAILABLE"
      ).map((e) => e.clinical_time),
    ).toEqual([60]);
    f.elapsed(300);
    await f.state();
    expect(
      f.raw().committed_events.filter((e) =>
        e.event_type === "INVESTIGATION_RESULT_AVAILABLE"
      ).map((e) => e.clinical_time),
    ).toEqual([60, 300]);
  });
  it("interrupt during measurement settles due work without acquisition or consumed learner key", async () => {
    const f = await wp1Fixture();
    f.elapsed(290);
    await f.state();
    const r = await f.action(O.bp);
    expect(r.response.status).toBe(422);
    expect(f.raw().patient_state.clinical_time).toBe(300);
    expect(projectAcquiredObservations(f.raw()).acquired).toEqual([]);
    expect(f.raw().idempotency_records).toHaveLength(0);
    expect(
      f.raw().committed_events.some((e) =>
        e.event_type === "CRITICAL_EVENT_OCCURRED"
      ),
    ).toBe(true);
  });
  it("old unsafe caches, forged schema fields, invalid repeat channels and continuous BP fail closed", () => {
    expect(
      LearnerObservationsSchema.safeParse({
        observation_schema_version: "1.0",
        heart_rate_bpm: 126,
      }).success,
    ).toBe(false);
    expect(
      ObservationAcquisitionPolicySchema.safeParse({
        channels: ["BP"],
        mode: "CONTINUOUS",
        duration_seconds: 30,
      }).success,
    ).toBe(false);
    expect(
      ObservationAcquisitionPolicySchema.safeParse({
        channels: ["HR", "HR"],
        mode: "SAMPLE",
        duration_seconds: 30,
      }).success,
    ).toBe(false);
  });
  it("successor keeps physiological truth/rules/rubric separate and each patient isolated", async () => {
    const d = await wp1Fixture(), k = await wp1Fixture("khalid");
    await d.action(O.bp);
    expect((await k.state()).observations.acquired).toEqual([]);
    expect(k.raw().patient_state.case_version).toBe("2.1.0");
    const c = await createObservationCase("dana", PORTABLE_SHA256_ADAPTER);
    expect(c.manifest.status).toBe("UNDER_REVIEW");
    expect(
      SafeSessionProjectionSchema.safeParse({
        ...await d.state(),
        observations: { ...projectAcquiredObservations(d.raw()), hidden: 82 },
      }).success,
    ).toBe(false);
  });
});
