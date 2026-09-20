/** Local Jordanian review composition only; shell language is not Patient language. */
export const V2_021_PATIENT_LANGUAGE = "ar-JO" as const;

export function createV2_021QuestionBody(
  intent: { text: string; source: "TEXT" | "STT" }, utteranceId: string
) {
  return { text: intent.text, locale: V2_021_PATIENT_LANGUAGE,
    source: intent.source, utterance_id: utteranceId };
}
