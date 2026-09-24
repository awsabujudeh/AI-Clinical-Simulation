# V2-028 — Expo Preflight / Observability / Operator Readiness

Implementation on V2-027 baseline `6804472bc84a64b6e2fad3208aefe61474bd9b8b`.
**V2-028 Expo Preflight / Observability / Operator Readiness — CLOSED.**
Scope: trusted operator, synthetic local Expo only. No production auth claim,
medical approval, provider reevaluation, global redesign or V2-029 work.

## Operator entry and procedure

From `C:/Projects/AI-Clinical-Simulation/v2`:

1. Start only intended review hosts; restart existing ones **in their original trusted terminals**. Do not
   move credentials between processes or enter them in the browser/chat.
   - Khalid: `npm run dev:v2-021` → `http://127.0.0.1:4186/`
   - Dana: `npm run dev:v2-026` → `http://127.0.0.1:4194/`
     (existing approved alternate port: `npm run dev:v2-026 -- --port=4195`).
   - Tutor: `npm run dev:v2-024` → `http://127.0.0.1:4192/`
   - Faculty: `npm run dev:v2-025` → `http://127.0.0.1:4193/expo`
2. Run `npm run dev:v2-028`. Open
   **http://127.0.0.1:4200/expo/preflight**. No credentials are necessary to use
   the local structural preflight; absent provider configuration is reported.
3. Require no critical BLOCKED checks. A stale/unverifiable active review host
   requires restart/stop in its own terminal. Re-run Preflight after restarting.
4. Inspect degraded items and accept only the intended fallback demo. Configured
   does not mean live-connected, quota-available, medically approved or offline-ready.
5. Only if separately authorized, perform the existing bounded live proof on its
   own review host. Then open the appropriate Hero Demo. Preflight itself never
   issues a question, interpretation, Tutor generation or voice token.
6. Keep local hosts running throughout the demo. Restart loses memory-only
   Sessions/drafts/quotas; restarting is not production recovery or a spend ledger.
7. After a commit or executable-source change, restart the operator with
   `npm run dev:v2-028` as well as any intended review hosts: boot identity includes
   both commit and source fingerprint. Re-run Preflight before presenting.

Do not bind these fixture-authenticated hosts to LAN, tunnel them or deploy them.

## Architecture / non-mutation

- `runtime/preflight-model.ts`: strict operator report and boot metadata; explicit
  three-state aggregation. No clinical/event/score authority.
- `runtime/preflight-domain.ts`: reuses existing Case validation/review compiler,
  pinned immutable Session initialization, Clinical Engine due evaluation **at
  the unchanged initial time**, evidence projection, six-domain assessment,
  Patient context projector, Tutor fallback and Faculty/RAG boundaries. Fresh
  isolated memory only; no owner Session/adapter or clinical action submission.
- `scripts/preflight-assets.mjs`: existing manifests, SHA-256, GLB structure,
  clips/shapes/coverage, shared environment and paired local diagnostic files.
  Never opens Blender or writes assets. Separate primary/fallback result per case.
- `scripts/review-readiness.mjs`: safe boot metadata on existing local hosts at
  `GET /__operator/readiness`, inside their existing Host/Origin guard. No patient
  facts, Session IDs, raw Voice IDs, key/token, prompt or provider body. V2-027
  ancestry plus source digest proves local version correspondence, not remote
  attestation. Current source modifications require a restart; matching HEAD
  alone is insufficient. A legacy host without metadata is not trusted as ready.
- `scripts/v2-028-preflight-host.mjs`: separate local operator composition using
  the existing Vite/React app structure. `/expo/preflight` is not imported by the
  production Student entry. Private POST `/__operator/preflight` requires exact
  local Host/Origin plus a non-simple header, no input body/query. Responses are
  no-store/nosniff, framing denied. No `/v1` forwarding or arbitrary command/URL.
- Probe targets are fixed loopback review ports 4186, 4192–4199; bounded 1.2s,
  4 KiB, redirect-refusing GETs only. Malformed/extra-field/foreign-case/stale
  metadata fails closed. No external network probes.
