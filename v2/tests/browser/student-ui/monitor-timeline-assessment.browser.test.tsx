import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../../../apps/web/src/App.tsx";
import type { StudentUiServices } from "../../../apps/web/src/app/types.ts";
import { formatBasisPoints } from "../../../apps/web/src/features/assessment/assessment-model.ts";
import { observationDescriptorLabel } from "../../../apps/web/src/features/monitor/monitor-model.ts";
import { learnerLocalizedText } from "../../../apps/web/src/features/timeline/timeline-model.ts";
import "../../../apps/web/src/styles.css";
import {
  SYNTHETIC_ASSESSMENT_SESSION,
  SYNTHETIC_SAFE_SESSION,
  SYNTHETIC_STALE_SESSION
} from "../../fixtures/student-ui/safe-session.ts";
import {
  SYNTHETIC_ENDED_ASSESSMENT_SESSION,
  SYNTHETIC_FINAL_ASSESSMENT,
  SYNTHETIC_LEARNER_TIMELINE
} from "../../fixtures/student-ui/v2-017.ts";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

function services(overrides: Partial<StudentUiServices> = {}): StudentUiServices {
  return {
    auth: overrides.auth ?? {
      async resolve() {
        return {
          status: "AUTHENTICATED",
          principal_user_id: "20000000-0000-4000-8000-000000000015",
          display_name: "Student"
        } as const;
      }
    },
    sessions: overrides.sessions ?? {
      async load() { return { kind: "AUTHORITATIVE", connectivity: "ONLINE", projection: SYNTHETIC_SAFE_SESSION } as const; },
      async start() { return { success: false, kind: "INVALID" } as const; }
    },
    actions: overrides.actions ?? {
      async submit() { return { kind: "UNAVAILABLE", requires_authoritative_sync: true } as const; }
    },
    timeline: overrides.timeline ?? {
      async load() { return { kind: "AVAILABLE", projection: SYNTHETIC_LEARNER_TIMELINE } as const; }
    },
    assessment: overrides.assessment ?? {
      async load() { return { kind: "AVAILABLE", projection: SYNTHETIC_FINAL_ASSESSMENT } as const; }
    },
    finalization: overrides.finalization ?? {
      async end() { return { kind: "UNAVAILABLE", requires_authoritative_sync: true } as const; }
    }
  };
}

async function render(uiServices = services()) {
  await act(async () => {
    root.render(<App services={uiServices} initialEntries={["/sessions/session.ui-neutral"]} />);
  });
}

async function settle(predicate: () => boolean) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate()) return;
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 10)); });
  }
  throw new Error("V2-017 UI did not settle into the expected state.");
}

function text() { return host.textContent ?? ""; }

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

describe("V2-017 authoritative Clinical Monitor", () => {
  it("renders every contracted observation and no fabricated waveform", async () => {
    await render();
    await settle(() => text().includes("Perform synthetic examination"));
    expect(text()).toContain("72");
    expect(text()).toContain("112/68");
    expect(text()).toContain("16");
    expect(text()).toContain("98");
    expect(text()).toContain("36.7");
    expect(text()).toContain("Regular rhythm");
    expect(text()).toContain("Alert");
    expect(text()).not.toContain("rhythm.synthetic-regular");
    expect(text()).not.toContain("consciousness.synthetic-alert");
    expect(host.querySelector("canvas, svg.monitor-waveform")).toBeNull();
  });

  it("marks stale observations as frozen and does not request a fresh timeline", async () => {
    const timelineLoad = vi.fn();
    await render(services({
      sessions: {
        async load() { return { kind: "STALE", connectivity: "OFFLINE_OR_UNREACHABLE", cached: SYNTHETIC_STALE_SESSION } as const; },
        async start() { return { success: false, kind: "INVALID" } as const; }
      },
      timeline: { load: timelineLoad }
    }));
    await settle(() => text().includes("Last confirmed"));
    expect(text()).toContain("Values and clinical time are frozen");
    expect(text()).toContain("02:05");
    expect(timelineLoad).not.toHaveBeenCalled();
    expect(host.querySelector(".monitor-slot--stale")).not.toBeNull();
  });

  it("uses presentation-only identifier mapping without changing unknown truth codes", () => {
    expect(observationDescriptorLabel("rhythm", "rhythm.synthetic-regular", "en-US" as never)).toBe("Regular rhythm");
    expect(observationDescriptorLabel("consciousness", "consciousness.unknown", "en-US" as never)).toBe("Case-configured consciousness");
  });
});

