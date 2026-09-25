# Owner-attested physician review / Expo execution contract

## Owner-authorized final checkpoint

**BALSIM FUNCTIONAL WORK PACKAGE 2 — CLOSED**

**SHARED CLINICAL CATALOGUE + COMPLETE EXPO CASE CONTENT — CLOSED**

**EXPO MEDICAL REVIEW GATE — CLOSED**

This closes the implemented Expo scope using the exact approvals below. It does
not invent formal physician identity/time or promote production publication,
diagnostic media matching/rights, real-source RAG or JU/JUST curriculum evidence.
The complete generated case packs remain unchanged and bound to current hashes;
their statement that medical approval does not automatically close WP2 records
the distinction from this subsequent explicit owner closeout decision.
No medical, runtime, asset or security behavior is changed by this closeout.

Medical review: **COMPLETE — APPROVED_FOR_EXPO**. Approval basis:
**OWNER_ATTESTED_PHYSICIAN_REVIEW**. The owner explicitly attests that a qualified
physician reviewed both complete current medical datasets and confirmed them.
Reviewer role is PHYSICIAN; reviewer identity and exact physician review timestamp
are **NOT_FORMALLY_RECORDED**. No identity, institution, specialty, license,
signature or review date has been invented. No attestation date substitutes for
the unknown physician review date.

Expo execution is **APPROVED_EXPO / ALLOWED** in the trusted local synthetic host.
Production publication is **PENDING / NOT_PUBLISHED**. This is not full production
hardening, publication, source approval, or an independently verified signature.

## Exact immutable approvals

| Patient | Version / CaseVersion | Execution hash | Review subject hash |
| --- | --- | --- | --- |
| Khalid | 2.4.0 / case-version.stemi.inferior-rv.006 | e212c36090b59a4d324348c85fd1f5f7a0dbff02b1710a4e360a135e060760d7 | 2e09cc954facbe91983decc60da03948ee0e012de8b16361e9b7d291f841386e |
| Dana | 1.5.0 / case-version.anaphylaxis.dana.006 | 0cc26e1bad72fd44f84afe9f11832789cc60fd8408c9b13e1276c9fbf2a0dd65 | bc2ea75e05a4c58f8ec6e4fea6e280190fca85dc3a1e8ed6753abbd8b7e51022 |

Both bind `catalogue.balsim.expo-clinical@1.1.0`: 33 identical first-level concepts,
66 explicit Case bindings. Parent Khalid 2.3.0 and Dana 1.4.0 builders, hashes,
facts, effects, timings, scoring and patient assets are preserved. Earlier versions
and Sessions retain their existing pins/authority. Only successor version identity
and medical-review provenance change; no clinical values are replaced.

## Authority and integrity

- `OwnerAttestedMedicalReviewSchema` is strict and dedicated to this evidence type.
  Ordinary formal `ReviewRecord` requirements remain unchanged. No undocumented
  identity/time is accepted as a formal review or production publication record.
- `ReviewExecutionArtifact` now permits `APPROVED_EXPO` with a matching approval
  envelope. Case ID, version ID, semantic version, execution hash, subject hash and
  shared catalogue ID/version must match. A REVIEW_ONLY artifact cannot carry it.
- The execution hash identifies the immutable technical review/source snapshot,
  normalized to its original REVIEW_ONLY encoding. The approval is a separate
  trusted envelope over those bytes, not a circular hash of its own hash.
- Trusted content constants in `approved-expo-cases.ts` capture exactly the approved
  successor hashes. Changed content fails construction until a new authorized
  immutable version and approval binding are provided. Rebuilding the complete
  source snapshot verifies module hashes, technical checks and canonical bytes.
- The API verifies approved artifacts at start/load. Its process-local verification
  cache compares complete canonical bytes on each use; changed bytes invalidate
  the cached verification. A browser cannot submit medical approval, a result,
  another Case binding, or a trusted finalization boundary.
- This is trusted repository/runtime authorization, not a cryptographic physician
  signature system. There is no browser approval endpoint. Faculty writes remain
  metadata-only DRAFT operations with role/institution checks.

## Local execution and presentation

`npm run dev:wp2` uses Khalid on 4216; `npm run dev:wp2 -- --patient=dana` uses Dana
on 4217. Restart to obtain the new boot-created Session. Old V2 review hosts are
historically pinned; a running old Session is not promoted by this change.
The host refuses production mode, binds loopback, validates Origin/Host, allows
only its boot Session, checks local primary/fallback assets, and composes no live
provider. No credentials are required for this local approval proof.

Student pages show no medical-review badges for these approved current packages.
Faculty shows medical review Complete, owner-attested basis, identity/time not
formally recorded, and production publication Pending. The source manifest's
UNDER_REVIEW lifecycle means **unpublished package lifecycle**, not outstanding
medical review. Historical source snapshots keep their original status.

