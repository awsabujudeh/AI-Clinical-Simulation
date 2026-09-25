# BALSIM Functional Work Package 1 — Authoritative Observation Acquisition + Trusted Clinical Time

Date: 2026-09-25. Baseline: `58a297d6d2d36f31e5e56f5e36d32edc4b73e944`, `v2-development`.

Status: **CLOSED — IMPLEMENTED / EXPO_SUPPORTED**. Owner-authorized technical closeout; dedicated pulse-ox visual hardware remains pending and is not a WP1 blocker. No Work Package 2, final shell/mockups, medical approval, or publication-gate change. Local checkpoint only; no push.

## Authority and acquisition lifecycle

The existing Clinical Engine and immutable pinned Case remain the sole physiological truth. Internal `projectObservations` remains available to the engine, assessment/test boundaries and authorized internal tooling. It is **not** the learner projection.

PatientState is physiological truth; acquired-observation receipts are learner knowledge; VisualState remains a downstream projection. Neither UI nor AI can author observation truth or Clinical Time. The existing authoritative Session Coordinator remains the single time owner. Closeout changes no implementation or authority boundary.

`LearnerObservations` version 2.0 is a Session/time-bound read model of committed acquisition receipts. It carries only acquired values, units, acquisition/sample Clinical Time, action/Event ID/sequence provenance and `MEASURED`, `MONITORING` or `PRE_OBSERVED` status. Missing channel means `NOT_MEASURED`: no hidden numeric value, waveform descriptor or physiological-state identifier is serialized. The UI displays an em dash with “Not measured.” Existing cached v1 full-truth projections fail the new strict schema rather than being reused.

No new mutable aggregate/cache authority was created. A pinned action's acquisition policy is validated and hash-bound through existing Case compilation/review. The Session command pipeline validates the request, advances its authored compressed duration using V2-006, drains due work and same-time cascades, then captures completion physiology in the learner command's `observation_samples`. Samples, clock, events, sequence, equipment-driving execution and idempotency result commit through the existing atomic adapter. Ordinary failure rolls everything back; a Case interrupt commits only authoritative due settlement, not the interrupted learner measurement or its replay key. Sample/projection validation failure is fail-closed.

One-time measurements remain unchanged after later physiological changes. Remeasurement replaces the latest displayed sample while older receipts remain in the append-only event log. An active monitor refreshes only its explicitly authorized channels; taking a point measurement does not silently detach it. Assessment receives the same committed action identity, event sequence and completion Clinical Time; score weights/rubrics are unchanged. `intake_clinical_time` preserves the original canonical command time across exact API retries so retries cannot re-execute or repay a duration.

Explicit Case `pre_observed` values are supported as timestamp-zero point/handoff evidence. Neither current WP1 case supplies them. Physiological truth does not imply pre-observation. This does not invent an arrival-on-monitor attachment policy.

## Acquisition and duration policy

The 15/30-second values are explicit **Expo compressed SIMULATION TIMING FIXTURES**, not universal real-world procedure durations or clinically approved measurement-duration standards. The source catalogue had no general action-duration field; existing V2-006 `CASE_OWNED_DURATION` advancement is reused, with a minimal acquisition-policy field connecting it to measurement actions. No client selects channels, duration or sampled values.

| Path | Acquired channels | Clinical seconds | Behavior |
| --- | --- | ---: | --- |
| `examination.observe.bp` | BP | 30 | Point sample; cuff |
| `examination.observe.pulse-ox` | SpO2 + HR | 15 | Point samples; pulse-ox visual pending |
| `examination.observe.pulse` | HR | 30 | Point sample |
| `examination.observe.respirations` | RR | 30 | Point sample, independent of visible breathing |
| `examination.observe.temperature` | Temperature | 30 | Point sample; no decorative thermometer required |
| Khalid hemodynamic assessment/reassessment | BP + HR | 30 | Point samples; cuff |
| Khalid lungs/JVP or Dana respiratory assessment | RR | 30 | Point sample |
| Dana ABCDE | Consciousness | 30 | Point observation only; does not auto-measure all vitals |
| Khalid cardiac monitor | HR + rhythm | 15 | Continuous until encounter end; no continuous BP |
| Dana monitoring | HR + SpO2 + rhythm; BP | 30 | First three continuous; BP is a point sample |

Only acquisition actions gain these costs. Existing IV, medication and investigation command semantics are preserved. In particular, a scheduled therapeutic/diagnostic delay is **not** charged again as a sequential order duration. There is no general-duration catalogue expansion in WP1. Unsupported continuous channels (including BP/RR/temperature), duplicate channels, invalid duration, invalid action kind and missing temperature projection support fail validation. Remeasurement is explicitly repeatable; an identical idempotent retry is not a new measurement.

## Trusted time: exact rule

One existing Session Coordinator and one existing `SessionClinicalClock`; no new clock, scheduler or clinical engine.

