# V2-018 OpenAI Responses Provider

The OpenAI adapter uses standards-based `fetch` against `POST https://api.openai.com/v1/responses`; it has no OpenAI or Node-only SDK dependency. Trusted instructions and the user-role input item are separate request fields. The request always sends `store: false`, a bounded `max_output_tokens`, strict JSON Schema in `text.format`, and no tools. It omits background mode and `previous_response_id`, so provider storage is never application Session authority.

The implementation follows the current official [Create a model response](https://developers.openai.com/api/reference/cli/resources/responses/methods/create) and [Responses status/output object](https://platform.openai.com/docs/api-reference/responses-streaming/response/refusal) contracts as checked on 2026-09-08. It reads structured text from response output items rather than relying on an SDK-only convenience property. It separately handles `completed`, `failed`, `incomplete`, and refusal content and extracts only input, output, and total token counts from the larger provider usage object.

Only one completed output-text item proceeds. Malformed transport JSON, missing or multiple output fragments, failed/incomplete status, and refusal fail closed. A provider HTTP success is never sufficient by itself.