The existing trusted Session end operation now permits APPROVED_EXPO. The same
deterministic assessment engine produces FINAL results/six domain scores with
`TRUSTED_EXPO_FINALIZATION`, distinct from production finalization. In this Expo
boundary, the legacy `package_hash` field binds the review execution hash; it does
not manufacture a compiled production package hash. Legacy REVIEW_ONLY Sessions
still cannot finalize. Existing PUBLISHED_PRODUCTION contracts remain unchanged.
Tutor is downstream of finalized immutable evidence, cannot change scores/state,
and degrades without losing assessment. No external provider proof is repeated.

## Independent pending gates

- Production publication still needs the existing formal reviewer record, source,
  rights/asset, governance and other compilation/publication requirements. The
  production PostgreSQL case-authority path is not enabled for this local fixture.
- Local fixture authentication, process-local quotas, token/public synthetic-asset
  limitations and deployment/privacy controls remain PRODUCTION_PENDING.
- Eight knowledge sources remain registered; **zero trusted real documents**.
  References are not promoted to approved retrieval by medical approval.
- JU and JUST remain SOURCE_PENDING / CURRICULUM_SOURCE_PENDING. No alignment IDs
  or curriculum approval are invented.
- Clinical investigation reports/interpretations are approved for Expo. The
  mismatched Khalid 84-bpm ECG image remains withheld (ECG_IMAGE_MATCHING_PENDING).
  CXR image rights/matching and missing right-ECG/FoCUS/Dana image assets remain
  separate. Approved Expo APIs withhold uncleared diagnostic media even if a legacy
  image-availability event exists; deterministic text/results retain order/time
  gates. No Diagnostic Library files or patient assets change.
- V2-028 reports medical review Complete conditional on exact package checks,
  production Pending, RAG/curriculum pending and per-asset readiness separately.
  Missing provider configuration may degrade readiness; publication alone does
  not block this approved local Expo workflow.

## Future formal review upgrade

Retain this attestation in immutable history. When actual reviewer identity and
review time are available, create the existing fully documented ReviewRecord and
an appropriate new immutable content/review version. Bind that evidence to its
exact subject hash, preserving this predecessor. Never fill this historical
attestation's missing fields retroactively with guesses. Production compilation
must still pass all other gates. No formal upgrade occurs in this correction.

## Verification

Final affected Browser run: **764/764 across 76 files PASS**, including 13 new
approval tests. Covers approval schema, changed-content/cache invalidation,
forged browser fields, old hashes, unchanged medical modules, production rejection,
WP1/WP2, media withholding, authorization, Faculty, Preflight, final assessment,
Tutor non-authority and Student rendering. No full unrelated verify campaign.

Deno: **18/18 focused tests PASS** (the original 17 passing checks plus the
corrected Preflight snapshot recheck). Browser/Deno Preflight hash:
`913e7049936a94ee604b36d95974ee9bd25ea58ef1c6f3b1257a63d8a153a356`.
Node security/Preflight: **12/12 PASS**. Actual app: **3/3 scenarios PASS**:
two approved patient sessions and one Faculty catalogue/details/DRAFT scenario.
Typecheck, build, portability, secret scan and diff checks PASS. Build retains
the existing non-blocking >500 kB chunk warning.

Actual-app proof uses the ordinary local review transport, no provider composition.
The previous review entry's unavailable finalization stub is enabled only when
the approved Expo host explicitly supplies its capability; API ownership, exact
pin/approval and expected-state checks still decide. Legacy review hosts retain
their unavailable finalization path. The scenarios wait for committed UI refresh;
the rapid direct action sequence only resubmits after a confirmed version rejection
with a newly loaded state. No timeout/unknown outcome or provider call is retried.
Both end-of-session UI confirmations reached HTTP 200, FINAL scores/six domains
and deterministic Tutor fallback with truthful curriculum/source pending status.

Review images (local ignored test artifacts, not staged):

- `v2/test-results/wp2-app/catalogue-Khalid-shared-ca-5363c-red-BP-and-existing-patient/Khalid-approved-expo-final-assessment.png`
- `v2/test-results/wp2-app/catalogue-Dana-shared-cata-1e5cc-red-BP-and-existing-patient/Dana-approved-expo-final-assessment.png`
- `v2/test-results/faculty-actual-App-Faculty-64e62-and-no-publication-shortcut/faculty-stemi-details.png`
- `v2/test-results/faculty-actual-App-Faculty-64e62-and-no-publication-shortcut/faculty-catalogue.png`

Both complete physician packs match the deterministic read-only approved Case
export. The four required review documents retain historical audit context while
reporting current medical approval separately from all unrelated pending gates.

Working tree including pre-existing WP2 work: **42 modified tracked + 32 new scoped
files = 74**; zero staged. Before this correction: 17 modified + 26 new = 43.
All prior WIP is retained; the existing untracked `visual-patient-lab/` is excluded.
V1, frozen Architecture/ADRs, prior Case builders/hashes, knowledge registry and
patient/media assets remain unchanged. Disposable failed-test screenshots were
moved recoverably to ignored `v2/test-results/medical-approval-disposable/`.
No provider calls, credentials read/exposed, commit, push, or WP3. Test-owned
temporary hosts were stopped; no owner-configured provider host was replaced.