1. Session creation commits Clinical Time `0` (`00:00`). In a boot-created review Session, time spent before opening the page is encounter elapsed time; route entry must not reset it.
2. An authenticated active `/state` read synchronizes using **server-injected trusted UTC**, the existing real/clinical anchors and pinned `time_ratio`. The WP1 host supplies whole-second server time. At Expo ratio 1, five new running real seconds contribute five clinical seconds.
3. Before a command, the same coordinator synchronizes any unaccounted trusted elapsed interval. A measurement then adds its **compressed, not-real-waited** Case duration exactly once. Example: 10 trusted seconds + BP's 30 compressed seconds = 40; five later real seconds = 45. UI/network delivery latency is not a second copy of the 30-second measurement.
4. Same timestamp is a no-op; backward trusted time fails closed. Existing pause/resume semantics remain intact (paused elapsed time does not catch up). ENDED Sessions do not advance.
5. All scheduled work is processed chronologically through the target. Interrupts stop exactly at the interruption and preserve future work. Command failures do not consume their tentative duration.
6. UI polling every two seconds and window-focus refresh only deliver committed server snapshots. There is no local ticking/extrapolation. An out-of-order older snapshot cannot regress displayed time/version/sequence; mutation is disabled with `SYNC_REQUIRED` until a fresh snapshot arrives. Offline data remains visibly stale/frozen and non-authoritative.

Investigation order requests remain parallel: ready times are independently scheduled from their committed order Clinical Time. Tests order Dana ECG and CXR at zero, observe no results at 59, ECG at 60 and CXR at 300 without another clinical action. No result appears early and no UI request serializes their durations. Existing Clinical Engine/Case/Assessment regression and deterministic parity suites remain passing.

## Devices, visual patient and degradation

Equipment derives only from verified committed learner execution, not intent or hidden physiology. Both patients start without cuff, IV access or tubing. Completed BP acquisition enables the shared skeleton-following cuff without reloading the patient. Existing IV access and subsequent infusion sequencing remain unchanged and tested. Visual presentation stays qualitative; it does not expose numeric RR/HR/BP.

**PULSE_OX_VISUAL_ASSET_PENDING**: the shared runtime hides legacy fixed-position donor oximeter/lead meshes. Its valid attachment layer currently supports shoulder/elbow/wrist cuff and IV anchors, not a verified moving finger sensor. WP1 reports `APPLIED_VISUAL_PENDING` after SpO2 acquisition and does not enable a misplaced donor device or fabricate a new one. Pulse-ox observation correctness is complete; a reliable visual attachment is deferred.

Actual-app tests block external destinations. Measurement, cuff, timer and reload work without OpenAI, ElevenLabs, RAG or Tutor. Forced GLB failure displays each patient's existing local static fallback; acquired readings and server time remain usable, and a new RR measurement succeeds while the static fallback is displayed. No live provider calls were made. No voice, conversation or Visual Patient runtime/assets were edited.

## Immutable Case migration

Do not rewrite approved historical artifacts in place. `v2/content/cases/observations/wp1-cases.ts` creates explicit review successors. Physiological mappings, clinical facts, rules, delayed treatment response, diagnostics, dialogue, rubric, curriculum and media are inherited without changing their truth. Only package/version identity, acquisition catalogue policy and its regenerated validation evidence differ.

| Case | WP1 review version | Review execution hash |
| --- | --- | --- |
| Khalid/STEMI | 2.1.0, `case-package.stemi.inferior-rv.003` | `245d740fc945e684def834c5ec2e469170d3b3b6d7dbf176f341939e1010afa8` |
| Dana/Anaphylaxis | 1.1.0, `case-package.anaphylaxis.dana.002` | `46febaff5a13cdd8565922f3c65a48edd14a9ca1cd4b3d748996cb55a865eb2d` |

Review subject hashes: Khalid `68a53b4221636c56d1faef676c1e1955e8f4db84dd983d255b8770a5a1001ef0`; Dana `3dc3ab8b7014413887b12c4c75aef2983c94000f655edc71ecddaf7931b79141`.

Both remain **UNDER_REVIEW / REVIEW_ONLY**. No physician/media/curriculum approval is claimed. Exact new identities are bound to existing patient and diagnostic media, not new assets. Old cases still validate. Legacy Sessions without a pinned acquisition policy do **not** receive synthetic backfilled measurements; use a fresh WP1 successor Session to exercise this contract. Old review commands continue to use their old immutable packages; they are not silently migrated.

## Reproducible owner/app proof

From `C:/Projects/AI-Clinical-Simulation/v2`:

- Khalid: `npm run dev:wp1` (port 4214).
- Dana: `npm run dev:wp1 -- --patient=dana` (port 4215).
- Open the complete `/sessions/<boot-created-id>` URL printed by the host. No credentials or live-proof flags required. Only that boot-created Session is accessible. This uses the existing real App, API, coordinator, memory adapter, engine, renderer and recovery client, not a second simulation UI.
- Local synthetic faculty fixture authentication is explicitly DEV/review-only; host refuses production mode, binds loopback, validates origin, bounds request bodies and reuses V2-027 route/Session restrictions. Private responses remain no-store. It does not compose external providers.
- Select Examination, then a measurement and Execute. Observe value, sample Clinical Time, timeline action, cuff and live authoritative clock. Reload preserves acquisition and clock while the host is alive. Host restart creates a fresh Session; this is not production persistence.

