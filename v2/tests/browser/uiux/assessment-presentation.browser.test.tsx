import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { App } from "../../../apps/web/src/App.tsx";
import { createUnconfiguredStudentUiServices } from "../../../apps/web/src/app/services.ts";
import type { StudentUiServices } from "../../../apps/web/src/app/types.ts";
import { LocalizationProvider, useLocalization } from "../../../apps/web/src/app/localization.tsx";
import { TutorDebriefPanel } from "../../../apps/web/src/features/assessment/TutorDebriefPanel.tsx";
import { assessmentDomainLabel, formatBasisPoints } from "../../../apps/web/src/features/assessment/assessment-model.ts";
import { AssessmentDomainIdSchema, PatientLanguageSchema, SafeSessionProjectionSchema, TutorOutputLocaleSchema, type TutorDebrief } from "../../../packages/contracts/src/index.ts";
import { canonicalSerialize } from "../../../packages/case-schema/src/index.ts";
import { SYNTHETIC_SAFE_SESSION } from "../../fixtures/student-ui/safe-session.ts";
import { SYNTHETIC_ENDED_ASSESSMENT_SESSION, SYNTHETIC_FINAL_ASSESSMENT } from "../../fixtures/student-ui/v2-017.ts";
import { tutorSnapshot } from "../../fixtures/tutor.ts";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement, root: Root;
beforeEach(() => { host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); document.documentElement.dir = "ltr"; document.documentElement.lang = "en-US"; });
async function settle(predicate: () => boolean) {
  for (let i = 0; i < 80; i++) { if (predicate()) return; await act(async () => { await new Promise(resolve => setTimeout(resolve, 5)); }); }
  throw Error("Assessment presentation did not settle.");
}
function button(label: string, scope: ParentNode = host) {
  const target = [...scope.querySelectorAll<HTMLButtonElement>("button")].find(item => item.textContent === label);
  if (!target) throw Error(`Missing button: ${label}`);
  return target;
}
async function click(label: string, scope: ParentNode = host) { await act(async () => button(label, scope).click()); }
function services(overrides: Partial<StudentUiServices>): StudentUiServices {
  return { ...createUnconfiguredStudentUiServices(), auth: { async resolve() { return { status: "AUTHENTICATED", principal_user_id: "20000000-0000-4000-8000-000000000015", display_name: "Student" }; } }, ...overrides };
}
function LanguageControl() {
  const { setLocale } = useLocalization();
  return <button onClick={() => setLocale(PatientLanguageSchema.parse("ar-JO"))}>Arabic</button>;
}

const canonicalDomains = [
  ["domain.history", "history", "History", "القصة المرضية"],
  ["domain.examination", "examination", "Examination", "الفحص"],
  ["domain.diagnostics", "diagnostics", "Diagnostics", "الاستقصاءات"],
  ["domain.management", "management", "Management", "التدبير"],
  ["domain.clinical-reasoning", "clinical-reasoning", "Clinical reasoning", "الاستدلال السريري"],
  ["domain.reperfusion-disposition", "reperfusion-disposition", "Reperfusion and disposition", "إعادة التروية والتصرف"]
] as const;

it.each(["en-US", "ar-JO"] as const)("localizes exact generic Tutor domain labels in %s without changing assessment data", async locale => {
  const source = await tutorSnapshot();
  const original = canonicalSerialize(source);
  const debrief: TutorDebrief = { ...source, packet: { ...source.packet, locale: TutorOutputLocaleSchema.parse(locale),
    domain_labels: canonicalDomains.map(([domain_id, label]) => ({ domain_id, label })),
    assessment: { ...source.packet.assessment, domain_scores: source.packet.assessment.domain_scores.map((domain, index) => ({
      ...domain, domain_id: AssessmentDomainIdSchema.parse(canonicalDomains[index]![0])
    })) }
  } };
  const before = canonicalSerialize(debrief);
  const generate = vi.fn<NonNullable<StudentUiServices["tutor"]>["generate"]>(async () => ({ kind: "AVAILABLE", debrief }));
  await act(async () => root.render(<LocalizationProvider><LanguageControl /><TutorDebriefPanel sessionId={debrief.packet.assessment.session_id} service={{ generate }} review /></LocalizationProvider>));
  if (locale === "ar-JO") await click("Arabic");
  await click(locale === "ar-JO" ? "عرض لقطة المراجعة" : "Review debrief snapshot");
  await settle(() => !!host.querySelector('[data-testid="tutor-debrief"]'));
  canonicalDomains.forEach((domain, index) => {
    expect(host.textContent).toContain(domain[locale === "ar-JO" ? 3 : 2]);
    expect(host.textContent).toContain(formatBasisPoints(debrief.packet.assessment.domain_scores[index]!.score_basis_points));
  });
  expect(host.textContent).toContain(formatBasisPoints(debrief.packet.assessment.overall_score_basis_points));
  expect(canonicalSerialize(debrief)).toBe(before);
  expect(canonicalSerialize(source)).toBe(original);
});

