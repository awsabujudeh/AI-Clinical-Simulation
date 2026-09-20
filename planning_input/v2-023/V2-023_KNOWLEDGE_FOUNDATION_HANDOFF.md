# V2-023 — controlled knowledge foundation

V2-023 Controlled RAG / Curriculum Knowledge Foundation — **CLOSED**.
Technical status: **IMPLEMENTED**, verification **PASS**.
Medical/curriculum corpus: **SOURCE_PENDING**; source approval: **REVIEW_PENDING**.

- `REAL_CLINICAL_SOURCE_ENRICHMENT = PENDING`
- `JU_CURRICULUM_SOURCE = PENDING`
- `JUST_CURRICULUM_SOURCE = PENDING`

Closure applies only to the technical foundation, not medical source approval
or official curriculum alignment.
The owner explicitly confirmed there are no local STEMI references with both
documented reuse permission and human approval, authorized synthetic technical
proof, and confirmed missing approved sources are not a technical closure blocker.
No external browsing, download, embedding request or provider call was made.
V2-022 remains IMPLEMENTATION_COMPLETE / REVIEW_GATE_PENDING independently.

## Sources actually discovered and registered

The existing `planning_input/v2-009/STEMI_SOURCE_REGISTER.md` is explicitly
PENDING HUMAN SOURCE REVIEW. It lists references, not ingestible approved excerpts.

| Existing Source ID | Reference / version | Locator | Status |
|---|---|---|---|
| `source.stemi.acc-aha-acs-2025` | 2025 ACC/AHA/ACEP/NAEMSP/SCAI ACS guideline | DOI `10.1016/j.jacc.2024.11.009` | UNRESOLVED / SOURCE_PENDING |
| `source.stemi.esc-acs-2023` | ESC ACS guideline, 2023 | DOI `10.1093/eurheartj/ehad191` | UNRESOLVED / SOURCE_PENDING |
| `source.stemi.acc-shock-2025` | ACC cardiogenic shock consensus, 2025 | DOI `10.1016/j.jacc.2025.02.018` | UNRESOLVED / SOURCE_PENDING |
| `source.stemi.aha-chest-pain-2021` | AHA/ACC chest pain guideline, 2021 | DOI `10.1016/j.jacc.2021.07.052` | UNRESOLVED / SOURCE_PENDING |

These titles/DOIs are transcribed from the existing register, not independently
verified versions or permission claims. Source/version IDs are reused exactly.
The new registry adds two discovery placeholders (`source.curriculum.ju-pending`,
`source.curriculum.just-pending`), not invented official documents. Both retain
`objective_id = UNKNOWN_PENDING_SOURCE_REVIEW`. Program/course/year are null,
not guesses. Shared JU/JUST institution metadata is reused unchanged.

Two additional non-retrievable registry records identify the existing STEMI
2.0.1 structured Case and rubric:
`source.stemi.structured-case`, `source.stemi.structured-rubric`.
They remain UNDER_REVIEW / REVIEW_ONLY direct-lookup references; neither clinical
facts nor scoring rules are copied into an educational corpus. The implementation
does not introduce a new direct Case reader or alter existing disclosure/scoring.

**Eight registered records. Zero real documents/chunks ingested.** Missing source
checksums and permissions are null, never fabricated. There is no approved medical
evidence or official curriculum alignment to display yet.

## Implementation and authority

- Shared portable data contracts: `packages/contracts/src/knowledge.ts`.
- Server-owned ingestion/retrieval: `packages/ai-gateway/src/knowledge/retrieval.ts`.
- Small allow-list: `content/knowledge/stemi/registry.ts`.
- Versioned local bundle/pin: `content/knowledge/stemi/bundle.json`, `index.ts`.
- No new database, provider, web ingestion, public API, UI or Tutor implementation.
- Clinical Engine/Case remain the only source of simulation truth. Assessment
  remains the only scoring authority. Retrieval exposes evidence, not actions,
  effects, Patient State, investigation findings or score updates.

RAG is non-authoritative educational evidence only. It must never alter patient
state, investigation results, medication effects, transitions, scoring or
critical-action evaluation.

Four layers stay distinct. Clinical guidelines and institution-filtered curriculum
may become retrieval evidence after approval. Case Ground Truth and Simulation
Rubric requests return `DIRECT_LOOKUP_REQUIRED`; ingestion of either is rejected.
Their existing version-pinned structured readers remain authoritative.

This follows frozen Logical J and Physical N.7/O.7–O.10: reviewed semantic units,
layer filters and pinned fallback bundles. The emergency foundation uses the
existing **local pinned-bundle path with exact controlled-topic lookup**. It does
not install a competing vector service or claim to implement PostgreSQL/pgvector
ranking or embeddings. Those remain the selected future indexed backend; the
optional server `KnowledgeIndexAdapter` can select only prefiltered, verified
chunk IDs. No embedding/model decision or new ADR is introduced.

## Controlled ingestion and hashing

`prepareKnowledgeBundle(registry, inputs, HashAdapter)` is a trusted build/admin
function, not a learner upload endpoint. It accepts strict version-1 JSON semantic
sections with stable IDs and page/section/paragraph locators. It does not split
tables blindly, extract PDFs or invent source text. Clinical sections and atomic
curriculum objectives are prepared and reviewed before ingestion.

Every source/version must be allow-listed, rights-approved, active, locally
available, and approved against the exact normalized input hash. Clinical sources
also require clinical-review evidence. Curriculum approval requires known official
objective/program/course/year metadata. Multiple eligible versions of one source
are rejected. Unknown IDs, invalid structure, stale approvals and content changes
fail without a partial bundle. Identical duplicate ingestion is idempotent.

