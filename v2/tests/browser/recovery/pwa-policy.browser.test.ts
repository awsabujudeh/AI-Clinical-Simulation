import { describe, expect, it } from "vitest";

import {
  APP_SHELL_CACHE_ID,
  classifyBrowserCacheRequest
} from "../../../apps/web/src/offline/cache-policy.ts";
import {
  createFetchRecoveryTransport
} from "../../../apps/web/src/offline/fetch-recovery-transport.ts";
import { toMutationHttpRequest } from "../../../packages/recovery-core/src/index.ts";
import { createStartRecoveryRequest } from "../../fixtures/recovery/synthetic-recovery.ts";

describe("V2-014A PWA and private-data boundaries", () => {
  it("allows static application-shell assets but not private Session APIs", () => {
    expect(classifyBrowserCacheRequest({
      url: "/assets/app.abc123.js",
      has_authorization_header: false,
      method: "GET"
    })).toBe("STATIC_APP_SHELL");
    expect(classifyBrowserCacheRequest({
      url: "/v1/sessions/session.test/state",
      has_authorization_header: false,
      method: "GET"
    })).toBe("NETWORK_ONLY_PRIVATE");
    expect(classifyBrowserCacheRequest({
      url: "/assets/app.js",
      has_authorization_header: true,
      method: "GET"
    })).toBe("NETWORK_ONLY_PRIVATE");
  });

  it("keeps application cache identity independent of Case/API versions", () => {
    expect(APP_SHELL_CACHE_ID).toBe("ai-clinical-simulation-v2-app-shell");
    expect(APP_SHELL_CACHE_ID).not.toMatch(/case|2\.0\.0|api/iu);
  });

  it("injects current authorization only at send time and prevents HTTP caching", async () => {
    let captured: { url?: string; init?: RequestInit } = {};
    const transport = createFetchRecoveryTransport({
      api_origin: "https://api.test.invalid",
      get_authorization_header: async () => "Bearer current-token",
      fetch: async (url, init) => {
        captured = { url: String(url), init };
        return new Response(JSON.stringify({ error: "synthetic" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }
    });
    const request = toMutationHttpRequest(createStartRecoveryRequest());
    await transport.send(request);
    expect(new Headers(captured.init?.headers).get("Authorization"))
      .toBe("Bearer current-token");
    expect(captured.init?.cache).toBe("no-store");
    expect(JSON.stringify(request)).not.toContain("current-token");
  });

  it("distinguishes request-construction failure from ambiguous fetch failure", async () => {
    const transport = createFetchRecoveryTransport({
      api_origin: "https://api.test.invalid",
      get_authorization_header: async () => { throw new Error("expired"); },
      fetch: async () => { throw new Error("unreachable"); }
    });
    expect(await transport.send(toMutationHttpRequest(createStartRecoveryRequest())))
      .toEqual({
        kind: "NOT_SENT",
        failure: "REQUEST_CONSTRUCTION_FAILURE"
      });
    const ambiguous = createFetchRecoveryTransport({
      api_origin: "https://api.test.invalid",
      get_authorization_header: async () => "Bearer current-token",
      fetch: async () => { throw new Error("unreachable"); }
    });
    expect(await ambiguous.send(toMutationHttpRequest(createStartRecoveryRequest())))
      .toEqual({
        kind: "AMBIGUOUS_TRANSPORT_FAILURE",
        failure: "BEFORE_RESPONSE_CERTAINTY"
      });
  });
});
