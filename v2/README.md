# AI Clinical Simulation Platform V2

This directory is the isolated workspace for Version 2. The repository-root `README.md` and `er_sim_10.html` remain the untouched V1 fallback/reference and are not imported, moved, or converted here.

V2-001 establishes the preserved portability and test baseline. V2-002 adds shared contracts and identifiers only. It does not implement a Case Schema compiler or package content, clinical/session/assessment engines, medical rules, state transitions, vital calculations, production UI, authentication, databases, AI, speech, media, faculty features, cloud resources, or deployment.

V2-003 adds the portable `packages/case-schema/` validator/compiler. It represents the frozen modular Case Package boundaries, validates structural references and publication governance, formats deterministic reports, and compiles immutable package values through the shared runtime-neutral `HashAdapter`. It contains no rule execution, scheduler, scoring, physiology, media loading, persistence, provider integration, or medical case content.

V2-004 adds only the portable Patient State and observation-projection foundation under `packages/clinical-engine/`. It reuses the shared Patient State contract, treats that state as authoritative, and projects case-configured observation values and explicit rhythm descriptors without transitions, treatment effects, scheduling, physiology, or disease-specific behavior.

V2-005 adds the portable declarative transition and Clinical-Time scheduler foundation. Shared contracts own the versioned rule/effect/scheduler data language, Case Schema embeds and hash-binds it, and Clinical Engine evaluates it without taking Session Engine, persistence, or committed-event authority.

V2-006A adds only the portable Session/Clinical clock and interruptible Clinical-Time advancement foundation under `packages/session-engine/`. Normal Expo progression uses explicit elapsed input and the pinned `time_ratio = 1.0`; pause freezes Clinical Time and resume never catches up paused wall duration. Action-driven compressed advancement is separate: it pays the full Case-owned Clinical duration while deterministically draining V2-005 scheduled work through each due boundary and visiting Clinical-Time threshold rules at their exact monotonic boundary. Case-owned, hash-bound interrupt event classifications in `timeline_policy` can stop advancement at the exact reached Clinical Time while later work remains pending.

At the same Clinical Time, authoritative due Case work is drained before any future external learner command is evaluated. Independent scheduled completions remain independent and are never converted into an additive global wait. V2-006A has no runtime clocks, timers, command routing, idempotency store, persistence, API, UI, investigation model, assessment, AI, voice, or media behavior. Run `npm run test:session-engine` for its focused Browser/Deno suite or `npm run test:v2-006a` for all affected portable packages.

V2-006B adds the pure external learner-command transaction boundary. A minimal `PinnedSessionCaseContext` is derived from one compiled Case Package and binds the same package/Case Version identities, semantic version, package hash, Clinical policy, and orchestration-required action catalogue; callers cannot inject action or policy sidecars. `processExternalLearnerCommand` validates the shared `ActionRequest`, drains Case-owned due work before command evaluation, invokes only the pinned Clinical Engine entry point, and commits the command plus ordered Clinical event proposals into a new immutable in-memory Session aggregate. Clinical proposals never own Event IDs or Session sequence.

Command fingerprints use canonical JSON plus an injected `HashAdapter`; Patient/Scheduler state and wall-clock time are outside that equivalence boundary. Exact retries replay the committed event range without execution or sequence allocation, conflicting retries fail closed, and failed attempts create no replay record. Event UUIDs come from an injected testable factory, while trusted real UTC commit time is an explicit dependency. A pre-command Case interrupt commits its independently authoritative due settlement but neither executes nor records the learner command. Immediate V2-005 effects settle in the command transaction; positive-delay scheduler mutations commit atomically for later Clinical-Time processing. No zero-delay scheduler language, persistence, API, UI, database, assessment, AI, voice, or media behavior is added. Run `npm run test:v2-006b` for the affected command-orchestration regression set.

V2-006C closes the in-memory Session boundary with one `SessionCoordinator`. It loads and atomically compare-and-swaps complete Session aggregates through a storage-neutral `SessionCommitAdapter`; the portable `InMemorySessionCommitAdapter` proves copy isolation, append-only progression, stale-write rejection, and deterministic double-click replay. Its composite commit token uses existing authoritative Patient State version, next event sequence, clock state/time, and trusted real-time anchor rather than inventing another mutable version counter. The V2-012 PostgreSQL adapter and any future IndexedDB adapter implement this same boundary without changing Session semantics.

