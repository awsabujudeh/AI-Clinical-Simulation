import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  IdempotencyKeySchema,
  PatientLanguageSchema
} from "../../../packages/contracts/src/index.ts";

import { App } from "../../../apps/web/src/App.tsx";
import {
  formatClinicalTime,
  isSessionMutationEntryEnabled,
  mapHttpStatusToSafeError,
  presentSessionLoad
} from "../../../apps/web/src/app/session-presentation.ts";
import {
  sessionLoadFromRecovery,
  startSessionFromRecovery
} from "../../../apps/web/src/app/services.ts";
import type { StudentUiServices } from "../../../apps/web/src/app/types.ts";
import "../../../apps/web/src/styles.css";
import {
  SYNTHETIC_ASSESSMENT_SESSION,
  SYNTHETIC_SAFE_SESSION,
  SYNTHETIC_STALE_SESSION
} from "../../fixtures/student-ui/safe-session.ts";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

function services(input: Partial<StudentUiServices> = {}): StudentUiServices {
  return {
    auth: input.auth ?? {
      async resolve() {
        return {
          status: "AUTHENTICATED" as const,
          principal_user_id: "20000000-0000-4000-8000-000000000015",
          display_name: "Student"
        };
      }
    },
    sessions: input.sessions ?? {
      async load() {
        return {
          kind: "AUTHORITATIVE" as const,
          connectivity: "ONLINE" as const,
          projection: SYNTHETIC_SAFE_SESSION
        };
      },
      async start() {
        return {
          success: true as const,
          projection: SYNTHETIC_SAFE_SESSION,
          patient_language: PatientLanguageSchema.parse("en-US"),
          replayed: false
        };
      }
    },
    actions: input.actions ?? {
      async submit() {
        return {
          kind: "COMMITTED" as const,
          replayed: false,
          idempotency_key: "idempotency.ui.action",
          committed_event_ids: ["00000000-0000-4000-8000-000000000015"],
          projection: SYNTHETIC_SAFE_SESSION
        };
      }
    }
  };
}

async function render(path: string, uiServices = services()) {
  await act(async () => {
    root.render(<App services={uiServices} initialEntries={[path]} />);
  });
}

async function settle(predicate: () => boolean) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (predicate()) return;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  }
  throw new Error("Student UI did not settle into the expected state.");
}

function text() {
  return host.textContent ?? "";
}

beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  document.documentElement.lang = "en-US";
  document.documentElement.dir = "ltr";
});

describe("V2-015 learner routing and authentication shell", () => {
  it("renders the public route without calling the Clinical API", async () => {
    const resolve = vi.fn(async () => ({ status: "UNAUTHENTICATED" as const }));
    const load = vi.fn(async () => ({
      kind: "AUTHORITATIVE" as const,
      connectivity: "ONLINE" as const,
      projection: SYNTHETIC_SAFE_SESSION
    }));
    await render("/", services({
      auth: { resolve },
      sessions: { load, start: vi.fn() }
    }));
    expect(text()).toContain("AI Clinical Simulation Platform V2");
    expect(text()).toContain("Clinical truth stays authoritative");
    expect(resolve).not.toHaveBeenCalled();
    expect(load).not.toHaveBeenCalled();
  });

  it("defaults the Expo route to Practice / Demo without starting a case", async () => {
    const start = vi.fn();
    await render("/expo", services({ sessions: { load: vi.fn(), start } }));
    expect(text()).toContain("Expo learner experience");
    expect(text()).toContain("Practice / Demo");
    expect(text()).toContain("Authentication and server case authority are still required");
    expect(start).not.toHaveBeenCalled();
  });

  it("keeps a protected route private until auth resolves", async () => {
    let resolveAuth!: (value: { status: "AUTHENTICATED"; principal_user_id: string }) => void;
    const authPromise = new Promise<{ status: "AUTHENTICATED"; principal_user_id: string }>(
      (resolve) => { resolveAuth = resolve; }
    );
    const load = vi.fn(async () => ({
      kind: "AUTHORITATIVE" as const,
      connectivity: "ONLINE" as const,
      projection: SYNTHETIC_SAFE_SESSION
    }));
    await render("/sessions/session.ui-neutral", services({
      auth: { resolve: () => authPromise },
      sessions: { load, start: vi.fn() }
    }));
    expect(text()).toContain("Checking your secure session");
    expect(text()).toContain("No patient data is displayed");
    expect(text()).not.toContain("72");
    expect(load).not.toHaveBeenCalled();
    await act(async () => resolveAuth({
      status: "AUTHENTICATED",
      principal_user_id: "20000000-0000-4000-8000-000000000015"
    }));
    await settle(() => text().includes("Current patient"));
    expect(load).toHaveBeenCalledOnce();
  });

  it("shows unauthenticated and expired states without loading Session data", async () => {
    for (const status of ["UNAUTHENTICATED", "EXPIRED"] as const) {
      const load = vi.fn();
      await render("/sessions/session.ui-neutral", services({
        auth: { async resolve() { return { status }; } },
        sessions: { load, start: vi.fn() }
      }));
      await settle(() => text().includes("Learner sign in"));
      expect(load).not.toHaveBeenCalled();
      await act(async () => root.unmount());
      root = createRoot(host);
    }
  });
});

