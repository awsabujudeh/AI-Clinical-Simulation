# BALSIM Simulation UX + Functional Contract Audit

Date: 2026-09-25

Status: **READ-ONLY AUDIT COMPLETE — NO IMPLEMENTATION / NO REVERT**

Branch: `v2-development`

Verified HEAD: `589b8f33fe0e0d8663c63a27d837514d25beafa5`

## Scope, method and counting

This report is the sole file authored for the owner's audit request. Existing rejected UI WIP is retained, not approved. V2-021–028 remain closed at their previously accepted scope; this report identifies gaps against the **new locked contract**, not retroactive failure of those milestone scopes. No source, clinical content, assets, tests, frozen Architecture, ADRs or Visual Patient Lab files were changed. No tests, providers, clinical actions, commit, push or V2-029 implementation were performed for this audit.

Evidence: current source/contracts/routes, case definitions, relevant test assertions, the existing verification handoffs and existing actual-app gallery. The saved `02-bright-case-selection.png` and `03-bright-khalid-active.png` were also opened for visual inspection. These are existing captures, not a new running-browser or live-provider verification. The previous WIP report records 146 Browser tests, 12 host checks and one actual-app scenario; those historical passes are not certification against this newly locked UX.

The brief's sections 0–32 are decomposed into **58 auditable checks**, not 58 independent engineering projects:

| Classification | Count |
| --- | ---: |
| EXISTS | 13 |
| PARTIAL | 32 |
| MISSING | 3 |
| CONFLICT | 8 |
| DEFER_POST_EXPO | 2 |
| Total | 58 |
| EXPO_REQUIRED gaps (PARTIAL/MISSING/CONFLICT only) | **38** |
| EXPO_NICE_TO_HAVE gaps | 5 |
| POST_EXPO deferred checks | 2 |

The 38 required rows consolidate into the ten implementation work packages in section G. A row can be PARTIAL even when the underlying primitive exists: a functioning primitive is not the same as a complete actual-app journey. A CONFLICT is an observable incompatibility with a locked requirement. Impact Layer indicates the principal boundary; MULTI_LAYER is used when a presentation-only fix would be unsafe. Source references S01–S18 resolve to exact paths/symbols in section I.

Recommendation: **SELECTIVE_SALVAGE**. Do not blanket-reset the WIP, and do not adopt the rejected shell unchanged.

## Requirement matrix