- Concurrent rechecks coalesce. Logs contain only generated run ID, overall
  status/counts/duration. Unexpected failure returns `PREFLIGHT_UNAVAILABLE`,
  never an exception body/stack. Browser clears previous status while checking
  or on failure instead of retaining a stale green result.

## Classification

| Situation | Status |
| --- | --- |
| Required local Case/schema/initial Clinical/assessment path fails | BLOCKED |
| Primary 3D and verified static fallback both missing/corrupt | BLOCKED for that patient |
| Primary 3D unavailable, pinned static fallback valid | DEGRADED; no live examination claim |
| 3D valid, fallback missing | DEGRADED; reduced resilience |
| Active host stale/unverifiable or operator source changed after boot | BLOCKED; restart exact host |
| Host not running | DEGRADED; packaged foundation is not running-demo proof |
| Provider/profile missing | DEGRADED; manual actions/text/assessment remain |
| RAG technical failure | DEGRADED; deterministic feedback survives |
| Pending physician/rights/curriculum sources | Informational; never silently approved |
| All measured requirements pass | READY for measured scope only; live NOT_PROBED |

Summary includes critical blockers, degraded count and eight informational items.
READY never implies live provider success. There is no manual live button because
that would duplicate the approved, separately opt-in proof boundary and risk
resetting budgets. Recheck cannot issue tokens, execute actions or consume a proof.

## Measured coverage and truthful limitations

- Khalid/STEMI **2.0.1**, Dana/Anaphylaxis **1.0.0**: independently validated,
  hash-bound to their media packages, UNDER_REVIEW / REVIEW_ONLY. ar-JO contexts
  contain only own-case allowed facts. No live context text is returned to operator.
- Actual primary/fallback byte hashes checked, no external GLB resource URI.
  STEMI animation/face references resolve; Dana single rig, blink/mouth/anxious/
  improved/thoracic shapes and opaque examination coverage resolve. Bed/pillow/
  blanket/headwall, shared runtime/camera/Cover/Reset/equipment/adapters checked.
  This is structural integrity, not a new visual acceptance or GPU/audio test.
- STEMI ECG/CXR and paired reports checked. Right ECG/echo, Dana investigations
  remain authored text/media-pending. **84 bpm image report vs 112 bpm Case** is
  unchanged; physician matching/rights review remains open.
- Secure Gateway policies: Patient `gpt-5.6-terra`, Interpreter `gpt-5.6-luna`,
  Tutor `gpt-5.6-terra`. Operator-process key **presence only**, and running
  Patient/Tutor host configuration are distinguished. Interpreter policy
  availability is not an assertion that a review host enables live interpretation.
- Voice: each own running host must confirm successful trusted profile/broker
  composition. A shared local voice environment variable is not proof that both
  patient mappings exist. Existing ElevenLabs/`ttd_websocket`/
  `eleven_v3_conversational` path unchanged. No raw profile ID or token displayed.
  Configuration does not prove remaining proof budget, current account credit,
  live connectivity or browser autoplay/audio output.
- RAG: eight registered source records, **zero trusted real documents**. Guidelines
  SOURCE_PENDING; JU/JUST CURRICULUM_SOURCE_PENDING; objective IDs remain
  UNKNOWN_PENDING_SOURCE_REVIEW. No ingest, citation fabrication or new source.
- Assessment: six domains and immutable evidence packet checked for both cases;
  absent Tutor gives TEMPLATE_FALLBACK with no external citations. Review snapshot,
  not production finalization. AI/RAG failure cannot remove deterministic results.
- Faculty: catalogue/details, metadata-only DRAFT schema, role rejection and no
  publish/approve store operation. **SERVER-MEMORY DEMO**: refresh yes, restart no.
- Local packaged assets remain usable without external providers while local host
  is running. Built PWA shell/static image precache exists; GLBs and authoritative
  Sessions are **not** a complete browser-only offline execution bundle. Review
  hosts do not install the production service worker. No device cache integrity,
  storage capacity or release-specific warm-up receipt is asserted. `cache` remains
  DEGRADED rather than falsely certifying Level C offline readiness.