it("preserves authored domain labels exactly, including disposition labels and generic-looking custom text", () => {
  for (const locale of ["en-US", "ar-JO"] as const) {
    const language = PatientLanguageSchema.parse(locale);
    for (const [id, code] of canonicalDomains) {
      for (const label of ["Authored clinical priority", "أولوية سريرية مؤلفة", code.toUpperCase(), ` ${code} `, undefined]) {
        expect(assessmentDomainLabel(id, label, language)).toBe(label);
      }
    }
    for (const label of ["Disposition and follow-up", "التصرف والمتابعة"]) {
      expect(assessmentDomainLabel("domain.reperfusion-disposition", label, language)).toBe(label);
    }
    expect(assessmentDomainLabel("domain.custom", "history", language)).toBe("history");
    expect(assessmentDomainLabel("domain.history", "examination", language)).toBe("examination");
  }
});

it("renders exact final score and all six supplied domain scores without mutating the assessment", async () => {
  const before = canonicalSerialize(SYNTHETIC_FINAL_ASSESSMENT);
  const load = vi.fn<StudentUiServices["assessment"]["load"]>(async () => ({ kind: "AVAILABLE", projection: SYNTHETIC_FINAL_ASSESSMENT }));
  const end = vi.fn<StudentUiServices["finalization"]["end"]>(async () => ({ kind: "UNAVAILABLE", requires_authoritative_sync: false }));
  const injected = services({ sessions: { async load() { return { kind: "AUTHORITATIVE", connectivity: "ONLINE", projection: SYNTHETIC_ENDED_ASSESSMENT_SESSION }; }, async start() { return { success: false, kind: "INVALID" }; } }, assessment: { load }, finalization: { end } });
  await act(async () => root.render(<App services={injected} initialEntries={[`/sessions/${SYNTHETIC_ENDED_ASSESSMENT_SESSION.session_id}`]} />));
  await settle(() => !!host.querySelector(".final-assessment"));
  expect(host.querySelector(".final-assessment__summary strong")!.textContent).toBe("73.17%");
  const domains = [...host.querySelectorAll(".domain-score-grid article")];
  expect(domains).toHaveLength(6);
  SYNTHETIC_FINAL_ASSESSMENT.domain_scores.forEach((domain, index) => {
    expect(domains[index]!.querySelector("strong")!.textContent).toBe(formatBasisPoints(domain.score_basis_points));
    expect(domains[index]!.querySelector("span")!.textContent).toBe(domain.labels.find(label => label.locale === "en-US")!.text);
  });
  expect(canonicalSerialize(SYNTHETIC_FINAL_ASSESSMENT)).toBe(before);
  expect(load).toHaveBeenCalledOnce(); expect(end).not.toHaveBeenCalled();
});

it("keeps the scored debrief visible when a subsequent Tutor request fails", async () => {
  const debrief = await tutorSnapshot(); const before = canonicalSerialize(debrief.packet.assessment);
  const generate = vi.fn<NonNullable<StudentUiServices["tutor"]>["generate"]>()
    .mockResolvedValueOnce({ kind: "AVAILABLE", debrief }).mockResolvedValueOnce({ kind: "UNAVAILABLE" });
  await act(async () => root.render(<LocalizationProvider><TutorDebriefPanel sessionId={debrief.packet.assessment.session_id} service={{ generate }} review /></LocalizationProvider>));
  await click("Review debrief snapshot"); await settle(() => !!host.querySelector('[data-testid="tutor-debrief"]'));
  const score = host.querySelector('[data-testid="tutor-debrief"] strong')!.textContent;
  await click("Review debrief snapshot");
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("Tutor unavailable");
  expect(host.querySelector('[data-testid="tutor-debrief"] strong')!.textContent).toBe(score);
  expect(host.textContent).toContain("CASE_FEEDBACK");
  expect(canonicalSerialize(debrief.packet.assessment)).toBe(before);
});

it("finishes an Arabic debrief request when language changes during an in-flight manual review load", async () => {
  const english = await tutorSnapshot();
  const arabic: TutorDebrief = { ...english, packet: { ...english.packet, locale: TutorOutputLocaleSchema.parse("ar-JO") } };
  let finishEnglish!: (result: Awaited<ReturnType<NonNullable<StudentUiServices["tutor"]>["generate"]>>) => void;
  const first = new Promise<Awaited<ReturnType<NonNullable<StudentUiServices["tutor"]>["generate"]>>>(resolve => { finishEnglish = resolve; });
  const generate = vi.fn<NonNullable<StudentUiServices["tutor"]>["generate"]>()
    .mockImplementationOnce(() => first).mockResolvedValueOnce({ kind: "AVAILABLE", debrief: arabic });
  await act(async () => root.render(<LocalizationProvider><LanguageControl /><TutorDebriefPanel sessionId={english.packet.assessment.session_id} service={{ generate }} review /></LocalizationProvider>));
  expect(generate).not.toHaveBeenCalled(); await click("Review debrief snapshot");
  expect(generate).toHaveBeenCalledOnce(); await click("Arabic");
  await act(async () => finishEnglish({ kind: "AVAILABLE", debrief: english }));
  expect(generate).toHaveBeenCalledOnce();
  expect(host.querySelector('[data-testid="tutor-debrief"]')).toBeNull();
  await click("عرض لقطة المراجعة");
  await settle(() => !!host.querySelector('[data-testid="tutor-debrief"]'));
  expect(generate).toHaveBeenLastCalledWith(english.packet.assessment.session_id, "ar-JO");
  expect(host.textContent).toContain("الدرجة الحتمية");
  expect(host.querySelector('[data-testid="tutor-debrief"] strong')!.textContent).toBe(formatBasisPoints(english.packet.assessment.overall_score_basis_points));
});