| Requirement | Current Status | Evidence / Current Implementation | Gap | Impact Layer | Expo Priority | Recommended Fix | Dependencies |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R01 (§0) Preserve deterministic/core authority | EXISTS | [S01–S05, S12–S16] Existing Clinical/Session/Assessment engines, pinned cases, Voice, Tutor/RAG and two patient assets remain separate from presentation. | Preservation obligation, not a rewrite. | MULTI_LAYER | EXPO_REQUIRED | Keep these boundaries and existing accepted case/assets byte-stable unless a separately reviewed contract change is required. | All later work |
| R02 (§1) Salvage rejected WIP safely | PARTIAL | 34 tracked modified files plus 35 scoped new files; visual and behavioral hunks are mixed. No staged files. | Whole-file retention or blanket reset would both lose useful distinctions. | UI_ONLY | EXPO_REQUIRED | SELECTIVE_SALVAGE at hunk level; exact groups in B. Do not revert during this audit. | Owner approval of plan |
| R03 (§2) Fixed desktop encounter shell | CONFLICT | [S06] Grid explicitly stacks monitor, patient/actions, investigations/timeline, then assessment. Existing 1440×900 screenshot cuts off active content. | Document scroll can remove patient, time, vitals and navigation. | UI_ONLY | EXPO_REQUIRED | Bound encounter to available viewport; only active contextual content scrolls. Define small-screen/zoom accessibility separately. | R04–R06, R48 |
| R04 (§3) Persistent top bar / vitals / End | PARTIAL | [S06] Brand, language/theme, patient header, mode and time exist; End/review control lives in assessment section. | Split normal-flow headers; End Encounter is not a persistent top-bar operation. | UI_ONLY | EXPO_REQUIRED | Consolidate presentation without moving end authority into UI; keep stale/paused/Review labels truthful. | R10, R21, R47 |
| R05 (§3) One active right clinical domain | PARTIAL | [S07] Six requested domain tabs already exist; only selected action domain renders. | Investigation results, activity and assessment remain independent page sections rather than contextual content. | UI_ONLY | EXPO_REQUIRED | Reuse six-domain selection; route results/forms into the active panel instead of adding more page sections. | R03, R23, R48 |
| R06 (§3,18) Persistent simple Talk affordance | PARTIAL | [S07,S10] Conversation is mounted only in History; changing tabs unmounts it. | Cannot talk while inspecting another domain; draft input/audio lifecycle may be interrupted on tab change. | UI_ONLY | EXPO_REQUIRED | Keep one conversation controller mounted in persistent patient context; preserve editable STT and explicit send. | R03, R36 |
| R07 (§4) Authoritative count-up from 00:00 | EXISTS | [S01,S02,S06] Both case initial times are zero; Session clock is RUNNING/PAUSED with trusted anchors; UI formats projected elapsed Clinical Time. | No default countdown found. Audio/animation clocks are presentation-only. | RUNTIME_ONLY | EXPO_REQUIRED | Preserve Session-owned time and pause/no-catch-up semantics; never derive medical time from render frames. | R10 |
| R08 (§4,5) Authored action/measurement time costs | PARTIAL | [S02,S03] Coordinator synchronizes due work before commands; async case effects use authored delays. Core also has explicit compressed advancement. | No generic per-measurement duration/occupation contract in the two Expo catalogues; external command path does not assign an automatic duration to every action. | MULTI_LAYER | EXPO_REQUIRED | Author measurement costs and completion semantics in pinned policy; keep ordering, completion and time compression distinct. Do not make every action a blocking jump. | R11–R16, medical review |
| R09 (§4,14) Parallel investigation timing | EXISTS | [S03] ASYNC_PARALLEL definitions, independent milestones and due-work scheduler; separate result/image/report visibility. | Do not replace this with UI delays or sequential wait screens. | CLINICAL_ENGINE | EXPO_REQUIRED | Preserve scheduler chronological closure, budgets and failure/interrupt behavior. | R10 |
| R10 (§4) Continuous authoritative time/results delivery | PARTIAL | [S02,S06,S17] getPatientState loads/projects without sync; SessionPage has no polling; command intake syncs. UIUX review host advances only through bounded explicit trusted-time fixture calls. | A running label does not establish continuously updated authoritative time. Merely polling the current GET would not itself advance it. | MULTI_LAYER | EXPO_REQUIRED | Choose a trusted synchronization/publication cadence using existing coordinator; refresh safe state/results accordingly; reconnect catches up through scheduler. UI displays, not authors, time. | R07–R09, secure adapter/host boundary |
| R11 (§5) Separate hidden true vitals from acquired observations | CONFLICT | [S04] projectObservations derives all values; safeSessionProjection transmits them immediately; ClinicalMonitor renders them unconditionally. | No unmeasured/acquired/source/sample-time contract. Hiding numbers with CSS would still disclose them over API/cache. | MULTI_LAYER | EXPO_REQUIRED | Add server-owned learner observation acquisition projection; retain true PatientState. Explicitly author any pre-measured starting facts. | Case/policy schema, Session evidence, recovery cache, medical review |
| R12 (§5) BP measurement → time → cuff → reading | PARTIAL | [S05] STEMI hemodynamic exams and Dana combined-monitor action trigger cuff from committed events. | No discrete BP measurement completion/sample freshness/time policy; current BP is already exposed. | MULTI_LAYER | EXPO_REQUIRED | Reuse cuff projection; bind approved measurement actions to completed BP evidence and learner disclosure. | R08,R11,R44 |
| R13 (§5) SpO2 acquisition and monitoring | PARTIAL | [S01,S04] Dana monitoring explicitly includes SpO2; true SpO2 and oxygen response already exist. | No standalone acquisition state or finger-probe output; value appears before measurement. | MULTI_LAYER | EXPO_REQUIRED | Author supported acquisition/continuous channel semantics; project result and device only from committed evidence. | R11,R16,R45 |
| R14 (§5) Temperature acquisition | MISSING | [S04] Temperature has true-state numeric mapping and visible UI, but neither Expo action set defines temperature measurement. | No action, completion, measured value or measurement-time policy. | MULTI_LAYER | EXPO_REQUIRED | Add bounded Case-owned measurement support and safe observation state; no UI-created result. | R08,R11, authored timing |
| R15 (§5) HR and RR acquisition sources | PARTIAL | [S01,S04] Pulse/perfusion, ABCDE/respiratory and monitoring actions exist; true HR/RR mappings exist. | No contract linking a measured HR/RR to a specific completed exam/monitor source. | MULTI_LAYER | EXPO_REQUIRED | Map only clinically approved existing acquisition paths; distinguish intermittent RR assessment from continuous channels. | R11, medical review |
| R16 (§5) Continuous monitor activation/freshness | PARTIAL | [S01,S05] Case monitoring actions commit; equipment history persists. | No learner-channel active/stopped/stale acquisition model; currently all vitals track true state regardless of monitoring. | MULTI_LAYER | EXPO_REQUIRED | Define which committed action activates each channel, refresh policy, last sample and stale/offline behavior. | R10–R15 |
| R17 (§5,24) Device persistence and removal semantics | PARTIAL | [S05] Three device booleans are re-derived from committed event history, surviving reload/reprojection. | Current model is apply-only; no removal/stop lifecycle or initial-device declaration. | MULTI_LAYER | EXPO_NICE_TO_HAVE | Preserve apply-once persistence for Expo; label its limit. Add removal only with authored device policy, not UI toggles. | R44,R46 |
| R18 (§6) Safe neutral/amber/red vital classification | MISSING | [S04] Numeric monitor values are neutral; connection badge is green. Observation schema has numbers/rhythm, no severity bands. | No reviewed borderline/critical thresholds, contextual classification or non-color clinical status text. | CASE_SCHEMA | EXPO_REQUIRED | Obtain reviewed pinned severity policy and server-derived severity/label; UI only maps that to colors. Keep neutral until classified. | R11, physician-approved thresholds |
| R19 (§7) Validated live ECG waveform | DEFER_POST_EXPO | [S04,S11] Rhythm ID/display/waveform_descriptor exist; static ECG exists. No validated time-series morphology/HR synthesis path found. | Metadata is not waveform validation; static STEMI reference rate mismatch remains open. | CLINICAL_ENGINE | POST_EXPO | DEFER_POST_EXPO. Use authored rhythm/result text after proper acquisition; no decorative fake ECG. | Validated rhythm assets/algorithm and medical review |
| R20 (§8) Practice/Assessment disclosure separation | EXISTS | [S12] ACTIVE_ASSESSMENT_WITHHELD strips correctness; Practice exposes resolved findings; final evidence requires permitted phase. Tests explicitly cover both. | Clinical consequences are not correctness feedback; preserve that distinction. | ASSESSMENT_POLICY | EXPO_REQUIRED | Reuse current disclosure projector, not browser-only hiding; keep scoring deterministic and Tutor downstream. | R21,R22,R48 |
| R21 (§8,11) Two usable Expo modes and review end semantics | PARTIAL | [S06,S12,S17] Generic /app start offers both modes; UIUX two-case catalogue pre-creates PRACTICE_DEMO sessions. Review Tutor accepts Practice review snapshots, not production finalization. | No mode selection in actual two-case briefing; REVIEW_ONLY cannot use production /end. Assessment-mode review debrief cannot be obtained by relabeling Practice. | ASSESSMENT_POLICY | EXPO_REQUIRED | Approve explicit review-mode Assessment completion/disclosure semantics, then integrate mode selection/fresh session start. Never publish cases or relax production gates to enable demo. | Owner policy decision, R20,R25,R47 |
| R22 (§8) Timely Practice explanation/coaching | PARTIAL | [S12] Resolved category and committed Clinical-Time evidence appear; Tutor is evidence-bound. | Active feedback is generic, below encounter; no bounded authored explanation/hint policy bound to resolved findings. | ASSESSMENT_POLICY | EXPO_REQUIRED | Show concise resolved-action explanation from permitted authored evidence; do not disclose unresolved answer keys. Broader proactive hints are optional, not required here. | R20,R23, reviewed explanatory content |
| R23 (§9) Compact mode-safe activity | PARTIAL | [S08] Safe timeline includes committed action/result availability, sequence and Clinical Time; no raw scheduler/scoring data. | Standalone long panel; Practice feedback separate. No compact combined action/allowed-feedback presentation. | UI_ONLY | EXPO_REQUIRED | Use a compact collapsible activity sheet within the contextual area; join only server-permitted feedback by evidence IDs. Assessment stays neutral. | R03,R20,R22 |
| R24 (§10) No pre-diagnosis Student answer leakage | CONFLICT | [S01,S07,S17] Dana card/brief title says food-triggered anaphylaxis; diagnosis actions and some intervention aliases give answers. Khalid card uses a symptom-only title. | Student title projection incorrectly reuses Dana diagnostic title; narrow action options and coaching-like aliases leak likely answers. See detailed leakage inventory in H. | MULTI_LAYER | EXPO_REQUIRED | Dedicated learner-known briefing/title projection and neutral shared labels; keep diagnostic titles Faculty-only. Do not remove clinically earned results. | R11,R25–R32 |
| R25 (§11) Safe briefing and true encounter start | PARTIAL | [S01,S06,S17] Names, triage prose, setting and source demographics exist; catalogue Begin Encounter links to boot-created Session. | No unified learner-briefing contract for permitted age/sex/role/mode; Begin does not create a fresh Session or reset time. | MULTI_LAYER | EXPO_REQUIRED | Project allowed starting information, explicitly decide known measurements, choose mode, then obtain a fresh authorized Session; never reset existing Session client-side. | R21,R24, start security/budget policy |
| R26 (§12) Shared availability vs Case-specific outcomes | PARTIAL | [S03,S07] Generic ActionRequest/parameters/rules already separate intent and effects; safe catalogue is filtered exclusively from each pinned Case. | No common catalogue identity/version plus exhaustive per-Case outcome/unsupported matrix. Current two lists are materially different. | SHARED_CATALOG | EXPO_REQUIRED | Introduce minimum shared definitions compiled into existing pinned Case actions; preserve case-owned outcomes and membership validation. No runtime arbitrary sidecar. | R27–R32, Case hash/publication review |
| R27 (§13) Explicit outcomes, never fabricated normal | PARTIAL | [S03] Current investigations require authored diagnostic definitions/refs/milestones; unknown action IDs fail closed. Results are not LLM-generated. | No general shared-action unsupported/unavailable mapping for additions; no guarantee a new non-investigation action has a meaningful authored consequence merely because it is in a list. | SHARED_CATALOG | EXPO_REQUIRED | Require per-case authored result/effect, explicitly authored negative, or explicit unavailable mapping before exposing each shared option. Missing is never normal. | R26, validation coverage |
| R28 (§14) Bounded organized investigation catalogue | PARTIAL | [S01,S03,S07,S11] Search and scheduled result rendering exist; STEMI has 9 investigation actions, Dana 5; safe text fallback exists. | No shared categories or cross-case availability matrix; lab renderer registry is not a universal catalogue. | SHARED_CATALOG | EXPO_REQUIRED | Use only the bounded existing investigation union described in D; map each case or mark unavailable; no thousands of new results. | R26,R27,R29 |
| R29 (§14) Normal media and review-safe image mapping | PARTIAL | [S11] Packaged normal CXR candidate exists; STEMI ECG/CXR are REVIEW_ONLY; right ECG/echo and Dana images remain pending with authored text. | Library presence does not confer case validity/rights/physician approval. STEMI 84 vs 112 bpm discrepancy remains. | CASE_SCHEMA | EXPO_NICE_TO_HAVE | Preserve truthful review labels and text fallback; independently approve each mapping before adding assets. No generic normal-image reuse. | External physician/rights review, R27 |
| R30 (§15) Bounded shared medication choices | PARTIAL | [S01,S07] STEMI 8 medication actions include harmful/distractor branches; Dana 4 include repeat/adjunct actions. Not literally only correct choices. | Still narrow and case-specific; labels sometimes encode timing/indication. No shared drug→case-effect matrix. | SHARED_CATALOG | EXPO_REQUIRED | Use existing authored medication union only, separate neutral availability from case effect; no invented drug database or guessed cross-case effect. | R26,R27,R31 |
| R31 (§15) Dose/route intent vs authored order | PARTIAL | [S01,S03,S07] Generic parameter controls/validation and interpreter value preservation exist and have tests. | Both real case helpers use empty parameter_definitions; most doses/routes are pre-baked into action labels/IDs. Generic dose test fixtures are not real-case support. | MULTI_LAYER | EXPO_REQUIRED | Define bounded reviewed real-case parameters and exact value semantics, or explicitly retain fixed authored order variants. Never silently convert aspirin 300 into 324. | Medical/assessment review, R30 |
| R32 (§16) Shared procedures/support/monitoring | PARTIAL | [S01,S07] IV, oxygen, fluids, monitors, help/cath escalation exist as PROCEDURE/CONSULT; action domains combine them. | No shared subcategories or independent acquisition actions; doses/timing/prerequisites differ by case. | SHARED_CATALOG | EXPO_REQUIRED | Group existing support, access/fluids, monitoring, escalation and procedures; keep case-specific prerequisites/outcomes. Do not make unavailable options execute. | R08,R11,R26,R27 |
| R33 (§17) Manual action search and submission | EXISTS | [S07] Bilingual label/ID search, typed parameters, explicit proposal, configured confirmation, recovery journal and stale handling. | Search is domain-local; shared breadth is separate R26. | UI_ONLY | EXPO_REQUIRED | Retain manual path as authoritative fallback when AI/voice unavailable; do not auto-submit selection. | R26 |
| R34 (§17) Single-action AI Quick Order safety | EXISTS | [S09] MATCH is one non-authoritative candidate; catalogue reconciliation, missing/wrong value preservation, stale check and manual proposal. Duplicate/failure provider guards exist. | No clinical execution on interpretation alone. | MULTI_LAYER | EXPO_REQUIRED | Reuse existing interpreter and confirmation boundary; keep manual fallback and exact replay protections. | R26,R31 |
| R35 (§17) Compound Quick Orders | CONFLICT | [S09] Multiple intents deliberately yield AMBIGUOUS; frozen tests require compound commands remain non-executable. UI only loads one MATCH into form. | 'ECG and troponin' or 'IV and oxygen' is not a supported executable multi-order workflow. | MULTI_LAYER | EXPO_REQUIRED | Specify an explicit non-authoritative ordered candidate list with per-item review/commit/outcome and interruption/conflict semantics; update contract/evaluation deliberately, not a regex split or auto-execute loop. | Interpreter policy/schema review, R26,R34, regression evaluation |
| R36 (§18) Grounded text/STT/TTS with graceful fallback | EXISTS | [S10] Text form, editable STT review, explicit send, returned answer and explicit Play/Replay with playback-driven Speaking. Voice failure leaves text. | Automatic response playback is not implemented; providerless review host correctly reports unavailable, not live success. | MULTI_LAYER | EXPO_REQUIRED | Preserve components, privacy, approved providers and budgets. Persistent/simpler placement is R06; optional autoplay requires browser-consent/budget design. | R06, trusted host configuration |
| R37 (§19) Patient remains primary through workflows | CONFLICT | [S06,S07,S11,S12] Patient stays mounted on Session page, but page scrolling hides it during results, timeline, assessment and long forms; media modal covers encounter. | Mounted is not visible. History transcript/actions can exceed remaining desktop height; small-screen stack is longer. | UI_ONLY | EXPO_REQUIRED | Fix shell/context routing; explicit media zoom may temporarily focus an image, but routine results/actions must keep patient visible. | R03,R05,R48 |
| R38 (§20) Independent supported camera views | PARTIAL | [S13] Bounded manual camera/reset and internal named views/focus exist; external API exposes focus() and exam region reveal only. | No public Overview/Face/Chest/Arms/Overhead selector outside exam. Overhead not certified as a safe shared exposed preset. | VISUAL_PATIENT | EXPO_REQUIRED | Expose only verified shared presets without entering/revealing exam; QA both patients. Do not advertise Overhead until bounded and verified. | Existing camera runtime, visual QA |
| R39 (§21) Independent supported patient positions | PARTIAL | [S05,S13] Semi-Fowler/Supine and transition support exist; exam enters Supine and restores prior position. | No independent user position control/API; authoritative presentation may reapply position. | VISUAL_PATIENT | EXPO_REQUIRED | Define presentation-only pose override/reconciliation for these two supported positions; no physiology/scoring effects from pose selector. | Authority decision, shared runtime QA |
| R40 (§22) Inspection and authored exam-result delivery | PARTIAL | [S01,S07,S08,S13] Region reveal/Cover/Reset and Dana rash/breathing work; case EXAM_FINDING facts exist; pointer emits intent and opens Examination tab. | No learner exam-result projection/card found: action/timeline returns action label, not after_exam fact text. Visual wording promises findings more than current text path delivers. | MULTI_LAYER | EXPO_REQUIRED | Bind confirmed exam to explicit authored fact references and safe findings projection; show only available findings; pointer remains non-authoritative. | Case exam mapping, disclosure policy, R23 |
| R41 (§22) Stethoscope functionality | PARTIAL | [S01,S13] Anchors/cursor and AUSCULTATION intent exist. STEMI authored heart/lung text and Dana bilateral wheeze exist. | No integrated region→committed exam→finding text/audio path. No packaged auscultation audio found. | MULTI_LAYER | EXPO_REQUIRED | Make tool useful via authored text after confirmed exam; match existing regional coverage. Audio is optional and requires approved assets, never synthesized findings. | R40, medical region mapping |
| R42 (§22) Penlight usefulness | CONFLICT | [S07,S13] Tool selectable; Dana visual request is INSPECTION; UI explicitly says pupil result unavailable. | Neither case supplies a useful authored pupil response; generic neurologic negatives do not establish pupil findings. | UI_ONLY | EXPO_REQUIRED | Hide/disable with truthful unavailable state for these cases; do not invent pupil animation or examination result. | Case capability gating |
| R43 (§23) Coherent exam structure | PARTIAL | [S01,S03,S13] Body-region visuals, broad exam actions and fact types exist; Dana ABCDE action exists. | No uniform mapping of Airway/Breathing/Circulation/Disability/Exposure to supported actions/findings; composite STEMI exams do not map one-to-one to anchors. | CASE_SCHEMA | EXPO_REQUIRED | Use ABCDE-oriented action groups with body-region access as a separate presentation index. Only show supported checks; keep composite exam scope explicit. | R40,R41, reviewed mapping |
| R44 (§24) Existing committed-action equipment | EXISTS | [S05] Cuff, IV access and tubing derive from committed executed learner events in correct Session/order; runtime hides legacy attached devices before projection. | Do not infer device from vital value, selected UI button or AI intent. | VISUAL_PATIENT | EXPO_REQUIRED | Preserve existing event-derived projection/anchoring; exact triggers listed in D. | R11–R16 |
| R45 (§24) Visible pulse oximeter / independent leads | MISSING | [S05,S13] Output schema/runtime expose only bp_cuff, iv_access, iv_tubing; legacy finger-probe mesh name is hidden, not supported projection. | No active pulse-oximeter device attachment or committed trigger. Separate ECG leads also not projected. | VISUAL_PATIENT | EXPO_REQUIRED | Add only required pulse-oximeter attachment driven by authorized acquisition; separately scoped ECG leads can wait if monitor behavior is honest. | R13,R16; approved asset reuse/QA |
| R46 (§24) Explicit pre-applied equipment policy | PARTIAL | [S05] No qualifying committed events means all three current device flags false; both cases start without attached devices. | No case schema declaration for an alternative pre-applied starting device; room equipment is not patient-attached equipment. | CASE_SCHEMA | EXPO_NICE_TO_HAVE | Keep current clean initial state; add explicit initial-device policy only when a future case actually requires it. | R17; authored initial conditions |
| R47 (§25) Diagnosis → disposition → intentional End | PARTIAL | [S01,S03,S12] Typed DIAGNOSIS/DISPOSITION actions and confirmation dialog exist; production end is server-authoritative and review end remains blocked. | No guided prerequisite/order policy; most real options embed diagnosis/choice in fixed labels. Review completion is local presentation state. | MULTI_LAYER | EXPO_REQUIRED | Use neutral supported diagnosis/disposition input and confirmed finish flow; distinguish review snapshot from final production event. | R21,R24,R31,R48 |
| R48 (§26) Distinct post-encounter debrief screen | CONFLICT | [S06,S12] App has only /sessions/:sessionId for both encounter and debrief; local reviewComplete toggles controls and scrolls same page. | Assessment remains under patient; local completion is lost on reload and does not end/pause authoritative review Session. | MULTI_LAYER | EXPO_REQUIRED | Separate encounter/debrief navigation with permitted server evidence and robust completion/reload semantics; never fake production ENDED for REVIEW_ONLY. | R21,R47 |
| R49 (§27) Complete debrief hierarchy | PARTIAL | [S12,S15] Deterministic total/six domains, criteria/evidence, priorities, Tutor and truthful source/curriculum status exist. Timeline is separate. | Outputs are dispersed and timing is often evidence timestamps rather than an explicit timing summary. Current safe final findings can be generic. | UI_ONLY | EXPO_REQUIRED | Compose existing projections into requested hierarchy on debrief screen; avoid re-scoring or prose replacing evidence. Any missing authored label requires safe projection, not guessing. | R23,R48, preserve Tutor failure fallback |
| R50 (§28) Approved product-story Home | CONFLICT | [S18] Current rejected Home has brand/CTAs and three-step journey; PublicLanding aliases ExpoLanding. | No full Problem/Solution/Meet-Assess-Decide-Treat-Learn/platform/audience/institutional future/contact narrative; design rejected. | UI_ONLY | EXPO_REQUIRED | Design content structure after functional gates; use real product claims and owner-approved contact details; no official JU/JUST claim. | Owner copy/reference review, R24,R25 |
| R51 (§29) Official logo, B mark and tagline | EXISTS | [S18] Owner raster preserved, Bright/Dark full/mark assets extracted; Brand/PWA use them; official tagline present. | Assets are reusable even though page design is rejected. | UI_ONLY | EXPO_REQUIRED | Retain official bytes/provenance; do not redraw or replace brand. | Hunk-level salvage |
| R52 (§29) EN default, Arabic and Bright/Dark | EXISTS | [S18] Localization default en-US, RTL support, global controls; Bright default, stored Dark preference and safe storage fallback; navy/blue/cyan/violet tokens. | Existing support does not imply final visual approval or complete accessibility certification. | UI_ONLY | EXPO_REQUIRED | Retain functional controls and semantic tokens, not rejected composition. Keep patient language authorization separate from UI locale. | Focused locale/theme regression on later changes |
| R53 (§30) Honest Faculty management foundation | EXISTS | [S14] Catalogue/detail, metadata-only DRAFT create/edit, revision/role/institution guards; review status/curriculum/persistence disclosures. | Refresh persists server memory; restart does not. No approval/publication, AI Builder or analytics shortcut. | MULTI_LAYER | EXPO_REQUIRED | Preserve these truthful limits; Faculty need not share the encounter shell. | Existing Faculty boundary |
| R54 (§30) Both current cases in Faculty catalogue | PARTIAL | [S14,S17] UIUX composition seeds projectFacultyStemi only, then demo drafts; Dana is in Student catalogue. | Dana management detail is not seeded into this Faculty demo. | RUNTIME_ONLY | EXPO_NICE_TO_HAVE | Reuse Faculty metadata projection for Dana if needed for two-case demonstration; no clinical authoring/publish features. | Dana safe faculty metadata |
| R55 (§32) Reference-based comparison evidence | PARTIAL | Owner's prior Body Interact screenshot and current repository gallery support interaction principles; Curans recording and V1 screenshot set not located in current supplied audit inputs. | Cannot honestly claim scene-by-scene inspection of unavailable references. | UI_ONLY | EXPO_NICE_TO_HAVE | Use locked written patterns now; request/review exact reference artifacts only before future visual mockups. Copy no assets/branding/UI. | Owner reference availability |
| R56 (§0,31) Security/preflight preservation | EXISTS | [S16] V2-027 guards and V2-028 non-mutating preflight documented; no tracked core changes in rejected presentation WIP. | Providerless 4202 UIUX host is not a live multi-provider Expo integration proof; readiness checks must cover chosen final composition. | MULTI_LAYER | EXPO_REQUIRED | Preserve auth, ownership, isolation, replay, budgets and host restarts/source fingerprint checks; do not ship fixture authority as production. | Final runtime composition review |
| R57 (§0,27,28) Tutor/RAG/curriculum authority truth | EXISTS | [S15] Deterministic assessment first, evidence-bound Tutor, optional RAG, pending curriculum and provider/RAG fallback. | No approved real-source/curriculum claims may be inferred from technical availability. | ASSESSMENT_POLICY | EXPO_REQUIRED | Preserve pending source status and immutable score/evidence; never invent official alignment for Home or debrief. | Reviewed sources remain external pending |
| R58 (§31) Larger simulator ambitions | DEFER_POST_EXPO | Current bounded review demo intentionally lacks extensive drug/results database, validated waveform/audio library, full production services and advanced Faculty features. | Not necessary to invent these to satisfy bounded Expo encounter. | MULTI_LAYER | POST_EXPO | Defer broader catalogue expansion, advanced hints, extra positions/patients, new exam tools/audio and production deployment work; keep essential existing-feature gaps above in scope. | Future reviewed content and separate authority |