describe("V2-017 learner-safe timeline", () => {
  it("renders server order and authoritative Clinical Time in semantic list markup", async () => {
    await render();
    await settle(() => text().includes("Perform synthetic examination"));
    const items = [...host.querySelectorAll(".learner-timeline li")];
    expect(items).toHaveLength(2);
    expect(items.map((item) => item.textContent)).toEqual([
      expect.stringContaining("Session started"),
      expect.stringContaining("Perform synthetic examination")
    ]);
    expect(text()).toContain("02:05");
    expect(host.querySelector("ol.learner-timeline")).not.toBeNull();
  });

  it("localizes learner-safe timeline labels and preserves readable LTR units/time", async () => {
    await render();
    await settle(() => text().includes("Perform synthetic examination"));
    const arabic = [...host.querySelectorAll<HTMLButtonElement>("button")]
      .find((button) => button.textContent === "العربية");
    await act(async () => arabic?.click());
    expect(document.documentElement.dir).toBe("rtl");
    expect(text()).toContain("إجراء فحص اصطناعي");
    expect(host.querySelector('[dir="ltr"]')).not.toBeNull();
  });

  it("has deterministic localization fallback", () => {
    expect(learnerLocalizedText(SYNTHETIC_LEARNER_TIMELINE.items[0]!.labels, "en-US" as never)).toBe("Session started");
  });
});

describe("V2-017 assessment disclosure and finalization", () => {
  it("withholds all correctness, score, unsafe, rubric, and debrief data while Assessment is active", async () => {
    const assessmentLoad = vi.fn();
    await render(services({
      sessions: {
        async load() { return { kind: "AUTHORITATIVE", connectivity: "ONLINE", projection: SYNTHETIC_ASSESSMENT_SESSION } as const; },
        async start() { return { success: false, kind: "INVALID" } as const; }
      },
      assessment: { load: assessmentLoad }
    }));
    await settle(() => text().includes("Assessment in progress"));
    expect(text()).toContain("remain withheld");
    expect(text()).not.toMatch(/overall score|six-domain result|safety finding|evidence-based debrief|rubric/iu);
    expect(assessmentLoad).not.toHaveBeenCalled();
  });

  it("keeps Practice live disclosure bounded to resolved safe findings", async () => {
    await render();
    await settle(() => text().includes("Practice / Demo"));
    expect(text()).toContain("Only resolved deterministic findings");
    expect(text()).not.toMatch(/overall score|six-domain result|rubric|expected action/iu);
  });

  it("renders the finalized server result with exactly six authoritative domain labels", async () => {
    await render(services({
      sessions: {
        async load() { return { kind: "AUTHORITATIVE", connectivity: "ONLINE", projection: SYNTHETIC_ENDED_ASSESSMENT_SESSION } as const; },
        async start() { return { success: false, kind: "INVALID" } as const; }
      }
    }));
    await settle(() => text().includes("73.17%"));
    expect(text()).toContain("Six-domain result");
    for (const label of ["History", "Examination", "Diagnostics", "Management", "Clinical reasoning", "Disposition"]) {
      expect(text()).toContain(label);
    }
    expect(host.querySelectorAll(".domain-score-grid article")).toHaveLength(6);
    expect(text()).toContain("Evidence-backed strength");
    expect(text()).not.toMatch(/rubric-item|package_hash|scheduler|review_subject/iu);
  });

  it("formats returned basis points without deriving or reweighting scores", () => {
    expect(formatBasisPoints(0)).toBe("0.00%");
    expect(formatBasisPoints(7317)).toBe("73.17%");
    expect(formatBasisPoints(10000)).toBe("100.00%");
  });

  it("does not automatically repeat a finalization whose response is in doubt", async () => {
    const end = vi.fn(async () => ({ kind: "IN_DOUBT", idempotency_key: "idempotency.ui.end", requires_authoritative_sync: true } as const));
    const load = vi.fn(async () => ({ kind: "AUTHORITATIVE", connectivity: "ONLINE", projection: SYNTHETIC_ASSESSMENT_SESSION } as const));
    await render(services({
      sessions: { load, async start() { return { success: false, kind: "INVALID" } as const; } },
      finalization: { end }
    }));
    await settle(() => text().includes("End simulation"));
    const button = [...host.querySelectorAll<HTMLButtonElement>("button")]
      .find((candidate) => candidate.textContent === "End simulation");
    await act(async () => button?.click());
    await settle(() => text().includes("Finalization status is uncertain"));
    expect(end).toHaveBeenCalledOnce();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("keeps ended sessions read-only while retaining final monitor and history", async () => {
    await render(services({
      sessions: {
        async load() { return { kind: "AUTHORITATIVE", connectivity: "ONLINE", projection: SYNTHETIC_ENDED_ASSESSMENT_SESSION } as const; },
        async start() { return { success: false, kind: "INVALID" } as const; }
      }
    }));
    await settle(() => text().includes("73.17%"));
    expect(text()).toContain("112/68");
    expect(text()).toContain("Perform synthetic examination");
    const examination = [...host.querySelectorAll<HTMLButtonElement>('.clinical-tabs button')]
      .find((button) => button.textContent === "Examination");
    await act(async () => examination?.click());
    expect(host.querySelector<HTMLInputElement>('.action-search input')?.disabled).toBe(true);
    expect([...host.querySelectorAll<HTMLButtonElement>(".action-catalogue button")]
      .every((button) => button.disabled)).toBe(true);
    expect(text()).not.toContain("End simulation");
  });
});