- External AI/voice require network; text/manual actions, initial Case validation,
  local visuals and deterministic assessment do not require provider network.
- Production DB health, authenticated institutional operator access, persistent
  telemetry/Sentry, distributed rate/cost dashboards and Level C receipt UI remain
  outside this trusted-local preflight implementation. V2-027 limitations persist.

## Safe diagnostics / evidence

`CASE_VALIDATION_OR_HASH_FAILED`, `PATIENT_CONTEXT_INVALID`,
`ASSESSMENT_UNAVAILABLE`, `VISUAL_ASSET_MISSING`, `ASSET_HASH_MISMATCH`,
`STATIC_FALLBACK_MISSING`, `PRIMARY_AND_FALLBACK_UNAVAILABLE`,
`DIAGNOSTIC_MEDIA_UNAVAILABLE`, `VOICE_CONFIGURATION_MISSING`,
`AI_CONFIGURATION_OR_HOST_MISSING`, `STALE_REVIEW_HOST`, `STALE_PREFLIGHT_HOST`,
`REVIEW_HOST_NOT_RUNNING`, `RETRIEVAL_UNAVAILABLE`, `BUILD_CACHE_UNVERIFIED`,
`LOCAL_SERVER_REQUIRED_OFFLINE_NOT_CERTIFIED`, `PREFLIGHT_UNAVAILABLE`.

Focused commands:

- `npm run test:v2-028` (typecheck, focused Browser/Node/Deno, build, portability).
- `npm run test:v2-028:playwright` (one actual-app scenario plus injected failure).
- `git diff --check` from repository root.

Actual-app proof files (ignored, never committed):

- `v2/test-results/v2-028-owner-review/preflight-actual.png`
- `v2/test-results/v2-028-owner-review/preflight-injected-failure.png`

Injected failure is a named server-only test composition on port 4201 that makes
the Dana asset reader fail. No physical file/env/clinical state is changed. Dana
becomes BLOCKED; Khalid and Clinical Engine remain READY. Page load/recheck makes
zero external provider requests and no `/v1` requests.

Playwright uses a dedicated `test-results/v2-028-playwright` output directory,
avoiding shared output cleanup/locked earlier review logs. If the two **task-owned**
test hosts were started explicitly, PowerShell may set
`$env:V2_028_REUSE_TEST_HOSTS='1'` for this one test command; assertions remain
identical. Default is fresh hosts. Do not reuse a live proof host as a test fixture.

## Verification — 2026-09-24

- **22 distinct Browser tests PASS**: 8 new preflight tests plus 14 existing
  V2-027 security regressions. Final preflight-only rerun: 8/8 PASS.
- **12 Node tests PASS**: 9 preflight checks plus 3 preserved review-host guards.
- **1 Deno test PASS**; Browser and Deno share exact domain snapshot SHA-256
  `ea126ec5c885747ae4005ff1cac481b61986aa6466e1da5331b416be5bcf5f17`.
- **1 actual-app Playwright scenario PASS**, fresh test hosts, exit 0. Includes
  both cases, local assets, source/review status, recheck, wrong-Origin/body/API
  denial and injected Dana primary+fallback loss without clinical mutation.
- Typecheck PASS; production build PASS (unchanged >500 kB chunk warning);
  portability/authority guards PASS; scoped secret/bundle/text-artifact scan PASS;
  `git diff --check` PASS. No full historical suite or external live proof run.
- Initial observed machine report: **BLOCKED**, one host-readiness blocker, four
  degraded components. Existing ports **4194, 4195 and 4197** are active but cannot
  prove the new hardened heartbeat. These owner hosts were NOT stopped, restarted
  or used for a live request. Restart/stop those exact hosts in their own trusted
  terminals before the demo. The Clinical Engine, both cases, visual/fallback
  packages, RAG foundation, assessment and Faculty foundations all report READY.