## A. Current functional architecture that should be preserved

1. **Compiled/pinned Case → Session Coordinator → deterministic Clinical Engine → atomic committed aggregate.** PatientState is clinical truth. Clinical Time and event sequence are authoritative, separate from state version; the browser cannot author any of them. Commands remain intent until validated/committed. Due work and same-time closure precede a command; interrupts and rollback semantics must survive.
2. **Independent parallel diagnostics.** Case-owned result/image/report milestones, scheduler budgets and learner visibility already exist. Rendering a spinner or finishing an animation cannot make a result available.
3. **Assessment and disclosure.** Committed evidence and Clinical Time produce the score. Practice may disclose resolved findings; active Assessment withholds correctness. Patient improvement is a clinical consequence, not an assessment hint. Tutor cannot edit scores/events, and RAG is optional non-authoritative education.
4. **Two isolated patient packages with shared presentation machinery.** STEMI 2.0.1 and Dana 1.0.0 remain UNDER_REVIEW / REVIEW_ONLY. Dana's accepted face, breathing, scratching, body-complete exam and speaking layers; Khalid's accepted pain/living behavior; shared ED, camera bounds, Cover/Reset, and single-loaded-patient lifecycle should be preserved. No new model/animation work is indicated by this audit.
5. **Existing action-driven equipment.** Re-derive devices from committed learner execution, not true vital availability or pointer selection. This is the correct foundation for new measurement disclosure.
6. **Secure Patient, Interpreter and Voice paths.** Grounded Patient dialogue, catalogue-bound non-authoritative Interpreter, approved ElevenLabs TTD and playback-driven Speaking remain intact. Review profiles are Session-bound. Preserve server provider/model authority, replay/failure tombstones, request ceilings, no-store private responses and sanitized diagnostics.
7. **Honest Faculty and operator boundaries.** Faculty creates metadata-only DRAFTs, not clinical truth or publication. V2-028 Preflight measures structural/operator readiness, not live provider success, medical approval or production readiness.

