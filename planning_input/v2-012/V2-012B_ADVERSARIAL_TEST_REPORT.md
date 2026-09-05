# V2-012B Adversarial Test Report

Status: **PASS — 62 checks, 0 failures**.

The permanent `npm run test:v2-012b` suite runs against local native PostgreSQL 16.14 with multiple independent connections and synchronized contention. It proves:

- one winner for 8-way and 32-way same-base different-key races;
- one clinical execution plus durable replay for 8 identical same-key contenders;
- one immutable canonical identity for 8 conflicting requests sharing a key;
- correct retry-versus-new-command and stale-loaded-writer outcomes;
- observed PostgreSQL row-lock waiting, CAS after lock wakeup, and typed lock-timeout rollback;
- zero persistence before a skipped database call and after native backend termination before commit;
- durable replay after a deliberately discarded post-commit response;
- lossless rehydration across 10 fresh-adapter cycles;
- fail-closed Event, checkpoint, and replay corruption detection;
- one-winner scheduler and Clinical-Time contention with no loser/retry duplication;
- immutable REVIEW_ONLY real-STEMI bindings and synthetic PUBLISHED_PRODUCTION bindings under race;
- isolated concurrent JU and JUST commits;
- raw authenticated mutation denial while a trusted transaction waits on its lock;
- a 50-command sustained series with 10 exact retries, 7 stale attempts, and 4 adapter restarts;
- a mixed race/replay/stale/restart/forced-failure/recovery scenario ending in one coherent load.

The suite also re-audits 28/28 enabled and forced RLS tables, service-role-only `SECURITY INVOKER` functions, one-row lock ordering, absence of sticky-connection assumptions or blind clinical retries, typed persistence mappings, absence of production test hooks/secrets/remote Supabase configuration, and the approved STEMI review/golden-trace hashes.

This is correctness evidence, not a throughput benchmark. Maximum tested contention was 32. The lost-response case discards an established successful response and does not claim to simulate a physical network partition. Application adapter recreation is tested; native backend process termination is separately tested for pre-commit rollback.
