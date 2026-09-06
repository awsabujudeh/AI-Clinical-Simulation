import { describe, expect, it } from "vitest";

import {
  InDoubtRecoveryJournalEntrySchema,
  LastKnownSafeSessionProjectionSchema,
  RecoveryMutationOutcomeSchema,
  RecoveryMutationRequestSchema,
  RecoveryTelemetryEventSchema
} from "../../packages/contracts/src/index.ts";
import {
  RECOVERY_TEST_PRINCIPAL,
  RECOVERY_TEST_TIME,
  createStartRecoveryRequest
} from "../fixtures/recovery/synthetic-recovery.ts";

describe("V2-014A recovery contracts", () => {
  it("accepts only strict version 1.0 mutation records", () => {
    const valid = createStartRecoveryRequest();
    expect(RecoveryMutationRequestSchema.safeParse(valid).success).toBe(true);
    expect(RecoveryMutationRequestSchema.safeParse({
      ...valid,
      recovery_schema_version: "2.0"
    }).success).toBe(false);
    expect(RecoveryMutationRequestSchema.safeParse({
      ...valid,
      untrusted_role: "FACULTY"
    }).success).toBe(false);
  });

  it("rejects incompatible, tampered, and unbounded journal records", () => {
    const request = createStartRecoveryRequest();
    const valid = {
      recovery_schema_version: "1.0",
      journal_entry_id: `recovery:${RECOVERY_TEST_PRINCIPAL}:START_SESSION:${request.idempotency_key}`,
      principal_user_id: RECOVERY_TEST_PRINCIPAL,
      delivery_state: "IN_DOUBT",
      request,
      canonical_request: JSON.stringify(request),
      attempt_count: 1,
      maximum_attempts: 3,
      created_at_utc: RECOVERY_TEST_TIME,
      last_attempt_at_utc: RECOVERY_TEST_TIME
    };
    expect(InDoubtRecoveryJournalEntrySchema.safeParse(valid).success).toBe(true);
    expect(InDoubtRecoveryJournalEntrySchema.safeParse({
      ...valid,
      maximum_attempts: 999
    }).success).toBe(false);
    for (const tampered of [
      { role: "FACULTY" },
      { institution_id: "ju" },
      { execution_authority: "PUBLISHED_PRODUCTION" },
      { patient_state: { state_version: 999 } },
      { clinical_time: 999 }
    ]) {
      expect(InDoubtRecoveryJournalEntrySchema.safeParse({
        ...valid,
        ...tampered
      }).success).toBe(false);
    }
  });

  it("makes cached Session projections explicitly stale and non-authoritative", () => {
    const projectionBoundary = LastKnownSafeSessionProjectionSchema.shape;
    expect(projectionBoundary.freshness.safeParse("STALE_LAST_KNOWN").success).toBe(true);
    expect(projectionBoundary.freshness.safeParse("CURRENT").success).toBe(false);
    expect(projectionBoundary.mutation_authority.safeParse("NONE").success).toBe(true);
    expect(projectionBoundary.mutation_authority.safeParse("EXECUTE").success).toBe(false);
  });

  it("keeps terminal mutation and telemetry values strict and JSON serializable", () => {
    const outcome = RecoveryMutationOutcomeSchema.parse({
      recovery_schema_version: "1.0",
      operation: "START_SESSION",
      idempotency_key: "idempotency.recovery.contract",
      status: "CONFIRMED_SUCCESS",
      requires_authoritative_sync: false,
      replayed: true,
      http_status: 201
    });
    const telemetry = RecoveryTelemetryEventSchema.parse({
      recovery_schema_version: "1.0",
      code: "RECONCILIATION_REPLAYED",
      principal_user_id: RECOVERY_TEST_PRINCIPAL,
      operation: "START_SESSION",
      idempotency_key: "idempotency.recovery.contract"
    });
    expect(JSON.parse(JSON.stringify({ outcome, telemetry }))).toEqual({ outcome, telemetry });
    expect(RecoveryMutationOutcomeSchema.safeParse({ ...outcome, status: "QUEUED" }).success)
      .toBe(false);
  });
});