The rejected WIP has no tracked diff in `v2/packages`, `v2/content`, approved patient public assets or Visual Patient runtime JS. That is strong scope evidence, not a substitute for a future focused regression gate.

## B. Rejected UI WIP — revert vs salvage recommendation

**SELECTIVE_SALVAGE**, with surgical hunk selection in a separately authorized implementation pass. Preserve the current tree until then. The rejected design is not made acceptable by its prior test passes.

Pre-audit scope: **34 tracked modified files (+817/-527), 35 new scoped files**, plus the pre-existing untracked Visual Patient Lab directory. The 69-file scoped WIP excludes that Lab and ignored test/build artifacts. The sole audit addition is this report.

### A. Reusable functional improvements

| Exact files/group | Retain candidate | Caution |
| --- | --- | --- |
| `v2/apps/web/src/App.tsx` | Route-change focus restoration; shared provider wiring | Rework route topology for real debrief; whole-page scroll-to-top is not encounter-shell design |
| `v2/apps/web/src/features/actions/ClinicalActionsPanel.tsx` | Accessible six-domain keyboard tabs, search/parameter/confirmation behavior | Preserve existing service authority; do not retain catalogue leakage or long-page arrangement |
| `v2/apps/web/src/features/assessment/AssessmentDebriefPanel.tsx` | Intentional native confirmation dialog | Separate local review finish from server production end; don't retain local state as a durable finish contract |
| `v2/apps/web/src/features/assessment/TutorDebriefPanel.tsx`, `assessment-model.ts` | In-flight locale handling, immutable numeric score display, exact generic-domain localization, failure preservation | Auto-load after review completion is behavioral/provider-budget relevant; retest with final route/phase |
| `v2/apps/web/src/features/investigations/InvestigationResults.tsx`, `diagnostic-presentation.ts` | Known-label/unit presentation and accessible media enlargement without numeric edits | Unknown values must remain un-invented; modal layout and result placement need redesign |
| `v2/apps/web/src/features/voice/VoiceCapture.tsx`, `PatientSpeech.tsx`, conversation and connection copy | Readable fallback, status and accessibility language | These are presentation changes, not a reason to change adapters, TTD, profile binding or provider budgets |
| `v2/apps/web/src/features/faculty/FacultyPage.tsx` | Existing metadata edit/validation/revision handling and honest persistence copy | Separate usable form behavior from owner-rejected visual styling |

