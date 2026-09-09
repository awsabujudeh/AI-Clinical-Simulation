# V2-019B1 Intent and Execution Boundary

The authoritative path remains:

learner text → Clinical Interpreter → non-authoritative candidate → local catalogue/parameter reconciliation → learner review and Case-owned confirmation policy → existing `ActionRequest` → existing `/v1/sessions/:session_id/actions/propose` → Session Coordinator → Clinical Engine.

Interpretation itself performs no Session write. It appends no Event, advances no Clinical Time, changes no Patient State or scheduler, calculates no Assessment, and cannot finalize a Session. Pending, failed, ambiguous, and no-match interpretation are therefore medically inert.

The UI copies a current, locally revalidated `MATCH` into the same manual action form. It never submits automatically. Existing confirmation rules still apply, including explicit medication administration confirmation. The final action uses the existing recovery/idempotency service; there is no interpreter-specific execution or retry system.

The interpretation response carries the authoritative state version at which the catalogue was projected. A mismatch is treated as stale before the form is populated. Final execution still re-enters the current authoritative action pathway, which validates Session state, pinned catalogue membership, request identity, and idempotency. A stale interpretation is never auto-reexecuted.

Patient Conversation is not an input to this path. The only execution-capable HTTP route remains `/actions/propose`.
