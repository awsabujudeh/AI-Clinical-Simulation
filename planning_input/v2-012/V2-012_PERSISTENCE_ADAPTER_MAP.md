# V2-012 Persistence Adapter Map

| Existing authority | Persistent representation | V2-012A behavior |
|---|---|---|
| `SessionCommitAdapter.load` | load RPC over `simulation_sessions`, `session_events`, `session_commands`, and latest checkpoint | Rehydrates one strict Session aggregate and rejects cross-representation disagreement. |
| V2-006 composite commit token | normalized Session row axes | Compared under `SELECT ... FOR UPDATE`; stale values return `SESSION_VERSION_CONFLICT`. |
| Patient State | normalized version/time plus `patient_state_payload` and aggregate/checkpoint JSONB | Persisted exactly; no state recomputation. |
| Clinical clock and trusted anchor | normalized clock/time/anchor plus JSONB | Persisted exactly; database time never advances Clinical Time. |
| Scheduler state | `scheduler_state_payload` plus aggregate/checkpoint JSONB | Pending work round-trips without rule replay or cron. |
| committed Event suffix | `session_events` | Domain UUIDs, sequence, Clinical Time, causal order, and full envelope are preserved. |
| successful command replay suffix | `session_commands` | Stored only in the same successful transaction as its Events and Session result. |
| immutable pinned Case authority | normalized artifact/hash columns plus pinned context inside aggregate | Normal commits cannot switch review/production authority or rebind an artifact/hash. |

`PostgresSessionCommitAdapter` implements the unchanged storage-neutral interface through a narrow `PostgresSessionRpcClient`. It imports no PostgreSQL driver, Supabase SDK, Node API, Deno API, or browser API. A future trusted Deno/Edge client can supply the RPC transport without moving persistence or medical semantics into this package.

The in-memory adapter remains the deterministic local domain test implementation. V2-012A adds the PostgreSQL implementation; it does not add a second Session model.
