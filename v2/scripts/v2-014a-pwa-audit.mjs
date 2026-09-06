import { access, readFile } from "node:fs/promises";

const webRoot = new URL("../apps/web/", import.meta.url);
const configUrl = new URL("vite.config.mjs", webRoot);
const distUrl = new URL("dist/", webRoot);
const indexUrl = new URL("index.html", distUrl);
const manifestUrl = new URL("manifest.webmanifest", distUrl);
const serviceWorkerUrl = new URL("sw.js", distUrl);

await Promise.all([indexUrl, manifestUrl, serviceWorkerUrl].map((url) => access(url)));

const [config, index, manifest, serviceWorker] = await Promise.all([
  readFile(configUrl, "utf8"),
  readFile(indexUrl, "utf8"),
  readFile(manifestUrl, "utf8"),
  readFile(serviceWorkerUrl, "utf8")
]);

const assertions = [
  [config.includes('registerType: "prompt"'), "service-worker updates require prompt activation"],
  [config.includes("skipWaiting: false"), "skipWaiting must remain disabled"],
  [config.includes("clientsClaim: false"), "clientsClaim must remain disabled"],
  [config.includes("runtimeCaching: []"), "generic runtime caching must remain empty"],
  [config.includes("navigateFallbackDenylist"), "private API navigation must be denied fallback"],
  [config.includes("/^\\/v1"), "the /v1 API boundary must be excluded"],
  [serviceWorker.includes("ai-clinical-simulation-v2-app-shell"), "app-shell cache ID missing"],
  [serviceWorker.includes("index.html"), "offline application shell was not precached"],
  [!serviceWorker.includes("Authorization"), "Authorization material entered the service worker"],
  [!serviceWorker.includes('urlPattern:({url})=>url.pathname.startsWith("/v1'), "private API runtime cache detected"],
  [index.includes("manifest.webmanifest"), "PWA manifest is not linked"],
  [JSON.parse(manifest).display === "standalone", "PWA manifest display is invalid"],
  [!/case(?:-version)?\.[a-z0-9]|2\.0\.0/iu.test(
    /cacheId:\s*"([^"]+)"/u.exec(config)?.[1] ?? ""
  ), "cache identity is coupled to Case version"]
];

for (const [passed, message] of assertions) {
  if (!passed) throw new Error(`V2-014A PWA audit failed: ${message}`);
}

console.log(`V2_014A_PWA_AUDIT=PASS assertions=${assertions.length}`);
console.log("PRIVATE_API_RUNTIME_CACHE=NONE");
console.log("AUTHORIZATION_CACHE=NONE");
console.log("APP_SHELL_OFFLINE_FALLBACK=PASS");
