export const AI_MODEL_SELECTION_FREEZE_HASH =
  "f2ef12edf75e52016221563975da5689f698659ad12189c06cdeae88785d5523" as const;

export const SELECTED_AI_MODEL_POLICY = Object.freeze({
  PATIENT_CONVERSATION: "gpt-5.6-terra",
  CLINICAL_INTERPRETER: "gpt-5.6-luna"
} as const);

export type SelectedAiCapability = keyof typeof SELECTED_AI_MODEL_POLICY;

export function selectedAiModelForCapability(
  capability: SelectedAiCapability
): (typeof SELECTED_AI_MODEL_POLICY)[SelectedAiCapability] {
  return SELECTED_AI_MODEL_POLICY[capability];
}