### B. Reusable components/tokens and provenance

- `v2/apps/web/src/components/Brand.tsx`, `Icon.tsx`, `app/theme.tsx`, `app/localization.tsx`: reuse official branding, control mechanics, icon semantics, EN/AR and RTL. Individual localization entries still require leakage/content review.
- `v2/apps/web/public/brand/`: keep supplied original, legitimate crops/marks and provenance in `planning_input/uiux/BRAND_ASSETS.md`; no redraw.
- `v2/apps/web/src/design-system.css`: selectively reuse semantic color/focus tokens and accessible primitives. Do not retain its page composition wholesale.
- `v2/apps/web/index.html`, `vite.config.mjs`: BALSIM metadata/favicon/PWA asset changes are separable from layout.
- `planning_input/uiux/{UIUX_AUDIT,STUDENT_UX_AUDIT,HOST_UX_AUDIT,FACULTY_UX_AUDIT,BRAND_ASSETS,UIUX_VERIFICATION,UIUX_OWNER_REVIEW_HANDOFF}.md`: preserve as historical evidence; their prior readiness statements do not override owner's rejection/new brief.

### C. Rejected visual/layout work to replace, not call approved

- `components/AppFrame.tsx`; `features/public/{PublicLanding,ExpoLanding,ExpoCaseLibrary}.tsx`.
- `features/simulation/{SimulationWorkspace,SessionPage}.tsx` and `student-experience.css`: current stacked encounter architecture.
- Layout rules in `design-system.css`, `features/assessment/debrief.css`, `features/faculty/faculty.css`.
- Presentation hunks in `features/monitor/ClinicalMonitor.tsx`, `features/actions/{ClinicalActionsPanel,ClinicalInterpreterPanel}.tsx`, `features/conversation/PatientConversationPanel.tsx`, `features/investigations/InvestigationResults.tsx`, `features/visual-patient/{VisualPatient.tsx,visual-patient.css}`.
- `features/monitor/monitor-model.ts` fallback “See examination findings” is not sufficient: real-case rhythm/consciousness labels are not fully mapped, and a general exam-findings view is not delivered.

### D. Behavioral changes requiring deliberate acceptance

- New `/expo/cases` and `/expo/cases/:slug` routes and matching patient identity projection. “Start” currently opens existing boot-created sessions rather than making fresh encounters.
- `reviewComplete` local state disables encounter controls, auto-loads the Tutor snapshot and permits return; it does not end/pause the review Session. Reload loses it. It must not become an Assessment-mode security gate.
- `runtime/uiux-review-{composition.ts,entry.tsx}` and `scripts/uiux-review-{host.mjs,host-test.mjs}` create a bounded **providerless** two-case fixture, trusted-time advance operation and memory-only Faculty store. Useful for inspection, not a ready replacement for owner live hosts. The current public-facing composition also introduces Dana title leakage.
- `v2/package.json`, `v2/tsconfig.json`, `v2/playwright.uiux.config.mjs`, `v2/scripts/uiux-brand-assets.ps1`: keep only needed review/test wiring after final scope selection.
- New tests `v2/tests/browser/uiux/`, `uiux-e2e/` and existing modified tests under `student-ui/`, `visual-patient/`, `voice/voice-ui.browser.test.tsx`, `v2-025-e2e/faculty.spec.ts`: preserve authority/accessibility assertions; replace assertions that merely certify the rejected layout. **Do not weaken safety tests to accommodate new catalogue/multi-order behavior.**

A blanket revert is not safest: it would discard useful independent accessibility/localization/confirmation work without solving the new clinical contracts. Conversely, retaining entire components is unsafe because behavioral and visual changes coexist.

## C. Simulation UX contract — final interpretation

### Encounter shell

At normal Expo desktop size, app bar, safe vitals strip, Clinical Time, clinical-domain navigation and the patient viewport remain visible. Exactly one contextual domain is active. Forms, investigation results and compact activity belong within bounded contextual surfaces. Talk remains reachable independently of the active domain; changing tabs must not cancel approved playback or discard editable text. Debrief is a different screen, not additional encounter page height.

A small viewport/high text zoom requires an explicit accessible layout policy; “fixed” must not mean unreachable controls or clipped content. Current tests of *no horizontal overflow* do not prove *no whole-page vertical scrolling*. Layout changes should never unmount/reload the patient simply to change a domain.

### Time and acquired observations are different concepts

Keep three existing concepts distinct:

- Normal running synchronization: trusted real elapsed time × pinned ratio.
- Missed-tick catch-up: the same trusted synchronization over a longer interval, settling intermediate work.
- Authored compressed/action duration: explicit clinical duration, not elapsed animation time.

Current core supports the primitives. Current UI reads snapshots, and the offline UIUX host has a fixed trusted clock until an explicit fixture advance. There is no public clinical pause/resume/sync route in the inspected API route list, although the coordinator supports them. Any host integration must preserve interrupt/retry/CAS boundaries.

The learner-facing vital strip needs a safe acquisition model, conceptually: **not measured → pending measurement → measured at Clinical Time → active monitoring or last sampled/stale**. These are recommended contract states, not newly implemented enum names. Values withheld by policy must not be in the learner payload/cache in the first place. Preserve true PatientState so treatment, deterioration and assessment continue correctly even when the learner has not measured.

The existing triage for Khalid says hypotension. That may be legitimately preprovided information, but the owner/clinical review must resolve its relationship to the new “not measured at start” policy. Do not silently remove that authored clue or expose a precise BP without explicit policy.

### Practice, Assessment and Review are separate axes

Practice/Assessment is the disclosure mode; REVIEW_ONLY/PUBLISHED is execution/publication authority. They must not be conflated.

- Practice: resolved correctness/explanation where policy permits; no unresolved answer key.
- Assessment: neutral action log and real clinical consequences only; full correctness only at permitted end/debrief.
- Expo review: truthful review snapshot, never production-finalized wording or publication bypass.

Current review Tutor rejects non-Practice review access. The actual two-case WIP host pre-starts Practice only. Supporting selectable Assessment for these review cases needs an explicit review completion/disclosure design, not a renamed badge or browser boolean.

### Catalogue, action and result

Shared discoverability must not equal unrestricted executable membership. Reuse shared definitions by compiling validated per-case support/outcomes into the existing immutable Case artifact, rather than injecting live runtime actions beside the pinned package.

Every selectable action needs a declared supported outcome or explicit unavailable policy. “Available in the library” does not mean “normal for this patient.” A request/order, completed measurement/result and successful treatment response remain distinct. Common labels should be neutral; correctness and contraindication explanation belong to policy-governed feedback, not the choice name.

