# V2-014 Request Retry Matrix

| Request/result | Automatic retry | Journal behavior | Required next action |
|---|---:|---|---|
| Known offline mutation | No | No entry (`NOT_SENT`) | Refresh authority; learner/application reevaluates intent |
| Request construction/auth-context failure before send | No | Remove tentative entry; `NOT_SENT` | Restore verified authentication and reevaluate |
| Mutation transport outcome unknown | Exact only | Preserve `IN_DOUBT` | Same request + same idempotency key, maximum 3 attempts |
| HTTP success/replay | No | Remove entry; `CONFIRMED_SUCCESS` | Refresh authoritative projection when recovery flow requires it |
| HTTP definitive validation rejection | No | Remove entry; `CONFIRMED_REJECTION` | Surface safe error |
| HTTP 401 | No | Preserve unresolved entry temporarily | Reauthenticate same principal before reconciliation |
| HTTP 403/404 authorization boundary | No | Remove entry; `AUTHORIZATION_DENIED` | Do not resume/replay |
| HTTP 409 `SESSION_VERSION_CONFLICT` | No | Remove entry; `STALE_NOT_EXECUTED` | Authoritative resync; never auto-reexecute intent |
| HTTP 409 `IDEMPOTENCY_CONFLICT` | No | Remove entry; fail closed | Authoritative resync/manual resolution |
| HTTP 500/503 dependency unavailable | Exact mutation reconciliation only | Preserve unresolved metadata | Bounded retry; no fresh request identity |
| Read transport failure or 500/503 | Yes, bounded | No mutation entry created | Maximum 3 reads with 0/250/1000 ms schedule |
| Read 401/403/404/409/other semantic response | No | Unchanged | Typed failure; no blind retry |

Mutation reconciliation is bounded to three total recorded attempts. Reaching the limit leaves the entry unresolved and surfaces `RETRY_LIMIT_REACHED`; it does not convert ambiguity into success or rejection.

Client in-flight coalescing reduces rapid duplicates but is not correctness authority. Durable correctness remains the existing server idempotency key, Session CAS, append-only Event/checkpoint transaction, and authorization boundary.
