import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useLocation } from "react-router-dom";
import { FacultyDraftMetadataSchema, type FacultyCaseView, type FacultyDraftMetadata } from "../../../../../packages/case-schema/src/faculty-metadata.ts";
import type { FacultyDemoService } from "./faculty-service";
import { AppFrame } from "../../components/AppFrame";
import { Button, Panel, StatusBadge } from "../../components/ui";

function MetadataForm({ current, service, onSaved }: { current?: FacultyCaseView; service: FacultyDemoService; onSaved(v: FacultyCaseView): void }) {
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const parsed = FacultyDraftMetadataSchema.safeParse(values);
    if (!parsed.success) { setError("Complete all metadata fields. Specialty/difficulty must be stable codes, not clinical instructions."); return; }
    setBusy(true); setError("");
    try { onSaved(await service.save(parsed.data, current)); }
    catch (e) { setError(e instanceof Error ? e.message : "Save unavailable; draft was not confirmed."); }
    finally { setBusy(false); }
  }
  const field = (name: keyof FacultyDraftMetadata, title: string, max: number) => <label>{title}<input name={name} required maxLength={max} defaultValue={current?.metadata[name] ?? ""} /></label>;
  return <Panel className="entry-panel"><h2>{current ? "Edit draft metadata" : "New Case Draft"}</h2>
    <p>NOT MEDICALLY APPROVED. Metadata only; no medical truth is generated.</p>
    <form onSubmit={e => void submit(e)}>
      {field("title", "Title", 160)}
      <label>Specialty<select name="specialty" defaultValue={current?.metadata.specialty ?? "specialty.emergency-medicine"}>
        {[...new Set(["specialty.emergency-medicine", "specialty.cardiology", "specialty.general-medicine", ...(current ? [current.metadata.specialty] : [])])].map(s => <option key={s} value={s}>{s}</option>)}
      </select></label>
      <label>Difficulty<select name="difficulty" defaultValue={current?.metadata.difficulty ?? "difficulty.unspecified"}>
        {[...new Set(["difficulty.unspecified", "difficulty.beginner", "difficulty.intermediate", "difficulty.advanced", ...(current ? [current.metadata.difficulty] : [])])].map(s => <option key={s} value={s}>{s}</option>)}
      </select></label>
      <label>Language<select name="language" defaultValue={current?.metadata.language ?? "en-US"}><option value="en-US">English</option><option value="ar-JO">Arabic (Jordan)</option></select></label>
      {field("description", "Short educational description", 1000)}
      <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save DRAFT"}</Button>
    </form>{error ? <p role="alert">{error}</p> : null}
  </Panel>;
}

