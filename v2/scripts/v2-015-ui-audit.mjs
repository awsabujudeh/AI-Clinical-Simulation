import { readFile, readdir } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const webSource = fileURLToPath(new URL("../apps/web/src/", import.meta.url));

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await sourceFiles(path));
    else if ([".ts", ".tsx", ".css"].includes(extname(entry.name))) files.push(path);
  }
  return files;
}

const files = await sourceFiles(webSource);
const source = (await Promise.all(files.map(async (file) => ({
  file: relative(projectRoot, file).replaceAll("\\", "/"),
  text: await readFile(file, "utf8")
}))));
const joined = source.map((entry) => entry.text).join("\n");
const app = await readFile(new URL("../apps/web/src/App.tsx", import.meta.url), "utf8");
const packageJson = JSON.parse(await readFile(
  new URL("../apps/web/package.json", import.meta.url),
  "utf8"
));

const checks = [];
function check(name, condition) {
  checks.push({ name, pass: Boolean(condition) });
}

check("React Router 7 is the single router dependency", /^\^7\./u.test(packageJson.dependencies["react-router-dom"]));
check("TanStack Query 5 is the server-state dependency", /^\^5\./u.test(packageJson.dependencies["@tanstack/react-query"]));
check("no Three.js dependency", packageJson.dependencies.three === undefined);
check("no React Three Fiber dependency", packageJson.dependencies["@react-three/fiber"] === undefined);
check("public route exists", app.includes('path="/"'));
check("login route exists", app.includes('path="/login"'));
check("learner route exists", app.includes('path="/app"'));
check("Session route exists", app.includes('path="/sessions/:sessionId"'));
check("Expo route exists", app.includes('path="/expo"'));
check("UI consumes safe Session projection", joined.includes("SafeSessionProjection"));
check("UI consumes V2-014 recovery results", joined.includes("SessionRecoveryResult"));
check("no raw Patient State authority", !joined.includes("PatientStateSchema") && !joined.includes("patient_state:"));
check("no Clinical Engine dependency", !joined.includes("clinical-engine"));
check("no Session Engine dependency", !joined.includes("session-engine"));
check("no Assessment Engine dependency", !joined.includes("assessment-engine"));
check("no API core dependency", !joined.includes("api-core"));
check("no localStorage Session truth", !joined.includes("localStorage"));
check("no optimistic Query mutation", !joined.includes("onMutate") && !joined.includes("setQueryData"));
// V2-020 allows bounded presentation-only recording/playback deadlines, never Clinical Time.
check("no local Clinical-Time timer", !source.filter((entry) => !entry.file.startsWith("apps/web/src/features/voice/"))
  .some((entry) => /Date\.now|performance\.now|setInterval|setTimeout/u.test(entry.text)));
check("no client-side random medical state", !joined.includes("Math.random"));
check("no internal UJ identifier", !/\bUJ\b/u.test(joined));
check("no legacy patient-locale literal", !/["']en["']/u.test(joined));
check("Arabic locale is exact", joined.includes('"ar-JO"'));
check("English locale is exact", joined.includes('"en-US"'));
check("no media-generation or 3D import", !/@react-three|from ["']three["']|\.glb|\.gltf|\.mp4/u.test(joined));
check("no diagnostic media asset", !/diagnostic-media|base64,/iu.test(joined));
check("no action execution endpoint in UI", !joined.includes("actions/propose"));
check("no Patient AI endpoint in UI", !joined.includes("/questions"));
check("no faculty route in learner UI", !app.includes("/faculty"));
check("visible keyboard focus treatment", joined.includes(":focus-visible"));
check("reduced-motion preference respected", joined.includes("prefers-reduced-motion: reduce"));
check("semantic main content landmark", joined.includes('<main id="main-content"'));
check("critical status is not color-only", joined.includes("connection-banner__icon") && joined.includes("configuration.title"));

const failed = checks.filter((entry) => !entry.pass);
for (const item of checks) {
  console.log(`${item.pass ? "PASS" : "FAIL"} ${item.name}`);
}
if (failed.length > 0) {
  throw new Error(`${failed.length} V2-015 UI architecture check(s) failed.`);
}
console.log(`V2-015 UI architecture audit: ${checks.length}/${checks.length} PASS`);