describe("V2-015 safe Session workspace", () => {
  it("renders only a safe authoritative projection and reserves every shell region", async () => {
    await render("/sessions/session.ui-neutral");
    await settle(() => text().includes("Current patient"));
    expect(text()).toContain("02:05");
    expect(text()).toContain("72");
    expect(text()).toContain("112/68");
    expect(text()).toContain("Visual Patient");
    expect(text()).toContain("Clinical interaction");
    expect(text()).toContain("Investigations");
    expect(text()).toContain("Session context");
    expect(text()).not.toMatch(/hidden diagnosis|rubric|approval record|clinical review/i);
    expect(text()).not.toMatch(/package hash|scheduler state/i);
  });

  it("provides semantic landmarks, named regions, and keyboard-operable domain tabs", async () => {
    await render("/sessions/session.ui-neutral");
    await settle(() => text().includes("Current patient"));
    expect(host.querySelector("main#main-content")).not.toBeNull();
    for (const id of ["monitor-title", "visual-patient-title", "interaction-title", "investigation-title", "timeline-title"]) {
      const region = host.querySelector(`[aria-labelledby="${id}"]`);
      expect(region).not.toBeNull();
      expect(host.querySelector(`#${id}`)).not.toBeNull();
    }
    const tabs = [...host.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
    expect(tabs).toHaveLength(6);
    expect(tabs.every((tab) => tab.type === "button" && !tab.disabled)).toBe(true);
    expect(tabs.filter((tab) => tab.getAttribute("aria-selected") === "true")).toHaveLength(1);
  });

  it("visually distinguishes Assessment mode without revealing score or correctness", async () => {
    await render("/sessions/session.ui-neutral", services({
      sessions: {
        async load() {
          return { kind: "AUTHORITATIVE", connectivity: "ONLINE", projection: SYNTHETIC_ASSESSMENT_SESSION };
        },
        start: vi.fn()
      }
    }));
    await settle(() => text().includes("Assessment"));
    expect(text()).toContain("Assessment");
    expect(text()).not.toMatch(/score|correct action|unsafe action|expected action|rubric/i);
  });

  it("marks cached state stale, frozen, and without mutation authority", async () => {
    await render("/sessions/session.ui-neutral", services({
      sessions: {
        async load() {
          return {
            kind: "STALE",
            connectivity: "OFFLINE_OR_UNREACHABLE",
            cached: SYNTHETIC_STALE_SESSION,
            request_status: "IN_DOUBT"
          };
        },
        start: vi.fn()
      }
    }));
    await settle(() => text().includes("Connection lost"));
    expect(text()).toContain("last known state");
    expect(text()).toContain("clinical time are frozen");
    expect(text()).toContain("original request only");
    const state = presentSessionLoad({
      kind: "STALE",
      connectivity: "OFFLINE_OR_UNREACHABLE",
      cached: SYNTHETIC_STALE_SESSION
    });
    expect(state?.mutation_authority).toBe("NONE");
    expect(state && isSessionMutationEntryEnabled(state)).toBe(false);
  });

  it("shows recovering, sync-required, unauthorized, missing, and unavailable states", async () => {
    const cases = [
      [{ kind: "AUTHORITATIVE", connectivity: "RECOVERING", projection: SYNTHETIC_SAFE_SESSION }, "Reconnecting"],
      [{ kind: "AUTHORITATIVE", connectivity: "SYNC_REQUIRED", projection: SYNTHETIC_SAFE_SESSION }, "Session updated"],
      [{ kind: "UNAUTHORIZED", http_status: 403 }, "Session access denied"],
      [{ kind: "NOT_FOUND", http_status: 404 }, "Session not found"],
      [{ kind: "API_UNAVAILABLE", http_status: 503 }, "Clinical service unavailable"]
    ] as const;
    for (const [result, expected] of cases) {
      await render("/sessions/session.ui-neutral", services({
        sessions: { async load() { return result; }, start: vi.fn() }
      }));
      await settle(() => text().includes(expected));
      expect(text()).toContain(expected);
      await act(async () => root.unmount());
      root = createRoot(host);
    }
  });

  it("rejects malformed links before calling the Session service", async () => {
    const load = vi.fn();
    await render("/sessions/%20", services({ sessions: { load, start: vi.fn() } }));
    await settle(() => text().includes("Invalid session link"));
    expect(load).not.toHaveBeenCalled();
  });

  it("does not optimistically fabricate medical state while start is pending", async () => {
    let resolveStart!: (value: Awaited<ReturnType<StudentUiServices["sessions"]["start"]>>) => void;
    const pending = new Promise<Awaited<ReturnType<StudentUiServices["sessions"]["start"]>>>(
      (resolve) => { resolveStart = resolve; }
    );
    const start = vi.fn(() => pending);
    await render("/app", services({
      sessions: {
        load: vi.fn(async () => ({
          kind: "AUTHORITATIVE" as const,
          connectivity: "ONLINE" as const,
          projection: SYNTHETIC_SAFE_SESSION
        })),
        start
      }
    }));
    await settle(() => text().includes("Start secure session"));
    const input = host.querySelector<HTMLInputElement>('input[name="case-access-code"]');
    const form = input?.closest("form");
    expect(input).not.toBeNull();
    await act(async () => {
      if (input !== null) {
        const setter = Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          "value"
        )?.set;
        setter?.call(input, "case.synthetic-ui");
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
    await act(async () => {
      form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    expect(start).toHaveBeenCalledOnce();
    expect(text()).toContain("Starting secure session");
    expect(text()).not.toContain("Clinical monitor");
    expect(text()).not.toContain("112/68");
    await act(async () => resolveStart({
      success: true,
      projection: SYNTHETIC_SAFE_SESSION,
      patient_language: PatientLanguageSchema.parse("en-US"),
      replayed: false
    }));
    await settle(() => text().includes("Clinical monitor"));
    expect(text()).toContain("112/68");
  });
});

describe("V2-015 deterministic presentation boundaries", () => {
  it("uses fixed Clinical Time formatting without a local clock", () => {
    expect(formatClinicalTime(0)).toBe("00:00");
    expect(formatClinicalTime(125.8)).toBe("02:05");
    expect(formatClinicalTime(Number.NaN)).toBe("--:--");
  });

  it("maps existing safe API status codes without exposing raw errors", () => {
    expect([401, 403, 404, 409, 422, 500, 503].map(mapHttpStatusToSafeError)).toEqual([
      "AUTHENTICATION_REQUIRED",
      "AUTHORIZATION_DENIED",
      "NOT_FOUND",
      "STATE_CHANGED",
      "INVALID_REQUEST",
      "SERVICE_ERROR",
      "SERVICE_UNAVAILABLE"
    ]);
  });

  it("maps V2-014 recovery results without adding replay policy", () => {
    const loaded = sessionLoadFromRecovery({
      success: true,
      connectivity_state: "OFFLINE_OR_UNREACHABLE",
      last_known_projection: SYNTHETIC_STALE_SESSION,
      reconciliation_results: []
    });
    expect(loaded).toMatchObject({ kind: "STALE", request_status: "IN_DOUBT" });
    const start = startSessionFromRecovery({
      success: false,
      issue: { code: "REQUEST_IN_DOUBT", message_key: "recovery.request.in-doubt", retryable: true },
      outcome: {
        recovery_schema_version: "1.0",
        operation: "START_SESSION",
        idempotency_key: IdempotencyKeySchema.parse("idempotency.ui-start"),
        status: "IN_DOUBT",
        requires_authoritative_sync: false
      }
    }, PatientLanguageSchema.parse("en-US"));
    expect(start).toEqual({ success: false, kind: "IN_DOUBT" });
  });

  it("switches ar-JO RTL and en-US LTR at shell level", async () => {
    await render("/");
    const arabic = [...host.querySelectorAll("button")].find((button) => button.textContent === "العربية");
    expect(arabic).toBeDefined();
    await act(async () => arabic?.click());
    expect(document.documentElement.lang).toBe("ar-JO");
    expect(document.documentElement.dir).toBe("rtl");
    expect(text()).toContain("منصة المحاكاة السريرية");
    const english = [...host.querySelectorAll("button")].find((button) => button.textContent === "EN");
    await act(async () => english?.click());
    expect(document.documentElement.lang).toBe("en-US");
    expect(document.documentElement.dir).toBe("ltr");
  });
});
