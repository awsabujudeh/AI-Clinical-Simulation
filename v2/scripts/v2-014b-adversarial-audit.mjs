import { access, readFile } from "node:fs/promises";

const projectRoot = new URL("../", import.meta.url);
const read = async (path) => readFile(new URL(path, projectRoot), "utf8");

const [coordinator, request, storage, indexedDb, fetchTransport, viteConfig, serviceWorker] =
  await Promise.all([
    read("packages/recovery-core/src/coordinator.ts"),
    read("packages/recovery-core/src/request.ts"),
    read("packages/recovery-core/src/storage.ts"),
    read("apps/web/src/offline/indexeddb-recovery-storage.ts"),
    read("apps/web/src/offline/fetch-recovery-transport.ts"),
    read("apps/web/vite.config.mjs"),
    read("apps/web/dist/sw.js")
  ]);

await Promise.all([
  "../planning_input/v2-014/V2-014B_NETWORK_CHAOS_MATRIX.md",
  "../planning_input/v2-014/V2-014B_MULTI_TAB_AND_AUTH_RECOVERY.md",
  "../planning_input/v2-014/V2-014B_SERVICE_WORKER_RECOVERY.md",
  "../planning_input/v2-014/V2-014B_ADVERSARIAL_TEST_REPORT.md",
  "../planning_input/v2-014/V2-014_FINAL_VERIFICATION_REPORT.md"
].map((path) => access(new URL(path, projectRoot))));

const portableRecoverySource = `${coordinator}\n${request}\n${storage}`;
const productionRecoverySource = `${portableRecoverySource}\n${indexedDb}\n${fetchTransport}`;
const assertions = [
  [!productionRecoverySource.includes("DeterministicRecoveryChaosTransport"), "test chaos transport entered production source"],
  [!productionRecoverySource.includes("COMMIT_THEN_DROP_RESPONSE"), "test failpoint entered production source"],
  [!portableRecoverySource.includes("Date.now"), "portable recovery core reads a wall clock"],
  [!portableRecoverySource.includes("Math.random"), "portable recovery core uses random authority"],
  [!portableRecoverySource.includes("setInterval("), "portable recovery core owns a reconnect loop"],
  [!portableRecoverySource.includes("ClinicalEngine"), "offline recovery core imports clinical execution"],
  [request.includes("canonicalRecoveryRequest"), "exact canonical mutation identity is absent"],
  [request.includes("recoveryJournalEntryId(parsed.data.principal_user_id"), "journal identity is not re-derived from principal and request"],
  [storage.includes("RECOVERY_JOURNAL_MAX_ENTRIES"), "in-memory journal is not bounded"],
  [indexedDb.includes("RECOVERY_JOURNAL_MAX_ENTRIES"), "IndexedDB journal is not bounded"],
  [fetchTransport.includes('cache: "no-store"'), "private recovery transport is not network/no-store"],
  [viteConfig.includes("runtimeCaching: []"), "generic runtime caching is enabled"],
  [viteConfig.includes("navigateFallbackDenylist"), "private API navigation denylist is absent"],
  [viteConfig.includes("skipWaiting: false"), "service-worker update may force takeover"],
  [viteConfig.includes("clientsClaim: false"), "service worker may force client control"],
  [!serviceWorker.includes("Authorization"), "Authorization material entered built service worker"],
  [!serviceWorker.includes('pathname.startsWith("/v1'), "private API runtime cache entered built service worker"],
  [coordinator.includes("last_known_projection"), "explicit stale last-known projection path is absent"]
];

for (const [passed, message] of assertions) {
  if (!passed) throw new Error(`V2-014B adversarial audit failed: ${message}`);
}

console.log(`V2_014B_ADVERSARIAL_AUDIT=PASS assertions=${assertions.length}`);
console.log("PRODUCTION_RECOVERY_FAILPOINTS=NONE");
console.log("OFFLINE_CLINICAL_ENGINE=NONE");
console.log("PRIVATE_API_RUNTIME_CACHE=NONE");
