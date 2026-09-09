# V2-019A Conversation Persistence and Idempotency

## Two-phase protocol

`begin_patient_conversation_v2_019a` locks the Session, validates active membership and exact idempotency, atomically commits the server-generated `QUESTION_ASKED` Event, and inserts a `PENDING` turn before provider execution. The turn captures the minimized context, authoritative question Event ID, Clinical Time, and State Version used for grounding.

`complete_patient_conversation_v2_019a` locks the Session and turn, verifies the claim and canonical request hash, commits the causally linked `PATIENT_RESPONSE_RECORDED` Event, then stores the validated turn as `COMPLETED` in one transaction. HTTP success is emitted only after that commit.

## Retry and concurrency

- Exact retry of a completed turn returns its stored response without provider execution or duplicate Events.
- Same idempotency key with different canonical question content fails closed.
- An unexpired pending claim returns in-progress; an expired claim can be reclaimed with its persisted original safe context.
- Turn sequence is unique and monotonic per Session, not process-global.
- A lost HTTP response is recovered through exact durable replay.

Completed turns and authoritative Events are append-only. A Session cannot finalize while a Patient Conversation turn is pending.

## Storage authority

`patient_conversation_turns` has ENABLE and FORCE RLS. Raw anonymous/authenticated table access and RPC execution are revoked; only the trusted service role can invoke the narrow functions. No remote database resource is created by V2-019A.
