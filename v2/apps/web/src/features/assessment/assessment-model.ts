import type { PatientLanguage } from "@ai-clinical-simulation/contracts";

export function formatBasisPoints(basisPoints: number): string {
  const whole = Math.floor(basisPoints / 100);
  const fraction = String(basisPoints % 100).padStart(2, "0");
  return `${whole}.${fraction}%`;
}

const genericDomainLabels = {
  "domain.history": { generic: "history", "en-US": "History", "ar-JO": "القصة المرضية" },
  "domain.examination": { generic: "examination", "en-US": "Examination", "ar-JO": "الفحص" },
  "domain.diagnostics": { generic: "diagnostics", "en-US": "Diagnostics", "ar-JO": "الاستقصاءات" },
  "domain.management": { generic: "management", "en-US": "Management", "ar-JO": "التدبير" },
  "domain.clinical-reasoning": { generic: "clinical-reasoning", "en-US": "Clinical reasoning", "ar-JO": "الاستدلال السريري" },
  "domain.reperfusion-disposition": { generic: "reperfusion-disposition", "en-US": "Reperfusion and disposition", "ar-JO": "إعادة التروية والتصرف" }
} as const;

/** Display-only fallback for exact generic codes; authored case labels retain authority. */
export function assessmentDomainLabel(domainId: string, label: string | undefined, locale: PatientLanguage): string | undefined {
  const generic = Object.hasOwn(genericDomainLabels, domainId)
    ? genericDomainLabels[domainId as keyof typeof genericDomainLabels]
    : undefined;
  return generic && label === generic.generic ? generic[locale === "ar-JO" ? "ar-JO" : "en-US"] : label;
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
