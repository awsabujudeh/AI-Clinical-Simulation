# V2-011 RLS Policy Matrix

## Final V2-011B posture

All 28 application tables have Row Level Security enabled and forced. The final client surface contains 14 explicit policies: 13 `SELECT` policies and one column-limited `UPDATE` policy. There are no authenticated `INSERT` or `DELETE` grants, no broad `FOR ALL` policy, and no permissive `USING (true)` or `WITH CHECK (true)` expression.

Authorization derives from `auth.uid()` plus active database-owned `institution_memberships`. Profile data, UI state, and caller-supplied role or institution values are not authorization authorities. `service_role` is the trusted backend principal and uses PostgreSQL `BYPASSRLS`; no service credential is stored in the repository.

## Actual table policy inventory

`—` means that operation is denied to normal client roles by missing grant and policy. “Faculty” means an authenticated principal with an active `FACULTY` membership satisfying the stated institution condition.

| # | Table | RLS | FORCE | SELECT policy | INSERT | UPDATE | DELETE | Authenticated scope and institution/owner condition | Trusted backend | Future dependency / rationale |
|---:|---|---|---|---|---|---|---|---|---|---|
| 1 | `institutions` | Yes | Yes | `institutions_select_active_membership` | — | — | — | Learner, Faculty, or Reviewer may read only an institution where their own active membership exists | Full low-level access via `service_role` | Public institution catalogue exposure is not required; fail closed |
| 2 | `profiles` | Yes | Yes | `profiles_select_own` | — | `profiles_update_safe_own` | — | Own `auth.uid()` row only; update grant limited to `display_alias` and `preferred_locale` | Managed | Auth linkage and authorization stay client-immutable |
| 3 | `institution_memberships` | Yes | Yes | `institution_memberships_select_own` | — | — | — | Own `auth.uid()` rows only | Managed | Roster and membership-management workflow remains a future dependency |
| 4 | `clinical_cases` | Yes | Yes | `clinical_cases_select_own_institution_faculty` | — | — | — | Faculty with active membership in row `institution_id` | Managed | Faculty mutation/assignment workflow not yet authorized |
| 5 | `case_versions` | Yes | Yes | `case_versions_select_own_institution_faculty` | — | — | — | Faculty with active membership in row `institution_id` | Managed | Learner authoring/review visibility denied |
| 6 | `case_modules` | Yes | Yes | `case_modules_select_own_institution_faculty` | — | — | — | Faculty with active membership in row `institution_id` | Managed | Raw module mutation remains trusted/future workflow |
| 7 | `clinical_sources` | Yes | Yes | `clinical_sources_select_faculty_scope` | — | — | — | Faculty in owner institution; `GLOBAL` sources readable by any active Faculty | Managed | Global scope is read-only; authoring remains trusted |
| 8 | `clinical_source_versions` | Yes | Yes | `clinical_source_versions_select_faculty_scope` | — | — | — | Faculty only when parent source is visible under its RLS scope | Managed | Exact versions remain client-immutable |
| 9 | `case_source_links` | Yes | Yes | `case_source_links_select_own_institution_faculty` | — | — | — | Faculty with active membership in row `institution_id` | Managed | Link mutation is a future authoring workflow |
| 10 | `curriculum_sources` | Yes | Yes | `curriculum_sources_select_own_institution_faculty` | — | — | — | Faculty with active membership in row `institution_id` | Managed | Curriculum governance mutation remains trusted |
| 11 | `curriculum_source_versions` | Yes | Yes | `curriculum_source_versions_select_own_institution_faculty` | — | — | — | Faculty with active membership in row `institution_id` | Managed | Exact versions remain client-immutable |
| 12 | `learning_objectives` | Yes | Yes | `learning_objectives_select_own_institution_faculty` | — | — | — | Faculty with active membership in row `institution_id` | Managed | Curriculum assignment workflow is deferred |
| 13 | `curriculum_mappings` | Yes | Yes | `curriculum_mappings_select_case_owner_faculty` | — | — | — | Faculty with active membership in `case_owner_institution_id` | Managed | Separate curriculum institution does not confer Case ownership |
| 14 | `case_reviews` | Yes | Yes | — | — | — | — | No raw client access | Managed | Assignment-aware reviewer workflow is not yet present; fail closed |
| 15 | `case_approvals` | Yes | Yes | — | — | — | — | No raw client access | Managed | Exact-package approval is trusted governance only |
| 16 | `case_approval_review_refs` | Yes | Yes | — | — | — | — | No raw client access | Managed | Approval evidence cannot be client-fabricated |
| 17 | `review_execution_artifacts` | Yes | Yes | — | — | — | — | No raw client access | Insert through trusted review preparation; UPDATE/DELETE trigger rejects | Review assignment projection is a future dependency; remains `REVIEW_ONLY` |
| 18 | `case_packages` | Yes | Yes | — | — | — | — | No raw client access | Insert through trusted publication; UPDATE/DELETE trigger rejects | Eligible learner package projection belongs to a later API, not raw SQL |
| 19 | `media_assets` | Yes | Yes | — | — | — | — | No raw client access | Managed | Asset approval/provenance is sensitive; storage policies are separate scope |
| 20 | `visual_manifests` | Yes | Yes | — | — | — | — | No raw client access | Managed | Session-safe visual projection is a later API concern |
| 21 | `simulation_sessions` | Yes | Yes | — | — | — | — | No raw client access | V2-012 trusted coordinator will create/update | Aggregate contains Patient State, scheduler, authority, and sequence; raw access denied |
| 22 | `session_commands` | Yes | Yes | — | — | — | — | No raw client access | V2-012 trusted atomic command path | Client cannot forge or erase committed replay authority |
| 23 | `session_events` | Yes | Yes | — | — | — | — | No raw client access | Trusted append; UPDATE/DELETE trigger rejects | Safe disclosure-aware timeline projection is deferred |
| 24 | `patient_state_checkpoints` | Yes | Yes | — | — | — | — | No raw client access | Trusted append; UPDATE/DELETE trigger rejects | Raw checkpoint exposes scheduler and Patient State authority |
| 25 | `assessments` | Yes | Yes | — | — | — | — | No raw client access | Trusted deterministic write; UPDATE/DELETE trigger rejects | Active-mode disclosure cannot safely be expressed by broad raw reads |
| 26 | `assessment_domain_scores` | Yes | Yes | — | — | — | — | No raw client access | Trusted deterministic write; UPDATE/DELETE trigger rejects | Domain scores may reveal withheld truth |
| 27 | `assessment_findings` | Yes | Yes | — | — | — | — | No raw client access | Trusted deterministic write; UPDATE/DELETE trigger rejects | Findings/evidence require lifecycle-safe projection |
| 28 | `assessment_debriefs` | Yes | Yes | — | — | — | — | No raw client access | Trusted deterministic write; UPDATE/DELETE trigger rejects | Finalized learner read projection remains future API scope |

## Helper inventory

| Function | Security | Identity authority | Execute grants | Purpose |
|---|---|---|---|---|
| `public.current_user_has_active_membership(institution_identifier,text[])` | `SECURITY DEFINER`, `STABLE`, fixed empty `search_path`, fully qualified relations | `auth.uid()` only; no caller-supplied user ID | `authenticated`, `service_role`; revoked from `PUBLIC` and `anon` | Checks active membership and allowed database-owned role for one institution; null institution is used only for global clinical-source Faculty reads |

The local PostgreSQL harness reproduces the Supabase request identity boundary by defining the exact `auth.uid()` contract over transaction-local `request.jwt.claim.sub` / `request.jwt.claims`, then testing non-owner, non-superuser roles with `SET LOCAL ROLE` and `row_security = on`.

## Intentionally denied pending future work

- Direct Session, Event, Command, checkpoint, Assessment, finding, and debrief access remains denied until V2-012 and later disclosure-aware APIs provide trusted projections and atomic writes.
- Faculty authoring mutation, reviewer assignment, membership management, and published package delivery require explicit workflow/assignment boundaries and are not granted by this gate.
- No storage bucket policy, remote Supabase resource, API, or persistent Session coordinator is introduced.