### Examination and presentation controls

Camera and pose selectors are presentation controls unless a separately authored clinical action gives them medical significance. They cannot change physiology, score or reveal an unearned finding. A visual stethoscope hit identifies an intended exam site; it is not a diagnosis or a committed exam. Keep confirmation and source-grounded finding release.

## D. Expo-required functional gaps

**38 atomic required gaps**: R02–R06, R08, R10–R16, R18, R21–R28, R30–R32, R35, R37–R43, R45, R47–R50. These overlap implementation dependencies; do not estimate them as independent projects.

Highest-priority contract gates:

1. **Learner observation acquisition and authoritative update cadence** (R08,R10–R16,R18,R45). This is not UI-only work.
2. **Diagnosis-safe briefing and shared catalogue/outcome coverage** (R24–R28,R30–R32). Prevent both answer leakage and fabricated results.
3. **Review Assessment mode / encounter completion / debrief phase** (R21,R47,R48). Preserve publication and disclosure rules.
4. **Useful exam findings delivery and compound-order semantics** (R35,R40–R43). Existing safe non-executable behavior must not be mistaken for delivered functionality.
5. **Fixed encounter shell and retained working workflows** (R02–R06,R22,R23,R37–R39,R49,R50), after the above contracts are decided.

### Exact vital/device evidence

| Item | Current authored/projection behavior | Missing contract |
| --- | --- | --- |
| True HR/BP/RR/SpO2/temperature | STEMI initially 112, 88/60, 24, 92%, 36.7°C; Dana 126, 82/48, 28, 93%, 36.7°C; all appear via observations | Learner acquisition/completion/freshness and explicit preprovided values |
| BP cuff, STEMI | Committed `examination.hemodynamic-perfusion` or `examination.hemodynamic-reassessment` | Discrete acquired BP/time semantics |
| BP cuff, Dana | Committed `procedure.dana.monitor` | Independent BP vs combined monitor policy |
| IV access | STEMI `procedure.peripheral-iv`; Dana `procedure.dana.iv-access` | Existing functionality can remain |
| IV tubing | Access must precede STEMI `procedure.normal-saline-250` or `medication.ufh-70-units-kg`; Dana `procedure.dana.crystalloid-500` | Confirm intended depiction: a medication order is not universally proof of continuous infusion |
| Pulse oximeter | Not in the three-boolean equipment contract; old device mesh names are hidden | Device projection/attachment and acquisition mapping |
| HR/RR source | Broad perfusion, respiratory/ABCDE and monitor actions | Which action/sample authorizes which channel; no guessed defaults |
| Temperature | True mapping only | Measurement action and timing |
| Continuous monitoring | Authored procedure exists | Channel activation/sample updates/stale semantics |
| Initial devices | No executed events → supported device flags false | Optional future authored initial device policy; do not confuse ED background equipment with attached monitoring |

The cuff and IV projection checks committed status, learner identity, executed payload, matching Session and appropriate action ordering. That logic should be extended, not replaced by UI-local toggles.

### Minimum Expo shared investigation scope — bounded recommendation

Use existing authored families only; this is an inventory recommendation, **not approval to expose all items for both cases without outcomes**:

- Cardiology: standard ECG; right-sided ECG and focused echo where authored.
- Blood tests: existing CBC/basic ED labs, chemistry, coagulation, troponin, point-of-care glucose, VBG and tryptase entries.
- Imaging: existing chest X-ray.
- Do not add urine/microbiology entries merely to populate a category. Respiratory can contain existing VBG if taxonomy is agreed; avoid duplicate selectable identities.

Current **STEMI 9**: standard ECG, right-sided ECG, POC glucose, CBC, chemistry, coagulation, troponin, chest X-ray, focused echo. **Dana 5**: ECG, CXR, VBG, basic ED labs, tryptase. Similar labels do not guarantee identical schema/results; normalize definitions without merging patient-specific truth.

Existing timing: STEMI glucose 60s; ECGs 120s; echo result/image 240s and report 360s; CXR result/image 300s and report 480s; CBC/chemistry/coagulation 480s; troponin 600s. Dana ECG 60s, VBG 180s, CXR 300s, basic ED labs 480s, tryptase 600s. Dana tryptase output is a truthful pending/supportive report, not a fabricated completed diagnostic value. These offsets are clinical scheduled milestones, not forced time consumption per click.

Required next artifact before implementing breadth: a small shared-action × case table with **supported result/effect / explicit negative / unavailable**, prerequisites, timing, visibility and review provenance. The union alone must not be loaded as executable actions in every case.

### Minimum Expo shared medication/support scope — existing content only

- STEMI: aspirin 324 mg chewed; ticagrelor 180 mg; clopidogrel 600 mg; UFH 70 units/kg; atorvastatin 80 mg; nitroglycerin; IV beta-blocker; norepinephrine rescue concept.
- Dana: IM epinephrine 0.5 mg anterolateral thigh; separately timed repeat IM epinephrine; antihistamine adjunct; inhaled bronchodilator adjunct.
- Existing support: IV access, oxygen, case-specific crystalloid orders, cardiac/SpO2/BP monitoring where authored, call for help/cath activation, education and disposition actions.

This is not a recommendation to administer any drug: it inventories existing review-only case content. Do not invent a named antihistamine/bronchodilator or dose when the case has not supplied one. STEMI has genuine harmful branches, so “only correct options exist” would be inaccurate; the problem is narrow case-shaped availability and hints embedded in labels.

The generic parameter schema supports dose/route forms, but both actual case action helpers use empty parameter definitions. Fixed-dose labels are not proof the real cases support a learner entering an arbitrary dose. In particular, interpreting “aspirin 300 mg” must not silently become the fixed 324 mg action. Any dose/route generalization needs authored outcome/assessment semantics and validation, not just editable inputs.

### Physical exam function, not visual buttons alone

- **Inspection:** working region exposure, camera and visible manifestations. Dana has authored general/skin/respiratory/CV facts. STEMI has general, cardiac, JVP, perfusion, lungs and other examination facts. The inspected safe action/state/timeline path does not project the actual after-exam fact texts to a learner exam-results panel.
- **Stethoscope:** functional target/intent foundation, but no result/audio integration. STEMI already authors regular tachycardia with S1/S2 and no murmur/rub, plus clear lungs with symmetric entry and no wheeze/crackles. Dana authors bilateral wheeze and mild increased breathing effort. These texts remain review-only; no new regional nuance may be invented. Chest is the useful region for heart/lung intent; generic neck/arm anchors do not justify new auscultation findings. Start with bounded authored text, not fabricated audio.
- **Penlight:** selectable visual affordance with no useful pupil response in these cases; Dana handler emits INSPECTION. Hide it for Expo or make unsupported state explicit. “No focal deficit” is not a pupil-reflex result.
- **Structure:** ABCDE-style exam action groups plus supported body-region access are coherent. Case fact IDs and composite exams require explicit mapping; do not automatically equate one clicked skin point with completion of the entire ABCDE action.

## E. Expo nice-to-have gaps

- R17: removal/stop lifecycle beyond existing applied-device persistence; do not add before a case needs it.
- R29: additional physician-matched/rights-cleared normal image mappings. Existing text fallbacks and explicit REVIEW_ONLY/PENDING labels remain acceptable within the approved review-demo scope. This audit does not silently convert the independent medical review gate into a newly completed gate.
- R46: support for future explicitly pre-applied starting equipment. Neither present case requires inventing it.
- R54: Dana Faculty management catalogue entry using existing metadata projection.
- R55: exact Curans/V1 reference artifact review before future visual design, not a blocker to the current source audit.

Optional convenience within existing rows: audio auto-play after user consent, approved auscultation audio, and richer coaching hints. Explicit Play/Replay, honest text findings and bounded resolved feedback are preferable to unreliable or clinically fabricated demonstrations.

## F. Post-Expo items

- R19: live ECG waveform. **DEFER_POST_EXPO**, not EXPO_SAFE_NOW. A rhythm name plus HR plus opaque `waveform_descriptor` cannot certify morphology. The reference ECG's 84 bpm vs Case 112 bpm mismatch makes it particularly inappropriate as a fake continuously updated trace.
- R58: expansive investigation/drug databases, new disease cases, advanced hints/analytics, additional exam tools/audio/positions, advanced device lifecycles, production Faculty persistence, production authentication/quota deployment and broader media library approvals.
- No advanced clinical effects, validation algorithm or medical threshold is to be invented to make a visual mockup look complete.

