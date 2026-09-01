import {
  SESSION_ENGINE_PORTABILITY_EXPECTED,
  createSessionEnginePortabilitySnapshot
} from "../fixtures/session-engine/synthetic-session.ts";
import {
  V2_006B_COMMAND_PORTABILITY_EXPECTED,
  V2_006C_COORDINATOR_PORTABILITY_EXPECTED,
  createV2006CPortabilitySnapshot,
  createV2006BPortabilitySnapshot
} from "../fixtures/session-engine/synthetic-command.ts";

Deno.test("V2-006A Session Engine produces the exact portable snapshot", () => {
  const actual = JSON.stringify(createSessionEnginePortabilitySnapshot());
  if (actual !== SESSION_ENGINE_PORTABILITY_EXPECTED) {
    throw new Error(`Session Engine portability mismatch:\n${actual}`);
  }
});

Deno.test("V2-006B command orchestration produces the exact portable snapshot", async () => {
  const actual = JSON.stringify(await createV2006BPortabilitySnapshot());
  if (actual !== V2_006B_COMMAND_PORTABILITY_EXPECTED) {
    throw new Error(`Session command portability mismatch:\n${actual}`);
  }
});

Deno.test("V2-006C coordinator produces the exact portable snapshot", async () => {
  const actual = JSON.stringify(await createV2006CPortabilitySnapshot());
  if (actual !== V2_006C_COORDINATOR_PORTABILITY_EXPECTED) {
    throw new Error(`Session coordinator portability mismatch:\n${actual}`);
  }
});
