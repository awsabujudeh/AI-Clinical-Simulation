# V2-009 STEMI Golden Traces

All traces execute the same real `UNDER_REVIEW` source through its immutable `ReviewExecutionArtifact`, review Clinical Policy, review Session, authoritative committed events, Clinical Time, real Case rules and observation projection, review Assessment context, and `evaluateReviewAssessment`. They never use production authority or manually injected scoring evidence.

## A. Excellent

- T=0: focused HPI, contraindication/medicine review, risk history, focused hemodynamic/perfusion, lungs/JVP, cardiac/neurologic examination, monitor, and peripheral IV readiness.
- T=1: standard ECG ordered.
- T=3: ECG result/image/fallback report available; inferior STEMI submitted; aspirin 324 mg chewed; PPCI/Cath pathway activated; ticagrelor 180 mg; UFH 70 U/kg; right-sided ECG ordered; baseline oxygen-not-indicated decision recorded.
- T=5: right-sided result available; RV involvement submitted; hemodynamics reassessed; one cautious 250 mL fluid challenge started; atorvastatin 80 mg; Cath transfer initiated.
- T=15: bounded fluid completion is settled. Cath activation prevented T=10/T=18 delay rules. No nitrate, routine oxygen, malignant rhythm, instant reperfusion, or cure was created.

Deterministic result: score `10000/10000`, unsafe `false`, 29 committed events.

## B. Delayed / suboptimal

- T=0: CBC, chemistry, coagulation, and CXR ordered before the priority ECG.
- T=3: hs-cTnI ordered.
- T=8:20: standard ECG finally ordered.
- T=10: the authored no-Cath deterioration rule executes (HR 118, BP 82/54, RR 26, SpO2 92%, pain 9, alert, worse perfusion).
- T=10:20: ECG is available and inferior STEMI is recognized.
- T=13: hs-cTnI returns; the learner has waited for it before activating PPCI.
- T=13: Cath pathway and transfer are finally initiated.

The patient remains salvageable; no artificial death is produced. Deterministic result: score `2800/10000`, unsafe `false`, 21 committed events. The low score reflects actual missed history/exam/management/reasoning evidence and timing, not score tuning.

## C. Unsafe but recoverable

- T=0: nitroglycerin is given in the baseline hypotensive/RV pathway.
- T=1: Case-owned nitrate harm executes at HR 122 and BP 72/44 with marked impaired perfusion, dizziness, GCS-compatible 14, severe persistent pain, and the nitrate-hypotension complication. It does not create arrest or death.
- T=1: learner reassesses and orders ECG.
- T=3: ECG becomes available; inferior STEMI is submitted; PPCI/Cath pathway activated; Cath transfer initiated.

Deterministic result: score `3200/10000`, unsafe `true`, 11 committed events. `MARK_UNSAFE`, the explicit 5-point safe-hemodynamics forfeiture, and the 1,000-basis-point overall nitrate deduction remain active. The whole Management domain is not zeroed, and the patient remains recoverable.

## Determinism identity

The exact portable serialized trace summary SHA-256 is:

`14fcf7de8a969fba49eb3d0d96db783f1c77e1fb2a89594c81f453495ace9a58`

Browser and Deno tests must reproduce this exact digest.
