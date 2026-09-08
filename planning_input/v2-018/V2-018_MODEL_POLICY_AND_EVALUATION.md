# V2-018 Model Policy and Evaluation

Model routing is trusted server configuration. The only architecture-approved evaluation candidates represented by this foundation are `gpt-5.6-luna` and `gpt-5.6-terra`. A capability definition selects exactly one candidate for a run; retries retain that model. The browser cannot provide a model or model-policy identity, and the gateway performs no silent Luna-to-Terra, Terra-to-Sol, or other failover.

No production winner is selected by V2-018. Patient Conversation, Clinical Interpreter, Tutor, Assessment Analysis, and Case Drafting exist only as capability identities; their prompts, context builders, behavior, evaluation datasets, and application routes remain later work. Disabled capability flags fail closed.

Safe evaluation metadata records capability, prompt and output-schema versions, model-policy identity, provider-returned model, reasoning effort when configured, latency, usage, response status, and retry count. V2-019 must run the paired quality, safety, Arabic, latency, and consistency evaluation gate before activating Patient or Interpreter workflows.