export function FacultyPage({ service }: { service?: FacultyDemoService }) {
  const [cases, setCases] = useState<FacultyCaseView[]>(); const [error, setError] = useState("");
  const { caseId } = useParams(); const navigate = useNavigate(); const location = useLocation();
  const isNew = location.pathname === "/faculty/new";
  useEffect(() => { let active = true; setCases(undefined); setError("");
    if (service) void service.list().then(v => { if (active) setCases(v); }, () => { if (active) setError("Faculty catalogue unavailable. No production service is connected."); });
    return () => { active = false; };
  }, [service, location.pathname]);
  const current = cases?.find(c => c.identity.case_id === caseId);
  function saved(v: FacultyCaseView) { setCases(rows => [...(rows ?? []).filter(c => c.identity.case_id !== v.identity.case_id), v]); navigate(`/faculty/cases/${v.identity.case_id}`); }
  return <AppFrame><div className="expo-page">
    <h1>Faculty case management</h1>
    {!service ? <p role="alert">Faculty unavailable. Use the explicitly configured local Faculty demo; no production authority is implied.</p> : <>
      <p><strong>LOCAL EXPO DEMO — Faculty sandbox</strong>. Server-memory drafts survive refresh, but are lost on host restart. No institutional login or production persistence is claimed.</p>
      <nav aria-label="Faculty"><Link to="/faculty">Case catalogue</Link>{" · "}<Link to="/faculty/new">New Case Draft</Link>{" · "}<Link to="/expo">Expo entry</Link></nav>
      <p>DRAFT = incomplete authoring · REVIEW_ONLY = review execution, not publication · PUBLISHED = existing reviewed release only. This demo cannot review, approve or publish.</p>
      {error ? <p role="alert">{error}</p> : !cases ? <p role="status">Loading catalogue…</p> : isNew ? <MetadataForm key="new" service={service} onSaved={saved} /> : caseId ? current ? <>
        <Panel><h2>{current.metadata.title}</h2><StatusBadge tone="warning">{current.execution_authority ?? current.identity.status}</StatusBadge>
          <p>Publication lifecycle: {current.identity.status} · version {current.identity.case_version} · metadata revision {current.revision}</p>
          {current.medical_approval ? <p>Medical review: Complete · Approval basis: Owner-attested physician review · Physician identity and exact review timestamp: Not formally recorded · Production publication: Pending</p>
            : <p>NOT MEDICALLY APPROVED{current.metadata_shell ? " — metadata shell, not runnable" : " — clinical review pending"}</p>}
          <p>{current.overview}</p><p>{current.metadata.description}</p>
          <p>{current.metadata.specialty} · {current.metadata.difficulty} · {current.metadata.language}</p>
          <small>{current.identity.case_id} / {current.identity.case_version_id}</small>
        </Panel>
        <Panel><h2>Authored learning objectives / competencies</h2><ul>{current.competencies.map(c => <li key={c}>{c}</li>)}</ul>
          <p>{current.competencies.length ? "Authored Case competencies — not official JU/JUST alignment." : "Not authored for this metadata shell."}</p>
          <h3>Curriculum mappings</h3><p>Official alignment not claimed. Missing or unapproved sources remain pending.</p>
          <ul>{current.curriculum?.mappings.map(m => <li key={m.mapping_id}>{m.institution_id}: {m.competency_code} → {m.objective_id} — {m.status}</li>)}</ul>
          <h3>Critical actions (authored{current.medical_approval ? ", medically approved for Expo" : ", review pending"})</h3><ul>{current.critical_actions.map((a, i) => <li key={i}>{a}</li>)}</ul>
          <h3>Investigation / media / visual package</h3><ul>{current.media_status.map((m, i) => <li key={i}>{m}</li>)}</ul>
          <h3>Sources</h3><ul>{current.sources.map(s => <li key={s.source_id}>{s.source_id} · {s.source_version_id} · {s.status}</li>)}</ul>
          <p>Review types: CLINICAL / CURRICULUM_UX / VISUAL / TECHNICAL. No review or approval is granted here.</p>
        </Panel>
        {current.metadata_shell && current.identity.status === "DRAFT" ? <MetadataForm key={`${current.identity.case_id}:${current.revision}`} current={current} service={service} onSaved={saved} /> : <p>This version is read-only. No editing or publication control is available.</p>}
      </> : <p role="alert">Case not found.</p> : <Panel><h2>Available cases</h2><ul>{cases.map(c => <li key={c.identity.case_id}>
        <h3><Link to={`/faculty/cases/${c.identity.case_id}`}>{c.metadata.title}</Link></h3>
        <StatusBadge tone="warning">{c.execution_authority ?? c.identity.status}</StatusBadge>
        {c.medical_approval ? <p>Medical review: Complete · Owner-attested physician review · Production publication: Pending</p> : null}
        <p>{c.metadata.specialty} · {c.metadata.difficulty} · v{c.identity.case_version} · {c.identity.status}</p>
        <p>Curriculum: {c.curriculum?.official_alignment_claimed === false ? "pending source approval / no official alignment" : "not authored"}</p>
      </li>)}</ul></Panel>}
      <p>AI-assisted case drafting — planned / deferred. No generation is connected.</p>
    </>}
  </div></AppFrame>;
}
