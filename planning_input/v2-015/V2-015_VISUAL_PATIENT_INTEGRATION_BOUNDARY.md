# V2-015 Visual Patient Integration Boundary

## Current boundary

The workspace reserves a first-class Visual Patient region so the future visual experience fits the clinical layout without taking ownership of medical truth. V2-015 renders only a neutral, accessible placeholder and status copy.

The region accepts no raw Patient State, media URL, arbitrary asset identifier, or client-authored visual rule. It does not resolve media, choose clinical appearance, generate video, animate a waveform, or infer an observation.

## Future owner

V2-021 may connect this slot to the approved Visual Patient strategy:

- reusable, pre-generated and approved Visual Patient library;
- dedicated manually prepared Expo visual packs where required;
- clinically appropriate reuse only;
- mandatory static fallbacks;
- future Parametric Digital Patient/3D Avatar only under its own reviewed architecture.

Any future resolver must consume approved, pinned Case visual descriptors and disclosure-safe runtime data. It must not introduce an unreviewed sidecar policy or overwrite authoritative Patient State.

## Explicit exclusions

V2-015 includes no Three.js, React Three Fiber, 3D scene, video generation, diagnostic-media ingestion, asset pipeline, visual resolver, CDN, external media request, or cloud resource.
