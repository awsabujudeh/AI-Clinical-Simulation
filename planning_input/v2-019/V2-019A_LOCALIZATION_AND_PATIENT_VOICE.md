# V2-019A Localization and Patient Voice

Patient language identifiers remain exactly `ar-JO` and `en-US`; plain `en` is not accepted.

The two locales use the same fact IDs, manifestation IDs, and truth statuses. Localization changes expression only. Missing requested-locale content fails closed instead of silently changing truth.

`ar-JO` guidance asks for clear, conversational Jordanian Arabic in first person without excessive slang or physician-documentation tone. `en-US` guidance similarly requires concise patient voice rather than chart prose or generic AI-assistant branding.

The Student UI uses RTL for `ar-JO` and LTR for `en-US`. Offline and ended Sessions retain a read-only transcript and block new questions.

Institution metadata continues to use `JU` and `JUST`; internal `UJ` is not introduced.
