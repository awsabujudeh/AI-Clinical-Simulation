# Final Expo functional completion

Baseline: `aaa705c882e191711cde38b4b4ffb11215b269cb` (WP3).
Status: **BALSIM EXPO FUNCTIONAL CORE — CLOSED**.
`FUNCTIONAL_EXPO_SCOPE = FROZEN` for this bounded Expo learner workflow.
Implementation acceptance: `BALSIM_EXPO_FUNCTIONAL_COMPLETE — YES`.
Owner-authorized closeout checkpoint; no push.
This is a functional package, not final UI design or production deployment.

## Closeout boundary

The next phase is **FINAL UI/UX IMPLEMENTATION**, not started by this closeout.
Closure does not claim final UI completion, production deployment, V2-029
reliability, V2-030 release, a complete RAG corpus, JU/JUST curriculum integration,
or production persistence/authentication. Those gates remain separate.

Closeout changes documentation only after the verified implementation. It preserves
Session-owned modes, Practice/Assessment disclosure, learner-safe entry, the shared
catalogue execution boundary, end-state locks, separate debrief and deterministic
assessment. Existing case approval and medical content are not changed.
The scoped staging/secret scan and `git diff --check` are the final closeout checks;
the previously passing test/build evidence below is reused without provider calls.

## Entry and lifecycle

Run from `v2`: `npm run dev:expo-functional`, then open
`http://127.0.0.1:4218/app`.

The trusted local synthetic composition uses the existing API authority/store
fixture boundary. It creates no Session while browsing cards or the briefing.
The two cards have opaque entry IDs, patient name, existing demographics,
ED setting, presenting complaint and learner role. Neither identifies the diagnosis,
correct treatment, rubric or investigation results. Dana remains Adult female;
no numeric age is invented. Faculty/internal content is unchanged.

Choose Practice or Assessment, review briefing, then **Begin Encounter**. This is
the existing authoritative Session-start command and its first projection is at
Clinical Time zero. Subsequent time is owned by the WP1 Coordinator, not a UI
stopwatch. The existing internal `PRACTICE_DEMO` enum is presented as Practice;
no parallel mode or client-owned mutable mode is introduced.

Routes: `/app` -> `/sessions/:id` -> `/sessions/:id/debrief`. End Encounter requires
the existing explicit confirmation dialog. The Coordinator finalizes a snapshot
and deterministic assessment; all clinical/diagnosis/disposition mutations lock.
Ended sessions redirect to a separate debrief without a live patient/action form.
Final acquired observations and timeline remain readable. Active sessions cannot
use the debrief route to reveal final assessment.

The new local host is loopback-only, rejects foreign Host/Origin/cross-site
requests, enforces body limits, permits only its own created Sessions, and has
no provider gateway/credentials. At most 64 starts are retained per host. It
must not be exposed publicly or represented as production authentication.
Refresh preserves host-memory state; host restart intentionally does not.
Existing trusted live-provider hosts and their single-Session limits are unchanged.

## Compound Quick Orders

One bounded orchestration layer around the **existing Clinical Interpreter**:

1. `/v1/sessions/:id/quick-orders`: strict text/locale/utterance-ID request.
2. At most eight explicit comma/conjunction-delimited fragments, in input order.
   Negation/conditional/past-tense scope is not split into positive subcommands.
3. Exact controlled bilingual aliases resolve locally against the pinned shared
   `catalogue.balsim.expo-clinical@1.1.0`, without effects, scores or hidden facts.
4. Remaining language uses the existing gateway/reconciliation path when a trusted
   interpreter is configured (`gpt-5.6-luna`, unchanged policy). The local review
   host has no provider, so unsupported language truthfully needs clarification.
5. Each fragment retains its MATCH / AMBIGUOUS / NO_MATCH outcome. No unresolved
   fragment is silently discarded. Ambiguous fluids show both existing orders;
   the learner may choose one in the existing structured manual form.
