# AI Clinical Simulation Platform V2

This directory is the isolated workspace for Version 2. The repository-root `README.md` and `er_sim_10.html` remain the untouched V1 fallback/reference and are not imported, moved, or converted here.

V2-001 establishes the preserved portability and test baseline. V2-002 adds shared contracts and identifiers only. It does not implement a Case Schema compiler or package content, clinical/session/assessment engines, medical rules, state transitions, vital calculations, production UI, authentication, databases, AI, speech, media, faculty features, cloud resources, or deployment.

## V2-002 shared contracts

`packages/contracts/` is the single owner of portable runtime-validation schemas and inferred TypeScript types shared by later V2 packages. It contains identifiers, locale and institution metadata, lifecycle categories, action/request/proposal boundaries, the canonical event envelope, the explicit Patient State shape, public API errors, and narrow runtime adapter interfaces. It contains no clinical logic and no adapter implementations.

Domain and catalogue identifiers use justified lowercase namespaces, such as `case.*`, `rule.*`, and approved Action IDs like `investigation.*`. Runtime/operational identifiers use bounded ASCII-safe opaque values and keep distinct TypeScript brands without requiring invented prefixes. Persisted Event IDs are canonical UUIDs as required by the Physical Architecture. State, sequence, and proposal versions remain validated integer counters.

Schema versions use the frozen `major.minor` form (for example `2.0`), while Case Package/content versions use the separate `major.minor.patch` semantic form (for example `2.0.0`). Event and Patient State `case_version` fields carry semantic versions, not Case Version identity records.

Patient language is exactly `ar-JO` or `en-US`. Tutor output locale and authored locale use separate nominal contracts so they cannot be confused with patient language. Expo institution metadata is canonical:

- `ju` / `JU` / `University of Jordan`
- `just` / `JUST` / `Jordan University of Science and Technology`

Public contract objects are strict and reject unknown fields. The explicit `parameters`, `payload`, intervention attributes, and adapter metadata boundaries accept only JSON-serializable values. This lets extensions remain intentional without weakening high-risk envelopes.

Intent candidates and interpreter `MATCHED` references are explicitly non-authoritative. An Action Request carries syntactically valid input with unverified catalogue membership; a later deterministic Session/Clinical owner must revalidate it against the pinned Case Package before any approval or execution. This package performs no lookup, execution, or Patient State mutation.

At the external JSON boundary, an absent optional field and a JavaScript optional property whose value is `undefined` serialize equivalently as absent. JSON payload boundaries themselves reject `undefined`.

The package imports the same TypeScript source in Browser/Vite and project-local Deno. Runtime-specific behavior belongs behind `ClockAdapter`, `PersistenceAdapter`, `StorageAdapter`, `LoggerAdapter`, `RandomSeedAdapter`, or `HashAdapter`; the contracts package imports no runtime or provider SDK.

## Requirements

- Node.js 24
- npm 11

All JavaScript dependencies use exact versions in `package-lock.json`. Deno 2.9.6 is a pinned dev dependency and npm scripts resolve its project-local executable; no global Deno installation or `PATH` entry is required.

## Commands

Run these commands from `v2/`:

```powershell
npm install
npm run dev
npm run build
npm run typecheck
npm run test:browser
npm run test:deno
npm run test:contracts
npm run test:playwright
npm run test:portability-guard
npm run verify
```

Install the single Playwright browser once before browser-based tests:

```powershell
npm exec playwright install chromium
```

`npm run test:browser` executes the shared TypeScript smoke and focused contract tests in Vitest Browser Mode. `npm run test:deno` imports the same source files through project-local Deno. Both runtimes assert the same representative serialized contract result. `npm run test:contracts` runs the focused Browser and Deno contract checks plus the forbidden-import guard.

## Portable package rules

Code under `packages/portability-smoke/src/` and `packages/contracts/src/` must remain deterministic, side-effect-free, and portable. It must not depend directly on Node, Deno, browser globals, filesystems, databases, provider SDKs, or environment state. `npm run test:portability-guard` enforces these boundaries and checks canonical contract sources/fixtures for a reversed University of Jordan code.

## Source of Truth and rollback

The two files under repository-root `planning_input/` are frozen, read-only Architecture Source of Truth documents. They are not copied into this workspace.

V2-001 is reversible by removing `v2/` and the V2-scoped `.github/workflows/v2-001.yml` workflow. V1 requires no rollback because V2-001 does not modify it.