## G. Recommended implementation order before final mockups

These are recommendations only; **no implementation is authorized by this audit**.

1. **Salvage plan and authority decisions.** Approve hunk-level reuse; decide review Assessment completion semantics, learner-known initial facts/measurements and bounded shared catalogue scope. Keep current WIP intact until approved.
2. **Safe observation contract.** Separate true state from acquired learner measurements, sample timing/source/freshness and preprovided facts. Define reviewed severity policy and extend validation/hash/review evidence. Include safe recovery/cache behavior.
3. **Trusted time integration.** Connect chosen review/Expo composition to existing coordinator synchronization; preserve interrupts, pause and catch-up. Prove results progress without new actions; do not add a browser medical timer.
4. **Shared action/outcome matrix.** Normalize only existing bounded investigations/medications/support; author or explicitly mark unavailable per case. Resolve real-case dose/route semantics. Review learner labels and remove choice-name coaching.
5. **Measurement/device and exam findings integration.** Reuse cuff/IV projection, add pulse oximeter when authorized, bind exam completion to safe authored findings, hide unsupported penlight. Verify both cases independently.
6. **Quick Order contract.** Preserve safe single action; explicitly design multi-candidate review/commit/partial-failure semantics and update compound-command tests/evaluation. No silent promotion of AMBIGUOUS.
7. **Encounter lifecycle and disclosure.** Fresh start/mode selection, neutral briefing, intentional diagnosis/disposition/finish and reload-safe permitted review snapshot vs production finalization. Server policy controls Assessment disclosure.
8. **Functional shell and presentation APIs.** Fixed desktop encounter, contextual results/activity, persistent conversation, supported independent camera/pose controls. Retain one patient, existing speaking and accepted visual states.
9. **Distinct debrief and product story.** Compose score/domains/critical/missed/timing/timeline/Tutor/priorities without re-scoring; then content-plan Home, Faculty paths and truthful institutional future.
10. **Focused acceptance before mockups.** Demonstrate both case/mode journeys, withheld vitals/data, no diagnosis leakage, exact measurement/device timing, parallel investigations, failed/duplicate orders, unavailable providers, examination results, finish/reload and score immutability. Only then finalize visual mockups/style.

Medical/content-dependent rows need genuine review. A new hash-bound case/policy version may be necessary; do not revise accepted artefacts silently or weaken frozen Architecture. Seek a discrete architecture decision if the existing boundaries cannot express the agreed requirement.

## H. Risks / medical-safety concerns

### Disclosure and answer leakage inventory

1. **Confirmed visible Dana diagnosis:** `caseCard()` chooses `case.dana.title`; `ExpoCaseLibrary` renders it on Student card and orientation. Existing screenshot confirms “Dana — food-triggered anaphylaxis.” This is not safe learner briefing.
2. **Khalid current card is different:** it uses `case.stemi.title-learner` (“58-year-old man with acute chest pain and hypotension”), not the final STEMI title. Do not falsely report identical card leakage for both patients. Triage hypotension still needs reconciliation with acquisition policy.
3. **Both action catalogues give disease clues:** diagnosis entries include the actual diagnosis; narrow related options and aliases such as Dana repeat timing/adjunct indication/unsafe early discharge, and STEMI oxygen-not-indicated/ward-instead-of-reperfusion, embed advice or correctness. A broader neutral diagnostic choice/input cannot be invented only in JSX; current Case-pinned membership must support it.
4. **Raw identifier/provenance exposure:** SafeSessionProjection includes case package/version IDs (not package hash); action IDs, diagnostic IDs and inspectable media manifests/paths contain `stemi`/`anaphylaxis` and other clinical identifiers. Current UI slugs `khalid`/`dana` are neutral, and generic Session URLs do not themselves render a diagnostic title. Public synthetic assets are an explicitly accepted local Expo limitation, **not secure exam secrecy**. If the locked requirement means adversarial browser/network concealment as well as visible-label concealment, require a separate opaque-ID/protected-delivery contract. Hiding text alone cannot provide that stronger claim.
5. **Earned information is not a leak:** approved result interpretations after authoritative availability and post-encounter feedback may reveal diagnosis. Faculty titles may be diagnostic. Do not censor these to compensate for pre-encounter leakage.

### Other consequential risks

- **UI-only hiding of vitals is insufficient.** Values already transmitted cannot be made undisclosed by placeholders. Cached snapshots and stale replies must follow the new safe projection.
- **Missing result is not normal.** Cross-case copied diagnostics, images, free-form model output and no-op actions cannot stand in for authored outcomes. Similar medicine names do not imply matching dose, route, effect or score.
- **Severity thresholds are clinical rules.** Do not hard-code new HR/BP/etc thresholds in CSS/React. Interpretation must be approved and pinned; numeric observation schema bounds are not severity policy.
- **Current end review is not authoritative end.** Local React state can be lost on refresh and does not freeze a Session; it must not unlock Assessment answers. Both cases must remain UNDER_REVIEW / REVIEW_ONLY until real approval.
- **Current practice response language can coach before action.** Labeling a medication “after first-line treatment” inside a selection option differs from policy-governed feedback after an action.
- **Multi-order changes are not cosmetic.** Existing safety evaluation deliberately flags collapsing compounds to one MATCH. New lists need clear confirmation, ordering, missing parameters, duplicate identity, partial success and interrupt semantics.
- **Device depiction must match action meaning.** Validate whether the current UFH-triggered tubing matches the intended administered-vs-ordered depiction; preserve current code until reviewed. Do not infer a running infusion or measured channel from generic intent.
- **No false audio/exam claims.** Stethoscope cursor is not auscultation audio; generic negative neurologic text is not a penlight finding. Static fallback is not a live exam.
- **No UI-created clinical improvement.** Camera positions, device meshes, facial animation and theme changes are downstream presentation; clinical state and score do not depend on them.
- **Production scope remains pending.** Fixture authentication, local quotas and public synthetic assets are approved Expo exceptions, not production security. New unified routes/host composition must preserve Session-bound Voice, budget enforcement, no-store and preflight source freshness.
- **External review remains independent.** STEMI ECG/CXR physician/rights review, 84/112 discrepancy and unresolved real clinical/curriculum sources are not resolved by this audit.

## I. Exact file/component/contract map

Paths are repository-relative below. Symbols identify the evidence without relying on line numbers that rejected WIP may change later.

