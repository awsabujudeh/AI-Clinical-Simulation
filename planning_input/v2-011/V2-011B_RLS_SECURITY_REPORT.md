# V2-011B RLS Security Report

## Scope and result

V2-011B implements the final database client-access boundary for the 28 V2-011 application tables. It uses additive migration `202609030004_v2_011b_rls_security.sql`, 14 explicit policies, one hardened membership helper, narrow grants, and `FORCE ROW LEVEL SECURITY` on all 28 tables.

Security result: **PASS**. This is implementation evidence for the local gate, not production certification.

## Real database environment

- Engine: PostgreSQL 16.14, compiled by Visual C++ build 1944, 64-bit.
- Tool: exact-pinned `embedded-postgres@16.14.0-beta.17` with the platform package approved in repository metadata.
- Runtime: disposable repository-test local cluster and databases; no remote service is contacted at test time.
- RLS execution: real PostgreSQL roles, `SET LOCAL ROLE`, `row_security = on`, grants, policies, `FORCE ROW LEVEL SECURITY`, triggers, foreign keys, and `BYPASSRLS` service-role behavior.
- Supabase auth compatibility: the harness supplies the exact local `auth.uid()` request-subject contract using transaction-local `request.jwt.claim.sub` / `request.jwt.claims`. It does not claim to test the hosted Supabase Auth service.

## Principals and authority

Synthetic principals cover anonymous, two JU learners, JU Faculty, JU Reviewer, JUST learner, JUST Faculty, JUST Reviewer, a disabled learner, and trusted `service_role`. Client principals are non-owner, non-superuser, and lack `BYPASSRLS`. Institution and role authority comes only from active `institution_memberships` tied to `auth.uid()`.

The trusted backend uses the Supabase-compatible `service_role`/`BYPASSRLS` boundary. No service key or credential is stored. V2-012 must invoke this authority only behind its trusted atomic Session transaction path.

## Policy and helper audit

- Application tables with RLS enabled: 28/28.
- Application tables with FORCE RLS: 28/28.
- Final policies: 14 (13 `SELECT`, one column-limited `UPDATE`).
- Privileged helpers: one.
- Authenticated `INSERT` grants: zero.
- Authenticated `DELETE` grants: zero.
- Authenticated `UPDATE`: only `profiles.display_alias` and `profiles.preferred_locale`.
- No `USING (true)`, `WITH CHECK (true)`, broad authenticated `FOR ALL`, dynamic SQL, caller-supplied authorization user ID, public helper execution, or client service-role policy.

The helper is `STABLE SECURITY DEFINER`, fixes `search_path` to the empty string, schema-qualifies its relation and function references, derives identity from `auth.uid()`, and is executable only by `authenticated` and `service_role`.

## Adversarial evidence

The focused native PostgreSQL suite reports **151 passed, 0 failed**. It proves empty-database application, V2-011A-to-V2-011B upgrade, reset/reapply, exact policy inventory, anonymous denial across all 28 tables, JU/JUST isolation, role and membership mutation denial, governance/artifact isolation, Session/Event/idempotency protection, Assessment/disclosure protection, trusted backend writes, and immutable-history triggers under trusted access.

The detailed coverage is recorded in `V2-011B_ADVERSARIAL_TEST_MATRIX.md`.

## Verification

- `npm run typecheck`: PASS.
- `npm run build`: PASS.
- `npm run test:v2-011a`: PASS.
- `npm run test:v2-011b`: PASS — 151 passed, 0 failed.
- `npm run test:portability-guard`: PASS.
- `npm run test:playwright`: PASS — 1/1.
- `npm run verify`: PASS — exit code 0.
- `git diff --check`: PASS.

## Fail-closed decisions and limitations

Raw client access remains denied for reviews, approvals, review artifacts, published packages, media/visual governance, Sessions, Events, Commands, checkpoints, Assessments, scores, findings, and debriefs. This prevents premature permissions where assignment, atomic-write, or disclosure semantics are not yet enforceable.

V2-012 remains responsible for trusted persistent Session coordination, transaction/row locking, compare-and-swap, durable idempotency, authoritative sequence allocation, and atomic Event/checkpoint commit. Later APIs must provide disclosure-safe read projections. No PostgreSQL/IndexedDB adapter, remote Supabase project, region selection, remote migration, API, storage policy, or deployment is part of V2-011B.
