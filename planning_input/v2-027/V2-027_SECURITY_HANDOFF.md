# V2-027 Security / Privacy / Budget Hardening — CLOSED

Closeout: 2026-09-24. Technical implementation and verified trusted-local,
synthetic two-case Expo scope are accepted. `EXPO_SAFE` applies only within the
boundaries below; `PRODUCTION_PENDING` items remain explicit, accepted limitations
of this Expo scope, not completed production hardening. Remaining Expo blockers: none.

Baseline: `e90bff1439bc2d11c8a7d9b2da1f90268c5e9aff`, `v2-development`.
Scope: synthetic, owner-operated, loopback Expo demo. No production security
certification, deployment, medical approval, new live provider request or key rotation.
STEMI and Dana remain **UNDER_REVIEW / REVIEW_ONLY**, physician review pending.
V2-022 diagnostic-media discrepancy/review and unresolved clinical/curriculum
sources are unchanged. V2-021–026 remain closed at their established boundaries.

## Concrete hardening

1. **Case/Session voice binding:** broker catalogue membership previously sufficed
   for a TTS profile after Session authorization. With both profiles in one
   catalogue, that allowed a different patient's trusted profile to be selected.
   `/v1/voice/token` now requires an injected trusted `resolve_voice_profile`
   match against the authorized, loaded Session. Missing/mismatched binding is
   403, before minting. STEMI/Dana hosts bind only their boot-created Session.
   No global default, client Voice ID, Case-schema change or protocol change.
   Other compositions must supply this binding to enable TTS; STT is unchanged.
2. **Provider redirect refusal:** the default OpenAI HTTP transport now uses
   `redirect: "error"`, like the existing ElevenLabs path. A redirected request
   cannot silently forward a prompt/body to a different endpoint. Provider/model,
   frozen instructions, schemas, reasoning and output budgets are unchanged.
3. **Interpreter spend/replay:** same principal + Session + utterance identity
   shares one pending/completed result. Different content conflicts; a changed
   authoritative state version requires a new utterance. Failed outcomes remain
   tombstones, not free retries. At most 64 distinct utterances per Session and
   512 retained entries per service lifetime; exhaustion fails closed without
   clinical mutation. This is process-local, not a durable billing ledger.
4. **Patient spend ceiling:** 64 committed QUESTION_ASKED claims per Session,
   including provider failures. New requests over the limit fail before append
   or provider use; an exact durable replay still works. No clinical event or
   PatientState is invented by this check. Normal authored action flow is unchanged.
5. **Local review containment:** V2-021/024/025/026 launchers refuse explicit
   `NODE_ENV=production` before composition/credential access. Session review hosts
   forward only their boot-created Session routes, not new Session creation,
   foreign Sessions, Faculty writes, publication or a generic AI endpoint. This
   closes a way to evade the Tutor's per-Session limit through new review Sessions.
6. **Private API caching:** `/v1/*` responses, including denied requests, set
   `Cache-Control: no-store`, `Pragma: no-cache`, and `X-Content-Type-Options: nosniff`.

## EXPO_SAFE — verified boundaries

- Authorization still precedes provider/clinical access. Verified principal,
  membership/institution and exact artifact/Session pins determine access, not
  token claims or browser role fields. Real PostgreSQL/RLS contracts are unchanged;
  this pass exercised their API boundary with synthetic repositories, not a new
  remote deployment or database penetration test.
- Bidirectional tests use the actual Dana and STEMI review artifacts: foreign
  Session/result/profile access is denied; swapped artifact authority is denied;
  each state projection selects its own manifest. Patient contexts contain only
  that Case's allowed facts. Existing action, treatment, assessment, media and
  static-fallback pinning tests remain green. Shared ED presentation is intentional.
- Faculty writes remain metadata-only DRAFT operations with role/institution and
  revision checks. No review/approve/publish operation exists. Drafts survive
  refresh, not host restart. Faculty demo does not forward clinical API writes.