Trusted-time synchronization receives explicit UTC authority and never reads a live clock. RUNNING sessions advance elapsed whole seconds through the pinned ratio and V2-006A chronological scheduler path, so browser-sleep catch-up cannot skip Case work. An interrupt commits only the reached interval and advances the real-time anchor proportionally; PAUSED sessions never catch up, and resume establishes a new anchor. Normal sync/catch-up remains distinct from Case-owned action-duration advancement. Pause/resume produce generic committed lifecycle events but no clinical effects. Run `npm run test:v2-006` for the complete portable V2-006 closure suite.

V2-007A adds only the deterministic Assessment core under `packages/assessment-engine/`. The Session Engine projects a strict complete committed-timeline evidence value; raw Action Requests, rejected intent, Clinical proposals, UI state, real-time waiting, and runtime rubric sidecars are not accepted as scoring evidence. Assessment derives one pinned rubric context from the same compiled Case Package identity/hash as the Session and records rubric/module provenance in every result.

The Case-owned rubric contains exactly six distinct `domain.*` identities; their reviewed labels remain Case localization data because the frozen Architecture intentionally defers universal domain labels. Domain weights total 10,000 basis points. Positive and penalty criteria use committed event/action matchers, absolute inclusive/exclusive Clinical-Time windows, optional authoritative-sequence constraints, and explicit once-only or bounded-repeat policy. Critical action/error items may cap the overall score, zero a domain, deduct fixed overall basis points, or mark the result unsafe. The generic engine contains no medical criteria.

Raw points are integers. Domain percentages and weighted contributions use integer half-up rounding to basis points. Zero-domain effects are applied before weighting, then fixed overall deductions, then the minimum applicable cap; `MARK_UNSAFE` is orthogonal. Every criterion emits deterministic evidence IDs, committed Event IDs/sequence/Clinical Time where matched, or an explicit absence record. Results are internal scoring truth only; V2-007B owns any mode-aware learner reveal/debrief projection. Run `npm run test:assessment-engine` for Browser/Deno equality or `npm run test:v2-007a` for the affected regression set.

V2-007B preserves that internal scoring truth and adds explicit `LIVE` versus `FINAL` evaluation. Missing evidence remains `PENDING` while a Case-owned opportunity is still open; finalization requires trusted Session authority bound to the exact Session, pinned package/rubric, committed event sequence, and Clinical Time. Re-evaluating that same boundary is byte-deterministic, while mismatched or late evidence fails closed.

Learner disclosure is a separate pure projection. Active `ASSESSMENT` receives only neutral withheld status; active `PRACTICE_DEMO` receives structured findings only for behavior that is already resolved, never future rubric criteria or answer keys. Final debrief exposes the complete deterministic result and authoritative evidence package without generated prose, AI conclusions, RAG citations, or score mutation. Later Session/API code must supply trusted disclosure/finalization authority; no client `show_answers` flag exists. Run `npm run test:v2-007` for the complete V2-007 regression set.

The pre-V2-009 Diagnostic Investigation Contract Gate adds no real medical Case content. Shared contracts define bounded `STRUCTURED_LAB`, `ECG`, `IMAGING`, `ULTRASOUND`, and `TEXT_REPORT` results. The existing `action_catalogue` owns investigation identity/result/timing/visibility, `clinical_facts` owns language-neutral findings, and `visual_manifest` owns versioned diagnostic assets with provenance, rights, Clinical Review, and hash metadata. No seventeenth module or runtime sidecar is introduced.

Diagnostic truth remains independent from media. Media-bearing results require a Case-owned fact fallback; unavailable media never invokes AI or changes clinical truth. Independent `ASYNC_PARALLEL` Clinical-Time milestones remain independent and map onto the existing generic scheduler vocabulary, while unsupported blocking/patient-unavailable execution fails publication. All diagnostic policy is covered by normal module, review-subject, candidate, and package hashing. Run `npm run test:diagnostic-contract` for the focused Browser/Deno contract and publication-gate suite.

## V2-005 rule transitions and Clinical Scheduler

Rules use a small strict `1.0` vocabulary: bounded triggers and conditions; allowlisted Patient State changes; typed pain, intervention, complication, and outcome changes; relative or absolute Clinical-Time schedules; stable cancellation; and deterministic event proposals. Arbitrary paths, scripts, direct numeric-vital effects, physiology arithmetic, wall-clock timers, and disease-specific branches are prohibited. Rules change explicit Patient State codes; the pinned V2-004 observation definition then projects monitor values and rhythm descriptors.

