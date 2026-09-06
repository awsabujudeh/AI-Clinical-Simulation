import { canonicalSerialize } from "../../case-schema/src/index.ts";
import {
  InDoubtRecoveryJournalEntrySchema,
  LastKnownSafeSessionProjectionSchema,
  RECOVERY_JOURNAL_MAX_ENTRIES,
  type InDoubtRecoveryJournalEntry,
  type LastKnownSafeSessionProjection,
  type RecoveryJournalEntryId,
  type RecoveryPrincipalId
} from "../../contracts/src/index.ts";

export type RecoveryStorageWriteResult =
  | { success: true }
  | { success: false; code: "LOCAL_IDEMPOTENCY_CONFLICT" | "STORAGE_FULL" | "STORAGE_FAILURE" };

/** Runtime-specific persistent storage remains behind this portable boundary. */
export interface RecoveryStorageAdapter {
  readJournalEntry(entryId: RecoveryJournalEntryId): Promise<unknown | null>;
  listJournalEntries(input: {
    principal_user_id: RecoveryPrincipalId;
    session_id?: string;
  }): Promise<readonly unknown[]>;
  writeJournalEntry(entry: InDoubtRecoveryJournalEntry): Promise<RecoveryStorageWriteResult>;
  deleteJournalEntry(entryId: RecoveryJournalEntryId): Promise<void>;
  readLastKnownProjection(input: {
    principal_user_id: RecoveryPrincipalId;
    session_id: string;
  }): Promise<unknown | null>;
  writeLastKnownProjection(
    projection: LastKnownSafeSessionProjection
  ): Promise<RecoveryStorageWriteResult>;
  deletePrincipalRecoveryData(principalUserId: RecoveryPrincipalId): Promise<void>;
}

function cloneJson<T>(value: T): T {
  return JSON.parse(canonicalSerialize(value)) as T;
}

function projectionKey(principalUserId: string, sessionId: string) {
  return `${principalUserId}\u0000${sessionId}`;
}

/** Deterministic test/fallback adapter. It is not clinical persistence. */
export class InMemoryRecoveryStorageAdapter implements RecoveryStorageAdapter {
  readonly #journal = new Map<string, unknown>();
  readonly #projections = new Map<string, unknown>();

  async readJournalEntry(entryId: RecoveryJournalEntryId): Promise<unknown | null> {
    const value = this.#journal.get(entryId);
    return value === undefined ? null : cloneJson(value);
  }

  async listJournalEntries(input: {
    principal_user_id: RecoveryPrincipalId;
    session_id?: string;
  }): Promise<readonly unknown[]> {
    const entries: Array<{ journal_entry_id: string; value: unknown }> = [];
    for (const value of this.#journal.values()) {
      const candidate = typeof value === "object" && value !== null
        ? value as Record<string, unknown>
        : undefined;
      if (
        candidate?.principal_user_id === input.principal_user_id
        && (input.session_id === undefined || candidate.session_id === input.session_id)
      ) {
        entries.push({
          journal_entry_id: typeof candidate.journal_entry_id === "string"
            ? candidate.journal_entry_id
            : "",
          value
        });
      }
    }
    return entries
      .sort((left, right) => left.journal_entry_id < right.journal_entry_id ? -1
        : left.journal_entry_id > right.journal_entry_id ? 1 : 0)
      .map((entry) => cloneJson(entry.value));
  }

  async writeJournalEntry(
    entry: InDoubtRecoveryJournalEntry
  ): Promise<RecoveryStorageWriteResult> {
    const parsed = InDoubtRecoveryJournalEntrySchema.safeParse(entry);
    if (!parsed.success) return { success: false, code: "STORAGE_FAILURE" };
    const prior = this.#journal.get(entry.journal_entry_id);
    if (prior !== undefined) {
      const priorParsed = InDoubtRecoveryJournalEntrySchema.safeParse(prior);
      if (
        !priorParsed.success
        || priorParsed.data.principal_user_id !== entry.principal_user_id
        || priorParsed.data.canonical_request !== entry.canonical_request
      ) {
        return { success: false, code: "LOCAL_IDEMPOTENCY_CONFLICT" };
      }
    } else if (this.#journal.size >= RECOVERY_JOURNAL_MAX_ENTRIES) {
      return { success: false, code: "STORAGE_FULL" };
    }
    this.#journal.set(entry.journal_entry_id, cloneJson(entry));
    return { success: true };
  }

  async deleteJournalEntry(entryId: RecoveryJournalEntryId): Promise<void> {
    this.#journal.delete(entryId);
  }

  async readLastKnownProjection(input: {
    principal_user_id: RecoveryPrincipalId;
    session_id: string;
  }): Promise<unknown | null> {
    const value = this.#projections.get(
      projectionKey(input.principal_user_id, input.session_id)
    );
    return value === undefined ? null : cloneJson(value);
  }

  async writeLastKnownProjection(
    projection: LastKnownSafeSessionProjection
  ): Promise<RecoveryStorageWriteResult> {
    const parsed = LastKnownSafeSessionProjectionSchema.safeParse(projection);
    if (!parsed.success) return { success: false, code: "STORAGE_FAILURE" };
    this.#projections.set(
      projectionKey(projection.principal_user_id, projection.session_id),
      cloneJson(projection)
    );
    return { success: true };
  }

  async deletePrincipalRecoveryData(principalUserId: RecoveryPrincipalId): Promise<void> {
    for (const [key, value] of this.#journal.entries()) {
      const parsed = InDoubtRecoveryJournalEntrySchema.safeParse(value);
      if (parsed.success && parsed.data.principal_user_id === principalUserId) {
        this.#journal.delete(key);
      }
    }
    for (const [key, value] of this.#projections.entries()) {
      const parsed = LastKnownSafeSessionProjectionSchema.safeParse(value);
      if (parsed.success && parsed.data.principal_user_id === principalUserId) {
        this.#projections.delete(key);
      }
    }
  }
}