| Ref | Exact files / symbols | What they establish |
| --- | --- | --- |
| S01 | `v2/content/cases/stemi/v2-draft/stemi-case.ts`; `v2/content/cases/stemi/v2-conversation/stemi-conversation-case.ts`; `v2/content/cases/anaphylaxis/dana-case.ts` | Actual catalogue, parameters, public triage/facts, observations, diagnostic offsets, rules and rubric; current review artifacts |
| S02 | `v2/packages/session-engine/src/coordinator/session-coordinator.ts`; `src/clock/session-clock.ts`; `src/time/advance-clinical-time.ts`; `src/commands/process-external-command.ts`; `v2/packages/contracts/src/session-clock.ts` | Trusted clock, pause/resume, sync/command orchestration, compressed/due advancement and failure semantics |
| S03 | `v2/packages/contracts/src/{actions,diagnostics,rules,events,patient-state}.ts`; `v2/packages/case-schema/src/{schemas,validation,compiler,review-execution}.ts`; `v2/packages/session-engine/src/context/pinned-session-case.ts` | Existing action/result/rule contracts, static diagnostic validation, immutable Case membership |
| S04 | `v2/packages/contracts/src/observations.ts`; `v2/packages/clinical-engine/src/observations/project-observations.ts`; `v2/packages/api-core/src/service/secure-api-service.ts` — safeSessionProjection/getPatientState; `v2/packages/contracts/src/api-v1.ts`; `v2/apps/web/src/features/monitor/{ClinicalMonitor.tsx,monitor-model.ts}` | True state converted to immediate learner numbers; no acquisition/severity policy |
| S05 | `v2/packages/api-core/src/service/visual-patient-projection.ts`; `v2/packages/contracts/src/visual-patient.ts`; `v2/apps/web/src/features/visual-patient/runtime/equipment.js` | Exact committed-action device triggers, three flags, patient projection/pins |
| S06 | `v2/apps/web/src/App.tsx`; `components/AppFrame.tsx`; `features/simulation/{SessionPage,SessionEntryPage,SimulationWorkspace}.tsx`; `features/simulation/student-experience.css`; `app/session-presentation.ts` | Routes, generic mode selection, snapshot delivery and current page layout/time formatting |
| S07 | `v2/apps/web/src/features/actions/{ClinicalActionsPanel.tsx,ClinicalInterpreterPanel.tsx,action-model.ts}`; `v2/packages/api-core/src/service/secure-api-service.ts` — safeLearnerActionCatalogue/submitClinicalAction | Six domains, manual search, exam pointer bridge, real-case safe catalogue and submission |
| S08 | `v2/packages/api-core/src/service/secure-api-service.ts` — safeTimelineItem/safeLearnerTimelineProjection; `v2/apps/web/src/features/timeline/{LearnerTimeline.tsx,timeline-model.ts}` | Safe action/result timeline and absence of general exam-result text projection |
| S09 | `v2/packages/contracts/src/clinical-interpreter.ts`; `v2/packages/clinical-interpreter/src/{capability,reconcile,workflow,evaluation}.ts`; `v2/tests/browser/clinical-interpreter/clinical-interpreter.browser.test.ts` | Single MATCH, compound AMBIGUOUS, value preservation and no execution authority |
| S10 | `v2/apps/web/src/features/conversation/PatientConversationPanel.tsx`; `v2/apps/web/src/features/voice/{VoiceCapture.tsx,PatientSpeech.tsx,patient-audio-playback.ts,elevenlabs-speech-adapter.ts}`; `v2/packages/api-core/src/voice/token-broker.ts` | Text/STT review, explicit playback, Speaking lifecycle, Voice authority |
| S11 | `v2/content/media/{stemi,dana}/manifest.json`; `v2/apps/web/src/features/investigations/{InvestigationResults.tsx,diagnostic-presentation.ts}`; `planning_input/v2-022/{STEMI_MEDIA_PACKAGE,STEMI_DIAGNOSTIC_REVIEW_PACK}.md` | Packaged images/text, normal CXR candidate, pending media and review discrepancy |
| S12 | `v2/packages/assessment-engine/src/disclosure/project-assessment-disclosure.ts`; `v2/packages/api-core/src/service/secure-api-service.ts` — activeAssessmentProjection/getTutorDebrief/endSimulation; `v2/apps/web/src/features/assessment/{AssessmentDebriefPanel,TutorDebriefPanel}.tsx` | Modes, review snapshot vs production finalization, WIP local completion, debrief display |
| S13 | `v2/apps/web/src/features/visual-patient/VisualPatient.tsx`; `exam-intent.ts`; `runtime/{runtime.js,runtime.d.ts,exam.js,dana-rig.js,camera-navigation.js,dana-motion.js}` | Shared patient, public API, presentation positions/cameras, tool/anchor behavior, no exam finding authority |
| S14 | `v2/apps/web/src/features/faculty/{FacultyPage.tsx,faculty-service.ts}`; `v2/runtime/v2-025-faculty-store.ts`; `v2/packages/case-schema/src/faculty-metadata.ts` | Metadata-only DRAFTs, authorization/revision, memory persistence truth |
| S15 | `v2/packages/contracts/src/{assessment,tutor,knowledge}.ts`; `v2/packages/ai-gateway/src/tutor/debrief.ts`; `v2/packages/ai-gateway/src/knowledge/retrieval.ts`; `v2/content/knowledge/stemi/registry.ts`; `v2/runtime/v2-024-tutor-composition.ts` | Evidence/citation/source/curriculum boundaries and optional retrieval |
| S16 | `planning_input/v2-027/V2-027_SECURITY_HANDOFF.md`; `planning_input/v2-028/V2-028_OPERATOR_HANDOFF.md`; `v2/packages/api-core/src/http/create-api-app.ts`; `v2/scripts/review-readiness.mjs` | Preserved security/operator scope, actual API routes, no clinical sync/exam-finding route |
| S17 | `v2/runtime/{uiux-review-composition.ts,uiux-review-entry.tsx}`; `v2/scripts/uiux-review-host.mjs`; `v2/apps/web/src/features/public/ExpoCaseLibrary.tsx` | Actual two-case card/title source, pre-created Practice sessions, trusted-time fixture, providerless host |
| S18 | `v2/apps/web/src/features/public/{ExpoLanding,PublicLanding}.tsx`; `components/{Brand,Icon}.tsx`; `app/{theme,localization}.tsx`; `design-system.css`; `v2/apps/web/public/brand/`; `planning_input/uiux/BRAND_ASSETS.md` | Existing Home narrative, official supplied assets, themes/language/tokens |

### Actual API routes and implications

`v2/packages/api-core/src/http/create-api-app.ts` declares:

- `POST /v1/sessions`, `POST /v1/review-sessions`: separate creation authority.
- `GET /v1/sessions/:session_id/state`: safe state snapshot; currently no sync/acquisition filtering.
- `POST .../actions/propose`: deterministic execution authority.
- `POST .../actions/interpret`: non-authoritative intent only.
- `GET .../investigations/:result_id`: component availability/finding-text projection.
- `GET .../timeline`: safe committed activity.
- `POST .../end`, `GET .../assessment`, `POST .../debriefs`: phase/publication/disclosure gates.
- `GET/POST .../questions`, `POST /v1/voice/token`: grounded conversation and authorized Voice.
- No equivalent learner examination-findings or regular time-sync endpoint is presently declared. Core coordinator capability does not itself create a browser workflow.
- Demo Faculty routes are supplied by the local Faculty host; the generic API's Faculty create route remains unavailable. Do not imply production persistence.

### Test evidence inspected, not rerun

| Exact test file/group | Relevant existing assertions / limitation |
| --- | --- |
| `v2/tests/browser/api/action-catalogue.browser.test.ts` | Strict Case-pinned catalogue, neutral ordering, unauthorized/cross-tenant denial, review authority. Does not prove shared breadth |
| `v2/tests/browser/api/learner-timeline-assessment.browser.test.ts` | Committed-only timeline, no raw scheduler/rubric leakage, active Assessment withholding, final six-domain projection |
| `v2/tests/browser/assessment-engine/disclosure.browser.test.ts` | Active Practice resolved-only feedback; Assessment withholding; final evidence; rejects client reveal flags |
| `v2/tests/browser/clinical-interpreter/clinical-interpreter.browser.test.ts` | Compound remains non-executable; unknown actions/malformed values fail; wrong/missing values preserved |
| `v2/tests/browser/student-ui/clinical-actions.browser.test.tsx` | Generic parameter validation, explicit preview/confirmation, duplicate/stale/offline behavior. Synthetic dose forms are not real-case dose coverage |
| `v2/tests/browser/uiux/{assessment-presentation,student-presentation,shell,contrast,investigation-values}.browser.test.tsx` | WIP presentation/accessibility and immutable scores; local review finish explicitly does not production-finalize |
| `v2/scripts/uiux-review-host-test.mjs`; `v2/tests/browser/uiux-e2e/` | Providerless local review guards/journey; cannot prove live provider availability or satisfy new fixed-shell/acquisition requirements |
| `planning_input/uiux/UIUX_VERIFICATION.md` | Historical 146 Browser / 12 host / 1 app scenario plus build/typecheck/portability. Not rerun for this documentation audit |

### Audit completion / preservation

Only this report is added by the audit. Pre-existing WIP is not reverted, staged or endorsed. SHA-256 comparison of all 69 scoped pre-audit files returned **zero changes** after report creation. No clinical/external-provider request or runtime configuration change was needed. `git diff --check` and the equivalent no-index whitespace check for this untracked report pass; no implementation tests were rerun.

**BALSIM_SIMULATION_FUNCTIONAL_AUDIT — COMPLETE**

This is a functional decision map, not permission to implement or a visual approval. Stop before source changes, revert, commit, push or V2-029.