Actual-app evidence (local ignored `test-results`, not source artifacts):

- `v2/test-results/wp1-app/observations-Khalid-actual-69748-nd-reload-without-providers/Khalid-not-measured.png`
- Same directory: `Khalid-acquired-after-reload.png`, `Khalid-actual-app.png`, `Khalid-static-degraded.png`.
- `v2/test-results/wp1-app/observations-Dana-actual-a-8a92d-nd-reload-without-providers/Dana-not-measured.png`
- Same directory: `Dana-acquired-after-reload.png`, `Dana-actual-app.png`, `Dana-static-degraded.png`.

Browser inspection confirms visible cuffs on both actual 3D patients, measured BP only, other numeric vitals absent, and intact baseline UI. Automated assertions verify one model instance during acquisition. Reload intentionally loads the model anew but preserves authoritative Session evidence/time.

Khalid engine/API proof: baseline BP sample persists through the existing 600-second fluid-support transition; remeasurement captures current supported physiology, with IV and infusion equipment preserved. Dana proof: 82/48 and 93% point samples persist after existing delayed correct treatment; remeasurement returns 104/66. Dana's existing relieved/calm visual projection follows the clinical improvement, not the observation display. Explicit monitoring updates HR to 98 while its old BP remains 82/48 until measured again.

## Verification

All recorded passing runs below completed on this work package; overlapping suites are **not summed** as independent tests.

| Run | Result |
| --- | --- |
| Initial affected API/Session/recovery/UI/security/visual/observation/transition regression run | 416 Browser tests / 46 files PASS |
| Final WP1 + Session + monitor/assessment UI run | 102 Browser tests / 13 files PASS, including 30 WP1 tests |
| Additional Case Schema, Clinical Engine, Assessment Engine, STEMI regressions | 299 Browser tests / 26 files PASS |
| WP1/API/recovery/recovery-chaos/Session Deno | 8 PASS |
| WP1/Case Schema/Clinical Engine/Assessment Deno | 6 PASS (WP1 repeated; 13 distinct Deno tests overall) |
| Browser/Deno exact WP1 acquisition/time snapshot | PASS; previous engine snapshots still pass |
| V2-027 local-host security checks | 3 Node tests PASS |
| Final actual-App acquisition/reload/static-degradation proof | 2/2 Playwright PASS |
| Typecheck, build, portability guard, secret scan, `git diff --check` | PASS |

The existing >500 kB bundle warning remains non-blocking. No full unrelated historical verification campaign or live-provider test was run. Initial API retry and browser-selector failures were corrected, then covered by passing reruns. An extra test-only `/state` probe also demonstrated the expected 409 stale-version rejection; the final app test avoids advancing the server behind the UI before submitting, without changing the conflict guard. The known Windows Playwright teardown issue required stopping only the exact test-owned web-server PIDs after both tests passed. Initial generated failure captures were moved recoverably into ignored `v2/test-results/wp1-initial-failures/`; they are not source changes.

## Preservation and handoff

V1 SHA-256 remains `E1F5884A448E1CBD9125D1780A1236105D7E74DB2E3DD304F9A51F54857FCEE8` (README) and `2FE2732792EB1642909E53F42DB1A6455F9C72EF8088A0303F1E8857ECA2D512` (HTML). Frozen Architecture, ADRs, original STEMI/Dana source packages, clinical engine implementation, patient/media assets, visual runtime, Voice/provider architecture and Visual Patient Lab are unchanged. Lab remains pre-existing untracked content, excluded from this work.

IMPLEMENTED: authoritative receipts/redaction, five vital acquisitions, monitoring policy, committed equipment triggers, trusted elapsed-time delivery, compressed duration integration, atomic/retry safety, bounded review hosts, tests and two-case proof.

EXPO_SUPPORTED: local memory-backed fresh successor Sessions, explicit duration fixtures, two-second server snapshots, static fallback, no dependency on optional providers. Review/medical/media/curriculum gates remain open where previously pending.

DEFERRED_POST_EXPO / later authorized scope: reliable pulse-ox finger attachment; monitor detach/cycling policies; general clinical action duration authoring/review; production host authentication/persistence operations. No continuous NIBP is implied. Shared catalogues, compound orders, new examination findings, Practice/Assessment changes, final encounter lifecycle and final UI design are not implemented here.

Remaining WP1 blocking defect: **none found in the focused verification**. Owner has authorized WP1 technical closure and one scoped local checkpoint. Prior passing implementation evidence is reused; closeout validation is limited to documentation/status, whitespace, protected-path preservation and secret/staging sanity. No broad suites or live providers are rerun. This closure is not approval of clinical content. Next authorized work would be **WORK PACKAGE 2**; it is not started here.
