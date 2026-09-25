import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../../apps/web/src/App.tsx";
import { createUnconfiguredStudentUiServices } from "../../../apps/web/src/app/services.ts";
import type { StudentUiServices } from "../../../apps/web/src/app/types.ts";
import type { FacultyDemoService } from "../../../apps/web/src/features/faculty/faculty-service.ts";
import "../../../apps/web/src/styles.css";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const THEME_KEY = "balsim.theme.v1";
let host: HTMLDivElement;
let root: Root;
let previousTheme: string | null;

function observedServices() {
  const base = createUnconfiguredStudentUiServices();
  const auth = vi.fn(base.auth.resolve);
  const load = vi.fn(base.sessions.load);
  const start = vi.fn(base.sessions.start);
  const submit = vi.fn(base.actions.submit);
  const services: StudentUiServices = { ...base, auth: { resolve: auth }, sessions: { load, start }, actions: { submit } };
  return { services, auth, load, start, submit };
}

async function render(path = "/expo", options: { services?: StudentUiServices; faculty?: FacultyDemoService } = {}) {
  await act(async () => {
    root.render(<App initialEntries={[path]} services={options.services} faculty={options.faculty} />);
  });
}

function button(name: string) {
  const value = [...host.querySelectorAll("button")].find(element => element.getAttribute("aria-label") === name || element.textContent?.trim() === name);
  if (!value) throw Error(`Missing button: ${name}`);
  return value;
}

function link(name: string) {
  const value = [...host.querySelectorAll("a")].find(element => element.textContent?.trim() === name);
  if (!value) throw Error(`Missing link: ${name}`);
  return value;
}

async function settle(predicate: () => boolean) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (predicate()) return;
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)); });
  }
  throw Error("BALSIM shell did not reach the expected state.");
}

beforeEach(() => {
  previousTheme = localStorage.getItem(THEME_KEY);
  localStorage.removeItem(THEME_KEY);
  delete document.documentElement.dataset.theme;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.restoreAllMocks();
  if (previousTheme === null) localStorage.removeItem(THEME_KEY);
  else localStorage.setItem(THEME_KEY, previousTheme);
  delete document.documentElement.dataset.theme;
  document.documentElement.lang = "en-US";
  document.documentElement.dir = "ltr";
  document.querySelector('link[data-balsim-icon]')?.remove();
});

describe("BALSIM Expo shell", () => {
  it("starts in Bright mode and English with accessible global controls", async () => {
    await render();
    expect(document.documentElement.dataset.theme).toBe("bright");
    expect(document.documentElement.lang).toBe("en-US");
    expect(document.documentElement.dir).toBe("ltr");
    expect(button("EN").getAttribute("aria-pressed")).toBe("true");
    expect(button("العربية").getAttribute("aria-pressed")).toBe("false");
    expect(button("Dark mode").type).toBe("button");
    expect(host.querySelector(".skip-link")?.getAttribute("href")).toBe("#main-content");
    expect(host.querySelector("#main-content")?.getAttribute("tabindex")).toBe("-1");
    button("Dark mode").focus();
    expect(document.activeElement).toBe(button("Dark mode"));
  });

  it("toggles theme, persists Dark mode across remount and updates official brand slots", async () => {
    await render();
    await act(async () => button("Dark mode").click());
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem(THEME_KEY)).toBe("dark");
    expect(host.querySelector(".brand-lockup > img")?.getAttribute("src")).toBe("/brand/balsim-mark-dark.png");
    expect(document.querySelector('link[data-balsim-icon]')?.getAttribute("href")).toBe("/brand/balsim-mark-dark.png");
    await act(async () => root.render(null));
    await render();
    expect(document.documentElement.dataset.theme).toBe("dark");
    await act(async () => button("Bright mode").click());
    expect(document.documentElement.dataset.theme).toBe("bright");
    expect(localStorage.getItem(THEME_KEY)).toBe("bright");
  });

  it("uses Bright mode when the stored preference is invalid", async () => {
    localStorage.setItem(THEME_KEY, "unrecognized-theme");
    await render();
    expect(document.documentElement.dataset.theme).toBe("bright");
    expect(localStorage.getItem(THEME_KEY)).toBe("bright");
  });

  it("keeps theme switching usable when optional preference storage is blocked", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new DOMException("Storage blocked", "SecurityError"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("Storage blocked", "SecurityError"); });
    await render();
    expect(document.documentElement.dataset.theme).toBe("bright");
    await act(async () => button("Dark mode").click());
    expect(document.documentElement.dataset.theme).toBe("dark");
    vi.restoreAllMocks();
  });


  it("preserves Arabic RTL and English controls independently of layout", async () => {
    await render();
    await act(async () => button("العربية").click());
    expect(document.documentElement.lang).toBe("ar-JO");
    expect(document.documentElement.dir).toBe("rtl");
    expect(button("الوضع الداكن")).toBeDefined();
    await act(async () => button("EN").click());
    expect(document.documentElement.dir).toBe("ltr");
  });

  it("focuses main after baseline navigation without clinical service calls", async () => {
    const observed = observedServices();
    await render("/", { services: observed.services });
    const expo = host.querySelector<HTMLAnchorElement>('a[href="/expo"]')!;
    await act(async () => expo.click());
    expect(document.activeElement).toBe(host.querySelector("#main-content"));
    expect(host.querySelector(".expo-page")).not.toBeNull();
    expect(observed.load).not.toHaveBeenCalled();
    expect(observed.start).not.toHaveBeenCalled();
    expect(observed.submit).not.toHaveBeenCalled();
  });
});
