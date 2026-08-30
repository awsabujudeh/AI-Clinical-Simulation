import { readdir, readFile } from "node:fs/promises";
import { extname } from "node:path";

const portableSourceRoots = [
  new URL("../packages/portability-smoke/src/", import.meta.url),
  new URL("../packages/contracts/src/", import.meta.url),
  new URL("../packages/case-schema/src/", import.meta.url)
];

const forbiddenPatterns = [
  ["Node scheme import", /(?:from\s+|import\s*(?:\(\s*)?|require\s*\(\s*)["']node:/u],
  ["Node filesystem/path import", /(?:from\s+|import\s*(?:\(\s*)?|require\s*\(\s*)["'](?:fs|path)(?:\/[^"']*)?["']/u],
  ["runtime-specific global", /\b(?:process|Deno|document|localStorage|indexedDB|IndexedDB|Buffer|__dirname|__filename|require)\b/u],
  ["browser window global access", /\bwindow\s*(?:\.|\[)/u],
  ["provider SDK", /(?:@supabase\/|@azure\/|@sentry\/|@openai\/|["']openai["'])/iu]
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
