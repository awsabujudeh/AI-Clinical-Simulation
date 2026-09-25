import { useRef, useState } from "react";
import type { TutorDebrief } from "@ai-clinical-simulation/contracts";
import type { StudentTutorService } from "../../app/types";
import { useLocalization } from "../../app/localization";
import { Button } from "../../components/ui";
import { assessmentDomainLabel, formatBasisPoints } from "./assessment-model";

export function TutorDebriefPanel({ sessionId, service, review }: { sessionId: string; service: StudentTutorService; review: boolean }) {
  const { locale } = useLocalization();
  const ar = locale === "ar-JO";
  const [data, setData] = useState<TutorDebrief>();
  const [busy, setBusy] = useState(false);
  const requested = useRef(false);
  const [failed, setFailed] = useState(false);
  const visible = String(data?.packet.locale) === String(locale) ? data : undefined;
  const text = (en: string, arabic: string) => ar ? arabic : en;
  async function load() {
    if (requested.current) return;
    requested.current = true;
    setBusy(true); setFailed(false);
    try {
      const r = await service.generate(sessionId, locale);
      if (r.kind === "AVAILABLE") setData(r.debrief); else setFailed(true);
    } catch { setFailed(true); } finally { requested.current = false; setBusy(false); }
  }
  const a = visible?.packet.assessment;
  const status = (kind: string, value: string) => {
    if ((kind === "CRITICAL_ERROR" || kind === "PENALTY") && value === "PENDING") return text("Safety criterion unresolved; no matching unsafe event recorded", "معيار السلامة غير محسوم؛ لا يوجد حدث غير آمن مطابق مسجل");
    if (value === "PENDING") return text("Unresolved — not yet a missed action", "غير محسوم — لا يُعد إجراءً فائتًا بعد");
    if (kind === "CRITICAL_ACTION") return value === "TRIGGERED" ? text("Missed critical action", "إجراء حرج فائت") : text("Critical action completed", "إجراء حرج مكتمل");
    if (value === "SATISFIED") return text("Completed criterion", "معيار مكتمل");
    if (value === "MISSED") return text("Missed criterion", "معيار غير مستوفى");
    return value === "TRIGGERED" ? text("Safety / penalty finding", "ملاحظة سلامة / خصم") : text("Not triggered", "لم يتحقق");
  };
  const card = (id: string) => {
    const c = visible?.packet.criteria.find(c => c.criterion.rubric_item_id === id);
    if (!c || !a) return null;
    const evidence = a.evidence_records.filter(e => c.criterion.evidence_ref_ids.includes(e.evidence_ref_id));
    return <li key={id}>
      {c.criterion.criterion_kind === "CRITICAL_ERROR" || c.criterion.criterion_kind === "PENALTY" ? <span>{text("Safety watch — not a recommendation: ", "مراقبة السلامة — ليست توصية: ")}</span> : null}
      <strong>{c.action_labels.join(" / ") || c.event_types.join(" / ") || id}</strong>{" — "}
      {status(c.criterion.criterion_kind, c.criterion.status)}
      <details><summary>{text("Evidence / rubric timing", "الأدلة / توقيت المعيار")}</summary>
      <p>{id} · +{c.criterion.awarded_points} / −{c.criterion.deducted_points} {text("raw points", "نقاط خام")}</p>
      {a.applied_critical_effects.filter(e => e.rubric_item_id === id).map((e, i) => <p key={i}>{text("Applied Case safety rule", "قاعدة سلامة مطبقة من الحالة")}: {e.effect_type}{"cap_basis_points" in e ? ` ${formatBasisPoints(e.cap_basis_points)}` : "penalty_basis_points" in e ? ` −${formatBasisPoints(e.penalty_basis_points)}` : ""}</p>)}
      {c.timing_description ? <p>{text("Authored Clinical-Time window", "النافذة الزمنية السريرية المؤلفة")}: <span dir="ltr">{c.timing_description}</span></p> : null}
      <ul>{evidence.map(e => <li key={e.evidence_ref_id}>{e.evidence_kind === "COMMITTED_EVENT"
        ? <span dir="ltr">{e.clinical_time}s · #{e.sequence_no} · {e.action_id ?? e.event_type}</span>
        : text("Required matching evidence absent", "لا يوجد دليل مطابق للمعيار")}</li>)}</ul>
      <small>{c.criterion.trace_codes.join(" · ")}</small>
      </details>
    </li>;
  };
  return <section aria-label={text("Post-simulation Tutor", "مرشد ما بعد المحاكاة")}>
    <h3>{text("Post-simulation Tutor", "مرشد ما بعد المحاكاة")}</h3>
    {review ? <p>{text("REVIEW ONLY: assessment snapshot, not a finalized production score. Pending criteria stay unresolved. This does not end or publish the Case.", "للمراجعة فقط: لقطة تقييم وليست درجة إنتاج نهائية. تبقى المعايير المعلقة غير محسومة، ولا تُنهى الجلسة أو تُنشر الحالة.")}</p> : null}
    <Button disabled={busy} onClick={() => void load()}>{busy ? text("Preparing debrief…", "جارٍ التحضير…") : review ? text("Review debrief snapshot", "عرض لقطة المراجعة") : text("Generate Tutor debrief", "إنشاء ملخص المرشد")}</Button>
    {failed ? <p role="alert">{text("Tutor unavailable. Your deterministic assessment remains available above.", "المرشد غير متاح. يبقى التقييم الحتمي ظاهرًا أعلاه.")}</p> : null}
    {visible && a ? <div data-testid="tutor-debrief">
      <p role="status">{visible.tutor_status === "AI_ASSISTED" ? text("AI-assisted learning priorities · evidence-bound feedback", "أولويات تعلم بمساعدة الذكاء الاصطناعي · ملاحظات مقيدة بالأدلة") : text("Tutor unavailable / degraded — deterministic template feedback", "المرشد غير متاح / وضع محدود — ملاحظات حتمية بديلة")}</p>
      <h4>CASE_FEEDBACK</h4>
      <p>{text("Deterministic score", "الدرجة الحتمية")}: <strong>{formatBasisPoints(a.overall_score_basis_points)}</strong> · {a.assessed_through_clinical_time}s · {text("Evidence through event", "الأدلة حتى الحدث")} #{a.event_sequence_through}</p>
      <p>{text("This attempt", "هذه المحاولة")}: {a.criterion_results.filter(c => c.status === "SATISFIED").length} {text("scored criteria completed", "معايير تقييم مكتملة")} · {a.criterion_results.filter(c => c.status === "MISSED").length} {text("missed", "فائتة")} · {a.criterion_results.filter(c => c.status === "TRIGGERED").length} {text("triggered safety / penalty criteria", "معايير سلامة / خصم متحققة")}. {text("These are authored Case findings, not external guideline claims.", "هذه نتائج الحالة المؤلفة وليست ادعاءات بإرشادات خارجية.")}</p>
      <ul>{a.domain_scores.map(d => <li key={d.domain_id}>{assessmentDomainLabel(d.domain_id, visible.packet.domain_labels.find(l => l.domain_id === d.domain_id)?.label, locale)}: {formatBasisPoints(d.score_basis_points)}</li>)}</ul>
      <h4>{text("What went well", "ما تم بنجاح")}</h4>
      <ul>{visible.packet.criteria.filter(c => c.criterion.status === "SATISFIED" || (c.criterion.criterion_kind === "CRITICAL_ACTION" && c.criterion.status === "NOT_TRIGGERED")).map(c => card(c.criterion.rubric_item_id))}</ul>
      <h4>{text("Critical actions, errors and unresolved items", "الإجراءات الحرجة والأخطاء والمعايير غير المحسومة")}</h4>
      <ul>{visible.packet.criteria.filter(c => c.criterion.criterion_kind.startsWith("CRITICAL") || c.criterion.criterion_kind === "PENALTY").map(c => card(c.criterion.rubric_item_id))}</ul>
      <h4>{text("Missed actions and important timing", "الإجراءات الفائتة والتوقيت المهم")}</h4>
      <ul>{visible.packet.criteria.filter(c => c.criterion.status === "MISSED" || c.timing_description !== null).map(c => card(c.criterion.rubric_item_id))}</ul>
      <h4>{text("Learning priorities / next focus", "أولويات التعلم / التركيز القادم")}</h4>
      <ol>{visible.plan.priority_criterion_ids.map(id => card(id))}</ol>
      <p>{text("Review missed requirements, their Clinical-Time windows, and avoidance of recorded unsafe actions. No additional medical recommendation is generated.", "راجع المتطلبات الفائتة ونوافذها الزمنية السريرية وتجنب الإجراءات غير الآمنة المسجلة. لا يتم توليد توصيات طبية إضافية.")}</p>
      <h4>{text("Authored Case competencies — not official curriculum mapping", "كفاءات الحالة المؤلفة — ليست مواءمة منهج رسمية")}</h4>
      <ul>{visible.packet.authored_competencies.map(c => <li key={c}>{c}</li>)}</ul>
      <h4>EXTERNAL_EVIDENCE</h4>
      <p>{visible.packet.clinical_source_status}</p>
      {visible.packet.clinical_evidence.map(e => <blockquote key={e.chunk_id}>{e.content}<footer>{e.citation.title} · {e.source_version_id} · {e.citation.locator.section} · {e.citation.location}</footer></blockquote>)}
      <h4>CURRICULUM_ALIGNMENT</h4>
      <p>{visible.packet.curriculum_status === "CURRICULUM_SOURCE_PENDING" ? text("Curriculum mapping pending source approval", "مواءمة المنهج بانتظار اعتماد المصدر") : text("Approved mapped objective evidence", "دليل هدف مرتبط ومعتمد")}</p>
      {visible.packet.curriculum_evidence.map(e => <blockquote key={e.chunk_id}>{e.content}<footer>{e.objective_id} · {e.citation.title} · {e.source_version_id} · {e.citation.locator.section}</footer></blockquote>)}
    </div> : null}
  </section>;
}