`createPinnedClinicalPolicy` derives the only production execution policy from one validated immutable compiled Case Package. Its strict envelope binds package and Case Version identities, semantic version, package/review hashes, exact rules, timeline policy, initial scheduled items, approved Case Fact identities, observation policy, and relevant module hashes. The public `evaluatePinnedClinicalPolicy` entry accepts that envelope plus runtime context; it does not accept independent rule, fact, or observation sidecars. This envelope is an architectural binding, not a client authentication token: V2-006 must load the authoritative pinned package in trusted server/session infrastructure and clients must never manufacture authoritative envelopes.

Clinical Engine evaluation is pure and immutable. Rules are ordered by priority and stable Rule ID, effects by stable rule/effect order, and due items by Clinical Time ascending, priority descending, scheduled-item ID ascending, then originating Rule ID ascending. Due work is removed and executed one item at a time, so an earlier same-time item may cancel later pending work but never work that already executed. A request through target Clinical Time drains every newly created item due at or before that target, or returns a typed bounded failure; it never processes work after the target. Runtime-created relative delays must be greater than zero, and absolute schedules must be strictly later than the Clinical Time at which the effect executes. Authored initial items may start at current Clinical Time, but any work they create must advance time.

The hard work budget is deterministic and case data cannot raise it: 32 derived passes, 8,192 rules considered, 2,048 rule activations, 4,096 effects attempted, 1,024 due items processed, 1,024 scheduled items created, 1,024 cancellations processed, 512 event proposals, 4,096 trace entries, and scheduler causal depth 256. These limits align with contract collection caps and bound repeated evaluation; the package-derived maximum may lower derived passes but never raise the engine ceiling. Capacity is checked before output growth, and trace space is reserved for a terminal `BUDGET_EXCEEDED`/liveness diagnostic. Budget, progress, projection, conflict, effect, and cycle failures use the explicit non-committable Result boundary rather than data-driven `ZodError` throws.

State-condition rules activate at most once for each `(rule_id, Patient State fingerprint)` during one external evaluation. The canonical fingerprint covers every Patient State field except `state_version` and `clinical_time`, which cannot manufacture a new same-time clinical state. Mixed conflict policies for contradictory co-firing writes fail closed. With one policy, equal highest-priority different values fail and equal values coalesce; `HIGHEST_PRIORITY` and `REPLACE` select the unique highest-priority value, while `BLOCK` suppresses a contradictory lower-priority write set. Lexical Rule ID never decides contradictory equal-priority values. Adding an intervention or complication is idempotent only when the existing canonical record—including its original start/activation time—matches exactly; a differing record with the same ID is an identity conflict. Missing removals and repeated outcome operations are idempotent, and collections remain canonically ordered.

Scheduler state is a separate portable runtime value, not part of Patient State. All functions receive explicit Simulation Clinical Time and create no timers. Prior committed-event facts are trusted runtime evidence for later Session Engine construction—not interpreter intents, Action Requests, or natural language. Event outputs are proposals without Event IDs, sequence numbers, real UTC timestamps, or commit identity. V2-006 retains external-command versus due-work ordering, command/idempotency lifecycle, authoritative event sequence, atomic commit, checkpoints, persistence, and package authenticity.

Case Schema now performs conservative static reachability and scheduler-liveness analysis for the typed vocabulary. It starts from the Case-owned initial Patient State, treats structurally valid external event/time inputs as potentially reachable, follows delayed effects, rejects provable non-progressing absolute schedules/self-cycles, and blocks publication when any reachable hemodynamic, rhythm, respiratory, oxygenation, consciousness, or configured temperature value lacks its pinned mapping. `generateRuleReachabilityEvidence` certifies both reachable-state coverage and scheduler progress, with deterministic liveness findings included in the evidence hash bound to exact Case Version identity/version, review-subject hash, analyzer identity/version, and caller-supplied completion metadata. Runtime traces and publication evidence remain distinct.

Changing a trigger, condition, effect, delay, cancellation selector, conflict policy, or scheduled behavior changes the rules module hash, review-subject hash, and final candidate/package hash. The frozen sixteen-module Case Package remains unchanged; no rule sidecar exists.

## V2-004 Patient State and observation projection

Patient State owns clinical truth. Numeric observations, monitor values, and waveform descriptors are deterministic read-only projections from that explicit state plus a case-controlled projection definition. They never mutate the state and are never used to infer clinical truth backward. The portable observation definition/output schemas are owned by `packages/contracts/`; Clinical Engine owns only projection behavior.

