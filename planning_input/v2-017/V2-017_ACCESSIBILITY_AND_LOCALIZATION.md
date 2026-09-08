# V2-017 Accessibility and Localization

V2-017 uses the canonical `ar-JO` and `en-US` locales. Plain `en` is not a patient-language identifier, and `UJ` is not introduced as an institution identity.

Monitor, timeline, Assessment, debrief, loading, empty, stale, and error language is provided in Arabic and English. Case-authored timeline and Assessment labels are resolved server-side and carried as learner-safe localized data. Presentation-only rhythm and consciousness fallbacks never replace the language-neutral source identity.

The three learner surfaces use labelled semantic regions. Timeline history uses an ordered list, final findings use lists and headings, and status meaning is conveyed with text in addition to colour. Existing skip-link, focus-visible, keyboard, and reduced-motion behavior remains intact.

Arabic selects right-to-left document direction. Numeric clinical time and monitor units retain left-to-right direction for readability. Responsive layouts are verified at 1440×900, 1366×768, and 1024×768 without horizontal clipping.
