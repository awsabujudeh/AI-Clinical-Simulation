import {
  PatientConversationTranscriptSchema,
  PatientConversationTurnSchema,
  SafePatientConversationTurnSchema,
  type PatientConversationTurn
} from "../../../contracts/src/index.ts";
import type { SessionCommitAdapter } from "../../../session-engine/src/index.ts";

import {
  PatientConversationBeginRequestSchema,
  PatientConversationCompleteRequestSchema,
  type PatientConversationBeginResult,
  type PatientConversationCompleteResult,
  type PatientConversationRepository
} from "./repository.ts";

type PendingRecord = Readonly<{
  request_hash: string;
  principal_user_id: string;
  claim_token: string;
  claim_expires_at_utc: string;
  turn_id: string;
  turn_sequence: number;
  question_event_id: string;
  context: import("../../../contracts/src/index.ts").PatientConversationContext;
}>;

type RecordState = PendingRecord & Readonly<{ turn?: PatientConversationTurn }>;

function key(sessionId: string, idempotencyKey: string): string {
  return `${sessionId}\u0000${idempotencyKey}`;
}

function copyTurn(turn: PatientConversationTurn): PatientConversationTurn {
  return PatientConversationTurnSchema.parse(turn);
}

export class InMemoryPatientConversationRepository implements PatientConversationRepository {
  readonly #sessionAdapter: SessionCommitAdapter;
  readonly #records = new Map<string, RecordState>();

  constructor(sessionAdapter: SessionCommitAdapter) {
    this.#sessionAdapter = sessionAdapter;
  }

  async begin(input: Parameters<PatientConversationRepository["begin"]>[0]): Promise<PatientConversationBeginResult> {
    const parsed = PatientConversationBeginRequestSchema.safeParse(input);
    if (!parsed.success) return { success: false, code: "INVALID_REQUEST" };
    const recordKey = key(parsed.data.session_id, parsed.data.idempotency_key);
    const existing = this.#records.get(recordKey);
    if (existing !== undefined) {
      if (existing.request_hash !== parsed.data.canonical_request_hash
        || existing.principal_user_id !== parsed.data.principal_user_id) {
        return { success: false, code: "IDEMPOTENCY_CONFLICT" };
      }
      if (existing.turn !== undefined) {
        return { success: true, status: "REPLAYED", turn: copyTurn(existing.turn) };
      }
      if (existing.claim_expires_at_utc > parsed.data.claimed_at_utc) {
        return { success: false, code: "IN_PROGRESS" };
      }
      const reclaimed = {
        ...existing,
        claim_token: parsed.data.claim_token,
        claim_expires_at_utc: parsed.data.claim_expires_at_utc
      };
      this.#records.set(recordKey, reclaimed);
      return {
        success: true,
        status: "CLAIMED",
        turn_id: reclaimed.turn_id,
        turn_sequence: reclaimed.turn_sequence,
        question_event_id: reclaimed.question_event_id,
        context: reclaimed.context
      };
    }
    const committed = await this.#sessionAdapter.commit({
      session_id: parsed.data.session_id,
      expected_token: parsed.data.expected_token,
      proposed_session: parsed.data.proposed_session
    });
    if (!committed.success) {
      const codes = new Set(committed.issues.map((issue) => issue.code));
      return {
        success: false,
        code: codes.has("SESSION_VERSION_CONFLICT")
          ? "VERSION_CONFLICT"
          : codes.has("SESSION_NOT_FOUND")
            ? "NOT_FOUND"
            : "PERSISTENCE_FAILURE"
      };
    }
    const turnSequence = [...this.#records.entries()]
      .filter(([existingKey]) => existingKey.startsWith(`${parsed.data.session_id}\u0000`))
      .length + 1;
    const created: RecordState = Object.freeze({
      request_hash: parsed.data.canonical_request_hash,
      principal_user_id: parsed.data.principal_user_id,
      claim_token: parsed.data.claim_token,
      claim_expires_at_utc: parsed.data.claim_expires_at_utc,
      turn_id: parsed.data.turn_id,
      turn_sequence: turnSequence,
      question_event_id: parsed.data.question_event_id,
      context: parsed.data.context
    });
    this.#records.set(recordKey, created);
    return {
      success: true,
      status: "CLAIMED",
      turn_id: created.turn_id,
      turn_sequence: created.turn_sequence,
      question_event_id: created.question_event_id,
      context: created.context
    };
  }

  async complete(input: Parameters<PatientConversationRepository["complete"]>[0]): Promise<PatientConversationCompleteResult> {
    const parsed = PatientConversationCompleteRequestSchema.safeParse(input);
    if (!parsed.success) return { success: false, code: "INVALID_REQUEST" };
    const recordKey = key(parsed.data.session_id, parsed.data.idempotency_key);
    const existing = this.#records.get(recordKey);
    if (existing === undefined) return { success: false, code: "CLAIM_NOT_FOUND" };
    if (existing.request_hash !== parsed.data.canonical_request_hash
      || existing.principal_user_id !== parsed.data.principal_user_id) {
      return { success: false, code: "IDEMPOTENCY_CONFLICT" };
    }
    if (existing.turn !== undefined) {
      return { success: true, status: "REPLAYED", turn: copyTurn(existing.turn) };
    }
    if (existing.claim_token !== parsed.data.claim_token) {
      return { success: false, code: "CLAIM_MISMATCH" };
    }
    const committed = await this.#sessionAdapter.commit({
      session_id: parsed.data.session_id,
      expected_token: parsed.data.expected_token,
      proposed_session: parsed.data.proposed_session
    });
    if (!committed.success) {
      const codes = new Set(committed.issues.map((issue) => issue.code));
      return {
        success: false,
        code: codes.has("SESSION_VERSION_CONFLICT")
          ? "VERSION_CONFLICT"
          : codes.has("SESSION_NOT_FOUND")
            ? "NOT_FOUND"
            : "PERSISTENCE_FAILURE"
      };
    }
    const turn = copyTurn(parsed.data.turn);
    this.#records.set(recordKey, Object.freeze({ ...existing, turn }));
    return { success: true, status: "COMMITTED", turn };
  }

  async list(input: Parameters<PatientConversationRepository["list"]>[0]) {
    const loaded = await this.#sessionAdapter.load(input.session_id);
    if (!loaded.success) return { success: false as const, code: "NOT_FOUND" as const };
    const turns = [...this.#records.entries()]
      .filter(([recordKey, record]) => recordKey.startsWith(`${input.session_id}\u0000`)
        && record.principal_user_id === input.principal_user_id
        && record.turn !== undefined)
      .map(([, record]) => {
        const { provider_metadata: _providerMetadata, ...safe } = copyTurn(record.turn!);
        return SafePatientConversationTurnSchema.parse(safe);
      })
      .sort((left, right) => left.turn_sequence - right.turn_sequence);
    const limited = turns.slice(Math.max(0, turns.length - input.limit));
    const transcript = PatientConversationTranscriptSchema.parse({
      conversation_schema_version: "1.0",
      session_id: input.session_id,
      turns: limited,
      ...(limited.length === turns.length || limited[0] === undefined
        ? {}
        : { truncated_before_turn_sequence: limited[0].turn_sequence })
    });
    return { success: true as const, transcript };
  }
}
