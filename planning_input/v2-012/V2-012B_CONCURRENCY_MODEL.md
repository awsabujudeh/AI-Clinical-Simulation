# V2-012B Concurrency Model

Status: durability gate implemented and locally verified.

## Authority and isolation

The test authority is native PostgreSQL 16.14 from `embedded-postgres@16.14.0-beta.17`, using the server default `READ COMMITTED` isolation level. Every contender uses an independent database connection. A deterministic JavaScript barrier releases all contenders to the single atomic RPC together; PostgreSQL, not JavaScript, then determines the lock winner.

`commit_authoritative_session_v2_012a` executes as one database statement and one PostgreSQL transaction. Its `SELECT ... FOR UPDATE` on the authoritative `sessions` row is the serialization point. A loser waits for that row, wakes after the winner commits, and evaluates the composite CAS token against the now-current row. Therefore one stale base can have exactly one state-changing winner.

The transaction then writes child data in a fixed order: new Events, the successful replay record, the exact checkpoint, and finally the Session aggregate/token axes. It locks one authoritative Session row and does not acquire advisory or table locks. No automatic serialization/deadlock retry or medical-command recomputation exists. Lock timeout and other infrastructure failures return a typed persistence failure and commit no suffix.

## Race outcomes

- Eight different-key contenders from one base: one commit and seven typed version conflicts.
- Thirty-two different-key contenders from one base: one commit and 31 typed version conflicts. Thirty-two was the maximum tested; a 100-way run was not required for this local correctness gate.
- Eight identical same-key requests: one clinical commit and seven verified durable replays.
- Eight different requests sharing one key: one durable canonical identity and seven typed idempotency conflicts.
- An exact retry raced with a valid new command: the retry replayed without mutation and the new command advanced once.

All winner Events retain domain-assigned causal order. Losers and retries consume no Event sequence, create no checkpoint or replay suffix, and persist no Patient State, scheduler, or Clinical-Time mutation.

## Deployment compatibility

Correctness depends on one atomic PostgreSQL operation, not a sticky application process, permanent connection, in-memory mutex, or transaction state spanning RPC calls. A future pooled/serverless trusted backend may replace connections between operations without changing Session semantics. Raw clients remain outside this trusted commit boundary.
