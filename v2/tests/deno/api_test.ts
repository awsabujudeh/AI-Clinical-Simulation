import {
  V2_013_API_PORTABILITY_EXPECTED,
  createApiTestHarness,
  createV2013ApiPortabilitySnapshot
} from "../fixtures/api/secure-api.ts";

Deno.test("V2-013 Deno/Edge API executes the same deterministic transport path", async () => {
  const first = JSON.stringify(await createV2013ApiPortabilitySnapshot());
  const second = JSON.stringify(await createV2013ApiPortabilitySnapshot());
  if (first !== V2_013_API_PORTABILITY_EXPECTED || second !== first) {
    throw new Error(`V2-013 API output was nondeterministic:\n${first}\n${second}`);
  }
});

Deno.test("V2-013 CORS uses an exact allowlist and fails closed", async () => {
  const harness = await createApiTestHarness({ include_stemi: false });
  const allowed = await harness.app.request("/health", {
    headers: { Origin: "http://localhost:5173" }
  });
  if (allowed.headers.get("Access-Control-Allow-Origin") !== "http://localhost:5173") {
    throw new Error("Configured local origin was not returned exactly.");
  }
  const denied = await harness.app.request("/health", {
    headers: { Origin: "https://attacker.invalid" }
  });
  if (denied.status !== 403 || denied.headers.get("Access-Control-Allow-Origin") !== null) {
    throw new Error("Unconfigured origin was not denied safely.");
  }
});