Cardiac rhythm is an explicit Patient State dimension. The rhythm projector accepts only the explicit `cardiac_rhythm` value and its case-provided mapping; heart rate and blood pressure are not rhythm inputs. The package renders controlled rhythm and waveform identities but contains no ECG renderer or UI.

Observation definitions provide fixed mappings for hemodynamic, respiratory, oxygenation, consciousness, rhythm, and optional temperature state codes. The definition is stored inline as `initial_state.observation_projection`, so normal module, review-subject, candidate, and package hashes bind every reviewed vital and waveform mapping. Drafts may omit it temporarily; candidate and final publication validation require schema version `1.0` and complete coverage for the authored initial Patient State. Runtime processing must use the pinned Case Package field rather than a sidecar policy.

Generic validation enforces JSON-safe strict shapes, finite/nonnegative numeric fields, SpO2 percentage bounds, systolic-greater-than-diastolic structure, unique active intervention/complication identities, and complete mappings for the supplied state. It makes no case-specific medical-plausibility judgment. An unavailable, failed-device, or nonpulsatile BP representation may later need an explicit availability/status contract rather than sentinel numbers; no such representation is introduced in V2-004.

The V2-003 authored initial state remains session-free. `initializePatientState` validates that shared derived shape and attaches only the caller-supplied runtime Session ID; it does not invent or persist session data. V2-004 has no state transitions, rule evaluation, medication or treatment effects, scheduler, runtime clock, randomness, network, database, UI, or provider integration.

V2-004 publication validation proves only initial-state projection coverage. When V2-005 defines the reachable state/effect vocabulary, its Rule Reachability evidence and publication validation must prove projection coverage for every reachable observation-driving state code. V2-004 does not claim or implement that future analysis.

## V2-003 Case Schema validator/compiler

### Review-only executable artifacts

`prepareReviewExecutionArtifact` derives a strict, immutable `REVIEW_ONLY` artifact from a technically executable `UNDER_REVIEW` Case. Its `review_execution_hash` binds the exact 16-module source snapshot, all module hashes, the Case identity/version, and `review_subject_hash`; it never creates Clinical Approval, an Approval Record, a published package, or a lifecycle transition.

Technical review execution fails closed for schema/reference defects, unsupported runtime or diagnostic semantics, reachability/liveness failures, stale mandatory evidence, and reachable observation-projection gaps. Pending human Clinical, curriculum, visual, or media approval remains visible but does not masquerade as a technical failure when Case-authored structured fallback permits deterministic execution.

Production and review authority use separate pinning functions for Clinical, Session, and Assessment contexts. Production constructors still accept only `CompiledCasePackage`; review constructors accept only `ReviewExecutionArtifact` and preserve its `REVIEW_ONLY` authority. A review artifact cannot satisfy the minimal production-playability boundary, and no runtime policy/action sidecar is accepted.

Draft validation requires strict schema and reference integrity while reporting unresolved approval, source, curriculum, fallback, and review gates as warnings. `preparePublicationCandidate` accepts only an eligible `UNDER_REVIEW` or `APPROVED` source, applies every candidate-readiness gate, and projects it without mutation onto the exact target `PUBLISHED` artifact. This target status describes the would-be immutable package; it does not claim that persistence or publication has occurred. The same unchanged source content/evidence therefore produces the same candidate after `UNDER_REVIEW` becomes `APPROVED`.

Final publication validation requires an `APPROVED` source plus an external exact-package Approval Record whose Case Version identity, semantic version, required Clinical/Technical review references, and `approved_package_hash` match the recomputed candidate. The record remains outside Case Package bytes, matching the separate `case_approvals` and `case_packages` governance boundary. Candidate preparation and final compilation are pure: neither persists data nor mutates lifecycle state.

Both readiness layers fail closed for approved required modules and sources, compatible declarations, resolved curriculum mappings, required visual fallback, separate approved Clinical and Technical reviews, and mandatory Rule Reachability evidence. `CURRICULUM_UX` never substitutes for Clinical Review. Rule Reachability uses the system-owned `validation.rule-reachability` code; it cannot be omitted or downgraded, and `PASSED` evidence must bind validator/version identity, evidence hash, exact Case Version identity/version, current review-subject hash, and completion time. V2-003 validates this evidence but implements no reachability analyzer or Clinical Engine.

The immutable compiled package uses three deterministic SHA-256 boundaries. In every boundary, the `HashAdapter` hashes the UTF-8 bytes of the stated canonical JSON string:

