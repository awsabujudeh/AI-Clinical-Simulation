# V2-011 RLS Policy Matrix

## Status

All 28 application tables have RLS enabled with no client policies in V2-011A. This is fail-closed scaffolding, not a completed authorization system.

**RLS SECURITY GATE: PENDING V2-011B**

The matrix below is the test/design input for V2-011B. “Trusted backend” means a separately protected server execution path; no service credential is stored in this repository.

| Resource category | Anonymous | Authenticated learner | Faculty/instructor | Reviewer | Trusted backend | Slice-B notes |
|---|---|---|---|---|---|---|
| `institutions` | Read approved public metadata only if product requires | Read own/available institutions | Read own institution | Read assigned institution | Managed read/write | Public exposure decision must be explicit |
| `profiles` | None | Read/update safe own profile fields only | Own profile only | Own profile only | Managed | Role/tenant fields never belong here |
| `institution_memberships` | None | Read own active membership only | Read only authorized institutional membership subset | Read own/assigned scope | Managed | Broad roster access is a **FUTURE POLICY DEPENDENCY** |
| Case catalogue/source (`clinical_cases`, `case_versions`, `case_modules`) | Published read only if explicitly exposed | Read eligible published/review assignment content | Draft CRUD within authorized institution | Read exact assigned review target | Managed | Faculty assignment/cohort model is a **FUTURE POLICY DEPENDENCY** |
| Published `case_packages` | No direct mutation; read only through approved product boundary | Read only packages eligible for own Session | Read eligible packages; no direct mutation | Read exact review scope | Insert via trusted publication path; no UPDATE/DELETE | Browser write must be denied |
| `review_execution_artifacts` | None | None unless explicitly assigned review participation | Read exact owned/assigned artifact | Read exact assigned artifact | Insert via trusted preparation path | Never usable as production authority |
| Reviews/approvals/review refs | None | No approval authority | Curriculum/UX input only where assigned; no implicit Clinical approval | Exact assigned review type/scope | Managed exact-hash writes | Clinical, curriculum, visual, and technical authority must remain separate |
| Clinical/curriculum sources and mappings | No private source content | Read Session-authorized subset | Manage authorized institution subset | Read review scope | Managed | Private curricula and faculty assignment are **FUTURE POLICY DEPENDENCIES** |
| Media/visual metadata | Read only explicitly public/Session-pinned metadata | Read Session-pinned approved/fallback metadata | Manage authorized metadata if assigned | Review assigned assets | Managed | Storage-object policies are separately required; no bucket exists yet |
| `simulation_sessions` | Only anonymous-session capability if explicitly designed | Read own Session; no direct authoritative aggregate write | Read authorized Sessions only | Review Sessions explicitly assigned | Create/update through trusted coordinator | Cohort/assignment access is a **FUTURE POLICY DEPENDENCY** |
| `session_commands` | No direct table access | No direct insert/read except safe API result | No direct insert | No direct insert | Trusted atomic commit/replay | V2-012 RPC is sole write path |
| `session_events` | None | Read own safe timeline projection; no direct write | Read authorized Session timeline | Read assigned review Session timeline | Append through trusted atomic commit | UPDATE/DELETE denied for every caller |
| `patient_state_checkpoints` | None | No raw direct write; read only through safe state API | Read authorized Session checkpoint if needed | Read assigned review Session | Insert through trusted atomic commit | UPDATE/DELETE denied |
| Assessments/domain scores/findings/debriefs | None | Read only own mode/phase-appropriate projection | Read authorized completed results | Read assigned review evidence | Insert deterministic results | RLS must not bypass V2-007 disclosure policy |

## Mandatory V2-011B adversarial cases

- `auth.uid()` with no active membership cannot cross tenant boundaries.
- Client-editable profile fields cannot grant role or institution access.
- Learner cannot write packages, artifacts, approvals, events, checkpoints, scores, or findings.
- Faculty cannot approve Clinical Review merely by holding a faculty membership.
- Reviewer access is limited to exact assigned target/type once an assignment model exists.
- Review-only artifacts cannot be read or used as production packages.
- Anonymous demo access, if enabled, is narrow and cannot enumerate tenant data.
- Trusted backend paths are explicit; `service_role` is never exposed to the browser.
- Published packages and committed events reject UPDATE/DELETE even when a policy mistake would otherwise allow it.

No capability in this matrix is implemented or claimed complete by V2-011A.
