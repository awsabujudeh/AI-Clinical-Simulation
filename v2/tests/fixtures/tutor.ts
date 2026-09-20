import { TutorOutputLocaleSchema } from "../../packages/contracts/src/index.ts";
import { buildTutorEvidence, generateTutorDebrief, SecureAiGateway, TrustedCapabilityRegistry, TUTOR_CAPABILITY } from "../../packages/ai-gateway/src/index.ts";
import { createCompiledAssessmentCase, evaluateSyntheticAssessment, createExecutedSyntheticCheckEvent } from "./assessment-engine/synthetic-assessment.ts";
import { PORTABLE_SHA256_ADAPTER as hash } from "./portable-sha256.ts";

/** Deterministic provider DOUBLE ONLY. Never used in trusted live composition. */
export function tutorTestGateway(output?: unknown, fail = false) {
  let calls = 0;
  const gateway = new SecureAiGateway({ registry: new TrustedCapabilityRegistry([TUTOR_CAPABILITY]),
    clock: { nowMilliseconds: () => 0 }, capacity: { authorize: async () => ({ allowed: true }) }, logger: { log() {} },
    provider: { async execute(request) {
      calls++;
      if (fail) return { success: false, provider: "OPENAI", code: "AI_PROVIDER_UNAVAILABLE", response_status: "FAILED", retryable: false, retry_count: 0 };
      const p = JSON.parse(request.user_content);
      return { success: true, provider: "OPENAI", provider_response_id: "test-tutor", provider_model: request.model, retry_count: 0,
        output_text: JSON.stringify(output ?? { priority_criterion_ids: p.criteria.filter((c: any) => ["MISSED", "TRIGGERED"].includes(c.criterion.status)).slice(0, 5).map((c: any) => c.criterion.rubric_item_id), evidence_chunk_ids: [] }) };
    } }
  });
  return { gateway, calls: () => calls };
}
export async function tutorFixture(completed = false) {
  const artifact = await createCompiledAssessmentCase();
  const evaluated = evaluateSyntheticAssessment({ casePackage: artifact,
    committedEvents: completed ? [createExecutedSyntheticCheckEvent(artifact, 1, 30)] : [], assessedThroughClinicalTime: 120 });
  if (!evaluated.success) throw Error("ASSESSMENT_FIXTURE_FAILED");
  const packet = buildTutorEvidence({ assessment: evaluated.result, artifact, locale: TutorOutputLocaleSchema.parse("en-US"), institution_id: "ju" });
  if (!packet) throw Error("TUTOR_FIXTURE_FAILED");
  return { artifact, assessment: evaluated.result, packet, hash };
}
export async function tutorSnapshot() {
  const f = await tutorFixture();
  return generateTutorDebrief({ packet: f.packet, hash, gateway: tutorTestGateway().gateway, request_id: "tutor.test", correlation_id: "tutor.test" });
}
