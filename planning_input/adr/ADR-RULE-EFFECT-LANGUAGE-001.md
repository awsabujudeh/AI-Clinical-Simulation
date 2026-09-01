# ADR-RULE-EFFECT-LANGUAGE-001

## Small Typed Rule, Effect, and Clinical Scheduler Language

Status: **ACCEPTED**

## Context

The frozen architecture assigns medical meaning to reviewed Case Packages and deterministic transition mechanics to the Clinical Engine, while leaving the exact V2 effect vocabulary open. V2-005 requires a portable language that can express reviewed key-state trajectories without becoming an executable scripting system, physiology model, or Session Engine.

## Decision

1. Shared contracts own one versioned (`1.0`) portable rule, condition, effect, scheduler, pinned-policy, event-proposal, and transition-trace data authority. Case Schema embeds those contracts in the existing `rules` and `timeline_policy` modules; Clinical Engine owns evaluation behavior.
2. Conditions are a bounded flat vocabulary with ALL preconditions and ANY exclusions. They may inspect allowlisted Patient State values and identities, explicit Clinical Time, the supplied trigger, prior committed-event facts, and stable Case Fact references. Natural-language and executable expressions are prohibited.
3. Triggers are limited to committed-event input, Clinical-Time thresholds, scheduled-item input, and state conditions. Clinical Engine consumes these as data and does not commit authoritative events.
4. Immediate effects may set only the allowlisted scalar Patient State channels (`clinical_phase`, `hemodynamic_state`, `cardiac_rhythm`, `perfusion`, `respiratory_state`, `oxygenation`, `consciousness`, `neurologic_state`, `temperature_state`, and `metabolic_state`), replace typed pain state, and add/remove typed interventions, complications, or outcome flags.
5. Direct numeric vital effects, arbitrary state paths, functions, scripts, `eval`, and provider-specific behavior are prohibited. Observation values remain deterministic downstream projections from Patient State and the pinned Case observation policy.
6. Case Schema derives one `PinnedClinicalPolicyEnvelope` from a validated immutable compiled Case Package. It binds package/Case Version identity and hashes to the exact rules, timeline policy, initial scheduled work, approved Case Fact identities, observation policy, and relevant module hashes. The production Clinical Engine entry accepts this envelope plus runtime context and accepts no independent clinical-policy sidecars. The envelope is not a client authentication token; authoritative package loading and authenticity remain trusted V2-006 infrastructure responsibilities.
7. Scheduling supports typed relative-delay and absolute-Clinical-Time items. Runtime-created relative delays are strictly positive and absolute due times must be strictly later than the Clinical Time at which the effect executes. A causal step must advance Clinical Time, terminate without new work, or fail within deterministic hard limits. Scheduler state remains separate from Patient State and is supplied/returned as an immutable runtime value.
8. Due items use a total order of due Clinical Time ascending, priority descending, scheduled-item ID ascending, and originating Rule ID ascending. Processing removes only the current item. An earlier same-time item can cancel later pending work, but cannot retroactively cancel an item already executed. Processing through a target drains newly created work due at or before that target or fails explicitly; work after the target remains pending.
9. Cancellation selects pending work only by stable scheduled-item identity or controlled category. No-match and successful cancellation are distinct deterministic trace outcomes.
10. Evaluation has immutable engine ceilings: 32 derived passes, 8,192 rules considered, 2,048 activations, 4,096 attempted effects, 1,024 due items, 1,024 created scheduled items, 1,024 cancellations, 512 event proposals, 4,096 trace entries, and causal depth 256. Case data cannot raise them. Capacity is checked before growth and terminal trace capacity is reserved. Budget, liveness, effect, projection, conflict, and cycle failures are typed, deterministic, non-committable Results rather than data-driven exceptions.
11. A persistent state-condition rule activates at most once per `(rule_id, canonical Patient State fingerprint)` within one external evaluation. The fingerprint includes all Patient State content except `state_version` and `clinical_time`; those metadata fields cannot create a new same-time clinical activation. A changed clinical state may activate the rule again, while repeated states remain cycle/budget guarded.
12. Supported conflict policies are `REPLACE`, `BLOCK`, and `HIGHEST_PRIORITY`. Rules and effects are ordered deterministically. Contradictory co-firing writes with mixed policies fail closed. Equal highest-priority different values fail and equal values coalesce; a lexical Rule ID is never a hidden clinical tie-breaker. For a unique higher-priority value, `HIGHEST_PRIORITY` and `REPLACE` select it, while `BLOCK` suppresses the contradictory write set.
13. `ADD_INTERVENTION` and `ADD_COMPLICATION` add a new identity, treat an exactly equivalent canonical existing record as an idempotent no-op, and fail on the same identity with different type, attributes/parameters, or start/activation semantics. They never silently replace history. Missing removals and repeated outcome-flag operations are idempotent; output collections remain canonically ordered.
14. State-condition re-evaluation runs until stable and is bounded by the package-requested value under the engine hard ceiling. Repeated-state cycles and bound exhaustion fail explicitly; they are never silently truncated.
15. Runtime Transition Trace explains one proposed evaluation and distinguishes effect rejection, conflict, budget, scheduler progress/liveness, projection, and cycle failures. Static Rule Reachability evidence analyzes authored package safety. These are separate artifacts with different authority.
16. Static analysis conservatively computes reachable rule/state values for the implemented vocabulary, requires pinned mappings for every reachable observation-driving value, and includes scheduler-liveness/progress findings. Generated publication evidence certifies both reachability and liveness and binds the exact Case Version identity, semantic version, review-subject hash, analyzer identity/version, deterministic analysis hash, and caller-supplied completion time.
17. Event outputs are proposals only and contain no authoritative Event ID, sequence number, wall-clock timestamp, persistence identity, or database commit. Prior committed-event facts are trusted Session Engine evidence, not interpreter intents, Action Requests, or natural-language input.
18. The Clinical Engine receives explicit Simulation Clinical Time. It uses no timers or wall clock. Ordering between an external command and due scheduled work at the same Clinical Time remains a V2-006 Session/Clinical orchestration decision.
19. Future vocabulary expansion requires a new versioned contract and architecture decision. V2-005 contains no disease-specific rule paths.

## Consequences

- Reviewed transition and scheduling policy participates in normal rules/timeline-module, review-subject, candidate, and package hashing. Runtime execution is bound to the extracted pinned package policy rather than an unreviewed sidecar.
- Patient State remains authoritative, scheduler state remains separate, and observations remain downstream projections.
- Runtime evaluation is pure, deterministic, portable, strictly progressing, bounded, conflict-safe, identity-safe, and auditable.
- Session Engine retains command lifecycle, idempotency, authoritative event sequencing, atomic commit, checkpoint, persistence, and wall-clock orchestration ownership.
- Medical plausibility remains a Case Package clinical-review responsibility; the generic engine supplies mechanics and structural safety only.

## Architecture relationship

This ADR resolves the frozen architecture's open effect-vocabulary decision and clarifies its deterministic/fail-closed scheduler principles with strict forward progress, one-item due processing, package-pinned execution policy, and layered work limits. These are implementation-era safety refinements, not changes to Case ownership, Clinical Engine truth ownership, immutable Patient State proposals, publication governance, or Session Engine command/event/commit responsibilities. It introduces no Session Engine, persistence, assessment, provider, UI, visual, or disease-specific responsibility.
