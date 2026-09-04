# V2-011 Persistence Schema

## V2-011 status

V2-011A establishes the local PostgreSQL/Supabase persistence substrate. V2-011B completes the local RLS security gate for that substrate.

**RLS SECURITY GATE: PASSED V2-011B**

No remote Supabase project, production region, storage bucket, secret, Edge Function, or deployment is part of this slice. Production provisioning remains blocked by the Region ADR gate.

## Authority boundary

PostgreSQL persists the deterministic application model; it does not derive it. Clinical rules, Patient State transitions, observation projection, scheduler execution, event creation, and Assessment scoring remain in their existing portable engines. SQL contains structural constraints and immutable-history protection only.

The schema uses a relational core for identity, tenant, lineage, uniqueness, and authority binding. Versioned contract payloads are stored as JSONB so the implemented strict TypeScript/Zod objects round-trip without reimplementing those schemas in SQL. Canonical SHA-256 values are computed by the application and stored as lowercase 64-character digests; JSONB key order is not used for hashing.

## Artifact model

Three structures are intentionally distinct:

1. `case_versions` and `case_modules` store mutable authored source and its 16-module decomposition.
2. `review_execution_artifacts` stores immutable `REVIEW_ONLY` snapshots identified by `review_execution_hash` and bound to an `UNDER_REVIEW` source identity and `review_subject_hash`.
3. `case_packages` stores immutable `PUBLISHED_PRODUCTION` packages. A composite foreign key binds each row to an external `case_approvals` record carrying the exact Case Version, semantic version, candidate/package hash, and review subject.

An Approval Record is outside published package bytes. `case_approval_review_refs` binds its required review references to the same Case Version and exact current review-subject hash. The database does not fabricate reviews or approvals and does not recalculate clinical hashes.

## Identity and tenancy

Contract identifiers remain bounded text. UUID is used only where the shared contract requires it (`session_events.event_id`) or where Supabase Auth already owns it (`auth.users.id`). `institutions` seeds the canonical `ju`/`JU` and `just`/`JUST` rows; stable contract identities are not replaced by surrogate UUIDs.

`profiles` references Supabase Auth identity but carries no authorization role. Institution authority is represented in `institution_memberships`. Case, review, approval, Session, and Assessment relationships carry an institution dimension and use composite foreign keys where a same-tenant relationship is mandatory. V2-011B enforces the final least-privilege caller-visible tenant and role policy; authorization derives from `auth.uid()` plus active database-owned membership.

## Session representation

`simulation_sessions` stores the axes already present in the Session aggregate:

- exact review or published execution authority and hash binding;
- Patient State version;
- exact Clinical Time seconds;
- clock status and trusted real-time anchor;
- next authoritative event sequence;
- Patient State, scheduler, clock, and complete aggregate JSONB.

Clinical Time uses exact `numeric(20,9)`, not a floating-point or wall-time type. This preserves the runtime's nine-decimal normalization while retaining exact integer-second values when supplied. `timestamptz` columns are operational UTC facts only and never order clinical work.

`patient_state_checkpoints` stores immutable, lossless aggregate snapshots, including pending scheduler work. The Session row exposes the existing composite commit axes; no new Session-version counter is invented. V2-012 will perform row locking, compare-and-swap, and event/command/checkpoint atomic commit against this substrate.

Only successfully committed commands are rows in `session_commands`. Unique `(session_id, idempotency_key)` supports exact replay without letting a failed or interrupted attempt poison a key. `session_events` uses unique Event ID and unique `(session_id,event_sequence)` constraints and immutable triggers. Sequence and Clinical Time—not timestamps—remain authoritative.

## Assessment and asset representation

`assessments` stores the exact deterministic result and its production or review authority binding. Domain scores and findings are normalized for bounded queries while retaining evidence payloads. `assessment_debriefs` stores deterministic evidence packages only; no AI prose or scoring exists in SQL.

`media_assets` and `visual_manifests` store metadata, hashes, provenance, rights/review status, storage references, and fallback links. Storage paths and content hashes may remain absent while an asset is unresolved; no actual media is required. Media never becomes clinical truth.

## Local migrations and verification

Migrations are ordered under `v2/supabase/migrations/`. V2-011A uses exact-pinned `@electric-sql/pglite` for fast structural, constraint, immutability, and contract round-trip regression tests. V2-011B uses exact-pinned `embedded-postgres` with native PostgreSQL 16.14 for roles, grants, real RLS policies, `FORCE ROW LEVEL SECURITY`, `SET ROLE`, and Supabase-compatible `auth.uid()` request context.

From `v2/`:

```powershell
npm run test:v2-011a
npm run test:v2-011b
npm run verify
```

PGlite remains supplemental and is not used as the security claim. The native V2-011B harness applies migrations from empty, exercises the V2-011A-to-B upgrade, resets/reapplies, and runs the cross-tenant adversarial suite. Both runtimes are local test tools, not production adapters or remote services.

## Rollback and forward migration policy

Before schema freeze, local rollback is a full local database reset followed by migration reapply; no production data exists in this slice. The migration test proves that path on two independent empty databases. Once a production schema is frozen, changes must be additive and data-preserving. Historical artifacts, packages, events, checkpoints, and Assessment outputs use `ON DELETE RESTRICT` relationships and immutable triggers; the migrations define no broad delete cascades.

V2-012 may add transactional functions and adapter implementation, but must not move Session or Clinical Engine semantics into SQL.
