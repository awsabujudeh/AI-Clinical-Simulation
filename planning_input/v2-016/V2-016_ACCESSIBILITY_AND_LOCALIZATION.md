# V2-016 Accessibility and Localization

## Localization

The interaction UI uses the existing `ar-JO` and `en-US` authority. Document language and direction switch between Arabic RTL and English LTR. Generic control/status text is localized in the existing message catalogue. Case-authored clinical labels are not machine-translated: exact authored locale falls back to authored `en-US`, then the stable Action ID.

The legacy Patient locale `en` and internal institution code `UJ` are not introduced.

## Accessibility baseline

- semantic tab list and tab controls for domains
- button-based action selection with disabled states
- associated labels and described form errors
- `alert` semantics for validation issues
- live status region for pending, recovery, conflict, and committed states
- modal confirmation semantics, autofocus, explicit cancel, and Escape cancellation
- visible focus behavior inherited from the V2-015 component system
- textual status in addition to color/tone

Responsive Browser checks cover 1440×900, 1366×768, and 1024×768 without horizontal page overflow. This is an engineering accessibility baseline, not a claim of formal WCAG certification.
