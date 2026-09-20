import { useEffect, useRef, useState } from "react";
import { VisualExamRequestSchema, VisualPatientPresentationSchema,
  type VisualExamRequest, type VisualPatientPresentation } from "@ai-clinical-simulation/contracts";
import { Panel, Button } from "../../components/ui";
import { useLocalization } from "../../app/localization";
import type { PatientRuntime, ExamRegion } from "./runtime/runtime.js";
import "./visual-patient.css";
import { resolvePatientStaticFallback } from "./static-fallback";

// Read-only presentation diagnostics for local regression tooling, never clinical authority.
const runtimes = new WeakMap<HTMLCanvasElement, PatientRuntime>();
export function visualPatientDiagnostics(canvas: HTMLCanvasElement) { return runtimes.get(canvas)?.stats(); }
const regions: readonly [ExamRegion, string, string][] = [
  ["DEFAULT_COVERED", "Cover / Reset", "تغطية / إعادة ضبط"], ["CHEST", "Chest", "الصدر"],
  ["ABDOMEN", "Abdomen", "البطن"], ["LEFT_ARM", "Left arm", "الذراع اليسرى"],
  ["RIGHT_ARM", "Right arm", "الذراع اليمنى"], ["LOWER_LEGS", "Lower legs", "الساقان"]
];
export function VisualPatient({ sessionId, presentation, speaking, enabled, onExamRequest }: {
  sessionId: string; presentation?: VisualPatientPresentation; speaking: boolean;
  enabled: boolean; onExamRequest(request: VisualExamRequest): void;
}) {
  const { locale } = useLocalization(); const ar = locale === "ar-JO";
  const canvas = useRef<HTMLCanvasElement>(null); const viewport = useRef<HTMLDivElement>(null);
  const runtime = useRef<PatientRuntime | undefined>(undefined);
  const starter = useRef<(() => Promise<void>) | undefined>(undefined);
  const latest = useRef({ presentation, speaking, onExamRequest }); latest.current = { presentation, speaking, onExamRequest };
  const [status, setStatus] = useState<"IDLE" | "LOADING" | "READY" | "FAILED">("IDLE");
  const [staticFailed, setStaticFailed] = useState(false);
  const [exam, setExam] = useState(false); const [region, setRegion] = useState<ExamRegion>("DEFAULT_COVERED");
  const [tool, setTool] = useState<VisualExamRequest["tool"]>("inspection");
  const supported = VisualPatientPresentationSchema.safeParse(presentation).success;
  // Only session identity starts an instance. Presentation/playback updates never remount it.
  useEffect(() => {
    let cancelled = false; let started = false;
    const start = async () => {
      // StrictMode's discarded effect is cancelled before allocating/fetching a GLB.
      await Promise.resolve(); if (cancelled || !canvas.current || !viewport.current) return;
      if (started || !VisualPatientPresentationSchema.safeParse(latest.current.presentation).success) return;
      started = true;
      setStatus("LOADING"); setStaticFailed(false); setExam(false); setRegion("DEFAULT_COVERED");
      try {
        const { createPatientRuntime } = await import("./runtime/runtime.js");
        if (cancelled) return;
        const instance = createPatientRuntime(canvas.current, viewport.current, {
          onReady() { if (cancelled) return; const p = VisualPatientPresentationSchema.safeParse(latest.current.presentation); if (p.success) instance.setPresentation(p.data); instance.setSpeaking(latest.current.speaking); setStatus("READY"); },
          onError() { if (!cancelled) setStatus("FAILED"); },
          onExamRequest(value) { const parsed = VisualExamRequestSchema.safeParse(value); if (parsed.success) latest.current.onExamRequest(parsed.data); }
        });
        runtime.current = instance; runtimes.set(canvas.current, instance);
      } catch { if (!cancelled) setStatus("FAILED"); }
    };
    starter.current = start; void start();
    return () => { cancelled = true; if (canvas.current) runtimes.delete(canvas.current); runtime.current?.dispose(); runtime.current = undefined; };
  }, [sessionId]);
  useEffect(() => {
    const parsed = VisualPatientPresentationSchema.safeParse(presentation);
    if (parsed.success) { if (runtime.current) runtime.current.setPresentation(parsed.data); else void starter.current?.(); }
    else { runtime.current?.exitExam(); setExam(false); }
  }, [presentation]);
  useEffect(() => { runtime.current?.setSpeaking(speaking); }, [speaking]);
  useEffect(() => { if (!enabled) { runtime.current?.exitExam(); setExam(false); } }, [enabled]);
  const ready = status === "READY" && supported;
  const fallback = staticFailed ? undefined : resolvePatientStaticFallback(presentation, status);
  function selectRegion(value: ExamRegion) { if (runtime.current?.reveal(value)) { setRegion(value); if (tool === "penlight") setTool("inspection"); } }
  return <Panel className="visual-patient-native" aria-labelledby="visual-patient-title">
    <div className="visual-patient-native__header"><h2 id="visual-patient-title">{ar ? "المريض المرئي" : "Visual Patient"}</h2>
      <span>{exam ? (ar ? "الفحص السريري" : "Physical examination") : (ar ? "التواصل مع المريض" : "Patient interaction")}</span>
      {speaking && ready ? <span role="status">{ar ? "يتحدث" : "Speaking"}</span> : null}
    </div>
    <div className="visual-patient-native__viewport" ref={viewport} data-visual-status={ready ? "READY" : status}>
      {supported || status !== "IDLE" ? <canvas ref={canvas} aria-label={ar ? "المريض ثلاثي الأبعاد؛ اسحب لتحريك الكاميرا" : "3D patient; drag to adjust camera"} style={{ visibility: ready ? "visible" : "hidden" }} /> : null}
      {!ready ? <div className="visual-patient-native__fallback" role="status">
        {fallback ? <img src={fallback.path} onError={() => setStaticFailed(true)} alt={ar ? "صورة ثابتة للمريض، وليست فحصًا حيًا" : "Static patient illustration, not a live examination"} style={{ maxWidth: "100%", maxHeight: "calc(100% - 5rem)", objectFit: "contain" }} /> : null}
        <strong>{fallback ? (ar ? "صورة بديلة ثابتة — العرض ثلاثي الأبعاد غير متاح" : "Static fallback — 3D view unavailable") : status === "LOADING" && supported ? (ar ? "جارٍ تحميل المريض…" : "Loading patient…") : (ar ? "العرض المرئي غير متاح" : "Patient view unavailable")}</strong><p>{ar ? "تظل المراقبة والإجراءات السريرية متاحة." : "Monitoring and clinical actions remain available."}</p></div> : null}
    </div>
    <div className="visual-patient-native__controls">
      <Button disabled={!ready || !enabled} onClick={() => { if (exam) runtime.current?.exitExam(); else runtime.current?.enterExam(); setExam(!exam); setRegion("DEFAULT_COVERED"); setTool("inspection"); }}>{exam ? (ar ? "إنهاء الفحص" : "Exit examination") : (ar ? "بدء الفحص السريري" : "Enter physical examination")}</Button>
      <Button disabled={!ready} onClick={() => runtime.current?.focus()}>{ar ? "إعادة توسيط الكاميرا" : "Reset camera"}</Button>
      {exam ? <>
        <div role="group" aria-label="Examination region">{regions.map(([id, en, arabic]) => <button key={id} type="button" aria-pressed={region === id} onClick={() => selectRegion(id)}>{ar ? arabic : en}</button>)}</div>
        <div role="group" aria-label="Examination tool">{([ ["inspection", "Inspection / pointer", "المعاينة"], ["stethoscope", "Stethoscope", "السماعة"], ["penlight", "Penlight", "المصباح"] ] as const).map(([id,en,arabic]) => <button key={id} type="button" aria-pressed={tool === id} onClick={() => { if (runtime.current?.tool(id)) { setTool(id); if (id === "penlight") setRegion("DEFAULT_COVERED"); } }}>{ar ? arabic : en}</button>)}</div>
        <p>{ar ? "اختر منطقة ثم انقر على المريض لطلب الفحص. تأكيد الإجراء يتم من قائمة الإجراءات؛ لا تُستنتج النتائج من الصورة." : "Select a region, then point to the patient to request examination. Confirm clinical actions in the action panel; appearance is not an examination result."}</p>
      </> : null}
    </div>
  </Panel>;
}