- Strict input contracts reject client vitals, state, result, diagnosis truth,
  effects, score, critical findings, publication state and provider configuration.
  Action intent still needs deterministic Session/Clinical Engine execution.
- Patient AI receives only allowlisted patient knowledge/manifestations; invalid
  grounding or mutation-shaped output degrades safely. Interpreter output is
  non-authoritative catalogue-bound intent. Tutor can select supplied evidence
  identifiers, never scores/actions/citations/official curriculum approval.
  RAG remains educational evidence only, cannot ingest Case truth/rubrics or mutate
  clinical state, and preserves institution/source/hash filtering.
- OpenAI outage/invalid output -> safe Patient fallback or unavailable Interpreter;
  manual clinical actions remain. Tutor/RAG outage -> deterministic assessment
  remains. ElevenLabs outage -> text remains. Visual failure -> case-specific
  static fallback. No provider failure grants clinical execution or publication.
- Logs use fixed error codes and whitelisted capability/timing/usage metadata.
  No raw provider bodies, credentials, hidden prompts or microphone audio are
  logged by the audited API/gateway/patient/interpreter/voice runtime paths.
  Authored synthetic conversation transcripts are intentional Session evidence,
  not logging; institutional retention policy remains future deployment work.

## Provider budget inventory

| Boundary | Enforced behavior |
| --- | --- |
| Patient | 64 claims/Session; durable exact replay; 32,000 input characters; 256 output tokens; 8s/attempt; at most 2 transport attempts |
| Interpreter | 64 distinct utterances/Session, 512 process entries; in-flight coalescing and failed-outcome retention; 32,000 input characters; 1,536 output tokens; 8s/attempt, at most 2 |
| Tutor | 2 generations/Session/locale (4 maximum over two locales); evidence/request caching; 512-entry cache bounds; 1,000 output tokens; one 22s attempt; deterministic fallback on exhaustion |
| Speech mint | 6 attempts/principal/Session/10min; failed/in-flight keys tombstoned for 15min; 512-entry bounds; 5s timeout; no redirect or automatic retry |
| Speech browser | explicit learner playback/record; local audio replay reuse; no background generation loop; 15s recording maximum + bounded 5s finalization; TTD 10s acquisition / UI 12s watchdog |
| STEMI/Dana live proof | explicit owner opt-in; one provider invocation/HTTP attempt and one TTD mint per trusted host boot; exact allowed question; consumed identity returns safe code |

No new pricing/model decision or monetary ceiling is claimed. Existing trusted
gateway capacity rejection remains active. Fixed limits are safety stops, not
distributed quotas; restart/new service instances reset process-local controls.
Timeout cancels local work but cannot guarantee the provider did not bill it.
No blind retry of an ambiguous live proof is introduced.

## Dev/Expo helper inventory

| Helper | Classification / restriction |
| --- | --- |
| V2-021 and V2-026 review hosts/bootstrap | EXPO_SAFE on trusted loopback; synthetic Faculty principal, fresh boot namespace, exact local Host/Origin checks, no client environment injection; MUST NOT SHIP as production authentication |
| V2-021/026 live-proof wrappers | DEV_ONLY, separately opt-in, one-question/one-token budget; no credentials read without authorization flags; not a production provider composition |
| V2-022 media review composition | DEV_ONLY offline fixture/coordinator helper; not a deployed server |
| V2-023 knowledge proof/synthetic registry fixtures | DEV_ONLY technical evidence; no real source promoted or ingested |
| V2-024 review host / Tutor test double | EXPO_SAFE loopback; fallback by default, live/test mutually exclusive; single boot Session; test double is labelled and MUST NOT SHIP in production path |
| V2-025 Faculty host/store | EXPO_SAFE local metadata sandbox; fixture principal and in-memory drafts; MUST NOT SHIP as production authorization/persistence |
| V2-020 Voice Smoke | DEV_ONLY explicit launcher, fixed loopback origin/session, bounded token broker, isolated Vite environment; excluded from production browser build |
| Local WAV speaking fixture, forced GLB failure and review time advance | DEV_ONLY automated/visual-review controls; REMOVE FROM PRODUCTION entry graph, not from Expo/test sources; no provider calls or clinical override authority |
| Lab files, recordings, ignored test-results | local owner/test artifacts only; not production inputs or staged deliverables |

