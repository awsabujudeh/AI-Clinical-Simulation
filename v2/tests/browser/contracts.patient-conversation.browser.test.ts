import { describe, expect, it } from "vitest";

import {
  ConversationTurnIdSchema,
  PatientAgentOutputSchema,
  PatientConversationContextSchema,
  PatientConversationTranscriptSchema,
  PatientManifestationIdSchema
} from "../../packages/contracts/src/index.ts";

const output = {
  output_schema_version: "1.0",
  utterance: "I do not know.",
  locale: "en-US",
  answer_mode: "UNKNOWN",
  grounding_fact_ids: [],
  grounding_state_refs: [],
  safety_flags: ["UNKNOWN_INFORMATION"],
  disclosure_status: "WITHIN_PATIENT_BOUNDARY"
};

describe("shared Patient Conversation contracts", () => {
  it("uses stable strict identifiers and rejects malformed values", () => {
    expect(ConversationTurnIdSchema.safeParse("conversation-turn.synthetic.001").success).toBe(true);
    expect(PatientManifestationIdSchema.safeParse("patient-manifestation.synthetic.alert").success).toBe(true);
    expect(ConversationTurnIdSchema.safeParse("turn 1").success).toBe(false);
  });

  it("enforces strict versioned bilingual structured output", () => {
    expect(PatientAgentOutputSchema.safeParse(output).success).toBe(true);
    expect(PatientAgentOutputSchema.safeParse({ ...output, locale: "ar-JO" }).success).toBe(true);
    expect(PatientAgentOutputSchema.safeParse({ ...output, locale: "en" }).success).toBe(false);
    expect(PatientAgentOutputSchema.safeParse({ ...output, extra: true }).success).toBe(false);
    expect(PatientAgentOutputSchema.safeParse({ ...output, output_schema_version: "2.0" }).success).toBe(false);
  });

  it("rejects raw Patient State and Case fields at the minimized context boundary", () => {
    const base = {
      context_schema_version: "1.0",
      locale: "en-US",
      persona_code: "persona.synthetic",
      conversational_style_code: "style.concise",
      emotional_tone_code: "tone.neutral",
      facts: [],
      current_manifestations: [],
      history: [],
      deterministic_fallback_text: "I do not know.",
      grounded_state_version: 0,
      grounded_clinical_time: 0
    };
    expect(PatientConversationContextSchema.safeParse(base).success).toBe(true);
    expect(PatientConversationContextSchema.safeParse({ ...base, patient_state: {} }).success).toBe(false);
    expect(PatientConversationContextSchema.safeParse({ ...base, rubric: {} }).success).toBe(false);
  });

  it("serializes a learner-safe transcript without provider metadata", () => {
    const transcript = PatientConversationTranscriptSchema.parse({
      conversation_schema_version: "1.0",
      session_id: "session.synthetic.patient",
      turns: []
    });
    expect(JSON.parse(JSON.stringify(transcript))).toEqual(transcript);
  });
});
