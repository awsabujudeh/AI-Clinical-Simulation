import { readFile, readdir } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));

async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await filesUnder(path));
    else if ([".ts", ".tsx", ".css"].includes(extname(entry.name))) files.push(path);
  }
  return files;
}

async function source(path) {
  return await readFile(join(root, path), "utf8");
}

const webFiles = await filesUnder(join(root, "apps/web/src"));
const web = (await Promise.all(webFiles.map((path) => readFile(path, "utf8")))).join("\n");
const monitor = await source("apps/web/src/features/monitor/ClinicalMonitor.tsx");
const monitorModel = await source("apps/web/src/features/monitor/monitor-model.ts");
const timeline = await source("apps/web/src/features/timeline/LearnerTimeline.tsx");
const assessment = await source("apps/web/src/features/assessment/AssessmentDebriefPanel.tsx");
const assessmentModel = await source("apps/web/src/features/assessment/assessment-model.ts");
const workspace = await source("apps/web/src/features/simulation/SimulationWorkspace.tsx");
const services = await source("apps/web/src/app/services.ts");
const types = await source("apps/web/src/app/types.ts");
const localization = await source("apps/web/src/app/localization.tsx");
const styles = await source("apps/web/src/styles.css");
const contracts = await source("packages/contracts/src/api-v1.ts");
const api = await source("packages/api-core/src/service/secure-api-service.ts");
const routes = await source("packages/api-core/src/http/create-api-app.ts");
const openapi = await source("supabase/functions/api/openapi.v1.json");
const vite = await source("apps/web/vite.config.mjs");
const packageJson = JSON.parse(await source("package.json"));

const checks = [];
function check(name, condition) { checks.push({ name, pass: Boolean(condition) }); }

check("monitor reads the safe Session observation projection", monitor.includes("state.projection.observations"));
check("monitor does not own Patient State", !/PatientStateSchema|patient_state/u.test(monitor));
check("monitor does not calculate vital values", !/heart_rate_bpm\s*[+*/-]|systolic_bp_mm_hg\s*[+*/-]|spo2_percent\s*[+*/-]/u.test(monitor));
check("monitor does not classify medical thresholds", !/>\s*\d+|<\s*\d+|abnormal|danger|tachy|brady/iu.test(monitor));
check("monitor has no waveform renderer", !/<canvas|<svg|requestAnimationFrame|setInterval/iu.test(monitor));
check("monitor explicitly documents no fabricated waveform", monitor.includes("monitorNoWaveform"));
check("monitor shows HR", monitor.includes("heart_rate_bpm"));
check("monitor shows BP", monitor.includes("systolic_bp_mm_hg") && monitor.includes("diastolic_bp_mm_hg"));
check("monitor shows RR", monitor.includes("respiratory_rate_per_minute"));
check("monitor shows SpO2", monitor.includes("spo2_percent"));
check("monitor shows optional temperature only when present", monitor.includes("temperature_celsius === undefined"));
check("monitor shows explicit rhythm", monitor.includes("observation.rhythm.cardiac_rhythm"));
check("monitor shows consciousness", monitor.includes("consciousness_display_code"));
check("monitor marks stale state in text and style", monitor.includes("monitorStale") && monitor.includes("monitor-slot--stale"));
check("monitor identifier mapping is presentation-only", monitorModel.includes("observationDescriptorLabel"));
check("raw unknown rhythm code is not returned to learner", monitorModel.includes("Case-configured rhythm") && !monitorModel.includes("return code"));
check("mixed-direction monitor units are protected", monitor.includes('dir="ltr"'));

