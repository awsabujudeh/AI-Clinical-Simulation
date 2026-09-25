import { wp1Fixture } from "./wp1.ts";
export const WP2_PORTABLE_SHA256 =
  "e91fdfa88c1c1dddd2b43ebaffe671486939d54afe94b5684310f6b2e6680dfb";
export const wp2Fixture = (patient: "khalid" | "dana" = "dana") =>
  wp1Fixture(patient, "wp2");
export async function wp2PortableSnapshot() {
  const f = await wp2Fixture();
  await f.action("concept.expo.aspirin");
  await f.action("concept.expo.bp");
  const s = await f.state();
  return JSON.stringify({
    catalogue: s.learner_action_catalogue,
    time: s.clinical_time,
    outcomes: f.raw().committed_events.filter((e) => e.actor_type === "LEARNER")
      .map((e) => ({
        action: e.action_id,
        time: e.clinical_time,
        payload: e.payload,
      })),
    measurement: s.observations.acquired[0]?.measurement,
    cuff: s.visual_patient?.equipment?.bp_cuff,
  });
}
