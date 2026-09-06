# V2-013 Authorization Matrix

Authentication and authorization are separate. The API accepts identity only after cryptographic JWT verification. Role, membership status, and institution are resolved from PostgreSQL; JWT/body/query role or tenant claims are never authority.

| Capability | Anonymous | Learner | Faculty/Reviewer | Tenant/resource rule |
|---|---:|---:|---:|---|
| Health | Allow | Allow | Allow | Contains no private data |
| Start production Session | Deny | Allow | Deny | Active Learner membership and same-institution `PUBLISHED_PRODUCTION` package |
| Start review preview | Deny | Deny | Allow | Active same-institution Faculty/Reviewer and `UNDER_REVIEW` `REVIEW_ONLY` artifact |
| Read/act/end on Session | Deny | Owning Session only | Owning review Session only where operation permits | Exact verified user, membership, institution, and pinned artifact must match |
| Investigation/Assessment | Deny | Owning Session only | Owning review Session only | Same enumeration-safe Session authorization |
| Patient question shell | Deny | Owning Session only | Owning Session only | Authorization occurs before `FEATURE_NOT_AVAILABLE` |
| Case Builder shell | Deny | Delivery pending | Delivery pending | Authenticated shell only; no Case/membership authority is exercised and no draft is created in V2-013 |

Unauthorized Session access returns the same safe `RESOURCE_NOT_ACCESSIBLE` response whether a foreign Session exists or not. A Learner cannot resolve the real STEMI ReviewExecutionArtifact as production. A cross-institution reviewer cannot resolve it for preview. Review and production authority are selected by separate server routes and database resolvers, never by a trusted request flag.

All trusted API database functions are revoked from `public`, `anon`, and `authenticated` and granted only to the server-side `service_role`. V2-011B raw-client RLS denials remain unchanged.