- Synthetic failure screenshot: Dana visual BLOCKED with
  `PRIMARY_AND_FALLBACK_UNAVAILABLE`; Khalid and Clinical Engine remain READY.
- Initial Playwright default shared-output cleanup removed earlier disposable
  test outputs before stalling on a locked prior review-log folder. The new
  dedicated output directory prevents recurrence. No tracked file or Lab source
  was removed, and no live-provider proof was repeated. Fresh-server Windows
  teardown required terminating only the two exact Playwright-owned server PIDs
  after the scenario passed; the runner then exited 0.

## Final operator closeout — 2026-09-24

The three obsolete Dana visual-review instances were identified by listener PID,
`node.exe` command line and parent command before stopping:

| Port | Historical PID | Command | Classification / action |
| --- | --- | --- | --- |
| 4194 | 29444 | `node scripts/v2-026-review-host.mjs` | September 21 review instance; stopped |
| 4195 | 31700 | `node scripts/v2-026-review-host.mjs --port=4195` | Earlier offline visual-review instance; stopped |
| 4197 | 36532 | `node scripts/v2-026-review-host.mjs --port=4197` | Earlier offline owner-review instance; stopped |

These are historical PIDs, not reusable cleanup commands. For future cleanup,
identify the current listener with `Get-NetTCPConnection -State Listen` and its
command with `Get-CimInstance Win32_Process`; never print environments or raw
credential-bearing arguments. Prefer Ctrl+C in the owning terminal. Here Windows
refused ordinary console-process termination; only the three revalidated server
PIDs were terminated with `taskkill /PID <verified-PID> /F`. Parent terminals,
unrelated processes and credentials were untouched. No historical host was
restarted merely to obtain a green indicator. Their disposable in-memory Sessions
ended; this is not durable recovery. No file was removed during closeout.

Final real-machine recheck at **http://127.0.0.1:4200/expo/preflight**:

- Route HTTP **200**; actual operator page opened and **Re-run Preflight** used.
- Overall **DEGRADED**, **0 critical blockers**, **5 degraded components**, and
  **8 informational/review-pending items**. Stale-host detection is unchanged.
- Clinical Engine, both case packages/isolated patient contexts, both primary
  visuals/static fallbacks, shared ED, local diagnostic assets, deterministic
  assessment/Tutor fallback, RAG foundation and Faculty foundation: **READY**.
- AI configuration: **DEGRADED** because intended Patient/Tutor hosts are absent.
  Operator key-presence check is positive, but is not a connectivity proof.
- Khalid Voice and Dana Voice: **DEGRADED**; no current host confirms either live
  binding. No inference about provider credit, audio output or live availability.
- Review hosts: **DEGRADED / NOT_RUNNING**, deliberately not resurrected during
  closeout. Start the intended demo using the exact commands above before
  presenting. Local foundations passing does not claim a running Hero Session.
- Offline/cache: **DEGRADED**; keep localhost running. Manual actions, text,
  deterministic assessment, Tutor template and packaged visuals are verified
  fallback capabilities, not certification of browser-only offline execution.
- **0 provider requests; 0 clinical Session mutations.** No live proof repeated.

Both cases remain **UNDER_REVIEW / REVIEW_ONLY**. Physician/media-rights review,
the ECG 84 vs 112 bpm mismatch, zero trusted real RAG documents, JU/JUST pending
sources, and production-only hardening remain explicitly open. Faculty persistence
remains **SERVER-MEMORY DEMO** (refresh yes; host restart no).

Existing focused verification above is reused without another broad test run.
Closeout adds only documentation; final diff, secret/artifact and protected-path
checks accompany the scoped commit. Restart the operator after that commit to
capture its new HEAD; leave the operator available for the next pre-demo check.

**V2_028 — CLOSED** for this trusted-local operator scope, not full production or
live-provider readiness. Next planned task: **GLOBAL UI/UX FINALIZATION PASS**;
not started here. No push, UI redesign, clinical/asset/Voice change or V2-029 work.
