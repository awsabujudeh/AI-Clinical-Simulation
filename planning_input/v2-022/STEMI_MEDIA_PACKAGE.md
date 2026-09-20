# V2-022 — STEMI media package 1.0.0

Status: **IMPLEMENTATION COMPLETE — REVIEW GATE PENDING**.
Implementation: **COMPLETE**. Technical verification: **PASS**.
Physician review: **PENDING**. Formal diagnostic rights/provenance review:
**PENDING** (owner-attested project generation; formal documentation outstanding).
This implementation checkpoint is not full V2-022 clinical/review closure.
V2-021 remains CLOSED. No clinical approval, rights approval, or Case publication
is implied. No new patient/diagnostic image was generated.

## Ownership and inventory

Manifest: `v2/content/media/stemi/manifest.json`. Associated with STEMI 2.0.1,
`case-package.stemi.inferior-rv.002`, `case-version.stemi.inferior-rv.002`,
UNDER_REVIEW / REVIEW_ONLY. Reuses existing `MediaAssetDefinitionSchema`, Case
asset IDs, result IDs, report keys and fallback fact IDs. This is file resolution
and provenance, not parallel clinical policy or a new Case module. The historical
`pending` suffix in existing IDs remains unchanged.

| Media ID | Selected package file / paired report | Status / fallback |
|---|---|---|
| `asset.stemi.ecg-standard-pending` | `ecg-002.png` / `ecg-002-report.txt` | REVIEW_ONLY, PENDING_PHYSICIAN_REVIEW; authored findings fallback |
| `asset.stemi.ecg-right-pending` | None: no matching right-sided tracing found | MEDIA_ASSET_PENDING; authored right-sided findings |
| `asset.stemi.cxr-pending` | `cxr-001.png` / `cxr-001-report.txt` | REVIEW_ONLY, PENDING_PHYSICIAN_REVIEW; authored findings fallback |
| `asset.stemi.echo-pending` | None: available echo candidates do not match this Case | MEDIA_ASSET_PENDING; structured/text echo, not an Expo image blocker |
| `asset.stemi.static-fallback-pending` | `patient-pain-semi-fowler.png`, `patient-pain-supine.png` | Approved-parent project visual reuse; no independent clinical sign-off claimed |
| `stemi.physical-exam-v02` | Existing V2-021 GLB and JSON, unchanged | Approved Expo primary visual; failure-only static fallback |

Packaged filenames above are under `v2/apps/web/public/media/stemi/1.0.0/`.
Exact source/report paths, hashes, report text, expected findings and review
questions are in [STEMI_DIAGNOSTIC_REVIEW_PACK.md](STEMI_DIAGNOSTIC_REVIEW_PACK.md).

Selected diagnostics are PROJECT_GENERATED per owner attestation. Formal rights
documentation and physician review remain pending. The ECG reference report says
approximately 84 bpm, while the Case says approximately 112 bpm. Both are preserved
verbatim and the discrepancy is visible beside the image. The library image/report
are review references, NOT replacement clinical truth. Physician matching review
is required before approved Expo use.

No V1 embedded image was copied. No new investigation, animation, Anaphylaxis
asset, or media-generation dependency was added.

## Authoritative results and timing

The real V2 Student workspace now uses `InvestigationResults` instead of its
placeholder. The existing authorized investigation GET supplies structured data
plus localized authored finding/report text. Text is resolved server-side from
the same authorized Case, only at its component's availability. No whole Case,
rubric, future event or internal finding ID list is shipped as result content.

The renderer checks the pinned REVIEW_ONLY 2.0.1 identities, exact result ID,
exact media ID and independent component statuses. The review host implements
the service using the existing GET endpoint; no new clinical API exists.

| Investigation | Structured result / image | Formal report |
|---|---|---|
| Standard ECG | Order + 120 clinical seconds | Order + 120 |
| Right-sided ECG | Order + 120; image remains missing | Order + 120 |
| Chest X-ray | Order + 300 | Order + 480 |
| Focused echo | Existing authored scheduler, unchanged | Existing authored scheduler, unchanged |

Before availability: Not ordered or Ordered — pending; no image/report fetch.
After availability: authored findings/measurements, optional image, authored
report, and separately labeled library reference report. A missing or failed
image never removes released text. No browser timer releases clinical results;
polling only re-reads authoritative projections. Other Cases cannot inherit this
STEMI media binding. An unavailable service remains fail-closed.

These are local review assets, not a secure licensed-media distribution system.
Static URLs are not authorization endpoints; the result UI enforces disclosure
timing. No offline cached clinical result or offline clinical authority is added.
Images and paired reports are packaged locally and precached; API responses are
still excluded. The 5 MiB precache ceiling accommodates the unchanged 4.09 MB ECG
instead of recompressing a diagnostic image. Optional AI/network loss cannot
remove local media bytes; authoritative Session availability is still required.

## Preserved patient fallback

3D remains primary. Only runtime/GLB failure with a supported pain presentation
selects the matching position still. The stills are byte-identical copies of
existing V04 project renders. Unsupported states never receive a falsely alert
stock patient. If the still also fails, the existing neutral unavailable panel
remains. No clinical write or invented monitor image is involved.

Rights evidence: lab `ASSET_PROVENANCE.md`, `LICENSE.ASSETS.md`,
`CLEAN_SKIN_PROVENANCE.json`; parent visual approval: `APPROVED_VISUAL_FOUNDATION.md`.
Visual Patient Lab was read only. The prior V2-022 fallback implementation was
preserved; this diagnostic integration did not modify it.

## Focused verification

- `npm run typecheck`: PASS.
- `npm run build`: PASS after bounded media precache correction; existing large
  runtime chunk warning remains. No thresholds/tests disabled.
- Focused Browser: **29/29**, Visual Patient/media/renderer and diagnostic API
  tests, including real STEMI orders and scheduler timing (119/120, 299/300/480).
- `node scripts/v2-022-media-check.mjs --built`: eight hashes, source still-copy
  equality, provenance fields, two image/report pairs, built-byte equality and
  four diagnostic/report precache entries.
- `npm run test:pwa`: private API caching remains absent.
- `npx playwright test --config playwright.v2-022.config.mjs`: **1/1 PASS**, real
  App + actual authorized API/Clinical Engine with external requests blocked;
  pending, ECG, right ECG text-only, CXR image-before-report, normal 3D.
  The test-only offline host uses predetermined trusted Clinical-Time milestones,
  not fabricated result events, live providers, or client-controlled timing.
- Existing V2-022 fallback Playwright evidence: **1/1 PASS**, normal 3D,
  forced GLB failure, failed still, unchanged Session and zero clinical writes.
- `git diff --check`: PASS.

Investigation screenshots: ignored `v2/test-results/v2-022/investigations-actual-STEM-0a0a2-ing-with-local-review-media/`
(`pending.png`, `ecg.png`, `cxr.png`, `right-sided-ecg.png`, `normal.png`).
Preserved fallback evidence: ignored
`v2/test-results/media-fallback--v2-022-act-f6f04--failure-no-clinical-writes/fallback.png`.
Screenshots are review artifacts, not Case media. Windows Playwright teardown
required stopping only the test-owned review-server process after its passing
assertions; no owner provider host or test assertion was changed.

V1, clinical source, frozen Architecture/ADRs, V2-021 provider/runtime assets and
Visual Patient Lab remain unchanged. The owner authorized one implementation
closeout commit; no push or V2-023 work. The physician review pack remains the
handoff artifact and the review gate stays open after committing.
