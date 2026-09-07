import {
  InDoubtRecoveryJournalEntrySchema,
  LastKnownSafeSessionProjectionSchema,
  RECOVERY_JOURNAL_MAX_ENTRIES,
  type InDoubtRecoveryJournalEntry,
  type LastKnownSafeSessionProjection,
  type RecoveryJournalEntryId,
  type RecoveryPrincipalId
} from "@ai-clinical-simulation/contracts";
import {
  type RecoveryStorageAdapter,
  type RecoveryStorageWriteResult
} from "@ai-clinical-simulation/recovery-core";
import { openDB, type DBSchema, type IDBPDatabase } from "idb";

export const RECOVERY_DATABASE_NAME = "ai-clinical-simulation-v2-recovery" as const;
export const RECOVERY_DATABASE_VERSION = 1 as const;

interface RecoveryDatabase extends DBSchema {
  recovery_journal: {
    key: string;
    value: InDoubtRecoveryJournalEntry;
    indexes: { "by-principal": string };
  };
  safe_projections: {
    key: string;
    value: LastKnownSafeSessionProjection;
    indexes: { "by-principal": string };
  };
}

function projectionStorageKey(principalUserId: string, sessionId: string) {
  return `${principalUserId}::${sessionId}`;
}

function openRecoveryDatabase(): Promise<IDBPDatabase<RecoveryDatabase>> {
  return openDB<RecoveryDatabase>(RECOVERY_DATABASE_NAME, RECOVERY_DATABASE_VERSION, {
    upgrade(database, oldVersion) {
      if (oldVersion !== 0) {
        throw new Error("An explicit recovery-storage migration is required.");
      }
      const journal = database.createObjectStore("recovery_journal", {
        keyPath: "journal_entry_id"
      });
      journal.createIndex("by-principal", "principal_user_id");
      const projections = database.createObjectStore("safe_projections");
      projections.createIndex("by-principal", "principal_user_id");
    }
  });
}

export class IndexedDbRecoveryStorageAdapter implements RecoveryStorageAdapter {
  readonly #database: Promise<IDBPDatabase<RecoveryDatabase>>;

  constructor(database = openRecoveryDatabase()) {
    this.#database = database;
  }

  async close(): Promise<void> {
    (await this.#database).close();
  }

  async readJournalEntry(entryId: RecoveryJournalEntryId): Promise<unknown | null> {
    return (await (await this.#database).get("recovery_journal", entryId)) ?? null;
  }

  async listJournalEntries(input: {
    principal_user_id: RecoveryPrincipalId;
    session_id?: string;
  }): Promise<readonly unknown[]> {
    const records = await (await this.#database).getAllFromIndex(
      "recovery_journal",
      "by-principal",
      input.principal_user_id
    );
    return records
      .filter((record) => input.session_id === undefined || record.session_id === input.session_id)
      .sort((left, right) => left.journal_entry_id < right.journal_entry_id ? -1
        : left.journal_entry_id > right.journal_entry_id ? 1 : 0);
  }

  async writeJournalEntry(
    entry: InDoubtRecoveryJournalEntry
  ): Promise<RecoveryStorageWriteResult> {
    const parsed = InDoubtRecoveryJournalEntrySchema.safeParse(entry);
    if (!parsed.success) return { success: false, code: "STORAGE_FAILURE" };
    try {
      const database = await this.#database;
      const transaction = database.transaction("recovery_journal", "readwrite");
      const store = transaction.objectStore("recovery_journal");
      const prior = await store.get(entry.journal_entry_id);
      if (
        prior !== undefined
        && (
          prior.principal_user_id !== entry.principal_user_id
          || prior.canonical_request !== entry.canonical_request
          || prior.created_at_utc !== entry.created_at_utc
          || prior.attempt_count > entry.attempt_count
        )
      ) {
        await transaction.done;
        return { success: false, code: "LOCAL_IDEMPOTENCY_CONFLICT" };
      }
      if (prior === undefined && await store.count() >= RECOVERY_JOURNAL_MAX_ENTRIES) {
        await transaction.done;
        return { success: false, code: "STORAGE_FULL" };
      }
      await store.put(parsed.data);
      await transaction.done;
      return { success: true };
    } catch {
      return { success: false, code: "STORAGE_FAILURE" };
    }
  }

  async deleteJournalEntry(entryId: RecoveryJournalEntryId): Promise<void> {
    await (await this.#database).delete("recovery_journal", entryId);
  }

  async readLastKnownProjection(input: {
    principal_user_id: RecoveryPrincipalId;
    session_id: string;
  }): Promise<unknown | null> {
    return (await (await this.#database).get(
      "safe_projections",
      projectionStorageKey(input.principal_user_id, input.session_id)
    )) ?? null;
  }

  async writeLastKnownProjection(
    projection: LastKnownSafeSessionProjection
  ): Promise<RecoveryStorageWriteResult> {
    const parsed = LastKnownSafeSessionProjectionSchema.safeParse(projection);
    if (!parsed.success) return { success: false, code: "STORAGE_FAILURE" };
    try {
      await (await this.#database).put(
        "safe_projections",
        parsed.data,
        projectionStorageKey(
          parsed.data.principal_user_id,
          parsed.data.session_id
        )
      );
      return { success: true };
    } catch {
      return { success: false, code: "STORAGE_FAILURE" };
    }
  }

  async deletePrincipalRecoveryData(principalUserId: RecoveryPrincipalId): Promise<void> {
    const database = await this.#database;
    const transaction = database.transaction(
      ["recovery_journal", "safe_projections"],
      "readwrite"
    );
    const journalEntries = await transaction.objectStore("recovery_journal")
      .index("by-principal").getAllKeys(principalUserId);
    const projectionEntries = await transaction.objectStore("safe_projections")
      .index("by-principal").getAllKeys(principalUserId);
    for (const key of journalEntries) {
      await transaction.objectStore("recovery_journal").delete(key);
    }
    for (const key of projectionEntries) {
      await transaction.objectStore("safe_projections").delete(key);
    }
    await transaction.done;
  }
}