Hash encoding is explicitly `JSON.stringify(strictSchema.parse(value))` in UTF-8:
schemas fix object property order; section order remains meaningful. Source hash
binds the normalized source-version/sections, not claimed raw PDF bytes. Excerpt
hash binds the JSON string of exact section content. Chunk identity hashes the
source-version/section-ID tuple, avoiding ambiguous concatenation. Sorted source/chunk identities,
full registry hash and chunks form the bundle payload; bundle hash is outside its
own hashed payload. No hash self-reference. Raw originals/permission evidence must
be retained by future admin ingestion, not substituted with these normalized hashes.

Real empty bundle pin:
`493b8c933a672b9221250fba51ba96a5f426476dd52692ee99b092793b787261`.
Registry hash:
`600becab1825c8d18b9a3333488d859d49fe9c8f63a51e7dd15d9378e62ff558`.

`createKnowledgeRetrieval` rebuilds and checks a stored bundle against the trusted
registry and expected pin before exposing retrieval. Caller mutations cannot
change the service snapshot. A registry/source successor invalidates the prior
bundle. Trusted composition must reload/re-pin after revocation; it must not keep
using a stale authorized registry as a substitute for current governance.

## Retrieval and citations

Structured query: Case Version ID, controlled topic, requested source layers,
locale, optional source IDs, exact curriculum institution/program/course/year and
objective, trusted `as_of`, bounded limit (1–6). No raw learner prompt or runtime
rule/source payload. V2-024 must derive Case, institution and time from authorized
server context; this internal contract does not authenticate arbitrary clients.

Filters precede adapter selection: Case, layer, locale, institution/level/objective,
approval and effective interval (start inclusive, end exclusive). Exact topics
have stable chunk-ID ordering; there is no invented semantic confidence score.
Wrong institution, expired source, unknown topic or unsupported locale cannot
silently fall back to other institutions/languages. Clinical and curriculum
collections are returned separately and labeled `NON_AUTHORITATIVE_EVIDENCE`.

Each evidence item includes source/version IDs, title, publisher, original location,
source version, precise locator, exact content, source/excerpt/index hashes,
locale and curriculum metadata where applicable. Citation verification accepts
only IDs present in the trusted retrieval result at its exact index pin; it is not
medical validation of model-generated claims. Retrieved text is quoted data, not
instructions. No generated answer or clinical decision is produced here.

## STEMI proof and actual ingestion

Synthetic test-only corpus: three explicitly synthetic documents (one clinical
channel, JU and JUST test channels), three sections each, nine chunks. All approval
references are labeled TEST_ONLY and exist exclusively in test fixtures. Their
text contains no treatment recommendations and claims no official objectives.

| Query | Synthetic test result | Real registry result |
|---|---|---|
| `stemi.inferior-recognition` | Traceable controlled-topic fixture evidence | SOURCE_PENDING, zero evidence |
| `stemi.timely-escalation` | Traceable controlled-topic fixture evidence | SOURCE_PENDING, zero evidence |
| `stemi.action-reasoning` | Traceable controlled-topic fixture evidence | SOURCE_PENDING, zero evidence |
| JU/JUST curriculum context | Only matching institution/year/course fixture | CURRICULUM_SOURCE_PENDING, unknown objective |

Synthetic success proves infrastructure, not clinical-quality retrieval or medical
Recall@5. Official curriculum coverage and meaningful medical qrels evaluation
remain SOURCE_PENDING / REVIEW_PENDING, not technical results to fabricate.

## Degraded mode and V2-024 handoff

No network is needed for local pinned lookup. Adapter failure returns
`RETRIEVAL_UNAVAILABLE`, or `PINNED_FALLBACK` evidence from the same verified bundle
when explicitly enabled. Unknown/cross-institution adapter IDs cannot bypass the
filter. Empty/missing evidence stays empty; no LLM-prior substitute exists.

A focused test proves outage leaves the real review Session unchanged and an
existing clinical action still commits. No RAG import/call was added to Clinical,
Session or Assessment engines. No browser clinical authority or cached private
Session evidence was introduced. The real local bundle intentionally contains no
approved knowledge until permission/review evidence arrives.

V2-024 may consume this server-side Result and verified citation IDs, alongside
separate existing authorized Assessment/Case evidence. It must implement disclosure
and debrief policy, label unavailable enrichment, and never use this module to
recalculate scores or reveal Case truth. Patient Conversation remains no-RAG.

## Focused verification

Command: `npm run test:v2-023` (typecheck, knowledge Browser tests, Deno exact
serialized snapshot, real-source pending proof, existing portability guard).
Additional affected-package regressions: existing AI Gateway Browser tests.
`npm run build` and `git diff --check` are the final narrow checks; no full-project
verification, live provider, database migration or broad test campaign is required.

Final results: `npm run test:v2-023` **PASS, exit 0** — typecheck, **25/25 Browser**,
**1/1 Deno**, all five real pending-source queries and portability guard.
Existing AI Gateway Browser regressions: **56/56 PASS**. Web build: **PASS**;
existing greater-than-500-kB chunk warning remains. `git diff --check`: **PASS**.
No clinical-source or Case hash changed. No V1, frozen Architecture, prior ADR,
V2-022, Visual Patient or provider-policy file changed.

Browser/Deno exact serialized-evidence SHA-256:
`aeacacaac897df849bb87ebe58c537ad5bf139708baeaf54656545bc88a33300`.

**DEFERRED_POST_EXPO:** broad corpus expansion, PDF extraction UX, semantic/vector
ranking if needed, comprehensive medical retrieval evaluation. Source approval
is a separate release prerequisite, not optional polish. No approved excerpt may
be substituted by an unreviewed planning note to meet an Expo deadline.

V2-022 review gate unchanged. The owner authorized one local V2-023 technical
closeout commit. No push or V2-024 implementation.
