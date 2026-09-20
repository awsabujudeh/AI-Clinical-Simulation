import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { SafeInvestigationProjection } from "@ai-clinical-simulation/contracts";
import type { SessionPresentationState, StudentUiServices } from "../../app/types";
import { useLocalization } from "../../app/localization";
import { Panel, SectionHeader } from "../../components/ui";
import manifest from "../../../../../content/media/stemi/manifest.json";

type Entry = typeof manifest.diagnostics[number];
const text = (items: readonly {locale: string; text: string}[] | undefined, locale: string) =>
  items?.find(t => t.locale === locale)?.text ?? items?.find(t => t.locale === "en-US")?.text;

export function matchingStemiMedia(state: SessionPresentationState) {
  const p = state.projection.pinned_case;
  return p.execution_authority === "REVIEW_ONLY" && p.case_version_id === manifest.case_association.case_version_id
    && p.case_version === manifest.case_association.case_version && p.case_package_id === manifest.case_association.case_package_id;
}

export function InvestigationResult({ entry, result, ordered, locale }: {
  entry: Entry; result?: {kind: "AVAILABLE"; projection: SafeInvestigationProjection} | {kind: "PENDING" | "UNAVAILABLE"};
  ordered: boolean; locale: string;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const ar = locale === "ar-JO";
  const p = result?.kind === "AVAILABLE" && result.projection.diagnostic_result_id === entry.diagnostic_result_id ? result.projection : undefined;
  const mediaAllowed = p?.component_status.media === "AVAILABLE"
    && p.media_assets?.some(a => a.media_asset_id === entry.definition.media_asset_id);
  const reportAllowed = p?.component_status.formal_report === "AVAILABLE";
  const reference = useQuery({ queryKey: ["diagnostic-reference-report", entry.definition.media_asset_id],
    queryFn: async () => { const r = await fetch(entry.packaged!.report_path); if (!r.ok) throw Error("REPORT_UNAVAILABLE"); return r.text(); },
    enabled: !!(mediaAllowed && reportAllowed && entry.packaged), retry: false, refetchOnWindowFocus: false });
  return <article data-testid={entry.diagnostic_result_id} style={{borderTop:"1px solid #d8e2e6",padding:".8rem 0"}}>
    <h3>{text(entry.labels, locale)}</h3>
    <p role="status">{p ? (ar ? "النتيجة متاحة" : "Result available") : result?.kind === "UNAVAILABLE" ? (ar ? "تعذر جلب النتيجة" : "Result unavailable") : ordered ? (ar ? "تم الطلب — قيد الانتظار" : "Ordered — pending") : (ar ? "لم تُطلب بعد" : "Not ordered")}</p>
    {p?.component_status.structured_result === "AVAILABLE" ? <>
      {p.finding_texts?.map((f,i) => <p key={i}>{text(f,locale)}</p>)}
      {p.structured_result && "structured_measurements" in p.structured_result ? <ul>{p.structured_result.structured_measurements.map(m => <li key={m.measurement_id}>{m.measurement_code}: {m.value} {m.unit_code}</li>)}</ul> : null}
      {p.structured_result && "analytes" in p.structured_result ? <ul>{p.structured_result.analytes.map(a => <li key={a.analyte_id}>{a.analyte_code}: {a.value} {a.unit_code}</li>)}</ul> : null}
    </> : null}
    {mediaAllowed ? entry.packaged && !imageFailed ? <figure style={{margin:0}}>
      <figcaption>{ar ? "صورة مرجعية للمراجعة فقط — بانتظار مراجعة الطبيب، نتائج الحالة هي المرجع" : "REVIEW_ONLY reference image — PENDING_PHYSICIAN_REVIEW. Authored case findings remain authoritative."}</figcaption>
      {entry.review_note ? <p>{entry.review_note}</p> : null}
      <img src={entry.packaged.image_path} alt={text(entry.labels,locale)} onError={() => setImageFailed(true)} style={{maxWidth:"100%",height:"auto"}} />
    </figure> : <p role="status">{entry.packaged ? "MEDIA_UNAVAILABLE" : "MEDIA_ASSET_PENDING"} — {ar ? "النتائج النصية أعلاه هي المرجع" : "Use the authored text findings above."}</p> : p ? <p>{ar ? "الصورة قيد الانتظار أو محجوبة" : "Image pending or withheld"}</p> : null}
    {reportAllowed ? <section><h4>{ar ? "تقرير الحالة" : "Authored case report"}</h4><p>{text(p?.formal_report_text,locale) ?? (ar ? "نص التقرير غير متاح" : "Report text unavailable")}</p></section> : p ? <p>{ar ? "التقرير قيد الانتظار أو محجوب" : "Report pending or withheld"}</p> : null}
    {mediaAllowed && reportAllowed && entry.packaged ? <section><h4>{ar ? "التقرير المرافق للصورة المرجعية — للمراجعة" : "Paired library reference report — review only"}</h4><p style={{whiteSpace:"pre-wrap"}}>{reference.data ?? (reference.isError ? "REFERENCE_REPORT_UNAVAILABLE" : "Loading reference report…")}</p></section> : null}
  </article>;
}

export function InvestigationResults({state, services}: {state: SessionPresentationState; services: StudentUiServices}) {
  const {locale,t}=useLocalization();
  const allowed=state.mutation_authority === "SERVER_ONLY" && matchingStemiMedia(state);
  const query=useQuery({queryKey:["investigation-results",state.projection.session_id,state.projection.event_sequence_through],
    queryFn:async()=>{
      const timeline=await services.timeline.load(state.projection.session_id);
      const entries=await Promise.all(manifest.diagnostics.map(async entry=>({entry,result:await services.investigations!.load(state.projection.session_id,entry.diagnostic_result_id)})));
      return {timeline,entries};
    },enabled:allowed && !!services.investigations,retry:false,refetchInterval:2000,refetchOnWindowFocus:false});
  return <Panel className="investigation-slot" aria-labelledby="investigation-title"><SectionHeader id="investigation-title" title={t("investigationsTitle")} />
    {!allowed || !services.investigations ? <p>Results unavailable in this session context.</p> : query.isError ? <p role="alert">Results unavailable. Refresh authoritative Session state.</p> : query.data?.entries.map(({entry,result})=><InvestigationResult key={`${state.projection.session_id}:${entry.diagnostic_result_id}`} entry={entry} result={result} locale={locale}
      ordered={query.data.timeline.kind === "AVAILABLE" && query.data.timeline.projection.items.some(i=>i.action_id===entry.action_id && i.item_type==="ACTION_COMMITTED")} />) ?? <p>Loading investigations…</p>}
  </Panel>;
}
