# V2-009 STEMI Specialist Review Checklist

Status: **PENDING — NOTHING IN THIS CHECKLIST IS ACCEPTED**

For every row, the specialist must select `ACCEPT`, `MODIFY`, or `REJECT` and provide a comment. Blank status means pending.

| # | Review target | Current authored decision | Status | Comment |
|---:|---|---|---|---|
| 1 | hs-cTnI assay/value/ULN | Synthetic hs-cTnI 286 ng/L, authored ULN 34 ng/L, HIGH |  |  |
| 2 | LVEF | Approximately 45% |  |  |
| 3 | TAPSE | Approximately 14 mm |  |  |
| 4 | RV anatomy/function | Mild-to-moderate dilation with reduced function |  |  |
| 5 | Investigation turnaround | ECG/right ECG +2 min; POC glucose +1; CBC/chemistry/coagulation +8; troponin +10; CXR image +5/report +8; echo image +4/report +6 |  |  |
| 6 | Local UFH PPCI protocol | 70 U/kg IV bolus for 84 kg patient |  |  |
| 7 | Fluid volume | One cautious 250 mL normal-saline challenge |  |  |
| 8 | Fluid duration | 10 Clinical minutes |  |  |
| 9 | Fluid response | HR 106, BP 94/64, RR 23, SpO2 92% room air, GCS 15, pain 7, modestly improved perfusion, clear lungs |  |  |
| 10 | Norepinephrine trigger | Persistent severe hypotension/shock; exact trigger not encoded |  |  |
| 11 | Norepinephrine starting concept | Approximately 0.05 µg/kg/min; no titration rule encoded |  |  |
| 12 | Penalties/caps | Nitrate forfeits the 5-point safe-hemodynamics criterion, deducts 10%, and marks unsafe without zeroing Management; beta blocker -8% plus unsafe; no Cath cap 60%; wrong disposition cap 40% plus unsafe |  |  |
| 13 | Cath educational windows | Full within authored early window, partial in wider window, major delay after; exact curve requires review |  |  |
| 14 | Standard ECG diagnostic asset | Not supplied; structured fallback authored |  |  |
| 15 | Right-sided ECG asset | Not supplied; structured fallback authored |  |  |
| 16 | CXR asset | Not supplied; structured fallback authored |  |  |
| 17 | Echo still/loop | Not supplied; structured fallback authored |  |  |
| 18 | Overall deterioration realism | T=10 deterioration, T=18 shock, +1-minute nitrate harm, no routine VT/VF/arrest |  |  |

Also pending: exact troponin assay choice, asset source/rights, quantitative echo review, official institution objective IDs, detailed norepinephrine titration, detailed opioid dose, media Clinical Approval, Clinical Review, and faculty publication approval.

## Authorship classifications

- **Authorized medical decisions:** the case identity, clinical presentation, initial state, diagnostic findings, action set, explicit safety decisions, trajectory states, and six-domain rubric described in the authoring specification.
- **Synthetic values requiring review:** patient identity, laboratory panel and turnaround values, quantitative echo values, deterministic response values, and educational scoring thresholds.
- **Not implemented:** opioid dose/effect, norepinephrine transition/titration, diagnostic media, Clinical Approval, curriculum approval, and publication.
