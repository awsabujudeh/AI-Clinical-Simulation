# AI Clinical Simulation Platform V2

This directory is the isolated workspace for Version 2. The repository-root `README.md` and `er_sim_10.html` remain the untouched V1 fallback/reference and are not imported, moved, or converted here.

V2-001 establishes portability and test infrastructure only. It does not implement a case schema, patient state, clinical/session/assessment engines, medical logic, production UI, authentication, databases, AI, speech, media, faculty features, cloud resources, or deployment.

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
npm run test:playwright
npm run test:portability-guard
npm run verify
```

Install the single Playwright browser once before browser-based tests:

```powershell
npm exec playwright install chromium
```

`npm run test:browser` executes the shared TypeScript smoke in Vitest Browser Mode. `npm run test:deno` imports the same source file through project-local Deno. Both assert the same serialized result.

## Portable package rules

Code under `packages/portability-smoke/src/` must remain deterministic, side-effect-free, and JSON-serializable. It must not depend directly on Node, Deno, browser globals, filesystems, databases, provider SDKs, or environment state. `npm run test:portability-guard` enforces this small V2-001 boundary.

## Source of Truth and rollback

The two files under repository-root `planning_input/` are frozen, read-only Architecture Source of Truth documents. They are not copied into this workspace.

V2-001 is reversible by removing `v2/` and the V2-scoped `.github/workflows/v2-001.yml` workflow. V1 requires no rollback because V2-001 does not modify it.
