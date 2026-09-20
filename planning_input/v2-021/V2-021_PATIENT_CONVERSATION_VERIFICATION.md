# V2-021 — Patient Conversation correction and live-proof status

Current verdict: **CLOSED for Expo scope** — see [final live acceptance](V2-021_CLOSEOUT.md).

The remaining text is the historical pre-live-proof handoff. Its unavailable-runtime
and uncommitted-tree statements are historical, superseded by the closeout record.

Historical verdict: **V2_021_PATIENT_CONVERSATION_INTEGRATION — NEEDS_REFINEMENT**

Date: 2026-09-20. Branch `v2-development`; HEAD remains
`1b115739987450157aa5ae4c4302a18cbbd3c0ca`. Nothing staged, committed, pushed
or deployed. Prior Visual Patient integration is preserved.

## Finding and correction

The prior HTTP 422 originates in the **current V2-019 runtime capability guard**
in `packages/patient-conversation/src/context.ts`, not a V1 compatibility path.
It rejects a Case whose `instructor_notes.patient_ai_access` is not `ALLOWED`.
Original STEMI 2.0.0 explicitly specifies `FORBIDDEN`. The source establishes
an explicit current restriction; it does not establish a separate historical
medical rationale. The finding was reported before implementation.

The guard has not been removed, bypassed or globally relaxed. At the owner's
explicit request, a separate 2.0.1 Case Version/package is constructed using
the existing Case Schema and Review Execution Artifact mechanism. Only this
successor enables the existing capability. Instructor notes remain excluded
from Patient context, despite the flag's awkward module location.

Exact successor identity:

- Case Version: `case-version.stemi.inferior-rv.002`, semantic version `2.0.1`
- Package: `case-package.stemi.inferior-rv.002`
- Review subject: `6a707cdb7e19b01084c68a40ab86b5e48ef6140959b5ba96aa1db96c1137f18e`
- Review execution: `90b8bfa625ff217edaefd2f235deacf396f9a9d8af86268c0acf411f939046f1`

The hash changes follow only new manifest identity/version, matching initial
state version, Patient AI capability and regenerated exact-version reachability
evidence. Every other module is equal to its parent, including facts, dialogue,
rules, observation mappings, timelines, actions and rubric. The successor is
UNDER_REVIEW / REVIEW_ONLY, not medically approved or published. The exact asset
binding includes the complete new identity/hash tuple; mixed tuples fail closed.

Patient model remains **gpt-5.6-terra**; Interpreter remains **gpt-5.6-luna**.
Existing Secure AI Gateway, local grounding validation, disclosure rules,
ElevenLabs provider, `eleven_v3_conversational`, token type/protocol and key
handling remain unchanged. No second AI route or chatbot was added.

## Tests and execution evidence

| Gate | Actual result |
|---|---|
| `npm run test:v2-021` | PASS, exit 0 |
| Focused Browser | 13/13; includes 4 new conversation/version tests |
| Synthetic live-configuration tests | 7/7; no real environment secrets or provider calls |
| Source/approved-asset audit | 10/10 |
| Actual-App / visual-contract Playwright | 5/5 |
| `npm run verify` | PASS, exit 0 |
| Full Browser | 876/876, 88 files |
| Full Deno | 36/36 |
| Standard Playwright | 11/11 |
| Existing Voice Playwright | 3/3 |
| Persistence, RLS, atomic commit, durability | PASS |
| PostgreSQL API and Patient Conversation | PASS |
| Typecheck, build, portability, UI/AI/Voice/PWA audits | PASS |
| Final `git diff --check` | PASS |
| Changed-file generated-path / high-confidence secret-signature scan | 0 matches |

The new API test invokes the existing question route with the new pinned
artifact and an explicitly **synthetic provider**. It returns HTTP 200 with a
grounded onset response, preserves Patient State/Scheduler State/Clinical Clock,
and appends only question/response events. An exact retry does not call the
provider again. The original artifact still returns 422 before provider use.

Test question: “When did the chest pain start?”

Synthetic test answer: “It started about 55 minutes before I arrived, and it
has not stopped.” Grounding: existing `fact.stemi.symptom-onset`.

**This is regression evidence, not a live model answer.** Playback tests use
synthetic media events; the real visual runtime test proves instance/animation
continuity across speaking changes, but does not prove live provider audio.

The focused Playwright assertions all passed; its exact owned server PID 53932
then lingered during Windows teardown. Its command line was re-verified before
terminating only that PID. The command subsequently exited 0. No test/assertion
or timeout was weakened. Full verification ran outside the sandbox for the
previously identified embedded-PostgreSQL Windows user-info restriction; its
Playwright suites exited normally.

