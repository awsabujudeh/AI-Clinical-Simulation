# V2-009 STEMI Review Target

This is the exact artifact intended for specialist and architecture review. It is **not** an Approval Record and contains no `approved_package_hash`.

## Identity

- Case ID: `case.stemi.inferior-rv.001`
- Case Version ID: `case-version.stemi.inferior-rv.001`
- Case Package ID: `case-package.stemi.inferior-rv.001`
- Semantic version: `2.0.0`
- Source lifecycle: `UNDER_REVIEW`
- Execution authority: `REVIEW_ONLY`
- Technical executability: `PASS`
- Rule Reachability/liveness: `PASS`

## Hash authorities

- `review_subject_hash`: `46388c32e3ef74db413228adf837e90e828913a7db996a3ba57d181a2cbab11f`
- `review_execution_hash`: `a8e76e5cd96c8b29461968796d295674f8de1ab3630a55a5568a25664c2b7ab7`
- Rule Reachability evidence hash: `48bdd20c470c32debfc1a56d31257feee540ae721c1735d57b187b15c2b7cc5f`

| Module | SHA-256 |
|---|---|
| manifest | `2f82dfc37f729872ef542251af946da6ba618a53eab3f4874f15e889b9c508d2` |
| classification | `4dc51a6f5358b269e63ca9397a4423a593ec167fe34938c498069f5222541e4c` |
| localization | `ab2407724328509a2d40b201e90afbd20f42e681ebb70192b62fc021760a1c3b` |
| patient_profile | `4a01198ad67e9285b188151917bba022ce8cd804d4a611c99958b4b27d89bc79` |
| presentation | `dc1f8cb12b6bcd8a27b7173c1b1a88643d6dee0bee41f8e08024cdc7ddf8b939` |
| initial_state | `ccccd0399a392b47f360968ce8183f3d5e5bdd18172c36830e225ce5e105bea7` |
| clinical_facts | `ff8b76871d30cb1cf611004229ab34a208c420afa680ac08f76e7cf6c9e5b42d` |
| action_catalogue | `a4f2eb68e9e61ff18323da125f4e96cd63d12867f98a171bd71ddec11d6fbf0b` |
| rules | `5015b678b342506711ed0e53009ff259093dae7a3f5d1a4f0af0a3cf9bb5825f` |
| timeline_policy | `124ae0f382212f826be23c6a4936396ae4eb984eba84c5926beb276388a4b5d0` |
| assessment_rubric | `248aebf6202a3cc6ef026fb806356bcfafda9af87954bfb72c3c7ed8a4e2cf5f` |
| dialogue_policy | `10db844b0973faaa4060f04ff7351a1c4ea739de4bf97dd36378a85d4033964d` |
| visual_manifest | `35484450582aac5305e4ea833573a357c509af5907a604eb6fce5ab28cf4f2c7` |
| curriculum_mappings | `c8580d5bc65dc213762959e9d1dbb1a343611db8094d07b961b9d7805fb1ff67` |
| validation | `2e72325619606fb38a78a20ca343c410c2a05f2b61e9871fcfed6a09b597a271` |
| instructor_notes | `04004194c7e1427bdcc8e924d56d2a6c41d93f1a21d8aad8b6b9b5b8374869f3` |

## Outstanding gates

- Clinical Review: **PENDING**
- Specialist medical review: **PENDING**
- Curriculum/UX review and official JU/JUST objective mapping: **PENDING**
- Visual/media review: **PENDING**
- Diagnostic assets, provenance, rights, and Clinical Review: **PENDING**
- Source-version and claim review: **PENDING**
- hs-cTnI assay/value/ULN, echo values, investigation timings, UFH local protocol, fluid model, norepinephrine details, assessment thresholds/caps, and trajectory realism: **PENDING SPECIALIST REVIEW**
- Exact-package Approval: **ABSENT**
- Published Case Package: **ABSENT**

Any relevant change to authored medical content, projection policy, rules, evidence, rubric, dialogue, diagnostic fallback, or governance snapshot must produce a different hash and a new review target.
