# V2-011 Relationship and Invariant Map

## Identity and tenant path

```text
auth.users
  -> profiles
  -> institution_memberships -> institutions
       -> clinical_cases -> case_versions -> case_modules
                                      |-> reviews / approvals / sources
                                      |-> review_execution_artifacts
                                      `-> case_packages

institution membership + exact executable artifact
  -> simulation_sessions
       |-> session_events
       |-> session_commands
       |-> patient_state_checkpoints
       `-> assessments -> domain scores / findings / debrief evidence
```

Case, review, approval, Session, and Assessment foreign keys carry the institution dimension when tenant equality is mandatory. Curriculum mappings intentionally carry both Case-owner institution and curriculum institution because a Case may map to another institution's explicitly governed objective without conflating ownership.

## Structural invariants

| Boundary | Database invariant | Application invariant retained |
|---|---|---|
| Institution | Stable text IDs; canonical `ju` and `just` seed rows | Shared Institution schema remains source of runtime validation |
| Auth | `profiles.user_id` references `auth.users`; roles exist only in memberships | Supabase Auth authenticates; V2-011B RLS authorizes from `auth.uid()` and active membership |
| Case modules | PK prevents duplicate module names; CHECK allows exactly the frozen 16 names | Draft/publication validators prove completeness and references |
| Review subject | Hash is exact lowercase SHA-256 and retained with Case Version/reviews | Application computes review subject bytes |
| Review artifact | Literal artifact kind, `REVIEW_ONLY`, and `UNDER_REVIEW`; exact identity/hash FK | Application prepares and validates artifact bytes |
| Approval | Candidate hash and review-subject hash must match the exact Case Version row | Application validates review types, roles, and publication gates |
| Approval reviews | Same Case Version, institution, and review-subject hash on both sides | Application requires appropriate Clinical and Technical reviews |
| Published package | Literal `PUBLISHED_PRODUCTION`/`PUBLISHED`; exact Approval/candidate hash FK | Application compiles immutable package bytes |
| Session authority | Exclusive review-hash versus published-hash columns plus exact artifact/package FK | Trusted Session constructor authenticates pinned input |
| Session commit axes | Patient State version, next sequence, clock status/time, real-time anchor stored separately | V2-012 performs atomic compare-and-swap using existing semantics |
| Clinical Time | Exact nonnegative `numeric(20,9)` | Engine owns advancement and due-work semantics |
| Event order | Unique Event UUID and unique `(session_id,event_sequence)` | Session Engine allocates gap-free causal order |
| Event history | UPDATE and DELETE trigger rejects | Corrections append `supersedes_event_id` events |
| Scheduler recovery | Exact scheduler JSONB is in current Session and immutable checkpoint | Clinical Engine interprets pending work; DB never schedules medicine |
| Idempotency | Only committed results persist; Session/key unique | V2-012 atomically resolves replay/conflict |
| Assessment | Integer basis-point columns; exact Session/artifact/rubric binding; lossless result JSONB | Assessment Engine calculates every score/finding |
| Assets | Hash, provenance, rights/review states, path, and fallback relationship represented | Case/diagnostic validators determine semantic validity |

## Review versus production authority

Review and production references are mutually exclusive on Sessions and Assessments:

- `REVIEW_ONLY` requires `review_execution_hash` and `review_subject_hash`, forbids `published_package_hash`/`package_hash`, and must resolve to `review_execution_artifacts`.
- `PUBLISHED_PRODUCTION` requires the exact package hash, forbids review hashes, and must resolve to `case_packages`.

The two immutable artifact tables have different fixed discriminator values. Changing one mutable boolean cannot cross this boundary.

## Hash binding

- Module hashes are unique per `(case_version_id,module_name)` row; equal content may legitimately share the same digest across versions.
- Stale review hash A can remain as history, but cannot satisfy an Approval reference bound to current review-subject hash B.
- `case_approvals.approved_package_hash` must equal `case_versions.publication_candidate_hash` for that exact identity/version.
- `case_packages.package_hash` must equal its referenced Approval hash.
- SQL never serializes JSON to calculate these digests.

## Delete policy

Every foreign key explicitly uses `ON DELETE RESTRICT`; no delete cascade exists. Immutable artifacts, published packages, committed events, checkpoints, Assessment results, domain scores, findings, and debrief evidence additionally reject UPDATE and DELETE through a common non-medical trigger. Draft Case source remains editable before publication. Catalogue retirement uses status/archive metadata rather than deleting referenced history.

## Timing boundary

`clinical_time_seconds` is an exact simulation value. `real_time_utc`, `created_at`, `recorded_at`, `committed_at`, `published_at`, and `approved_at` are trusted operational timestamps. No index, trigger, cron job, or ordering constraint promotes an operational timestamp to clinical authority.

## RLS and deferred enforcement

V2-011B supplies caller-level RLS policies, the hardened current-membership helper, narrow role grants, `FORCE ROW LEVEL SECURITY`, and native PostgreSQL adversarial cross-tenant tests. Direct client access remains denied wherever assignment, atomic write, or disclosure-safe projection cannot yet be proven.

V2-012 owns row locks, persistent compare-and-swap, durable idempotent replay, sequence allocation, and Event/checkpoint atomic commit. It must use the trusted backend boundary without moving Session or Clinical Engine semantics into SQL.
