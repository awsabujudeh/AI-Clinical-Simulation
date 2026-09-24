import { prepareDanaReview } from "../../../content/cases/anaphylaxis/dana-case.ts";
import { prepareStemiConversationArtifact } from "../../../content/cases/stemi/v2-conversation/stemi-conversation-case.ts";
import { createSecureApiApp, createMemorySpeechTokenBroker } from "../../../packages/api-core/src/index.ts";
import { apiHeaders, createApiTestHarness, startBody } from "../api/secure-api.ts";
import { PORTABLE_SHA256_ADAPTER } from "../portable-sha256.ts";
import type { PatientVoiceProfile } from "../../../packages/contracts/src/index.ts";

export async function twoCaseHarness() {
  const dana = await prepareDanaReview(PORTABLE_SHA256_ADAPTER);
  if (!dana.success) throw Error("Synthetic security setup failed");
  const stemi = await prepareStemiConversationArtifact(PORTABLE_SHA256_ADAPTER);
  const profiles: PatientVoiceProfile[] = ["dana", "stemi"].map(name => ({
    profile_version: "2.0", profile_id: `voice-profile.${name}-security`, provider: "ELEVENLABS",
    model_id: "eleven_v3_conversational", voices: { "ar-JO": `synthetic-${name}`, "en-US": `synthetic-${name}` }
  }));
  let tokenCalls = 0;
  const broker = createMemorySpeechTokenBroker({ async issue() {
    tokenCalls++; return { single_use_token: "synthetic-security-token" };
  } }, () => 1000, profiles);
  const cases = [];
  for (const [index, artifact] of [dana.artifact, stemi].entries()) {
    const name = index === 0 ? "dana" : "stemi";
    const contexts: string[] = [];
    let bound: string | undefined;
    const h = await createApiTestHarness({ review_artifact: artifact, enable_patient_conversation: true,
      speech_token_broker: broker,
      resolve_voice_profile: session => session.session_id === bound ? profiles[index]!.profile_id : undefined,
      patient_provider: { async execute(request) {
        contexts.push(request.user_content);
        // A malicious/invalid model response must become a safe fallback, not an effect.
        return { success: true, provider: "OPENAI", output_text: JSON.stringify({ patient_state: { heart_rate: 1 }, score: 100 }),
          provider_response_id: "synthetic-malicious-output", provider_model: request.model, retry_count: 0 };
      } }
    });
    const response = await h.app.request("/v1/review-sessions", { method: "POST",
      headers: apiHeaders({ token: "faculty", idempotency: `idempotency.security.${name}` }),
      body: JSON.stringify(startBody(artifact.source_case.manifest.case_id, { mode: "PRACTICE_DEMO", patient_language: "ar-JO" })) });
    if (response.status !== 201) throw Error("Review setup failed");
    const sessionId: string = (await response.json()).data.session.session_id;
    bound = sessionId;
    cases.push({ h, artifact, name, sessionId, contexts, profile: profiles[index]!, otherProfile: profiles[1 - index]! });
  }
  return { cases, tokenCalls: () => tokenCalls };
}

/** Same deterministic bidirectional security probe in Browser and Deno. No network. */
export async function twoCaseSecuritySnapshot() {
  const setup = await twoCaseHarness();
  const rows = [];
  for (const c of setup.cases) {
    const other = setup.cases.find(candidate => candidate !== c)!;
    const headers = apiHeaders({ token: "faculty", idempotency: "idempotency.security.token" });
    const token = (profile: string) => c.h.app.request("/v1/voice/token", { method: "POST", headers,
      body: JSON.stringify({ session_id: c.sessionId, locale: "ar-JO", capability: "TTS", voice_profile_id: profile }) });
    const foreignVoice = await token(c.otherProfile.profile_id);
    const ownVoice = await token(c.profile.profile_id);
    const session = c.h.store.sessions.get(c.sessionId)!;
    const before = JSON.stringify(session);
    const state = await c.h.app.request(`/v1/sessions/${c.sessionId}/state`, { headers });
    const stateData = (await state.json()).data;
    const foreignSession = await c.h.app.request(`/v1/sessions/${other.sessionId}/state`, { headers });
    const mismatchedApp = createSecureApiApp({ ...c.h.dependencies, authority_repository: {
      ...c.h.dependencies.authority_repository,
      async authorizeSession(input) {
        const value = await c.h.dependencies.authority_repository.authorizeSession(input);
        return value.success ? { success: true, value: { ...value.value, artifact: other.artifact } } : value;
      }
    } });
    const mismatched = await mismatchedApp.request(`/v1/sessions/${c.sessionId}/state`, { headers });
    const foreignResult = other.artifact.source_case.action_catalogue.actions.find(a => a.investigation)?.investigation?.result.diagnostic_result_id;
    const investigation = await c.h.app.request(`/v1/sessions/${c.sessionId}/investigations/${foreignResult}`, { headers });
    rows.push({ case: c.name, foreign_voice: foreignVoice.status, own_voice: ownVoice.status,
      foreign_session: foreignSession.status, swapped_artifact: mismatched.status, foreign_result: investigation.status,
      asset: stateData.session?.visual_patient?.asset_id ?? stateData.visual_patient?.asset_id,
      unchanged: before === JSON.stringify(c.h.store.sessions.get(c.sessionId)) });
  }
  return { rows, token_calls: setup.tokenCalls() };
}

export const TWO_CASE_SECURITY_EXPECTED = {
  rows: [
    { case: "dana", foreign_voice: 403, own_voice: 200, foreign_session: 404, swapped_artifact: 404, foreign_result: 404, asset: "dana.review-v01", unchanged: true },
    { case: "stemi", foreign_voice: 403, own_voice: 200, foreign_session: 404, swapped_artifact: 404, foreign_result: 404, asset: "stemi.physical-exam-v02", unchanged: true }
  ], token_calls: 2
};
