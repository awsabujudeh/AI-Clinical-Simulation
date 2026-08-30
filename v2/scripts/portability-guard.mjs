import { readdir, readFile } from "node:fs/promises";
import { extname } from "node:path";

const portableSourceRoot = new URL(
  "../packages/portability-smoke/src/",
  import.meta.url
);

const forbiddenPatterns = [
  ["Node scheme import", /(?:from\s+|import\s*(?:\(\s*)?|require\s*\(\s*)["']node:/u],
  ["Node filesystem/path import", /(?:from\s+|import\s*(?:\(\s*)?|require\s*\(\s*)["'](?:fs(?:\/promises)?|path)["']/u],
  ["runtime-specific global", /\b(?:process|Deno|window|document|localStorage|indexedDB|Buffer|__dirname|__filename|require)\b/u],
  ["provider SDK", /(?:@supabase\/|@azure\/|@sentry\/|["']openai["'])/iu]
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

for (const fileUrl of await collectTypeScriptFiles(portableSourceRoot)) {
  const source = await readFile(fileUrl, "utf8");

  for (const [label, pattern] of forbiddenPatterns) {
    if (pattern.test(source)) {
      violations.push(`${label}: ${fileUrl.pathname}`);
    }
  }
}

if (violations.length > 0) {
  throw new Error(`Portable source violations:\n${violations.join("\n")}`);
}

console.log("PORTABILITY_GUARD=PASS");
