# V2-012B Crash and Recovery Matrix

| Scenario | Exact simulation | Durable result |
| --- | --- | --- |
| Failure before database call | Deterministic command was computed, then the adapter/RPC was not invoked. | Session, Events, checkpoints, replay records, and sequence remained unchanged. |
| Backend terminated before commit | A dedicated native PostgreSQL backend opened an outer transaction, invoked the atomic function, and was terminated with `pg_terminate_backend` before outer `COMMIT`. | PostgreSQL rolled back the complete transaction; no partial row survived. |
| Response lost after commit | The atomic commit completed and its application result was deliberately discarded; a fresh adapter retried the same canonical request/key. | The retry returned the verified durable replay with no second clinical execution, Event, sequence, or state version. This is an application-side lost-response simulation, not a physical network-partition test. |
| Adapter/application restart | Database clients/adapters were discarded, recreated, and the Session was loaded from PostgreSQL. | Strict aggregate parsing and durable Event/replay/checkpoint cross-checks reproduced the same authoritative Session. |
| Ten restart cycles | Ten load/command/commit/discard/recreate/reload cycles used synthetic nonmedical state. | Commit tokens, Event sequence, Patient State, scheduler data, and replay history remained coherent and monotonic. |
| Event corruption | In the disposable test database only, a superuser temporarily disabled the immutable Event trigger and altered durable Event data. | Load returned typed persistence/integrity failure and no authoritative Session. |
| Checkpoint corruption | The disposable database checkpoint payload was altered with test-superuser authority. | Load failed closed; no repair or healthy Session was returned. |
| Replay corruption | The disposable database replay result was altered with test-superuser authority. | Load/replay verification failed closed. |
| Lock timeout | An independent connection held the Session row while a contender used a controlled `lock_timeout`. | Typed persistence failure; no Session, Event, checkpoint, replay, or sequence mutation. |
| Forced late transaction failure | A test-only trigger in the disposable database failed checkpoint insertion after tentative earlier work. | The entire command transaction rolled back and a later fresh-adapter commit succeeded coherently. |

Corruption and crash helpers exist only in `scripts/v2-012b-durability-test.mjs`. No production migration contains a debug corruption function, failpoint, or privileged bypass. Production immutable triggers, forced RLS, grants, and constraints are unchanged after the tests.
