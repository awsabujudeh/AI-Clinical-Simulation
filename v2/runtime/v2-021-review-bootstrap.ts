/** Local Jordanian review composition only; shell language is not Patient language. */
export const V2_021_PATIENT_LANGUAGE = "ar-JO" as const;

/** UUIDs are supplied by the DEV host/page, not by clinical domain code. */
export function createV2_021ReviewStartKey(bootId: string) {
  return `idempotency.visual.${bootId}`;
}

export function createV2_021RequestIdentity(bootId: string, pageId: string) {
  return (kind: string, sequence: number) => `${kind}.visual.${bootId}.${pageId}.${sequence}`;
}

export function createV2_021QuestionBody(
  intent: { text: string; source: "TEXT" | "STT" }, utteranceId: string
) {
  return { text: intent.text, locale: V2_021_PATIENT_LANGUAGE,
    source: intent.source, utterance_id: utteranceId };
}
