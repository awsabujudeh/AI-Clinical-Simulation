import type { PatientLanguage } from "@ai-clinical-simulation/contracts";

const labels = Object.freeze({
  rhythm: Object.freeze({
    "rhythm.synthetic-regular": { "ar-JO": "نظم منتظم", "en-US": "Regular rhythm" },
    "rhythm.synthetic-alternative": { "ar-JO": "نظم بديل مُعدّ للحالة", "en-US": "Case-configured alternative rhythm" }
  }),
  consciousness: Object.freeze({
    "consciousness.synthetic-alert": { "ar-JO": "واعٍ", "en-US": "Alert" },
    "consciousness.synthetic-changed": { "ar-JO": "استجابة معدّلة للحالة", "en-US": "Case-configured altered response" }
  })
});

export function observationDescriptorLabel(
  kind: "rhythm" | "consciousness",
  code: string,
  locale: PatientLanguage
): string {
  const exact = labels[kind][code as keyof typeof labels[typeof kind]];
  if (exact !== undefined) return exact[locale];
  return kind === "rhythm"
    ? locale === "ar-JO" ? "نظم محدد في الحالة" : "Case-configured rhythm"
    : locale === "ar-JO" ? "حالة وعي محددة في الحالة" : "Case-configured consciousness";
}
