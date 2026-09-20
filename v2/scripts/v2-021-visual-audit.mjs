import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../apps/web/src/features/visual-patient/", import.meta.url));
async function walk(path) { const result = []; for (const entry of await readdir(path, { withFileTypes: true })) { const p = join(path, entry.name); result.push(...entry.isDirectory() ? await walk(p) : [p]); } return result; }
const source = (await Promise.all((await walk(root)).map(p => readFile(p, "utf8")))).join("\n");
const checks = [
  ["no clinical authority import", !/clinical-engine|session-engine|assessment-engine|api-core|PatientStateSchema/.test(source)],
  ["no clinical execution or findings", !/actions\/propose|fetch\([^)]*\/v1|finding\s*:|diagnosis\s*:/.test(source)],
  ["no lab DOM or iframe", !/getElementById|document\.querySelector|window\.STEMI|<iframe|Last Exam Request|HUMAN REVIEW/.test(source)],
  ["no external asset source", !/fetch\([^)]*https?:|\.\.\/\.\.\/exports/.test(source)],
  ["presentation clock separate from Clinical Time", !/clinical_time|state_version\s*[+]=/.test(source.replaceAll('state_version: SafeSessionProjection["state_version"]', ""))],
  ["one native runtime factory", (source.match(/export function createPatientRuntime\(/g) ?? []).length === 2], // implementation + declaration
  ["abort/dispose boundary", /cancelAnimationFrame/.test(source) && /observer\.disconnect/.test(source) && /renderer\.dispose/.test(source)],
  ["asset integrity verified before parse", source.includes("crypto.subtle.digest") && source.includes("ASSET_INTEGRITY")]
];
for (const [file, expected] of [
  ["visual_patient_stemi_physical_exam_runtime_v01.glb", "00563647261c8da8dd030f366aec6bdfdd2550bf667159eab9cf7c922beed4a1"],
  ["visual_patient_stemi_physical_exam_runtime_v01.json", "5eab5851925ed57367d274e79ee818ce393460a5604671255fc751ca1cbb366c"]
]) {
  const bytes = await readFile(new URL(`../apps/web/public/visual-patient/stemi/physical-exam-v02/${file}`, import.meta.url));
  checks.push([`${file} exact approved bytes`, createHash("sha256").update(bytes).digest("hex") === expected]);
}
for (const [name, pass] of checks) console.log(`${pass ? "PASS" : "FAIL"} ${name}`);
if (checks.some(([, pass]) => !pass)) process.exitCode = 1;
