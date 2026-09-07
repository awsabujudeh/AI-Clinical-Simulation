# V2-016 Domain Interaction Matrix

| Domain | Current interaction | Authority and deferral |
|---|---|---|
| History | Domain remains visible; no generic free-text control | No Patient AI or canned dialogue. A future explicitly typed History action can be added only through the safe catalogue contract. |
| Examination | Select disclosed Case action and submit structured parameters | Findings are never calculated or fabricated in React. |
| Investigations | Propose disclosed investigation action | No local result, media, timing, machine interpretation, or report is fabricated. Existing diagnostic availability remains authoritative. |
| Medications | Render configured numeric/code/string fields such as dose, unit, and route | No correct dose, preferred treatment, contraindication, or effect is inferred. Confirmation is intent confirmation; server validation remains decisive. |
| Procedures | Select disclosed procedure/consult action and submit configured fields | No equipment, vital, Patient State, or Visual Patient mutation occurs locally. |
| Diagnosis / Disposition | Submit configured text or safe configured choices | No autocomplete answer leakage, local scoring, correctness indication, or automatic Session end. |

Search and ordering are neutral label/identifier matching. They never rank rubric-relevant or clinically correct actions.
