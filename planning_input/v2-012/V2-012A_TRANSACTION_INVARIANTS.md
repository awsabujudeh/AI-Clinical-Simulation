# V2-012A Transaction Invariants

1. The locked Session row is the serialization point; child writes occur only after CAS and authority validation.
2. The composite token reuses Patient State version, next Event sequence, clock status, Clinical Time, and trusted real-time anchor. No extra Session version counter is introduced.
3. A stale token fails closed. It is never last-write-wins and never triggers blind clinical recomputation.
4. Prior Events and replay records are immutable prefixes. New entries are append-only suffixes.
5. Event UUID, sequence, Clinical Time, and causal order come from Session/domain execution and are not generated or sorted by PostgreSQL.
6. Session state, clock, scheduler, new Events, successful replay record, checkpoint, and token axes commit together or not at all.
7. Failed/uncommitted commands create no durable replay success and consume no persistent Event sequence.
8. Exact retry is served from the durable aggregate/replay record without clinical execution; conflicting reuse fails closed.
9. `REVIEW_ONLY` and `PUBLISHED_PRODUCTION` bindings are immutable within a Session commit.
10. Functions are `SECURITY INVOKER`, use an empty `search_path`, and are executable only by `service_role`; raw clients retain no write path.
11. Operational timestamps are audit metadata only. They never control Clinical Time, scheduling, diagnostics, or Assessment.
12. SQL contains no disease, rule, scoring, vital, rhythm, or treatment logic and creates no database clinical timer.

V2-012B must add dedicated simultaneous-writer, process/crash, corrupted-recovery, and replay/recovery adversarial testing before V2-012 can close.
