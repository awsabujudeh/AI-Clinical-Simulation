import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { PatientLanguageSchema, RecoveryPrincipalIdSchema, SafeInvestigationProjectionSchema } from "../../../packages/contracts/src/index.ts";
import { LocalizationProvider, useLocalization } from "../../../apps/web/src/app/localization.tsx";
import { createUnconfiguredStudentUiServices } from "../../../apps/web/src/app/services.ts";
import type { SessionPresentationState, StudentUiServices } from "../../../apps/web/src/app/types.ts";
import { ClinicalActionsPanel } from "../../../apps/web/src/features/actions/ClinicalActionsPanel.tsx";
import { InvestigationResult } from "../../../apps/web/src/features/investigations/InvestigationResults.tsx";
import { ClinicalMonitor } from "../../../apps/web/src/features/monitor/ClinicalMonitor.tsx";
import { SYNTHETIC_SAFE_SESSION } from "../../fixtures/student-ui/safe-session.ts";
import manifest from "../../../content/media/stemi/manifest.json";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement, root: Root, client: QueryClient;
const state: SessionPresentationState = { kind: "ACTIVE_ONLINE", mutation_authority: "SERVER_ONLY", projection: SYNTHETIC_SAFE_SESSION };
const auth = { status: "AUTHENTICATED" as const, principal_user_id: RecoveryPrincipalIdSchema.parse("20000000-0000-4000-8000-000000000015"), display_name: "Student" };
const refresh = vi.fn(async () => undefined);

function ArabicControl() {
  const { setLocale } = useLocalization();
  return <button data-testid="arabic" onClick={() => setLocale(PatientLanguageSchema.parse("ar-JO"))}>Arabic</button>;
}
async function render(content: ReactNode) {
  await act(async () => root.render(<QueryClientProvider client={client}><LocalizationProvider><ArabicControl />{content}</LocalizationProvider></QueryClientProvider>));
}
async function actions(services = createUnconfiguredStudentUiServices(), current = state, enabled = true) {
  await render(<ClinicalActionsPanel services={services} auth={auth} state={current} enabled={enabled} onAuthoritativeRefresh={refresh} />);
}
function tabs() { return [...host.querySelectorAll<HTMLButtonElement>('[role="tab"]')]; }
async function click(element: Element | null | undefined) {
  if (!(element instanceof HTMLElement)) throw new Error("Expected an interactive HTML element.");
  await act(async () => element.click());
}
async function type(name: string, value: string) {
  const input = host.querySelector<HTMLInputElement | HTMLSelectElement>(`[name="${name}"]`)!;
  const prototype = input instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}
beforeEach(() => {
  host = document.createElement("div"); document.body.append(host); root = createRoot(host); client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  vi.stubGlobal("fetch", vi.fn(async () => new Response("Reference report")));
});
afterEach(async () => {
  await act(async () => root.unmount()); client.clear(); host.remove(); vi.unstubAllGlobals(); vi.clearAllMocks();
  document.documentElement.dir = "ltr"; document.documentElement.lang = "en-US";
});

it("provides one tab stop and keyboard domain navigation without submitting actions", async () => {
  const submit = vi.fn<StudentUiServices["actions"]["submit"]>(async () => ({ kind: "NOT_SENT", requires_authoritative_sync: false }));
  const interpret = vi.fn<NonNullable<StudentUiServices["clinical_interpreter"]>["interpret"]>(async () => ({ kind: "UNAVAILABLE" }));
  await actions({ ...createUnconfiguredStudentUiServices(), actions: { submit }, clinical_interpreter: { interpret } });
  expect(tabs().filter(tab => tab.tabIndex === 0)).toHaveLength(1);
  await act(async () => { tabs()[0]!.focus(); tabs()[0]!.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })); });
  expect(tabs()[1]!.getAttribute("aria-selected")).toBe("true"); expect(document.activeElement).toBe(tabs()[1]);
  await act(async () => tabs()[1]!.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true })));
  expect(tabs()[5]!.getAttribute("aria-selected")).toBe("true");
  expect(submit).not.toHaveBeenCalled(); expect(interpret).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
});

it("reverses horizontal navigation in Arabic while retaining semantic panel relationships", async () => {
  await actions(); await click(host.querySelector('[data-testid="arabic"]'));
  await act(async () => tabs()[0]!.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true })));
  expect(document.documentElement.dir).toBe("rtl"); expect(tabs()[1]!.getAttribute("aria-selected")).toBe("true");
  expect(host.querySelector('[role="tabpanel"]')!.getAttribute("aria-labelledby")).toBe(tabs()[1]!.id);
});