- Review-subject hash: canonical identity plus the 14 content modules, excluding `manifest` and `validation`, so review evidence can bind exact content without circular hashing.
- Module hash: canonical JSON for each individual Draft module; the manifest module hash covers the pre-compilation manifest without generated hashes.
- Candidate package hash: canonical JSON for the complete would-be published package, including the normalized target manifest, every exact module, generated module hashes, and the immutable validation/review/evidence snapshot. It excludes only the final `package_hash` field. The external Approval Record is not package content and is therefore outside this hash boundary.

The review-subject hash and candidate-package hash have separate authority. Clinical Review binds authored clinical/content material; it does not authorize publication. Exact-package approval binds the complete candidate artifact, and any candidate hash change invalidates the prior external approval. No module, manifest, review-subject, candidate-package, or approval hash depends on itself.

Canonical JSON recursively sorts object keys and preserves array order. Only shared JSON-contract values are accepted; `Date`, `Map`, `Set`, `undefined`, functions, classes, and executable case scripts are rejected. Hash implementations stay outside the package behind `HashAdapter`.

## V2-002 shared contracts

`packages/contracts/` is the single owner of portable runtime-validation schemas and inferred TypeScript types shared by later V2 packages. It contains identifiers, locale and institution metadata, lifecycle categories, action/request/proposal boundaries, the canonical event envelope, the explicit Patient State shape, strict observation definition/output data contracts, public API errors, and narrow runtime adapter interfaces. It contains no projection behavior, clinical logic, or adapter implementations.

Domain and catalogue identifiers use justified lowercase namespaces, such as `case.*`, `rule.*`, and approved Action IDs like `investigation.*`. Runtime/operational identifiers use bounded ASCII-safe opaque values and keep distinct TypeScript brands without requiring invented prefixes. Persisted Event IDs are canonical UUIDs as required by the Physical Architecture. State, sequence, and proposal versions remain validated integer counters.

Schema versions use the frozen `major.minor` form (for example `2.0`), while Case Package/content versions use the separate `major.minor.patch` semantic form (for example `2.0.0`). Event and Patient State `case_version` fields carry semantic versions, not Case Version identity records.

Patient language is exactly `ar-JO` or `en-US`. Tutor output locale and authored locale use separate nominal contracts so they cannot be confused with patient language. Expo institution metadata is canonical:

- `ju` / `JU` / `University of Jordan`
- `just` / `JUST` / `Jordan University of Science and Technology`

Public contract objects are strict and reject unknown fields. The explicit `parameters`, `payload`, intervention attributes, and adapter metadata boundaries accept only JSON-serializable values. This lets extensions remain intentional without weakening high-risk envelopes.

Intent candidates and interpreter `MATCHED` references are explicitly non-authoritative. An Action Request carries syntactically valid input with unverified catalogue membership; a later deterministic Session/Clinical owner must revalidate it against the pinned Case Package before any approval or execution. This package performs no lookup, execution, or Patient State mutation.

At the external JSON boundary, an absent optional field and a JavaScript optional property whose value is `undefined` serialize equivalently as absent. JSON payload boundaries themselves reject `undefined`.

The package imports the same TypeScript source in Browser/Vite and project-local Deno. Runtime-specific behavior belongs behind `ClockAdapter`, `PersistenceAdapter`, `StorageAdapter`, `LoggerAdapter`, `RandomSeedAdapter`, or `HashAdapter`; the contracts package imports no runtime or provider SDK.

## Requirements

- Node.js 24
- npm 11

All JavaScript dependencies use exact versions in `package-lock.json`. Deno 2.9.6 is a pinned dev dependency and npm scripts resolve its project-local executable; no global Deno installation or `PATH` entry is required.

## Commands

Run these commands from `v2/`:

```powershell
npm install
npm run dev
npm run build
npm run typecheck
npm run test:browser
npm run test:deno
npm run test:contracts
npm run test:case-schema
npm run test:clinical-engine
npm run test:v2-005
npm run test:session-engine
npm run test:v2-006b
npm run test:v2-006
npm run test:assessment-engine
npm run test:v2-007a
npm run test:v2-007
npm run test:diagnostic-contract
npm run test:review-execution-artifact
npm run test:v2-009
npm run test:v2-010
npm run test:v2-011a
npm run test:v2-011b
npm run test:v2-012a
npm run test:playwright
npm run test:portability-guard
npm run verify
```

Install the single Playwright browser once before browser-based tests:

```powershell
npm exec playwright install chromium
```

