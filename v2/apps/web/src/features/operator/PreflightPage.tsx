import { useEffect, useState } from "react";
import { PreflightReportSchema, type PreflightReport, type CheckId } from "../../../../../runtime/preflight-model.ts";
import "./preflight.css";

const labels: Record<CheckId, string> = {
  build: "Build / hardened boot", clinical: "Clinical Engine — local", stemi: "Khalid / STEMI package", dana: "Dana / Anaphylaxis package",
  stemi_visual: "Khalid 3D / static fallback", dana_visual: "Dana 3D / static fallback", shared_ed: "Shared ED / examination runtime",
  diagnostics: "Local investigation media", patient_stemi: "Khalid Patient Conversation context", patient_dana: "Dana Patient Conversation context",
  assessment: "Deterministic Assessment / Tutor fallback", knowledge: "RAG technical foundation", faculty: "Faculty demo",
  ai_config: "AI Gateway configuration / model policy", voice_stemi: "Khalid Voice configuration", voice_dana: "Dana Voice configuration",
  hosts: "Review hosts / restart readiness", cache: "Local assets / PWA / offline limits"
};
export function PreflightPage() {
  const [report, setReport] = useState<PreflightReport>();
  const [busy, setBusy] = useState(false), [failed, setFailed] = useState(false);
  async function run() {
    setBusy(true); setFailed(false); setReport(undefined);
    try {
      const r = await fetch("/__operator/preflight", { method: "POST", headers: { "X-Preflight-Check": "local" }, cache: "no-store" });
      if (!r.ok) throw Error();
      setReport(PreflightReportSchema.parse(await r.json()));
    } catch { setFailed(true); } finally { setBusy(false); }
  }
  useEffect(() => { void run(); }, []);
  return <main className="operator-preflight">
    <header><p>OPERATOR ONLY · TRUSTED LOCAL SYNTHETIC EXPO · NOT A LEARNER FEATURE</p>
      <h1>Expo Preflight</h1><p>Packaged integrity + configuration + local host checks. No external provider requests.</p>
      <button disabled={busy} onClick={() => void run()}>{busy ? "Checking local readiness…" : "Re-run Preflight"}</button>
    </header>
    {failed ? <section className="readiness BLOCKED" role="alert"><h2>BLOCKED</h2><code>PREFLIGHT_UNAVAILABLE</code><p>No current readiness result. Restart the operator host and inspect its sanitized diagnostic. A previous green result is not retained.</p></section> : null}
    {report ? <>
      <section className={`readiness ${report.overall}`} aria-label="Readiness summary">
        <h2>{report.overall}</h2><p>Critical blockers: <strong>{report.blockers}</strong> · Degraded components: <strong>{report.degraded}</strong> · Informational / pending items: <strong>{report.information.length}</strong></p>
        <p>Application {report.build.version} · commit <code>{report.build.commit ?? "UNKNOWN"}</code> · {report.build.working_tree} source</p>
        <p>Checked {report.checked_at} · {report.duration_ms} ms · run <code>{report.run_id}</code></p>
        <details><summary>Source fingerprint / scope</summary><code>{report.build.source_hash}</code><p>{report.scope}. Live connectivity: NOT_PROBED. Provider requests: 0. Demo Session mutations: 0.</p></details>
      </section>
      <div className="preflight-grid">{report.checks.map(c => <section key={c.id} data-check={c.id} className={`preflight-check ${c.status}`}>
        <h2>{labels[c.id]}</h2><strong>{c.status}</strong><p><code>{c.code}</code></p><p>{c.detail}</p>
      </section>)}</div>
      <section><h2>Review / source / production gates</h2><ul>{report.information.map(i => <li key={i.id}><strong>{i.status}</strong> — {i.detail}</li>)}</ul></section>
      <section><h2>Local host checks</h2><p>Old or unverifiable active hosts are BLOCKED, not silently green. Restart in their original trusted terminals; do not transfer credentials.</p>
        <ul>{report.hosts.map(h => <li key={h.port}><code>127.0.0.1:{h.port}</code> — {h.host?.host ?? "review port"}: <strong>{h.state}</strong>{h.state === "CURRENT" ? <> · <a href={`http://127.0.0.1:${h.port}/${h.host?.host === "faculty" ? "expo" : ""}`} target="_blank" rel="noreferrer">Open local demo</a></> : null}</li>)}</ul>
      </section>
    </> : null}
    <section><h2>Before the demo</h2><ol>
      <li>Restart the intended trusted review hosts with their existing approved environment.</li>
      <li>Re-run this local preflight. Resolve every BLOCKED item.</li>
      <li>Accept only documented degraded behavior: manual actions, text, deterministic assessment and static visuals.</li>
      <li>Keep the local server running. This is not certification of full offline execution.</li>
      <li>If authorized, use the existing bounded live proof separately. No live probe button is added here.</li>
    </ol><p>Physician, diagnostic-media rights and curriculum review remain independent release gates.</p></section>
  </main>;
}
