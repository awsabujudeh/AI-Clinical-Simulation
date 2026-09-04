# V2-011B Adversarial Test Matrix

## Execution model

The permanent harness runs against native PostgreSQL 16.14 with real RLS semantics. Every client case uses a non-owner, non-superuser, non-`BYPASSRLS` login role, transaction-local Supabase-style request subject, `SET LOCAL ROLE`, and `row_security = on`.

Synthetic principals:

- anonymous;
- JU learner A and learner B;
- JU Faculty and Reviewer;
- JUST learner, Faculty, and Reviewer;
- disabled learner;
- trusted `service_role` with `BYPASSRLS`.

All identities and data are synthetic and medically neutral.

## Permanent security coverage

| Area | Adversarial operations | Expected/result |
|---|---|---|
| Migration paths | Empty A+B apply; A-only then B upgrade; reset and reapply | PASS |
| RLS inventory | 28 enabled, 28 forced, exact 14 policy names, grants enumerated | PASS |
| Anonymous | `SELECT`, `INSERT`, `UPDATE`, and `DELETE` attempts across private application tables | DENIED |
| Auth identity | Own profile/membership reads; attempts to read/update another profile or spoof another UUID | Own-safe only; spoofing DENIED |
| Profile mutation | Safe alias/locale update; protected auth/authority linkage mutation | Safe columns PASS; protected mutation DENIED |
| Membership escalation | Learner→Faculty, learner→Reviewer, Faculty→backend-like role, disabled→active, institution movement, foreign/duplicate privileged insertion, deletion | DENIED |
| Faculty Case reads | JU Faculty reads JU authoring; JUST Faculty reads JUST authoring; reciprocal cross-tenant reads | Own tenant PASS; foreign rows invisible |
| Learner Case access | Learner reads/mutates Case, Case Version, module, source, or curriculum authoring data | DENIED |
| Faculty authoring mutation | `INSERT`, tenant-moving `UPDATE`, and `DELETE` while workflow is deferred | DENIED |
| Clinical/curriculum sources | Institution-scoped Faculty reads, global Faculty source read, learner reads, cross-tenant reads | Narrow Faculty reads PASS; learner/foreign DENIED |
| Reviews | Learner creation/mutation, reviewer foreign access, target movement, historical rewrite | DENIED |
| Review artifacts | Learner/faculty raw creation, read, mutation, conversion to production | DENIED; trusted append only |
| Approvals/packages | Client exact-package Approval creation, published artifact creation/mutation, hash rebinding, review→production conversion | DENIED |
| Hash governance | Trusted insertion with stale package hash against V2-011A foreign-key authority | Rejected |
| Media/visual governance | Raw learner/faculty access or mutation | DENIED |
| Sessions | Own/foreign/cross-tenant raw reads; institution, learner, execution authority, pinned hash, Patient State, Clinical Time, scheduler, and sequence mutation | DENIED |
| Events | Client `INSERT`, `UPDATE`, `DELETE`, and cross-tenant read | DENIED |
| Idempotency | Client committed-record forgery, rewrite, and deletion | DENIED |
| Checkpoints | Raw read/mutation and trusted immutable-history mutation | Client DENIED; trusted UPDATE/DELETE trigger rejects |
| Assessments | Score creation/update, domain result/evidence mutation, unsafe-marker removal, penalty deletion, finalization fabrication, tenant movement, review→production conversion | DENIED |
| Active disclosure | Raw Assessment/domain/finding/debrief reads during active Assessment | DENIED |
| Trusted backend | Low-level Case insert and authoritative Event append | PASS through `service_role` only |
| Immutable history | Trusted `UPDATE` and `DELETE` on review artifacts, packages, Events, checkpoints, Assessments, domain scores, findings, and debriefs | Trigger rejects all |
| SQL hardening | Permissive predicates, broad `FOR ALL`, dynamic SQL, unsafe helper execution, unexpected authenticated mutation grants | NONE / PASS |
| Canonical institutions | Canonical `ju`/`JU`, `just`/`JUST`; no internal `UJ` fixture | PASS |

## Result

Focused V2-011B native PostgreSQL suite: **151 passed, 0 failed**.

The suite proves database-level denial or narrow allowance only. It does not implement or certify V2-012's trusted transaction orchestration, hosted Supabase Auth, remote deployment, or production operations.
