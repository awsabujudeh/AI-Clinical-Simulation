import type { PatientLanguage } from "@ai-clinical-simulation/contracts";

export function formatBasisPoints(basisPoints: number): string {
  const whole = Math.floor(basisPoints / 100);
  const fraction = String(basisPoints % 100).padStart(2, "0");
  return `${whole}.${fraction}%`;
}

export function assessmentFindingLabel(
  category: "CORRECT_ACTION" | "UNSAFE_ACTION" | "IMPORTANT_DELAY" | "MISSED_OPPORTUNITY",
  locale: PatientLanguage
): string {
  const values = {
    CORRECT_ACTION: { "ar-JO": "نقطة قوة مثبتة", "en-US": "Evidence-backed strength" },
    UNSAFE_ACTION: { "ar-JO": "ملاحظة سلامة", "en-US": "Safety finding" },
    IMPORTANT_DELAY: { "ar-JO": "تأخير مهم", "en-US": "Important delay" },
    MISSED_OPPORTUNITY: { "ar-JO": "فرصة تحسين", "en-US": "Improvement opportunity" }
  } as const;
  return locale === "ar-JO" ? values[category]["ar-JO"] : values[category]["en-US"];
}