`npm run test:browser` executes the shared TypeScript smoke and focused contract tests in Vitest Browser Mode. `npm run test:deno` imports the same source files through project-local Deno. Both runtimes assert the same representative serialized results. `npm run test:contracts`, `npm run test:case-schema`, and `npm run test:clinical-engine` run their focused Browser/Deno checks plus the forbidden-import guard.

## V2-009 medically reviewable STEMI case

`content/cases/stemi/v2-draft/` contains the medically reviewable, explicitly `UNDER_REVIEW` Acute Inferior STEMI with right-ventricular-involvement Case source. It uses the published Case Schema, review-execution artifact, pinned Clinical/Session/Assessment paths, and deterministic Browser/Deno golden traces. Unresolved sources, specialist sign-off, curriculum mapping, and visual provenance intentionally keep publication fail-closed; this is not an approved or published Case Package. Run `npm run test:v2-009` for its focused gate.

## V2-010 STEMI functional parity gate

`planning_input/v2-010/` reconciles all 346 extracted V1 records against the medically reviewable V2 Case and deterministic engine path. The gate distinguishes preserved, intentionally replaced or removed, architecture-superseded, and domain-ready/later-delivery behavior. It adds no medical content and does not promote the Case beyond `UNDER_REVIEW` / `REVIEW_ONLY`. Run `npm run test:v2-010` for automated ledger accounting plus the focused Browser and existing Browser/Deno STEMI evidence.

## V2-011A local persistence foundation

`supabase/migrations/` defines the local PostgreSQL relational/JSONB substrate for institution membership, the 16-module Case source, exact review and publication artifacts, Session aggregates/events/checkpoints/idempotency, deterministic Assessments, and diagnostic/visual metadata. The database stores application-owned truth and hashes; it contains no Clinical Engine, score calculation, clinical timer, API, or remote service.

`npm run test:v2-011a` applies all migrations to two independent PGlite databases and runs permanent structural, immutability, authority-binding, and real-contract round-trip checks. `npm run test:v2-011b` uses exact-pinned native PostgreSQL 16.14 to prove real roles, grants, `SET ROLE`, `row_security`, `FORCE ROW LEVEL SECURITY`, Supabase-compatible `auth.uid()` request context, empty/upgrade/reset migration paths, and JU/JUST adversarial isolation. Both runtimes are local test dependencies; no remote Supabase project or region is selected.

All 28 application tables have RLS enabled and forced. V2-011B adds 14 explicit least-privilege policies and one hardened membership helper. Raw governance, Session, Event, checkpoint, and Assessment access remains denied until trusted mutation and disclosure-safe API boundaries exist. **RLS SECURITY GATE: PASS.** V2-012 will own persistent atomic Session commit orchestration.

## V2-012A atomic persistent Session foundation

`PostgresSessionCommitAdapter` implements the existing V2-006 storage-neutral boundary through a narrow SDK-free RPC client. The additive PostgreSQL migration provides `SECURITY INVOKER`, `service_role`-only load and commit functions. The commit function locks the Session row, applies the existing composite CAS token, preserves immutable review/production artifact authority, and atomically appends domain-assigned Events and successful replay records with an exact checkpoint and Session update. PostgreSQL stores the already-computed outcome; it contains no clinical rules, medical timers, event ordering logic, or scoring.

Persistent reload validates the strict Session aggregate and cross-checks its committed Event and replay collections plus latest checkpoint. Stale commits fail without automatic clinical recomputation; a double-click race may resolve only when the newly loaded durable record proves an exact already-committed replay. Run `npm run test:v2-012a` for the native PostgreSQL 16.14 transaction and rollback suite. V2-012 remains open pending the dedicated Slice B concurrency/crash/recovery adversarial gate.

## Portable package rules

Code under `packages/portability-smoke/src/`, `packages/contracts/src/`, `packages/case-schema/src/`, `packages/clinical-engine/src/`, `packages/session-engine/src/`, and `packages/assessment-engine/src/` must remain deterministic, side-effect-free, and portable. It must not depend directly on Node, Deno, browser globals, filesystems, databases, UI frameworks, provider SDKs, or environment state. `npm run test:portability-guard` enforces these boundaries, rejects runtime randomness/clocks and disease-specific terms in generic engine source, and checks canonical contract/case fixtures for a reversed University of Jordan code.

## Source of Truth and rollback

The two files under repository-root `planning_input/` are frozen, read-only Architecture Source of Truth documents. They are not copied into this workspace.

V2-001 is reversible by removing `v2/` and the V2-scoped `.github/workflows/v2-001.yml` workflow. V1 requires no rollback because V2-001 does not modify it.
