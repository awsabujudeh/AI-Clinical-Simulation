# V2-016 Submission and Recovery Flow

## New learner decision

1. The learner selects a disclosed action and completes its strict fields.
2. The UI validates against the shared safe parameter definitions.
3. The action service creates one command, action-request, request, correlation, and idempotency identity.
4. The existing recovery coordinator persists the exact canonical request before transport.
5. The secure API validates caller, Session, pinned action membership, expected state version, and request shape.
6. A committed result triggers authoritative Session refetch; the UI does not synthesize medical changes.

## Recovery outcomes

- `NOT_SENT`: transport was not crossed. The UI reports failure and does not queue or auto-submit later.
- `IN_DOUBT`: response certainty was lost after send. Reconciliation retains the exact canonical request and original idempotency key; blind duplicate submit is blocked.
- `STALE`: state/CAS conflict. The UI resynchronizes but never automatically re-executes the clinical intent.
- `IDEMPOTENCY_CONFLICT`: fail closed; the UI does not mint a replacement key for the changed request.
- journal failure: no transport is attempted.

The component blocks obvious double activation while a request is active, but correctness continues to rely on durable idempotency, CAS, and atomic server commit.

## Clinical Time and interruption

The browser performs no local medical time advancement. Compressed or interruptible advancement is reflected only by a committed safe Session projection. An uncertain, rejected, stale, or interrupted action cannot be locally completed or converted into a medical result.
