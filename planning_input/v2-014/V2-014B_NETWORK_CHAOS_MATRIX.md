# V2-014B Network Chaos Matrix

## Purpose

This matrix records deterministic recovery behavior at explicit transport phases. The test harness is fixture-only and cannot be enabled by production code.

| Phase / fault | Server outcome | Browser classification | Permitted recovery | Safety invariant |
|---|---|---|---|---|
| `BEFORE_SEND` to offline | Request not sent | `NOT_SENT` | User may deliberately submit a new request after synchronization | Never autoexecute later |
| `REQUEST_SENT` to no commit to response dropped | Not committed | `IN_DOUBT` | Retry the exact canonical request and idempotency identity | No fabricated success |
| `SERVER_COMMITTED` to response dropped | Committed once | `IN_DOUBT` | Exact retry obtains durable replay | No duplicate Session, Event, effect, or finalization |
| Semantic 4xx response | Definitively rejected | Typed terminal outcome | Authoritative reload where required; no blind retry | Intent is not execution |
| Dependency/network failure during safe read | Unknown read outcome only | Bounded read retry | Last-known projection may be displayed as stale | Cached data grants no mutation authority |

The deterministic fixture records `BEFORE_SEND`, `REQUEST_SENT`, `SERVER_COMMITTED` or `SERVER_NOT_COMMITTED`, `RESPONSE_PENDING`, `RESPONSE_DROPPED`, `OFFLINE`, `RECONNECTED`, and `RESPONSE_DELIVERED`. No random delay is correctness evidence.

## Durable mutation coverage

- `startSession`, action proposal, and `endSimulation` use the existing server idempotency boundary.
- Lost-response retries preserve the original canonical request and key.
- A changed request under the same key conflicts; a stale command is not reconstructed against newer Patient State.
- Local journal persistence precedes transport. A journal-write failure prevents send.
- Cleanup failure leaves ambiguity recoverable; server replay still prevents duplicate execution.

Native PostgreSQL V2-013/V2-012 tests remain the durable authority for atomic commit, replay, crash rollback, append-only Events, and terminal finalization. Browser chaos tests exercise the recovery coordinator against the same API semantics without replacing that database proof.

## Limits

The application shell may remain usable offline, but live clinical simulation does not continue offline. The browser does not advance Clinical Time, execute scheduler work, reveal diagnostics, score an Assessment, or run the Clinical Engine.
