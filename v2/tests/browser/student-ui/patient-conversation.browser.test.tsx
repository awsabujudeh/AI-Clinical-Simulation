import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LocalizationProvider, useLocalization } from "../../../apps/web/src/app/localization.tsx";
import type { StudentPatientConversationService } from "../../../apps/web/src/app/types.ts";
import { PatientConversationPanel } from "../../../apps/web/src/features/conversation/PatientConversationPanel.tsx";
import { SYNTHETIC_SAFE_SESSION, SYNTHETIC_STALE_SESSION } from "../../fixtures/student-ui/safe-session.ts";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const turn = {
  conversation_schema_version: "1.0" as const,
  turn_id: "conversation-turn.ui.001" as any,
  session_id: "session.ui-neutral" as any,
  turn_sequence: 1 as any,
  clinical_time: 125 as any,
  grounded_state_version: 3 as any,
  locale: "en-US" as any,
  source: "TEXT" as const,
  utterance_id: "utterance.ui.001",
  learner_utterance: "How do you feel?",
  patient_utterance: "I only know the reviewed patient information.",
  answer_mode: "GROUNDED" as const,
  fallback_used: false,
  grounding_fact_ids: ["fact.synthetic.concern" as any],
  grounding_state_refs: [],
  question_event_id: "00000000-0000-4000-8000-000000000091" as any,
  response_event_id: "00000000-0000-4000-8000-000000000092" as any
};

function LocaleButton() {
  const { setLocale } = useLocalization();
  return <button onClick={() => setLocale("ar-JO" as any)}>Arabic</button>;
}

let host: HTMLDivElement;
let root: Root;

async function settle(predicate: () => boolean) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (predicate()) return;
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 5)); });
  }
  throw new Error("Patient conversation UI did not settle.");
}

function render(service: StudentPatientConversationService, options?: { stale?: boolean; ended?: boolean }) {
  const projection = options?.ended ? { ...SYNTHETIC_SAFE_SESSION, status: "ENDED" as const } : SYNTHETIC_SAFE_SESSION;
  const state = options?.stale
    ? { kind: "ACTIVE_STALE" as const, projection: SYNTHETIC_STALE_SESSION.projection, mutation_authority: "NONE" as const }
    : { kind: options?.ended ? "ENDED" as const : "ACTIVE_ONLINE" as const, projection, mutation_authority: options?.ended ? "NONE" as const : "SERVER_ONLY" as const };
  root.render(
    <LocalizationProvider>
      <LocaleButton />
      <PatientConversationPanel state={state} service={service} enabled={!options?.stale && !options?.ended} />
    </LocalizationProvider>
  );
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

describe("Patient Conversation learner UI", () => {
  it("loads the authoritative transcript and submits through its service", async () => {
    const submit = vi.fn(async () => ({ kind: "COMMITTED" as const, replayed: false, turn }));
    const service: StudentPatientConversationService = {
      async load() { return { kind: "AVAILABLE", transcript: { conversation_schema_version: "1.0", session_id: turn.session_id, turns: [] } }; },
      submit
    };
    await act(async () => render(service));
    await settle(() => host.textContent?.includes("Patient available") === true);
    const textarea = host.querySelector("textarea")!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set?.call(textarea, "How do you feel?");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
      textarea.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await act(async () => host.querySelector<HTMLButtonElement>('button[type="submit"]')?.click());
    await settle(() => host.textContent?.includes(turn.patient_utterance) === true);
    expect(submit).toHaveBeenCalledWith(expect.objectContaining({ source: "TEXT", locale: "en-US" }));
    expect(host.textContent).not.toContain("AI Assistant");
  });

  it("blocks fake offline responses and leaves the transcript read-only", async () => {
    const service: StudentPatientConversationService = {
      load: vi.fn(), submit: vi.fn(async () => ({ kind: "UNAVAILABLE" as const }))
    };
    await act(async () => render(service, { stale: true }));
    expect(host.querySelector("textarea")?.disabled).toBe(true);
    expect(service.load).not.toHaveBeenCalled();
    expect(service.submit).not.toHaveBeenCalled();
    expect(host.textContent).toContain("Reconnect to ask a new question");
  });

  it("makes an ended Session read-only", async () => {
    const service: StudentPatientConversationService = { load: vi.fn(), submit: vi.fn() };
    await act(async () => render(service, { ended: true }));
    expect(host.querySelector("textarea")?.disabled).toBe(true);
    expect(host.textContent).toContain("Session has ended");
  });

  it("uses canonical Arabic localization and RTL without changing the service boundary", async () => {
    const service: StudentPatientConversationService = {
      async load() { return { kind: "AVAILABLE", transcript: { conversation_schema_version: "1.0", session_id: turn.session_id, turns: [] } }; },
      async submit() { return { kind: "UNAVAILABLE" }; }
    };
    await act(async () => render(service));
    await act(async () => host.querySelector<HTMLButtonElement>("button")?.click());
    await settle(() => document.documentElement.dir === "rtl");
    expect(document.documentElement.lang).toBe("ar-JO");
    expect(host.textContent).toContain("التحدث مع المريض");
  });

  it("contains rejected transport promises as an unavailable read-only state", async () => {
    const service: StudentPatientConversationService = {
      async load() { throw new Error("synthetic network loss"); },
      async submit() { throw new Error("unreachable"); }
    };
    await act(async () => render(service));
    await settle(() => host.querySelector("textarea")?.disabled === true);
    expect(host.textContent).toContain("Reconnect to ask a new question");
  });
});
