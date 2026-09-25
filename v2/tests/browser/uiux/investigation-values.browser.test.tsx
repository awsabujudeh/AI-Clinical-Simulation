import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SafeInvestigationProjectionSchema } from "../../../packages/contracts/src/index.ts";
import { createStemiUnderReviewCase } from "../../../content/cases/stemi/v2-draft/stemi-case.ts";
import { PORTABLE_SHA256_ADAPTER } from "../../fixtures/portable-sha256.ts";
import { InvestigationResult } from "../../../apps/web/src/features/investigations/InvestigationResults.tsx";
import { diagnosticUnitLabel, diagnosticValueLabel } from "../../../apps/web/src/features/investigations/diagnostic-presentation.ts";
import manifest from "../../../content/media/stemi/manifest.json";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const entry = manifest.diagnostics[0]!;
let host: HTMLDivElement, root: Root, client: QueryClient;

beforeEach(() => {
  host = document.createElement("div"); document.body.append(host); root = createRoot(host); client = new QueryClient();
  vi.stubGlobal("fetch", vi.fn(async () => new Response("Should remain unavailable")));
});
afterEach(async () => { await act(async () => root.unmount()); client.clear(); host.remove(); vi.unstubAllGlobals(); });

function projection(component: "AVAILABLE" | "PENDING" | "WITHHELD" = "AVAILABLE") {
  return SafeInvestigationProjectionSchema.parse({
    diagnostic_result_id: entry.diagnostic_result_id, clinical_time: 120,
    component_status: { structured_result: component, media: "WITHHELD", machine_interpretation: "WITHHELD", formal_report: "PENDING" },
    finding_texts: [[{ locale: "en-US", text: "Returned finding" }]],
    formal_report_text: [{ locale: "en-US", text: "Withheld report" }],
    structured_result: {
      result_type: "ECG", modality: "ECG", structured_measurements: [
        { measurement_id: "measurement.test.qrs", measurement_code: "ecg.qrs-ms", display_label_key: "diagnostic.stemi.qrs", value: 90, unit_code: "unit.millisecond" },
        { measurement_id: "measurement.test.st", measurement_code: "ecg.st-elevation-v4r-mm", display_label_key: "diagnostic.stemi.st-v4r", value: 1.5, unit_code: "unit.millimeter" },
        { measurement_id: "measurement.test.pr", measurement_code: "ecg.pr-ms", display_label_key: "diagnostic.stemi.pr", value: 160, unit_code: "unit.millisecond" }
      ]
    }
  });
}

async function render(result: Parameters<typeof InvestigationResult>[0]["result"], locale = "en-US") {
  await act(async () => root.render(<QueryClientProvider client={client}><InvestigationResult entry={entry} result={result} locale={locale} ordered /></QueryClientProvider>));
}
const rows = () => [...host.querySelectorAll("article li")].map(row => row.textContent);

it("matches every known measurement/analyte label to authored English and Arabic without importing case content into the UI", async () => {
  const authored = await createStemiUnderReviewCase(PORTABLE_SHA256_ADAPTER);
  const known = new Set<string>();
  for (const action of authored.action_catalogue.actions) {
    const result = action.investigation?.result;
    const values = result && "structured_measurements" in result ? result.structured_measurements
      : result && "analytes" in result ? result.analytes : [];
    for (const value of values) {
      const code = "measurement_code" in value ? value.measurement_code : value.analyte_code;
      known.add(code);
      for (const locale of ["en-US", "ar-JO"]) {
        const authoredLabel = authored.localization.entries.find(label => label.key === value.display_label_key)?.translations.find(label => label.locale === locale)?.text;
        expect(authoredLabel).toBeDefined();
        expect(diagnosticValueLabel(code, locale)).toBe(authoredLabel);
        expect(diagnosticUnitLabel(value.unit_code, locale)).not.toBe(value.unit_code);
      }
    }
  }
  expect(known.size).toBe(25);
});

