import { expect, it } from "vitest";

import {
  SESSION_ENGINE_PORTABILITY_EXPECTED,
  createSessionEnginePortabilitySnapshot
} from "../../fixtures/session-engine/synthetic-session.ts";
import {
  V2_006B_COMMAND_PORTABILITY_EXPECTED,
  V2_006C_COORDINATOR_PORTABILITY_EXPECTED,
  createV2006CPortabilitySnapshot,
  createV2006BPortabilitySnapshot
} from "../../fixtures/session-engine/synthetic-command.ts";

it("serializes the deterministic V2-006A snapshot identically in Browser", () => {
  expect(JSON.stringify(createSessionEnginePortabilitySnapshot())).toBe(
    SESSION_ENGINE_PORTABILITY_EXPECTED
  );
});

it("serializes the deterministic V2-006B command snapshot identically in Browser", async () => {
  expect(JSON.stringify(await createV2006BPortabilitySnapshot())).toBe(
    V2_006B_COMMAND_PORTABILITY_EXPECTED
  );
});

it("serializes the deterministic V2-006C coordinator snapshot identically in Browser", async () => {
  expect(JSON.stringify(await createV2006CPortabilitySnapshot())).toBe(
    V2_006C_COORDINATOR_PORTABILITY_EXPECTED
  );
});
