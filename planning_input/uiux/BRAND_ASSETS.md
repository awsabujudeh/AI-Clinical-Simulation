# BALSIM official web brand assets

Owner-supplied official Bright/Dark raster reference; no replacement logo was generated or redrawn. Owner authorized its use for this UI pass. This records supplied provenance, not a separate third-party license certification.

Original PNG SHA-256: `f9e05525fccb7448ef17205524c2fcbc574ce4ea7f01362b6d2107dbcce6567e`.

The preserved reference is `v2/apps/web/public/brand/balsim-official-reference.png`. `v2/scripts/uiux-brand-assets.ps1` performs lossless rectangular extraction only. Geometry, color, lettering and official tagline are unchanged; the original Bright/Dark backgrounds remain in the raster.

| Slot | Bright | Dark | Use |
| --- | --- | --- | --- |
| Full lockup | `balsim-bright.png` | `balsim-dark.png` | Retained reusable asset; original tagline included; no Home composition prescribed |
| Standalone B | `balsim-mark-bright.png` | `balsim-mark-dark.png` | Compact header and favicon |
| Wordmark | `balsim-wordmark-bright.png` | `balsim-wordmark-dark.png` | Reserved horizontal brand slot |

All files are under `v2/apps/web/public/brand/`. The original 1672×941 master is preserved separately from these crops. Do not use a crop to overwrite a future vector master. A later owner-supplied SVG can replace these slots through `Brand.tsx` and theme favicon selection; no component geometry redraw is needed. Raster favicons are an Expo accommodation, not a completed mobile icon export set.

The official tagline is **PRACTICE TODAY, BETTER CARE TOMORROW**. It remains in the supplied full-lockup asset. The rejected Home composition has been removed; no new placement is prescribed by the salvage. Interface branding includes the Arabic name **بَلسِم**.

## Design primitives

`v2/apps/web/src/design-system.css` now contains only minimal color-mode substitutions and compact official-brand/theme-control sizing. The rejected typography, spacing, grids, card hierarchy and decorative design tokens were removed. Committed V2-028 styles retain layout authority. No external fonts, design frameworks or animation dependencies were added. The 3D canvas and diagnostic image pixels are not filtered by either theme.

Bright and English are first-use defaults. Only theme preference is stored locally (`balsim.theme.v1`); storage denial degrades safely to the in-memory preference. Arabic switches document direction and interface geometry to RTL. Authored medical content is rendered as supplied, not rewritten to fabricate translations or curriculum approval.
