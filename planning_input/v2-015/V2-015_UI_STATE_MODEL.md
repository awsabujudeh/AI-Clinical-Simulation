# V2-015 UI State Model

## Authentication states

The shell distinguishes resolving, authenticated, unauthenticated, and expired states. Protected Session queries are disabled until authentication has resolved successfully. The client never promotes a user, assigns a role, or treats a route as authorization proof.

## Session entry states

Session start is an explicit server request containing the selected patient language, requested mode, and an authorized Case access code. The form waits for a committed safe response before navigation. It does not create a local Session, expose a Case catalogue, or optimistically fabricate patient data.

Failures map to safe unauthenticated, unauthorized, not-found, conflict, invalid, in-doubt, or unavailable presentations. Provider details, stack traces, secrets, review metadata, and clinical internals are not displayed.

## Session presentation states

| UI state | Source | Mutation authority | Presentation |
| --- | --- | --- | --- |
| Active online | Authoritative safe projection | `SERVER_ONLY` | Normal workspace |
| Recovering | Authoritative recovery result | `SERVER_ONLY` | Explicit synchronization banner |
| Sync required | Authoritative recovery result | `SERVER_ONLY` | Conflict/resynchronization banner |
| Active stale | Last-known safe projection | `NONE` | Clearly stale/offline workspace |
| Ended | Authoritative safe projection | `SERVER_ONLY` | Terminal status without answer-key disclosure |

`IN_DOUBT` and `STALE_NOT_EXECUTED` are visible request states. The UI does not autoexecute, replay, or reconcile mutations; V2-014 recovery owns that protocol.

## Invariants

- No React code advances Clinical Time or runs scheduled work.
- No optimistic medical state or partial clinical result is presented.
- Loading states do not fabricate vitals or patient identity.
- Safe cached projections may be shown offline only with an explicit stale label and `mutation_authority = NONE`.
- Assessment mode does not expose score, correctness, rubric, critical criteria, or hidden diagnosis.
- Practice/Demo is a visual mode distinction only; reveal behavior remains deferred.
