import type {
  LearnerLocalizedText,
  PatientLanguage
} from "@ai-clinical-simulation/contracts";

export function learnerLocalizedText(
  labels: readonly LearnerLocalizedText[],
  locale: PatientLanguage
): string | undefined {
  return labels.find((label) => label.locale === locale)?.text
    ?? labels.find((label) => label.locale === "en-US")?.text;
}
