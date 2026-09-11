# V2-019B2 Cost and Latency Report

Pricing snapshot: **2026-09-10**, USD per one million text tokens.

| Model | Input | Output |
|---|---:|---:|
| `gpt-5.6-luna` | $0.20 | $1.20 |
| `gpt-5.6-terra` | $2.00 | $12.00 |

Sources are the official OpenAI model pages recorded in the machine freeze.

| Capability/model | Input tokens | Output tokens | Median | p95 | Cost |
|---|---:|---:|---:|---:|---:|
| Patient / Luna | 97,065 | 20,242 | 2473 ms | 4750 ms | $0.0437034 |
| Patient / Terra | 98,256 | 12,704 | 2119 ms | 3921 ms | $0.3489600 |
| Interpreter / Luna | 148,193 | 19,948 | 2559 ms | 3971 ms | $0.0535762 |
| Interpreter / Terra | 148,201 | 12,842 | 2031 ms | 3851 ms | $0.4505060 |
| **Selection run** | **491,715** | **65,736** | — | — | **$0.8967456** |

Previously authorized diagnostics and symmetric schema smokes cost approximately $0.1984864. Cumulative V2-019B2 spend is therefore approximately **$1.095232**, below the authorized **$5.00** ceiling. No cost reduction changed the frozen 648-request matrix.

Terra was faster in both capability samples and more expensive at the frozen rates. Latency and cost were considered only after hard safety and deterministic correctness/reliability, and neither changed the capability-specific selections.
