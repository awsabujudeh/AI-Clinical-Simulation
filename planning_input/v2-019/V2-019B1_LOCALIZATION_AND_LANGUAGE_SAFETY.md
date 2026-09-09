# V2-019B1 Localization and Language Safety

Patient-language identifiers remain exactly `ar-JO` and `en-US`; plain `en` is invalid. The same language-neutral action IDs and parameter contracts are used in both locales. Authored learner-safe labels and optional Case-owned aliases provide parsing vocabulary. `JU` remains the University of Jordan code; `UJ` is not introduced.

The deterministic evaluation corpus covers Jordanian Arabic, English, and Arabic/English clinical code-switching. Equivalent utterance meaning is reconciled against the same authorized catalogue, so language cannot expand clinical authority.

Safety categories include negation, hypothetical or educational questions, past-tense reports, self-correction, ambiguity, no match, malformed numeric input, unavailable actions, prompt injection, and compound commands. In particular, a negated action is not a command, a past report is not repeated, and a question asking what should be done is not converted into a recommendation.

Numbers and units are accepted only as explicit model-extracted values that pass the Case-owned parameter contract. The interpreter does not silently convert units or generate plausible values. Missing clinically meaningful values remain unresolved.

The Clinical Actions UI supplies localized labels, states, and failure messages in both canonical locales. Patient Conversation remains a separate surface in both LTR and RTL layouts.
