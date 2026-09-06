import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { deleteDB } from "idb";

import {
  IndexedDbRecoveryStorageAdapter,
  RECOVERY_DATABASE_NAME
} from "../../../apps/web/src/offline/indexeddb-recovery-storage.ts";
import {
  LastKnownSafeSessionProjectionSchema
} from "../../../packages/contracts/src/index.ts";
import {
  canonicalRecoveryRequest,
  createInDoubtEntry
} from "../../../packages/recovery-core/src/index.ts";
import {
  RECOVERY_OTHER_PRINCIPAL,
  RECOVERY_TEST_PRINCIPAL,
  RECOVERY_TEST_TIME,
  createStartRecoveryRequest
} from "../../fixtures/recovery/synthetic-recovery.ts";
import { createApiTestHarness } from "../../fixtures/api/secure-api.ts";

let adapters: IndexedDbRecoveryStorageAdapter[] = [];

beforeEach(async () => {
  await deleteDB(RECOVERY_DATABASE_NAME);
  adapters = [];
});

afterEach(async () => {
  for (const adapter of adapters) await adapter.close();
  await deleteDB(RECOVERY_DATABASE_NAME);
});

function adapter() {
  const value = new IndexedDbRecoveryStorageAdapter();
  adapters.push(value);
  return value;
}

describe("V2-014A IndexedDB recovery storage", () => {
  it("persists a valid in-doubt record across adapter reloads", async () => {
    const first = adapter();
    const request = createStartRecoveryRequest();
    const entry = createInDoubtEntry({
      principal_user_id: RECOVERY_TEST_PRINCIPAL,
      request,
      attempted_at_utc: RECOVERY_TEST_TIME
    })!;
    expect(await first.writeJournalEntry(entry)).toEqual({ success: true });
    const reloaded = adapter();
    const stored = await reloaded.readJournalEntry(entry.journal_entry_id) as {
      canonical_request: string;
    };
    expect(stored.canonical_request).toBe(canonicalRecoveryRequest(request));
  });

  it("uses one atomic key and rejects conflicting cross-tab writes", async () => {
    const first = adapter();
    const second = adapter();
    const request = createStartRecoveryRequest(
      "case.synthetic-assessment",
      "idempotency.recovery.indexed-conflict"
    );
    const entry = createInDoubtEntry({
      principal_user_id: RECOVERY_TEST_PRINCIPAL,
      request,
      attempted_at_utc: RECOVERY_TEST_TIME
    })!;
    expect(await first.writeJournalEntry(entry)).toEqual({ success: true });
    expect(await second.writeJournalEntry({
      ...entry,
      canonical_request: "{}"
    })).toEqual({ success: false, code: "LOCAL_IDEMPOTENCY_CONFLICT" });
    expect((await first.readJournalEntry(entry.journal_entry_id) as {
      canonical_request: string;
    }).canonical_request).toBe(entry.canonical_request);
  });

  it("stores only strict stale safe projections scoped by principal and Session", async () => {
    const harness = await createApiTestHarness({ include_stemi: false });
    const start = await harness.app.request("/v1/sessions", {
      method: "POST",
      headers: {
        Authorization: "Bearer test.learner",
        "Content-Type": "application/json",
        "X-Api-Schema-Version": "1.0",
        "X-Request-Id": "request.recovery.idb-start",
        "X-Correlation-Id": "correlation.recovery.idb-start",
        "Idempotency-Key": "idempotency.recovery.idb-start"
      },
      body: JSON.stringify({
        case_id: harness.productionPackage.manifest.case_id,
        patient_language: "en-US",
        mode: "ASSESSMENT",
        client_capabilities: {
          supports_static_visual_fallback: true,
          supports_audio: false
        }
      })
    });
    const session = (await start.json() as Record<string, any>).data.session;
    const projection = LastKnownSafeSessionProjectionSchema.parse({
      recovery_schema_version: "1.0",
      principal_user_id: RECOVERY_TEST_PRINCIPAL,
      session_id: session.session_id,
      freshness: "STALE_LAST_KNOWN",
      mutation_authority: "NONE",
      captured_at_utc: RECOVERY_TEST_TIME,
      projection: session
    });
    const storage = adapter();
    expect(await storage.writeLastKnownProjection(projection)).toEqual({ success: true });
    expect(await storage.readLastKnownProjection({
      principal_user_id: RECOVERY_TEST_PRINCIPAL,
      session_id: session.session_id
    })).toEqual(projection);
    expect(await storage.readLastKnownProjection({
      principal_user_id: RECOVERY_OTHER_PRINCIPAL,
      session_id: session.session_id
    })).toBeNull();
  });

  it("clears only the logged-out principal recovery data", async () => {
    const storage = adapter();
    const a = createInDoubtEntry({
      principal_user_id: RECOVERY_TEST_PRINCIPAL,
      request: createStartRecoveryRequest("case.synthetic-assessment", "idempotency.idb.a"),
      attempted_at_utc: RECOVERY_TEST_TIME
    })!;
    const b = createInDoubtEntry({
      principal_user_id: RECOVERY_OTHER_PRINCIPAL,
      request: createStartRecoveryRequest("case.synthetic-assessment", "idempotency.idb.b"),
      attempted_at_utc: RECOVERY_TEST_TIME
    })!;
    await storage.writeJournalEntry(a);
    await storage.writeJournalEntry(b);
    await storage.deletePrincipalRecoveryData(RECOVERY_TEST_PRINCIPAL);
    expect(await storage.readJournalEntry(a.journal_entry_id)).toBeNull();
    expect(await storage.readJournalEntry(b.journal_entry_id)).not.toBeNull();
  });
});