6. Fixed medication orders retain their exact catalogue dose/route. A name match
   offers that complete fixed order for deliberate confirmation; it is not a
   free-form prescription. Explicit inconsistent numeric dose/unit/route is not
   silently normalized (e.g. aspirin 300 mg does not become 324 mg).
7. `/quick-orders/confirm` requires `confirmed:true`, the server-owned plan ID and
   selected resolved indexes. It accepts no action ID, effects or parameter override.
   Missing required parameters/ambiguous fragments must use manual clarification.

All actions execute through the existing `submitClinicalAction`/Coordinator path.
Dependencies reorder only actions the learner explicitly included. IV access is
never silently inserted. Each action commits separately with its own stable
command/idempotency identity, Clinical Time and evidence. Independent investigation
orders retain their existing parallel completion schedule.

### Partial execution / idempotency

Policy: `CONFIRMED_SEQUENTIAL_STOP_ON_FAILURE`. Earlier successful actions remain
committed; the failing action is NOT_COMPLETED, and no later action is attempted.
There is no pretend all-or-nothing rollback. The activity/authoritative Session is
the recovery source of truth. The UI clearly reports stopped/unconfirmed outcomes.
Transport exceptions are caught with safe copy; a lost confirmation response never
claims successful execution or triggers an automatic new request. The original
server plan remains available for an idempotent retry after checking Activity.

Concurrent/retried confirmations share one reserved execution promise. Altered
confirmation selections conflict. Plan identities are principal + Session +
utterance scoped; changed text with the same identity conflicts. Plan cache is
bounded (64/Session, 512/service), and existing interpreter provider quotas apply
per unresolved fragment. Explicit noncommitted version conflicts caused by trusted
clock refresh may retry at most twice using the SAME action identity and a fresh
server version. Domain errors, ambiguous outcomes and provider failures are not
automatically retried. A process-lost plan cannot be confirmed as a new plan;
durable committed actions retain engine replay protection.

Patient Conversation remains its separate `/questions` path. Quick Orders cannot
read Patient State or create actions outside the shared catalogue.

## Practice / Assessment and Activity

Both modes were already authoritative Session fields; they are selected only at
start. No mode-switch endpoint exists. Existing deterministic assessment policy is
reused, not new weights or AI judgment.

- Practice: resolved, evidence-backed educational categories may be shown after
  committed actions. Activity items can carry bounded `educational_feedback`
  categories derived from that same trusted disclosure projection and exact Event.
- Assessment: activity shows action, Clinical Time and committed/result status;
  no correctness category, score, rubric or coaching is returned during encounter.
- Ended: deterministic total/six-domain scores, findings/evidence and the existing
  manually requested Tutor appear only in the debrief. AI/RAG failure does not
  remove assessment. This local host makes no real Tutor provider request.

## Diagnosis and disposition

The same eight decision choices appear in both patients: acute inferior STEMI,
RV involvement, food-triggered anaphylaxis, diagnosis not yet determined; Cath Lab
transfer, monitored observation, ward admission, discharge home. Availability never
identifies the correct answer for the active patient. Labels omit authored evaluative
phrases such as 'premature' or 'instead of emergent reperfusion'.

The server resolves a selected decision to the existing authored Case action when
present, preserving its physiology, prerequisites, repeat behavior and scoring.
Other choices commit learner-decision evidence only: no invented harm, beneficial
effect, diagnosis truth, rubric weight or claimed successful disposition. The
delivery-only bindings are pinned to the two exact approved Expo hashes, like WP3.
They do not mutate Case Package bytes or change medical approval. Later physician-
authored scoring expansion for currently unmapped decisions is separate work.

## Learner-safe state/error handling

WP3's precise internal event status `CURRENT_STATE_NOT_AUTHORED` is preserved.
The learner receipt maps it to `FINDING_NOT_AVAILABLE_FOR_CURRENT_STATE` and
explains that an earlier finding is historical. No follow-up finding is invented.
Examination failures now use human-facing copy rather than displaying result-kind
codes. Existing manual action/investigation clients retain semantic rejection,
pending, stale and unavailable states; internal rule/effect/exception messages are
not rendered. Quick Orders report clarification or stopped/unconfirmed execution,
not hidden contraindication reasoning. There is no final wording/style redesign.

