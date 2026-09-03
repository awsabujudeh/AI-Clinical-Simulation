# V2-011A Table Catalog

All application tables are in `public`. Every table has RLS enabled with no client policies in Slice A; final access policies and grants are pending V2-011B.

| # | Table | Purpose and authority | Primary identity | Tenant dimension | History/deletion |
|---:|---|---|---|---|---|
| 1 | `institutions` | Canonical institution catalogue | `institution_id` | self | Referenced with `RESTRICT` |
| 2 | `profiles` | Minimal application profile linked to Supabase Auth | `user_id` | none; memberships supply tenant | Auth FK `RESTRICT` |
| 3 | `institution_memberships` | Database-owned learner/faculty/reviewer relationship | `membership_id` | `institution_id` | Referenced with `RESTRICT` |
| 4 | `clinical_cases` | Stable authored Case identity and owner | `case_id` | required `institution_id` | archival timestamp; deletes restricted |
| 5 | `case_versions` | Semantic version, lifecycle, authored payload, review/candidate hashes | `case_version_id` | required `institution_id` | source remains versioned; deletes restricted |
| 6 | `case_modules` | Exact 16-module authored decomposition | `(case_version_id,module_name)` | required `institution_id` | mutable draft source; no seventeenth module |
| 7 | `clinical_sources` | Clinical reference catalogue | `source_id` | global or institution scope | deletes restricted |
| 8 | `clinical_source_versions` | Exact source version/checksum/rights metadata | `source_version_id` | inherited from source | deletes restricted |
| 9 | `case_source_links` | Case module/entity to exact source version/locator | generated row ID | Case `institution_id` | deletes restricted |
| 10 | `curriculum_sources` | Institution curriculum source catalogue | `curriculum_source_id` | required `institution_id` | deletes restricted |
| 11 | `curriculum_source_versions` | Exact curriculum source version | `curriculum_source_version_id` | required `institution_id` | deletes restricted |
| 12 | `learning_objectives` | Version-bound curriculum objective | `objective_id` | required `institution_id` | deletes restricted |
| 13 | `curriculum_mappings` | Case-to-objective structural mapping and review status | `mapping_id` | separate Case owner and curriculum institution | deletes restricted |
| 14 | `case_reviews` | Revisioned review record; review types remain distinct | generated record ID; unique `(review_id,revision)` | required `institution_id` | historical references use `RESTRICT` |
| 15 | `case_approvals` | External exact-package Approval Record | `approval_id` | required `institution_id` | package FK prevents deletion |
| 16 | `case_approval_review_refs` | Exact Approval-to-review evidence binding | `(approval_id,review_id,revision)` | required `institution_id` | all FKs `RESTRICT` |
| 17 | `review_execution_artifacts` | Immutable executable review snapshot | `review_execution_hash` | required `institution_id` | UPDATE/DELETE trigger rejects |
| 18 | `case_packages` | Immutable compiled production package | `case_package_id`; unique `package_hash` | required `institution_id` | UPDATE/DELETE trigger rejects |
| 19 | `media_assets` | Generic diagnostic/visual asset governance metadata | `media_asset_id` | global or institution scope | deletes restricted; no media required |
| 20 | `visual_manifests` | Versioned visual/fallback metadata for a Case Version | `visual_manifest_id` | required `institution_id` | deletes restricted |
| 21 | `simulation_sessions` | Current authoritative Session axes and lossless aggregate | `session_id` | required `institution_id` and learner membership | mutable only through future trusted commit path |
| 22 | `session_events` | Authoritative committed event timeline | UUID `event_id` | through Session | UPDATE/DELETE trigger rejects |
| 23 | `session_commands` | Successful idempotency/replay records | `command_id`; unique Session/key | through Session | successful commits only; deletes restricted |
| 24 | `patient_state_checkpoints` | Immutable state/scheduler/clock/aggregate snapshot | generated `checkpoint_id` | through Session | UPDATE/DELETE trigger rejects |
| 25 | `assessments` | Deterministic Assessment result and pinned authority | `assessment_id` | explicit Session institution | UPDATE/DELETE trigger rejects |
| 26 | `assessment_domain_scores` | Six-domain integer score rows/evidence | `(assessment_id,domain_id)` | through Assessment | UPDATE/DELETE trigger rejects |
| 27 | `assessment_findings` | Deterministic categorized findings/evidence | `finding_id` | through Assessment | UPDATE/DELETE trigger rejects |
| 28 | `assessment_debriefs` | Deterministic final evidence package | `assessment_id` | through Assessment | UPDATE/DELETE trigger rejects |

## Deliberate omissions

No knowledge chunks, embeddings, retrieval bundles, AI workflow runs, tutor-generated prose, remote storage buckets, API tables, Postgres clinical scheduler, or V2-012 transaction function is introduced. Those are outside V2-011A.