check("shared learner timeline contract exists", contracts.includes("SafeLearnerTimelineProjectionSchema"));
check("timeline contract version is exact", contracts.includes('LEARNER_TIMELINE_SCHEMA_VERSION = "1.0"'));
check("timeline response is bounded", contracts.includes("items: z.array(SafeLearnerTimelineItemSchema).max(256)"));
check("timeline enforces unique Event references", contracts.includes("Learner timeline Event references must be unique"));
check("timeline enforces committed sequence order", contracts.includes("must preserve increasing committed sequence order"));
check("timeline API route exists", routes.includes('/v1/sessions/:session_id/timeline'));
check("timeline route uses the secure service authority", routes.includes("service.getLearnerTimeline"));
check("timeline derives from committed events", api.includes("session.committed_events.flatMap"));
check("timeline filters non-committed data", api.includes('event.status !== "COMMITTED"'));
check("timeline filters future Clinical Time", api.includes("event.clinical_time > session.patient_state.clinical_time"));
check("timeline uses authoritative event sequence", api.includes("sequence_no: event.sequence_no"));
check("timeline uses authoritative Clinical Time", api.includes("clinical_time: event.clinical_time"));
check("timeline emits safe labels rather than payload", api.includes("labels:") && !contracts.match(/SafeLearnerTimelineItemSchema[\s\S]{0,500}payload/u));
check("timeline excludes unmapped internal events", api.includes("return undefined"));
check("timeline UI consumes only safe projection", types.includes("SafeLearnerTimelineProjection"));
check("timeline UI does not import raw Event contracts", !/CanonicalEvent|EventEnvelope|InMemorySessionAggregate/u.test(timeline));
check("timeline UI preserves server item order", !/\.sort\(/u.test(timeline));
check("timeline UI does not use browser wall time", !/Date\.now|performance\.now|new Date/u.test(timeline));
check("timeline has semantic ordered-list markup", timeline.includes('<ol className="learner-timeline">'));
check("timeline private API is absent from Workbox cache", vite.includes("runtimeCaching: []"));
check("timeline OpenAPI declaration exists", openapi.includes('/v1/sessions/{session_id}/timeline'));

check("active Assessment disclosure contract remains distinct", contracts.includes("ACTIVE_ASSESSMENT_WITHHELD"));
check("final Assessment safe contract exists", contracts.includes("SafeFinalAssessmentProjectionSchema"));
check("Assessment API union is strict", contracts.includes("SafeAssessmentApiProjectionSchema"));
check("final Assessment requires six domains", contracts.includes(")).length(6)"));
check("domain labels are returned by the server", api.includes("localizedLabelsForKey(authorization, definition.title_key)"));
check("React does not hard-code disease domain labels", !/Reperfusion|Acute inferior|STEMI|anaphylaxis/iu.test(assessment));
check("active Assessment does not fetch final result", assessment.includes("enabled: ended && current"));
check("active Assessment presents explicit withholding", assessment.includes("assessmentWithheld"));
check("Practice uses only resolved disclosure findings", assessment.includes("disclosure.resolved_findings"));
check("final Assessment requires ended Session state", assessment.includes('state.projection.status === "ENDED"'));
check("final domain values are rendered as returned", assessment.includes("result.domain_scores.map"));
check("overall score is read from returned projection", assessment.includes("result.overall_score_basis_points"));
check("basis-point arithmetic is display formatting only", assessmentModel.includes("formatBasisPoints") && !/weight|penalty|cap|criterion/u.test(assessmentModel));
check("React does not derive unsafe status", assessment.includes("result.unsafe") && !/unsafe\s*=|unsafe\s*:/u.test(assessment));
check("public findings exclude rubric item identity", !/rubric_item_id/u.test(contracts.match(/SafeFinalAssessmentProjectionSchema[\s\S]*?EndSimulationResponseDataSchema/u)?.[0] ?? ""));
check("debrief evidence uses safe references", assessment.includes("finding.evidence") && !/payload/u.test(assessment));
check("debrief is deterministic and has no AI dependency", !/OpenAI|LLM|generateText|chatCompletion/iu.test(assessment));
check("finalization uses the recovery mutation boundary", services.includes('operation: "END_SESSION"'));
check("finalization uses stable idempotency identity", services.includes("SessionFinalizationIdentityFactory"));
check("finalization does not auto-repeat in UI", assessment.includes("ending.current") && (assessment.match(/finalizationService\.end/gu)?.length ?? 0) === 1 && !/setTimeout|setInterval/u.test(assessment));
check("lost finalization response triggers authoritative refresh", assessment.includes('result.kind === "IN_DOUBT"') && assessment.includes("onAuthoritativeRefresh"));
check("ended actions remain disabled by shared mutation authority", workspace.includes("isSessionMutationEntryEnabled(state)"));

check("English localization includes V2-017 surfaces", localization.includes('assessmentTitle: "Assessment and debrief"'));
check("Arabic localization includes V2-017 surfaces", localization.includes('assessmentTitle: "التقييم والمراجعة الختامية"'));
check("canonical ar-JO locale remains present", web.includes('"ar-JO"'));
check("canonical en-US locale remains present", web.includes('"en-US"'));
check("legacy patient locale is absent", !/["']en["']/u.test(web));
check("internal UJ institution code is absent", !/\bUJ\b/u.test(web));
check("RTL direction remains explicit", localization.includes('direction: "ltr" | "rtl"') && styles.includes('[dir="rtl"]'));
check("LTR direction remains default", web.includes('return locale === "ar-JO" ? "rtl" : "ltr"'));
check("status presentation is not color-only", monitor.includes("StatusBadge") && timeline.includes("StatusBadge"));
check("assessment has labelled semantic region", assessment.includes('aria-labelledby="assessment-title"'));
check("timeline has labelled semantic region", timeline.includes('aria-labelledby="timeline-title"'));
check("monitor has labelled semantic region", monitor.includes('aria-labelledby="monitor-title"'));
check("responsive tablet layout includes all three surfaces", styles.includes('grid-template-areas: "visual" "monitor" "interaction" "investigation" "timeline" "assessment"'));
check("reduced motion remains respected", styles.includes("prefers-reduced-motion: reduce"));

check("web has no Three.js or React Three Fiber dependency", !/@react-three|from ["']three["']/u.test(web));
check("web has no Meshy integration", !/\bMeshy\b/iu.test(web));
check("web has no 3D asset dependency", !/\.glb|\.gltf|\.fbx/iu.test(web));
check("web has no diagnostic media ingestion", !/base64,|FileReader|diagnostic-media|accept=["'][^"']*image/iu.test(web));
check("Visual Patient remains a reserved slot", workspace.includes("VisualPatientSlot") && workspace.includes("visualBody"));
check("Patient Conversation uses the injected service boundary", web.includes("PatientConversationPanel") && web.includes("services.patient_conversation"));
check("web has no direct Patient provider or HTTP endpoint", !web.includes("/questions") && !web.includes("api.openai.com"));
check("web has no API-core dependency", !web.includes("api-core"));
check("web has no Clinical or Assessment Engine dependency", !/clinical-engine|assessment-engine|session-engine/u.test(web));
check("web has no optimistic medical cache mutation", !/setQueryData|onMutate/u.test(web));
check("web has no local Clinical Time clock", !/Date\.now|performance\.now|setInterval/u.test(web));
check("no remote Supabase dependency was added", !/supabase\.co|createClient\(/u.test(web));
check("focused V2-017 command exists", typeof packageJson.scripts["test:v2-017"] === "string");

const failed = checks.filter((entry) => !entry.pass);
for (const item of checks) console.log(`${item.pass ? "PASS" : "FAIL"} ${item.name}`);
if (failed.length > 0) throw new Error(`${failed.length} V2-017 disclosure audit check(s) failed.`);
console.log(`V2-017 disclosure audit: ${checks.length}/${checks.length} PASS`);
