import { readdir, readFile } from "node:fs/promises";
import { extname } from "node:path";

const clinicalEngineSourceRoot = new URL("../packages/clinical-engine/src/", import.meta.url);
const sessionEngineSourceRoot = new URL("../packages/session-engine/src/", import.meta.url);
const assessmentEngineSourceRoot = new URL("../packages/assessment-engine/src/", import.meta.url);
const portableSourceRoots = [
  new URL("../packages/portability-smoke/src/", import.meta.url),
  new URL("../packages/contracts/src/", import.meta.url),
  new URL("../packages/case-schema/src/", import.meta.url),
  clinicalEngineSourceRoot,
  sessionEngineSourceRoot,
  assessmentEngineSourceRoot
];

const forbiddenPatterns = [
  ["Node scheme import", /(?:from\s+|import\s*(?:\(\s*)?|require\s*\(\s*)["']node:/u],
  ["Node filesystem/path import", /(?:from\s+|import\s*(?:\(\s*)?|require\s*\(\s*)["'](?:fs|path)(?:\/[^"']*)?["']/u],
  ["runtime-specific global", /(?:\bprocess\s*(?:\.|\[)|\b(?:Deno|document|localStorage|indexedDB|IndexedDB|Buffer|__dirname|__filename|require)\b)/u],
  ["browser window global access", /\bwindow\s*(?:\.|\[)/u],
  ["provider SDK", /(?:@supabase\/|@azure\/|@sentry\/|@openai\/|["']openai["'])/iu],
  ["UI framework", /(?:from\s+|import\s*(?:\(\s*)?)["'](?:react(?:-dom)?|vue|svelte|@angular\/[^"']+)["']/u]
];

async function collectTypeScriptFiles(directoryUrl) {
  const entries = await readdir(directoryUrl, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryUrl = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, directoryUrl);

    if (entry.isDirectory()) {
      files.push(...(await collectTypeScriptFiles(entryUrl)));
    } else if (extname(entry.name) === ".ts") {
      files.push(entryUrl);
    }
  }

  return files;
}

const violations = [];

for (const portableSourceRoot of portableSourceRoots) {
  for (const fileUrl of await collectTypeScriptFiles(portableSourceRoot)) {
    const source = await readFile(fileUrl, "utf8");

    for (const [label, pattern] of forbiddenPatterns) {
      if (pattern.test(source)) {
        violations.push(`${label}: ${fileUrl.pathname}`);
      }
    }
  }
}

if (violations.length > 0) {
  throw new Error(`Portable source violations:\n${violations.join("\n")}`);
}

const clinicalEngineSourceFiles = await collectTypeScriptFiles(clinicalEngineSourceRoot);
const diseaseSpecificTerms = /\b(?:STEMI|anaphylaxis)\b/iu;
const runtimeNondeterminism = /\b(?:Math\.random|Date\.now|performance\.now|setTimeout|setInterval|crypto\.getRandomValues|crypto\.randomUUID|localeCompare)\s*\(/u;
const duplicateObservationContractAuthority = /\b(?:export\s+)?const\s+(?:ObservationProjectionDefinitionSchema|ObservationProjectionSchema|RhythmObservationDefinitionSchema|RhythmObservationMappingsSchema|RhythmObservationSchema)\s*=/u;
const duplicateRuleContractAuthority = /\b(?:export\s+)?const\s+(?:TransitionRuleSchema|RuleEffectSchema|RuleConditionSchema|SchedulerStateSchema|ScheduledItemSchema|ClinicalEventProposalSchema|TransitionTraceSchema)\s*=/u;
const clinicalEngineViolations = [];

for (const fileUrl of clinicalEngineSourceFiles) {
  const source = await readFile(fileUrl, "utf8");

  if (diseaseSpecificTerms.test(source)) {
    clinicalEngineViolations.push(`Disease-specific source term: ${fileUrl.pathname}`);
  }
  if (runtimeNondeterminism.test(source)) {
    clinicalEngineViolations.push(`Runtime nondeterminism: ${fileUrl.pathname}`);
  }
  if (duplicateObservationContractAuthority.test(source)) {
    clinicalEngineViolations.push(`Duplicate shared observation schema authority: ${fileUrl.pathname}`);
  }
  if (duplicateRuleContractAuthority.test(source)) {
    clinicalEngineViolations.push(`Duplicate shared rule/effect schema authority: ${fileUrl.pathname}`);
  }
}

if (clinicalEngineViolations.length > 0) {
  throw new Error(
    `Clinical Engine foundation violations:\n${clinicalEngineViolations.join("\n")}`
  );
}

const sessionEngineSourceFiles = await collectTypeScriptFiles(sessionEngineSourceRoot);
const sessionEngineViolations = [];
for (const fileUrl of sessionEngineSourceFiles) {
  const source = await readFile(fileUrl, "utf8");

  if (diseaseSpecificTerms.test(source)) {
    sessionEngineViolations.push(`Disease-specific source term: ${fileUrl.pathname}`);
  }
  if (runtimeNondeterminism.test(source)) {
    sessionEngineViolations.push(`Runtime nondeterminism: ${fileUrl.pathname}`);
  }
}
if (sessionEngineViolations.length > 0) {
  throw new Error(
    `Session Engine foundation violations:\n${sessionEngineViolations.join("\n")}`
  );
}

const assessmentEngineSourceFiles = await collectTypeScriptFiles(assessmentEngineSourceRoot);
const assessmentEngineViolations = [];
const assessmentSessionEngineDependency = /(?:from\s+|import\s*(?:\(\s*)?)["'][^"']*session-engine[^"']*["']/u;
for (const fileUrl of assessmentEngineSourceFiles) {
  const source = await readFile(fileUrl, "utf8");

  if (diseaseSpecificTerms.test(source)) {
    assessmentEngineViolations.push(`Disease-specific source term: ${fileUrl.pathname}`);
  }
  if (runtimeNondeterminism.test(source)) {
    assessmentEngineViolations.push(`Runtime nondeterminism: ${fileUrl.pathname}`);
  }
  if (assessmentSessionEngineDependency.test(source)) {
    assessmentEngineViolations.push(`Assessment Engine must consume the shared authoritative evidence projection, not Session internals: ${fileUrl.pathname}`);
  }
}
if (assessmentEngineViolations.length > 0) {
  throw new Error(
    `Assessment Engine foundation violations:\n${assessmentEngineViolations.join("\n")}`
  );
}

const caseSchemaSourceFiles = await collectTypeScriptFiles(
  new URL("../packages/case-schema/src/", import.meta.url)
);
const caseSchemaClinicalEngineDependency = /(?:from\s+|import\s*(?:\(\s*)?)["'][^"']*clinical-engine[^"']*["']/u;

for (const fileUrl of caseSchemaSourceFiles) {
  const source = await readFile(fileUrl, "utf8");

  if (caseSchemaClinicalEngineDependency.test(source)) {
    throw new Error(`Case Schema must consume shared observation contracts, not Clinical Engine: ${fileUrl.pathname}`);
  }
  if (duplicateRuleContractAuthority.test(source)) {
    throw new Error(`Case Schema must embed shared rule/effect contracts, not redefine them: ${fileUrl.pathname}`);
  }
}

const sharedContractSourceFiles = await collectTypeScriptFiles(
  new URL("../packages/contracts/src/", import.meta.url)
);
let sharedRuleAuthorityCount = 0;
for (const fileUrl of sharedContractSourceFiles) {
  const source = await readFile(fileUrl, "utf8");
  if (/\bexport\s+const\s+TransitionRuleSchema\s*=/u.test(source)) {
    sharedRuleAuthorityCount += 1;
  }
}
if (sharedRuleAuthorityCount !== 1) {
  throw new Error(`Expected exactly one shared TransitionRuleSchema authority; found ${sharedRuleAuthorityCount}.`);
}

const canonicalInstitutionTargets = [
  ...(await collectTypeScriptFiles(new URL("../packages/contracts/src/", import.meta.url))),
  new URL("../tests/fixtures/contracts-fixture.ts", import.meta.url),
  ...(await collectTypeScriptFiles(new URL("../tests/fixtures/cases/", import.meta.url)))
];
const standaloneReversedInstitutionCode = /(?:^|[^A-Za-z0-9_])UJ(?:$|[^A-Za-z0-9_])/mu;
const institutionCodeViolations = [];

for (const fileUrl of canonicalInstitutionTargets) {
  const source = await readFile(fileUrl, "utf8");

  if (standaloneReversedInstitutionCode.test(source)) {
    institutionCodeViolations.push(fileUrl.pathname);
  }
}

if (institutionCodeViolations.length > 0) {
  throw new Error(
    `Invalid standalone institution code in canonical contracts/fixtures:\n${institutionCodeViolations.join("\n")}`
  );
}

console.log("PORTABILITY_GUARD=PASS");
console.log("INSTITUTION_UJ_GUARD=PASS count=0");
console.log("CLINICAL_ENGINE_DISEASE_NEUTRALITY_GUARD=PASS");
console.log("CLINICAL_ENGINE_DETERMINISM_GUARD=PASS");
console.log("OBSERVATION_CONTRACT_AUTHORITY_GUARD=PASS");
console.log("RULE_EFFECT_CONTRACT_AUTHORITY_GUARD=PASS count=1");
console.log("SESSION_ENGINE_PORTABILITY_GUARD=PASS");
console.log("SESSION_ENGINE_DETERMINISM_GUARD=PASS");
console.log("ASSESSMENT_ENGINE_PORTABILITY_GUARD=PASS");
console.log("ASSESSMENT_ENGINE_DETERMINISM_GUARD=PASS");