Existing already-running hosts must be restarted in the owner's configured
terminal to activate launcher changes. This task neither reads/transfers that
environment nor restarts a trusted live proof or consumes provider quota.

## PRODUCTION_PENDING / POST_EXPO_HARDENING

- Local Expo hosts deliberately trust the local machine/operator, not a signed-in
  institutional user. Host/Origin/Fetch-Site checks are browser defenses, not
  authentication against a local process that can forge headers. Do not bind
  them to a LAN interface, tunnel them, or deploy them. Vite also serves development
  source to the local operator; this is not a confidential production asset server.
- Speech tokens are single-use **capability** bearer tokens. API issuance is
  Session/profile authorized, but provider-side enforcement of Session identity,
  exact text and voice selection is NOT claimed. A malicious bearer can construct
  its own provider frames. Server-mediated synthesis/stronger provider scope and
  distributed usage quotas are production hardening, not implemented here.
- Static synthetic GLB/diagnostic assets are publicly packaged and some are
  precached for Expo resilience. Session APIs control clinical availability and
  which asset is displayed, but assets are not confidential or access-controlled
  by direct URL. Production assessment secrecy needs a reviewed delivery design.
- Shared durable principal/institution spending quotas, distributed Interpreter
  replay, service-wide admission/rate limits, circuit policy and operations
  alerts remain deployment work. Do not scale this memory-only protection as if
  it were a dollar billing cap. Existing persistent clinical idempotency is unchanged.
- Internet deployment requires reviewed CSP/connect-src, authenticated routing,
  transport/proxy body/rate limits, retention/consent/residency and secret-manager
  policy. No remote Supabase, production region or real patient data is authorized.
- Rights/physician/curriculum gates remain independent and open. No retrospective
  key rotation is required by this pass; no exposure was found. Regex scans cannot
  prove absence of all possible secrets or inspect binary screenshot/video pixels.

## Verification (2026-09-24; no external provider I/O)

- Affected Browser suite: **347/347 PASS**, 27 files (API/auth, new adversarial
  checks, Faculty, Patient/Interpreter, gateway/provider, Tutor/RAG, Voice, Dana
  clinical isolation and visual/media fallback). No broad full-project verify.
- Final targeted two-case file: **8/8 PASS**, including one additional regression
  exercising Dana's actual review composition with a synthetic broker. **348
  distinct Browser tests** covered across the two runs; no live proof repeated.
- Deno: **15/15 PASS**, eight files, including exact Browser/Deno two-case snapshot.
- Local host guard Node tests: **3/3 PASS**. Injected-I/O live-wrapper regressions:
  Dana **6/6 PASS**, STEMI **9/9 PASS**; synthetic transports only.
- Typecheck and production build: PASS, exit 0. Existing >500 kB chunk warning only.
- Portability/deterministic-engine/authority guards: PASS.
- Secret/bundle scan: PASS for repository text, production bundle text and small
  local text diagnostics. Values are never printed; environment and binary proof
  media are not inspected. Only explicitly synthetic fixture literals and the
  existing comment-only `.env.example` are exempted from credential heuristics.
- Implementation verification checkpoint: `git diff --check` PASS, with no files
  staged and no commit or push at that point. Local Lab remains the pre-existing
  untracked directory, untouched by implementation and closeout.
- V1, frozen Logical/Physical Architecture, prior ADRs, both clinical content trees,
  both public visual/media packages and Visual Patient Lab are unchanged.

Run `npm run test:v2-027` for the focused reproducible gate; subcommands allow
reuse of unchanged passing checks. Final closeout reuses the passing evidence
above; only closure documentation changes after that verification. One scoped
local V2-027 closeout commit is authorized; no push, new provider call, production
deployment, medical-review closure or V2-028 implementation is included.
