import { z } from "zod";

export const PatientLanguageSchema = z.enum(["ar-JO", "en-US"]).brand<"PatientLanguage">();
export type PatientLanguage = z.infer<typeof PatientLanguageSchema>;

// Tutor output is selected independently from patient language, even though Expo supports the same locales.
export const TutorOutputLocaleSchema = z.enum(["ar-JO", "en-US"]).brand<"TutorOutputLocale">();
export type TutorOutputLocale = z.infer<typeof TutorOutputLocaleSchema>;

// Authored content uses its own nominal type so it cannot be confused with a session's patient language.
export const AuthoredLocaleSchema = z.enum(["ar-JO", "en-US"]).brand<"AuthoredLocale">();
export type AuthoredLocale = z.infer<typeof AuthoredLocaleSchema>;

export const LocalizationKeySchema = z
  .string()
  .min(3)
  .max(160)
  .regex(/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)+$/u, "Expected a stable localization key")
  .brand<"LocalizationKey">();
export type LocalizationKey = z.infer<typeof LocalizationKeySchema>;
