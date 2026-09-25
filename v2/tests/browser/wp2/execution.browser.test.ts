import { describe, expect, it } from "vitest";
import { wp2Fixture } from "../../fixtures/wp2.ts";
const truth = (f: Awaited<ReturnType<typeof wp2Fixture>>) => {
  const { clinical_time: _, state_version: __, ...rest } =
    f.raw().patient_state;
  return rest;
};
for (const patient of ["khalid", "dana"] as const) {
  describe(`WP2 ${patient} execution`, () => {
    it("commits appropriate medication with time and internal evidence, retaining authored physiology", async () => {
      const f = await wp2Fixture(patient), before = truth(f);
      const r = await f.action(
        patient === "khalid"
          ? "concept.expo.aspirin"
          : "concept.expo.epinephrine",
      );
      expect(r.response.status).toBe(200);
      expect(f.raw().patient_state.clinical_time).toBe(30);
      expect(
        f.raw().committed_events.find((e) => e.actor_type === "LEARNER")
          ?.payload,
      ).toMatchObject({
        case_outcome_behavior: "AUTHORED_CASE_BEHAVIOR",
        action_duration_seconds: 30,
      });
      if (patient === "khalid") expect(truth(f)).toEqual(before);
      else {
        expect(f.raw().patient_state.outcome_flags).toContain(
          "outcome.dana.epi-given",
        );
        expect(f.raw().patient_state.hemodynamic_state).toBe(
          "hemodynamics.dana.initial",
        );
      }
      expect(JSON.stringify(r.body.data.session.learner_action_catalogue)).not
        .toContain("case_outcome");
    });
    it("commits non-beneficial medication without invented physiology or public correctness", async () => {
      const f = await wp2Fixture(patient), before = truth(f);
      const r = await f.action(
        patient === "khalid"
          ? "concept.expo.epinephrine"
          : "concept.expo.aspirin",
      );
      expect(r.response.status).toBe(200);
      expect(truth(f)).toEqual(before);
      expect(f.raw().patient_state.clinical_time).toBe(30);
      expect(f.raw().committed_events[0]?.payload).toMatchObject({
        case_outcome_behavior: "NO_MODELED_BENEFIT",
      });
      expect(JSON.stringify(r.body)).not.toMatch(
        /NO_MODELED_BENEFIT|case_outcome_code|outcome_policy_version/,
      );
      expect((await r.retry()).status).toBe(200);
      expect(f.raw().committed_events).toHaveLength(1);
    });
    it("supported distractor fluid requires access, commits with tubing, and does not invent response", async () => {
      const f = await wp2Fixture(patient),
        id = patient === "khalid"
          ? "concept.expo.crystalloid-500"
          : "concept.expo.saline-250";
      expect((await f.action(id)).response.status).toBe(422);
      expect(f.raw().committed_events).toHaveLength(0);
      expect(f.raw().patient_state.clinical_time).toBe(0);
      await f.action("concept.expo.iv");
      const before = truth(f);
      expect((await f.action(id)).response.status).toBe(200);
      expect(truth(f)).toEqual(before);
      expect((await f.state()).visual_patient?.equipment).toMatchObject({
        iv_access: true,
        iv_tubing: true,
      });
      expect(f.raw().patient_state.clinical_time).toBe(30);
    });
    it("validates fixed orders, rejects invented dose/route and duplicate medication/IV", async () => {
      const f = await wp2Fixture(patient);
      for (
        const parameters of [{ dose: 999 }, { route: "IV" }, {
          effect: "normal",
        }]
      ) {
        expect(
          (await f.action("concept.expo.aspirin", { parameters })).response
            .status,
        ).toBe(422);
      }
      await f.action("concept.expo.iv");
      expect((await f.action("concept.expo.iv")).response.status).toBe(422);
      await f.action("concept.expo.aspirin");
      expect((await f.action("concept.expo.aspirin")).response.status).toBe(
        422,
      );
      expect(f.raw().committed_events.filter((e) => e.actor_type === "LEARNER"))
        .toHaveLength(2);
    });
    it("preserves hidden observations, repeat BP, pulse-ox and committed devices", async () => {
      const f = await wp2Fixture(patient);
      expect((await f.state()).observations.acquired).toEqual([]);
      await f.action("concept.expo.bp");
      await f.action("concept.expo.bp");
      await f.action("concept.expo.pulse-ox");
      const s = await f.state();
      expect(s.clinical_time).toBe(75);
      expect(s.observations.acquired.map((a) => a.measurement.channel).sort())
        .toEqual(["BP", "HR", "SPO2"]);
      expect(s.visual_patient?.equipment).toMatchObject({
        bp_cuff: true,
        pulse_ox: "APPLIED_VISUAL_PENDING",
      });
    });
    it("preserves parallel ECG/CXR milestones, no early result, pinned result mapping", async () => {
      const f = await wp2Fixture(patient);
      await f.action("concept.expo.ecg");
      await f.action("concept.expo.cxr");
      const ecgTime = patient === "khalid" ? 135 : 75, cxrTime = 330;
      const ecgId = patient === "khalid"
        ? "diagnostic-result.stemi.ecg-standard"
        : "diagnostic-result.dana.ecg";
      const result = () => f.response(`/investigations/${ecgId}`);
      expect(f.raw().patient_state.clinical_time).toBe(30);
      f.elapsed(ecgTime - 31);
      await f.state();
      expect(
        f.raw().committed_events.filter((e) =>
          e.event_type === "INVESTIGATION_RESULT_AVAILABLE"
        ),
      ).toHaveLength(0);
      f.elapsed(ecgTime - 30);
      await f.state();
      expect(
        f.raw().committed_events.filter((e) =>
          e.event_type === "INVESTIGATION_RESULT_AVAILABLE"
        ).map((e) => e.clinical_time),
      ).toEqual([ecgTime]);
      // Prevent Dana's unrelated five-minute no-treatment interruption in this scheduling proof.
      if (patient === "dana") await f.action("concept.expo.epinephrine");
      f.elapsed(cxrTime - (patient === "dana" ? 60 : 30));
      await f.state();
      expect(
        f.raw().committed_events.filter((e) =>
          e.event_type === "INVESTIGATION_RESULT_AVAILABLE"
        ).map((e) => e.clinical_time),
      ).toEqual([ecgTime, cxrTime]);
      expect((await result()).status).toBe(200);
      expect(f.h.getPatientProviderCalls() + f.h.getInterpreterProviderCalls())
        .toBe(0);
    });
    it("blocks raw/foreign binding and outcome forgery without clinical mutation", async () => {
      const f = await wp2Fixture(patient), before = truth(f);
      for (
        const id of [
          "medication.aspirin-324-chewed",
          "medication.dana.epinephrine-im-05",
          "concept.expo.fake",
        ]
      ) expect((await f.action(id)).response.status).toBe(422);
      expect(
        (await f.action("concept.expo.aspirin", {
          case_action_id: "medication.dana.epinephrine-im-05",
          outcome: "benefit",
        })).response.status,
      ).not.toBe(200);
      expect(truth(f)).toEqual(before);
      expect(f.raw().committed_events).toHaveLength(0);
      expect((await f.response("/state", undefined, "other-learner")).status)
        .toBe(404);
      expect((await f.response("/state", undefined, "cross-reviewer")).status)
        .toBe(404);
    });
    it("atomic adapter failure cannot leave time, devices or outcome evidence", async () => {
      const f = await wp2Fixture(patient);
      f.h.store.failNextCommit = true;
      expect((await f.action("concept.expo.bp")).response.status).not.toBe(200);
      expect(f.raw().patient_state.clinical_time).toBe(0);
      expect(f.raw().committed_events).toHaveLength(0);
    });
  });
}
describe("WP2 Dana retained treatment and timing rules", () => {
  it("retains early-repeat unsafe evidence and prior-dose prerequisite", async () => {
    const f = await wp2Fixture();
    expect((await f.action("concept.expo.repeat-epinephrine")).response.status)
      .toBe(422);
    await f.action("concept.expo.epinephrine");
    expect((await f.action("concept.expo.repeat-epinephrine")).response.status)
      .toBe(200);
    expect(f.raw().patient_state.outcome_flags).toContain(
      "outcome.dana.repeat-outside-window",
    );
    expect(
      f.raw().committed_events.some((e) =>
        e.event_type === "CRITICAL_EVENT_OCCURRED"
      ),
    ).toBe(true);
  });
  it("correct treatment retains delayed improvement and sample-vs-monitor semantics", async () => {
    const f = await wp2Fixture();
    await f.action("concept.expo.monitor");
    for (const id of ["epinephrine", "oxygen", "iv", "crystalloid-500"]) {
      expect((await f.action(`concept.expo.${id}`)).response.status).toBe(200);
    }
    expect(f.raw().patient_state.outcome_flags).not.toContain(
      "outcome.dana.improved",
    );
    f.elapsed(180);
    const s = await f.state();
    expect(f.raw().patient_state.outcome_flags).toContain(
      "outcome.dana.improved",
    );
    expect(
      s.observations.acquired.find((a) => a.measurement.channel === "HR")
        ?.measurement,
    ).toMatchObject({ value: 98 });
    expect(s.observations.acquired.find((a) => a.measurement.channel === "BP"))
      .toMatchObject({ status: "MEASURED", measurement: { systolic: 82 } });
  });
});