it("preserves returned measurement order and numeric values while displaying readable labels and units", async () => {
  const p = projection(); const before = JSON.stringify(p);
  await render({ kind: "AVAILABLE", projection: p });
  expect(rows()).toEqual(["QRS duration: 90 ms", "ST elevation V4R: 1.5 mm", "PR interval: 160 ms"]);
  expect([...host.querySelectorAll('article bdi[dir="ltr"]')].map(value => value.textContent)).toEqual(["90", "1.5", "160"]);
  expect(host.textContent).not.toMatch(/ecg\.qrs-ms|unit\.millisecond|unit\.millimeter/);
  expect(host.textContent).not.toContain("Withheld report");
  expect(fetch).not.toHaveBeenCalled();
  expect(JSON.stringify(p)).toBe(before);
});

it("localizes measurement labels and units in Arabic while keeping values in LTR isolation", async () => {
  await render({ kind: "AVAILABLE", projection: projection() }, "ar-JO");
  expect(rows()).toEqual(["مدة QRS: 90 مللي ثانية", "ارتفاع ST في V4R: 1.5 ملم", "فترة PR: 160 مللي ثانية"]);
  expect(host.querySelectorAll('article bdi[dir="ltr"]')).toHaveLength(3);
  expect(host.textContent).not.toMatch(/ecg\.|unit\./);
});

it("formats laboratory units without converting values, reordering analytes or guessing unknown codes", async () => {
  const p = SafeInvestigationProjectionSchema.parse({ ...projection(), structured_result: {
    result_type: "STRUCTURED_LAB", modality: "LABORATORY", panel_code: "panel.test", analytes: [
      { analyte_id: "analyte.test.glucose", analyte_code: "lab.glucose", display_label_key: "diagnostic.stemi.glucose", value: 184, unit_code: "unit.mg-dl" },
      { analyte_id: "analyte.test.wbc", analyte_code: "lab.wbc", display_label_key: "diagnostic.stemi.wbc", value: 9.1, unit_code: "unit.x10e3-per-ul" },
      { analyte_id: "analyte.test.unknown", analyte_code: "lab.unmapped", display_label_key: "diagnostic.test.unknown", value: 7.25, unit_code: "unit.unmapped" }
    ]
  } });
  const before = JSON.stringify(p);
  await render({ kind: "AVAILABLE", projection: p });
  expect(rows()).toEqual(["Glucose: 184 mg/dL", "White blood cell count: 9.1 ×10³/µL", "lab.unmapped: 7.25 unit.unmapped"]);
  await render({ kind: "AVAILABLE", projection: p }, "ar-JO");
  expect(rows()).toEqual(["الغلوكوز: 184 ملغ/دل", "عدد الكريات البيضاء: 9.1 ×10³/ميكرولتر", "lab.unmapped: 7.25 unit.unmapped"]);
  expect(JSON.stringify(p)).toBe(before);
});

it.each(["PENDING", "WITHHELD"] as const)("retains the %s structured-result disclosure gate even if measurements are present", async status => {
  await render({ kind: "AVAILABLE", projection: projection(status) });
  expect(rows()).toEqual([]);
  expect(host.textContent).not.toContain("Returned finding");
  expect(host.textContent).not.toContain("QRS duration");
  expect(host.textContent).not.toContain("Withheld report");
  expect(fetch).not.toHaveBeenCalled();
});

it("does not disclose values for a pending request or mismatched diagnostic identity", async () => {
  await render({ kind: "PENDING" });
  expect(rows()).toEqual([]);
  await render({ kind: "AVAILABLE", projection: { ...projection(), diagnostic_result_id: "diagnostic-result.other" as never } });
  expect(rows()).toEqual([]);
  expect(host.textContent).not.toContain("Returned finding");
  expect(fetch).not.toHaveBeenCalled();
});

it("preserves unknown label and unit identifiers rather than inferring measurements", () => {
  expect(diagnosticValueLabel("ecg.unmapped", "ar-JO")).toBe("ecg.unmapped");
  expect(diagnosticUnitLabel("unit.unmapped", "ar-JO")).toBe("unit.unmapped");
  expect(diagnosticUnitLabel("constructor", "en-US")).toBe("constructor");
});
