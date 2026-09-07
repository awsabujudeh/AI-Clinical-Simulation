# V2-015 Accessibility and Localization

## Locale authority

The shell imports the shared `PatientLanguageSchema` and supports exactly:

- `ar-JO`, rendered with `lang="ar-JO"` and `dir="rtl"`;
- `en-US`, rendered with `lang="en-US"` and `dir="ltr"`.

Plain `en` is not introduced as a patient-language identifier. Clinical codes, identifiers, units, and server-owned truth remain language-neutral. UI copy is a small authored dictionary for this shell; it is not a medical translation system.

## Arabic behavior

Arabic layout reverses document direction and panel flow while preserving readable mixed-direction identifiers, units, and common monitor abbreviations. Copy uses realistic Jordanian Arabic shell terminology without translating or inventing hidden clinical content.

## English behavior

English uses the same hierarchy and content boundaries in LTR. Layout does not depend on one language having shorter labels.

## Accessibility baseline

- semantic header, navigation, main, section, form, and status regions;
- associated form labels and descriptive help text;
- keyboard-operable links, buttons, locale controls, and action-domain tabs;
- visible `:focus-visible` treatment;
- selected tabs expose `aria-selected`;
- loading and recovery messages expose status semantics;
- error messages expose alert semantics;
- critical connectivity/mode state is conveyed by text and iconography, not color alone;
- reduced-motion preferences are respected.

The permanent component, static, and Playwright smoke tests verify these boundaries. This slice does not add a heavyweight accessibility framework or claim formal conformance certification.
