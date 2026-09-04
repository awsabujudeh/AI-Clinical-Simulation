# V2-012 Atomic Commit Model

V2-012A persists one already-computed authoritative Session transition. The Session and Clinical engines remain the only owners of Clinical Time, Patient State transitions, scheduler outcomes, Event IDs, and Event ordering.

The commit unit is one PostgreSQL statement invoking `commit_authoritative_session_v2_012a`. PostgreSQL locks the current `simulation_sessions` row, verifies the existing V2-006 composite commit token, validates immutable pinned authority, and then writes all newly committed Events, successful command replay records, a recovery checkpoint, and the updated Session row. A constraint, trigger, or update failure aborts the statement transaction and persists none of those components.

The function is storage-only. It does not evaluate rules, calculate medical effects, advance Clinical Time, infer event order, or use database timestamps as clinical truth. A failed commit leaves the prior event sequence reusable, so persistence failures cannot create authoritative gaps.

`load_authoritative_session_v2_012a` returns the stored aggregate plus ordered Event rows, ordered replay rows, and the latest checkpoint. The portable adapter runtime-validates the aggregate and requires those durable representations to agree before exposing it.

V2-012 remains open. Slice B must adversarially attack concurrent writers, crash boundaries, recovery corruption, exact replay races, and sustained rollback behavior.