Non-fatal build warning remains: the lazy visual runtime chunk is approximately
617 kB. The approved 65,580,508-byte GLB is unchanged and is not shell precache
content. No asset optimization or UI polish was performed.

## Live proof — blocked by local configuration

Read-only presence checks in this process found:

- `OPENAI_API_KEY`: present (value never printed)
- `ELEVENLABS_API_KEY`: absent
- `ELEVENLABS_SMOKE_VOICE_IDS`: absent

No existing local Voice smoke listener was available on its established port.
The owner was asked to configure the trusted launch process, or identify an
existing trusted local Voice server, without sending a secret through chat.

The opt-in composition is ready to run **one** supported Arabic onset question:
`متى بلش وجع صدرك؟`

It bounds live work to the existing Patient invocation/retry policy and one TTD
token mint; it blocks actions and other mutations. It preserves `store:false`
and no tools. Missing configuration fails before external I/O. Setup details are
in `V2-021_INTEGRATION.md`; it reads process variables only, not a secret file.

Actual local review URL:
`http://127.0.0.1:4186/sessions/session.api.0003.idempotency-visual-review`

Default `npm run dev:v2-021` is the offline original-artifact review composition.
The explicitly configured live mode selects the new 2.0.1 artifact. This is a
loopback-only in-memory/test-principal harness around the actual App and domain
code, not production authentication or deployment.

No live Patient or ElevenLabs request was made during this correction. Therefore:

- Live returned answer: **not yet available**.
- Live Pain + Speaking screenshot: **not yet available**.
- MP4 with actual generated answer audio and speaking ON/OFF: **not yet available**.
- Existing silent Visual Patient video is historical evidence only and is not
  relabeled as voice proof.

Do not declare PASS until the configured actual application flow succeeds and
the requested live artifacts are captured. Missing relief transitions and
anchor-specific examination findings remain separate known integration gaps;
neither was invented or used to block this capability correction.

## Files changed during this correction

New:

```text
planning_input/v2-021/V2-021_PATIENT_CONVERSATION_VERIFICATION.md
v2/content/cases/stemi/v2-conversation/stemi-conversation-case.ts
v2/runtime/v2-021-live-proof.mjs
v2/scripts/v2-021-live-proof-test.mjs
v2/tests/browser/visual-patient/stemi-conversation.browser.test.ts
```

Modified (some were already uncommitted V2-021 additions):

```text
planning_input/v2-021/V2-021_INTEGRATION.md
planning_input/v2-021/V2-021_VERIFICATION_REPORT.md
v2/README.md
v2/package.json
v2/packages/api-core/src/service/visual-patient-projection.ts
v2/scripts/v2-021-review-host.mjs
v2/tests/browser/v2-021-e2e/app.tsx
v2/tests/fixtures/api/secure-api.ts
```

No approved Patient/Interpreter/provider core was edited in this correction.
After successful executable-tree verification, only documentation was updated.
Total current V2-021 working tree: 18 tracked files modified and 30 new scoped
files, including prior integration work (48 files). Tracked diff: 127 insertions,
30 deletions; Git's tracked diff does not count new-file contents. The pre-existing
untracked laboratory is excluded from these counts. Nothing is staged. Generated
test outputs remain ignored, not proposed source changes.

## Preservation

`VISUAL_PATIENT_LAB_SOURCE_MODIFIED = NO`

The approved GLB/manifest hashes and V04 runtime Blender hash still match the
initial read. No lab file was edited. V1 hashes remain:

- README: `E1F5884A448E1CBD9125D1780A1236105D7E74DB2E3DD304F9A51F54857FCEE8`
- HTML: `2FE2732792EB1642909E53F42DB1A6455F9C72EF8088A0303F1E8857ECA2D512`

Frozen Architecture and all accepted ADRs have zero Git diff. Canonical hashes:

- Logical: `5190DA35B24E8A45BA50ACDF91279454199F8FF6B4558340CC019DEFB1CDD0DE`
- Physical: `7C27F0D2318A82039E1747EF70B02CB31731A1BEC16D3E74B7EC80C87662FDCA`

Windows checkout uses CRLF because `core.autocrlf=true`.

Original STEMI 2.0.0 source and hashes remain unchanged:

- Review subject: `46388c32e3ef74db413228adf837e90e828913a7db996a3ba57d181a2cbab11f`
- Review execution: `a8e76e5cd96c8b29461968796d295674f8de1ab3630a55a5568a25664c2b7ab7`
- Golden trace: `14fcf7de8a969fba49eb3d0d96db783f1c77e1fb2a89594c81f453495ace9a58`

No new medical fact, treatment effect, exam finding, relief transition, medical
approval, remote Supabase, model/provider-policy change, commit, push or deployment.