## Preserved boundaries

- Khalid 2.4.0 execution hash:
  `e212c36090b59a4d324348c85fd1f5f7a0dbff02b1710a4e360a135e060760d7`.
- Dana 1.5.0 execution hash:
  `0cc26e1bad72fd44f84afe9f11832789cc60fd8408c9b13e1276c9fbf2a0dd65`.
- APPROVED_FOR_EXPO remains distinct from NOT_PUBLISHED production status.
- Shared 33-item clinical catalogue and approved medical contents are unchanged.
- WP1 observations/time, WP2 effects/results, WP3 exams/devices, V2-027 ownership,
  role/institution boundaries and V2-028 preflight remain authoritative.
- Patient assets, Visual Patient Lab, V1, frozen Architecture/ADRs untouched.

## Verification and app proof

Verification on 2026-09-25:

- 436/436 affected Browser regression tests passed across API, Interpreter,
  Assessment/Session Engine, Student UI, WP1/WP2/WP3 and this package.
- After the final Activity/version-conflict changes, the affected subset rerun
  passed 197/197. These overlap the regression count; do not add them together.
- New functional suite passed 13/13, including two UI transport-loss checks.
  The two transport-loss tests were rerun after correcting their branded locale
  fixture type and passed again. No runtime behavior was changed by that correction.
- 9/9 relevant Deno and 12/12 Node security/preflight checks passed.
- Actual app: 4/4 journeys passed (Khalid and Dana, each in Practice and Assessment).
- Typecheck, production build, portability and secret scan passed. Existing
  bundle-size warning is non-blocking. Final `git diff --check` passed.
- No external provider requests. No credential-store/environment inspection.
- Case source/approval packages, patient assets, V1, frozen Architecture/ADRs and
  Visual Patient Lab have no tracked delta. At implementation verification, nothing
  was staged or committed; the subsequent owner-authorized checkpoint contains
  only the 31 scoped implementation/test/handoff files.

The four app journeys cover safe selection/briefing, zero-time Begin, compound
investigations, treatment orders, manual BP acquisition, mode disclosure, explicit
diagnosis/disposition, End, six-domain final assessment, separate debrief and reload.
Existing focused WP1/WP2/WP3 regressions verify delayed treatment response, scheduling,
observations and examination authority; the app tests do not accelerate the clinical
clock or claim immediate treatment improvement. The Windows/Vite test host retained
a teardown process after assertions; only that test-owned process was stopped to
complete the run (exit 0). No owner-configured host was stopped.

Review screenshots are ignored artifacts under
`C:/Projects/AI-Clinical-Simulation/v2/test-results/expo-functional/`:

| Journey folder | Evidence |
| --- | --- |
| `journey-Khalid-PRACTICE-DEMO-complete-functional-journey` | `briefing.png`, `active.png`, `debrief.png` |
| `journey-Khalid-ASSESSMENT-complete-functional-journey` | `briefing.png`, `active.png`, `debrief.png` |
| `journey-Dana-PRACTICE-DEMO-complete-functional-journey` | `briefing.png`, `active.png`, `debrief.png` |
| `journey-Dana-ASSESSMENT-complete-functional-journey` | `briefing.png`, `active.png`, `debrief.png` |

The actual-app test explicitly verifies HTTP 200 diagnosis/disposition receipts
and their final timeline entries, not merely a success label left by an earlier
action. All four journeys use real local API/engine state and block external
network requests. No external OpenAI or ElevenLabs calls are required.

The handoff has 19 modified tracked files and 12 new scoped files (31 total),
excluding existing untracked `visual-patient-lab/` and ignored proof/build outputs.
No final visual composition/style redesign was introduced.

## Deferred beyond this functional package

Final visual shell/copy polish, production authentication/persistent plan storage,
full ICD/prescribing systems, state-specific follow-up examination authoring,
new clinical effects/scoring, broader NLP without clarification, advanced cohort/
faculty workflows and new medical content are not claimed.
