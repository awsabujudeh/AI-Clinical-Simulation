import {
  WP2_PORTABLE_SHA256,
  wp2Fixture,
  wp2PortableSnapshot,
} from "../fixtures/wp2.ts";
import { PORTABLE_SHA256_ADAPTER as hash } from "../fixtures/portable-sha256.ts";
Deno.test("WP2 exact Browser/Deno catalogue, time, outcome evidence and observation equality", async () => {
  const a = await wp2PortableSnapshot(), b = await wp2PortableSnapshot();
  if (a !== b || await hash.sha256(a) !== WP2_PORTABLE_SHA256) {
    throw Error("WP2_PARITY_FAILED");
  }
});
Deno.test("WP2 both patients expose identical catalogues; foreign action cannot execute", async () => {
  const k = await wp2Fixture("khalid"), d = await wp2Fixture();
  if (
    JSON.stringify((await k.state()).learner_action_catalogue) !==
      JSON.stringify((await d.state()).learner_action_catalogue)
  ) throw Error("CATALOGUE_DIFFERS");
  if (
    (await d.action("medication.aspirin-324-chewed")).response.status !== 422 ||
    d.raw().committed_events.length
  ) throw Error("FOREIGN_BINDING_ACCEPTED");
});
