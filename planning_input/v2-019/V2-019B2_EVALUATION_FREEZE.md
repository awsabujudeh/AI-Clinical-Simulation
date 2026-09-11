# V2-019B2 Evaluation Freeze

Status: **COMPLETE — SELECTION VALID**

- Freeze hash: `f2ef12edf75e52016221563975da5689f698659ad12189c06cdeae88785d5523`
- Harness version: `1.2`
- Result normalization: `1.0`
- Machine freeze: `v2/evaluation/v2-019b2.freeze.json`
- Candidates: `gpt-5.6-luna`, `gpt-5.6-terra`
- Repetitions: 3 per case/model
- Matrix: 54 Patient cases + 54 Interpreter cases, both models, 648 requests
- Order: repetition → capability → case → paired Luna/Terra
- Maximum concurrency: 2
- Reasoning: `low`
- Provider storage: `false`
- Tools: none

## Frozen capability identities

| Capability | Prompt | Provider schema | Domain schema | Maximum output |
|---|---|---|---|---:|
| Patient Conversation | `prompt.patient-conversation@1.0` | `ai-schema.patient-conversation@1.0` | `1.0` | 256 |
| Clinical Interpreter | `prompt.clinical-interpreter@1.0` | `ai-schema.clinical-interpreter@2.0` | `1.0` | 1536 |

| Capability | Prompt SHA-256 | Schema SHA-256 | Corpus SHA-256 | Label SHA-256 | Method SHA-256 |
|---|---|---|---|---|---|
| Patient | `179a8e07a1d174333d574388c2c53b20699a87476593d5304511056abb38aaef` | `7f6f3330231fbc5c71a12feed403354736a823e91cdbbca11c5f9fe5500014b1` | `f7432435c624add8704eb23eaa5030fdfc21b81dd0157dbdaec48b642d532071` | `c3544acf098a5696a4255d8329df4b6d33ae1ae315f227d3d9bee1b3be2c676a` | `0345436c29dfe3408bfb0b7051c0b5e2188f4887ab88a7b70b7684a9b11a82ce` |
| Interpreter | `276628e2e4aad5425352e6465908b6433521c44221d53ba00a600e160eb4fb71` | `299c39c289d6e38bb9706b19cb9c7c3c57310f1aba3d0cb7170efdcbeb954885` | `1f8d75faff6f4a48774be5941d355e24b4e6eb72b30bdbd3d22ddf086e86606d` | `ffb7569ac55b43d683823e41d6ab671944b11f6bfc35aa7f45c3b5573c482f53` | `94eb7ac05301bdce2ccebbe31d2e622fc654336dbaa978d2c57fc3269bb4accd` |

## Completion integrity

The durable checkpoint contains 648 valid records, 648 unique composite identities, zero missing identities, zero duplicates, and exactly one freeze hash. Counts are 162 for each capability/model pair. Recorded provider failures remain final evidence and were not retried outside policy. The normalized checkpoint SHA-256 is `834ea968d4eec17a376e5da09e6cb9c305534a227ecf809dacd31ac5a2ee0fe0`.

Earlier invalidated freezes and their partial records are historical diagnostic evidence only. They were not mixed into this selection-valid run.
