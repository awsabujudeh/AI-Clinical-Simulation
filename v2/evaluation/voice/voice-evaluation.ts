import { z } from "zod";
import { PatientLanguageSchema } from "../../packages/contracts/src/locales.ts";

export const VOICE_EVALUATION_POLICY = Object.freeze({
  version: "1.0", provider: "AZURE", minimum_utterances: 50, minimum_speakers: 3,
  usable_percentage: 90, consequential_safe_percentage: 100,
  first_partial_ms: { p50: 800, p95: 1500 }, final_after_release_ms: { p50: 1200, p95: 3000 },
  tts_first_audio_ms: { p50: 1200, p95: 2500 }, full_question_p95_ms: 8000,
  primary_metric: "HUMAN_REVIEWED_SEMANTIC_TASK_ACCURACY", secondary_metric: "WER",
  audio_provenance: "CONSENTED_HUMAN_ONLY", live_gate_executed: false
} as const);
export const VoiceUtteranceDefinitionSchema = z.strictObject({
  utterance_id: z.string().regex(/^voice-eval\.\d{3}$/u), locale: PatientLanguageSchema,
  category: z.string().min(1).max(64), reference_text: z.string().min(1).max(500),
  reference_semantic_meaning: z.string().min(1).max(500), clinically_consequential: z.boolean(),
  important_concepts: z.array(z.string().min(1).max(120)).min(1).max(12),
  acceptable_semantic_variants: z.array(z.string().min(1).max(500)).max(6),
  routing_target: z.enum(["PATIENT_QUESTION", "CLINICAL_LANGUAGE"]),
  speaker_metadata: z.null(), recording_provenance: z.null()
});
export type VoiceUtteranceDefinition = z.infer<typeof VoiceUtteranceDefinitionSchema>;
export const VoiceHumanEvidenceSchema = z.strictObject({
  utterance_id: VoiceUtteranceDefinitionSchema.shape.utterance_id,
  speaker_id: z.string().regex(/^speaker\.[a-z0-9-]+$/u),
  reviewer_id: z.string().regex(/^reviewer\.[a-z0-9-]+$/u),
  consent_confirmed: z.literal(true), provenance: z.literal("LIVE_HUMAN"),
  recording_reference: z.string().regex(/^recording\.[a-z0-9-]+$/u),
  condition: z.enum(["QUIET", "BOOTH_NOISE"]),
  final_transcript: z.string().max(4_000),
  semantic_verdict: z.enum(["PRESERVED", "MEANING_CHANGED", "UNUSABLE"]),
  correction_detected_before_submit: z.boolean(), confirmation_boundary_observed: z.boolean(),
  first_partial_ms: z.number().finite().nonnegative(), final_after_release_ms: z.number().finite().nonnegative(),
  full_question_ms: z.number().finite().nonnegative().optional()
});
export const TtsHumanReviewSchema = z.strictObject({
  voice_id: z.enum(["ar-JO-TaimNeural", "ar-JO-SanaNeural"]),
  reviewer_id: z.string().min(1).max(80), text_reference: z.string().min(1).max(80),
  natural_jordanian_acceptability: z.number().int().min(1).max(5),
  intelligibility: z.number().int().min(1).max(5), medical_english_pronunciation: z.number().int().min(1).max(5),
  pacing: z.number().int().min(1).max(5), emotional_appropriateness: z.number().int().min(1).max(5),
  pronunciation_failure: z.boolean(), first_audio_ms: z.number().finite().nonnegative(),
  notes: z.string().max(1_000)
});
function percentile(values: number[], p: number) {
  return [...values].sort((a, b) => a - b)[Math.max(0, Math.ceil(values.length * p) - 1)] ?? null;
}
/** Human semantic adjudication is explicit evidence, never inferred from keyword overlap or an LLM. */
export function evaluateVoiceEvidence(corpusInput: unknown, evidenceInput: unknown) {
  const corpus = z.array(VoiceUtteranceDefinitionSchema).min(50).safeParse(corpusInput);
  const evidence = z.array(VoiceHumanEvidenceSchema).safeParse(evidenceInput);
  if (!corpus.success || !evidence.success) return { status: "INVALID_EVIDENCE" } as const;
  const definitions = new Map(corpus.data.map((item) => [item.utterance_id, item]));
  const records = evidence.data;
  const ids = new Set(records.map((item) => item.utterance_id));
  if (definitions.size !== corpus.data.length || ids.size !== records.length
    || records.some((item) => !definitions.has(item.utterance_id)
      || item.semantic_verdict === "PRESERVED" && !item.final_transcript.trim())) return { status: "INVALID_EVIDENCE" } as const;
  if (!records.length) return { status: "NOT_EXECUTED", records: 0 } as const;
  const preserved = records.filter((item) => item.semantic_verdict === "PRESERVED").length;
  const consequential = records.filter((item) => definitions.get(item.utterance_id)!.clinically_consequential);
  const safe = consequential.filter((item) => item.confirmation_boundary_observed
    && (item.semantic_verdict === "PRESERVED" || item.correction_detected_before_submit)).length;
  const stats = {
    records: records.length, preserved, usable_percentage: preserved * 100 / records.length,
    consequential: consequential.length, consequential_safe: safe,
    first_partial_p50: percentile(records.map((item) => item.first_partial_ms), .5),
    first_partial_p95: percentile(records.map((item) => item.first_partial_ms), .95),
    final_p50: percentile(records.map((item) => item.final_after_release_ms), .5),
    final_p95: percentile(records.map((item) => item.final_after_release_ms), .95)
  };
  const complete = records.length === corpus.data.length && new Set(records.map((item) => item.speaker_id)).size >= 3
    && records.some((item) => item.condition === "BOOTH_NOISE") && consequential.length > 0;
  const meets = preserved * 100 >= records.length * 90 && safe === consequential.length
    && stats.first_partial_p50! < 800 && stats.first_partial_p95! < 1500 && stats.final_p50! < 1200 && stats.final_p95! < 3000;
  return { status: !complete ? "INCOMPLETE" : meets ? "MEETS_STT_TARGETS" : "BELOW_STT_TARGETS", ...stats,
    overall_voice_gate: "REQUIRES_SEPARATE_TTS_AND_END_TO_END_HUMAN_REVIEW" } as const;
}
