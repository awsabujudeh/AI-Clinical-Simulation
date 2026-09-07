# V2-015 Workspace Layout

## Primary layout

The learner workspace is optimized for the Expo desktop/laptop experience while remaining usable on tablet:

- a compact navigation header;
- a full-width patient/context header;
- a responsive two-column clinical workspace on wide screens;
- a monitor-first primary column;
- Visual Patient and investigation regions in the complementary column;
- action-domain navigation and timeline/status regions below.

At narrower tablet widths the columns stack without changing information ownership or hiding critical status text. The portrait-tablet layout is a supported sanity fallback rather than the primary Expo composition.

## Region boundaries

The monitor renders only server-supplied observation values and explicit rhythm descriptors. It does not synthesize waveforms, interpolate values, infer rhythm, or advance Clinical Time.

The Visual Patient region is a first-class placeholder for a future approved asset resolver. It contains no Three.js, React Three Fiber, video generation, media selection, or 3D implementation.

The investigation region is an integration boundary only. It does not request, parse, render, or unlock diagnostic media.

The action region exposes navigational categories but no clinical mutation endpoint. Selecting a tab changes only local presentation; it cannot change Patient State.

The timeline region displays authoritative Clinical Time and Session status received from the safe projection. It contains no clock, interval, scheduler, or catch-up calculation.

## Responsive and visual rules

- Desktop target: 1440 × 900.
- Laptop target: 1366 × 768.
- Tablet landscape target: 1024 × 768.
- Tablet portrait sanity target: 768 × 1024.
- Long labels wrap rather than clip.
- Status meanings include text/icons and are not color-only.
- Focus rings remain visible.
- Reduced-motion preferences disable nonessential animation.
