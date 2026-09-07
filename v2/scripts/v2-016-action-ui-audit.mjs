import { readFile, readdir } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const v2Root = fileURLToPath(new URL("../", import.meta.url));

async function filesUnder(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const paths = [];
  for (const entry of entries) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) paths.push(...await filesUnder(path));
    else if ([".ts", ".tsx", ".css"].includes(extname(entry.name))) paths.push(path);
  }
  return paths;
}

const actionFiles = await filesUnder(join(v2Root, "apps/web/src/features/actions"));
const webFiles = await filesUnder(join(v2Root, "apps/web/src"));
const actions = (await Promise.all(actionFiles.map((path) => readFile(path, "utf8")))).join("\n");
const web = (await Promise.all(webFiles.map((path) => readFile(path, "utf8")))).join("\n");
const contracts = await readFile(join(v2Root, "packages/contracts/src/api-v1.ts"), "utf8");
const api = await readFile(join(v2Root, "packages/api-core/src/service/secure-api-service.ts"), "utf8");
const recovery = await readFile(join(v2Root, "packages/recovery-core/src/coordinator.ts"), "utf8");
const component = await readFile(
  join(v2Root, "apps/web/src/features/actions/ClinicalActionsPanel.tsx"),
  "utf8"
);
const service = await readFile(join(v2Root, "apps/web/src/app/services.ts"), "utf8");
const localization = await readFile(join(v2Root, "apps/web/src/app/localization.tsx"), "utf8");

const checks = [];
function check(name, condition) {
  checks.push({ name, pass: Boolean(condition) });
}

check("shared safe learner catalogue contract exists", contracts.includes("SafeLearnerActionCatalogueSchema"));
check("safe Session projection owns catalogue", contracts.includes("learner_action_catalogue: SafeLearnerActionCatalogueSchema"));
check("catalogue schema version is exact", contracts.includes('LEARNER_ACTION_CATALOGUE_SCHEMA_VERSION = "1.0"'));
check("API derives catalogue server-side", api.includes("SafeLearnerActionCatalogueSchema.safeParse"));
check("API limits catalogue to pinned action membership", api.includes("pinnedActionIds.has(action.action_id)"));
check("safe projection contains authored labels", api.includes("action.aliases"));
check("safe projection contains permitted parameter definitions", api.includes("parameter_definitions: action.parameter_definitions"));
check("safe projection omits prerequisite references", !/prerequisite_action_ids:\s*action\.prerequisite_action_ids/u.test(api));
check("safe projection omits source references", !/source_ids:\s*action\.source_ids/u.test(api));
check("safe projection omits effect definitions", !/effects:\s*action\./u.test(api));
check("browser has no raw Case Package import", !/case-schema|content\/cases|CompiledCasePackage|ReviewExecutionArtifact/u.test(web));
check("browser has no API-core import", !/api-core/u.test(web));
check("browser has no Clinical Engine import", !/clinical-engine/u.test(web));
check("browser has no Session Engine import", !/session-engine/u.test(web));
check("UI uses shared safe action type", actions.includes("SafeLearnerAction"));
check("UI sends through action service", component.includes("services.actions.submit"));
check("UI does not directly address propose endpoint", !actions.includes("actions/propose"));
check("recovery coordinator owns journal-before-transport", recovery.indexOf("safelyWriteJournal(entry)") < recovery.indexOf("sendEntry(entry)"));
check("UI does not implement retry loop", !/setInterval|retry\s*:/u.test(actions));
check("stale path resynchronizes", component.includes('result.kind === "STALE"') && component.includes("onAuthoritativeRefresh"));
check("IN_DOUBT path resynchronizes", component.includes('result.kind === "IN_DOUBT"'));
check("double-submit guard exists", component.includes("submitting.current"));
check("post-commit authoritative refresh exists", component.includes('setPhase("PROCESSING")') && component.includes("await onAuthoritativeRefresh()"));
check("no optimistic query cache mutation", !web.includes("setQueryData") && !web.includes("onMutate"));
check("no local medical state mutation", !/patient_state\s*=|observations\.[a-z_]+\s*=|clinical_time\s*\+=/u.test(actions));
check("no local Clinical-Time timer", !/Date\.now|performance\.now|setInterval|setTimeout/u.test(actions));
check("no client randomness in action components", !/Math\.random|randomUUID/u.test(actions));
check("ActionRequest is strict shared data", service.includes("RecoveryMutationRequestSchema.safeParse"));
check("request source is fixed UI", service.includes('source: "UI"'));
check("no role authority in request construction", !/request:\s*\{[^}]*role:/su.test(service));
check("no institution authority in request construction", !/request:\s*\{[^}]*institution_id:/su.test(service));
check("no package authority in request construction", !/request:\s*\{[^}]*package_hash:/su.test(service));
check("no Patient State in request construction", !/request:\s*\{[^}]*patient_state:/su.test(service));
check("no effects in request construction", !/request:\s*\{[^}]*effects:/su.test(service));
check("History free text remains deferred", component.includes("patientAiDeferred"));
check("no Patient AI endpoint", !web.includes("/questions"));
check("no fake diagnostic result", !/fabricated_result|fake_result|client_result/u.test(actions));
check("no disease-specific action conditional", !/\bSTEMI\b|anaphylaxis|myocardial infarction/iu.test(actions));
check("no correct-action ranking", !/expected_action|correct_action|rubric|score_weight/iu.test(actions));
check("Assessment correctness not rendered", !/correct\/incorrect|correctness/u.test(component));
check("authored label lookup supports ar-JO", localization.includes('"ar-JO"'));
check("authored label fallback supports en-US", actions.includes('"en-US"'));
check("legacy patient locale absent", !/["']en["']/u.test(actions));
check("internal UJ absent", !/\bUJ\b/u.test(web));
check("form issues use alert semantics", component.includes('role="alert"'));
check("submission status uses live region", component.includes('aria-live="polite"'));
check("confirmation has dialog semantics", component.includes('role="dialog"') && component.includes('aria-modal="true"'));
check("confirmation supports keyboard cancellation", component.includes('event.key === "Escape"'));
check("disabled state is explicit", component.includes("disabled={locked}"));
check("status is text plus badge marker", component.includes("statusPresentation") && component.includes("StatusBadge"));
check("no Three.js", !/@react-three|from ["']three["']|Three\.js/u.test(web));
check("no GLB or FBX", !/\.glb|\.gltf|\.fbx/iu.test(web));
check("no Meshy", !/\bMeshy\b/iu.test(web));
check("no diagnostic media ingestion", !/base64,|diagnostic-media|FileReader|accept=["'][^"']*image/iu.test(web));
check("no RAG", !/\bRAG\b|retrieval augmented/iu.test(actions));
check("no Case Builder", !/CaseBuilder|case-builder/u.test(web));
check("no V2-017 implementation", !/features\/(monitor|timeline|assessment)/u.test(web));
check("generic clinical fields only", actions.includes("parameter_definitions"));
check("neutral search ordering", actions.includes("actionsForDomain") && !/relevance|priority|recommended/u.test(actions));
check("review-only context remains visible", component.includes("execution_authority") && component.includes("reviewOnly"));
check("Visual Patient not manipulated by actions", !/VisualPatient|visual-patient|equipment_overlay/iu.test(actions));

const failed = checks.filter((entry) => !entry.pass);
for (const item of checks) console.log(`${item.pass ? "PASS" : "FAIL"} ${item.name}`);
if (failed.length > 0) {
  throw new Error(`${failed.length} V2-016 action UI architecture check(s) failed.`);
}
console.log(`V2-016 action UI audit: ${checks.length}/${checks.length} PASS`);
