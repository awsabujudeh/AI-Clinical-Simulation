import { z } from "zod";

import { InstitutionIdSchema } from "./ids.ts";

export const InstitutionCodeSchema = z
  .string()
  .min(2)
  .max(16)
  .regex(/^[A-Z][A-Z0-9]*$/u, "Expected an uppercase institution code")
  .brand<"InstitutionCode">();
export type InstitutionCode = z.infer<typeof InstitutionCodeSchema>;

export const InstitutionMetadataSchema = z.strictObject({
  institution_id: InstitutionIdSchema,
  institution_code: InstitutionCodeSchema,
  institution_name: z.string().trim().min(2).max(200)
});
export type InstitutionMetadata = z.infer<typeof InstitutionMetadataSchema>;

export const UNIVERSITY_OF_JORDAN = InstitutionMetadataSchema.parse({
  institution_id: "ju",
  institution_code: "JU",
  institution_name: "University of Jordan"
});

export const JORDAN_UNIVERSITY_OF_SCIENCE_AND_TECHNOLOGY = InstitutionMetadataSchema.parse({
  institution_id: "just",
  institution_code: "JUST",
  institution_name: "Jordan University of Science and Technology"
});

export const EXPO_INSTITUTIONS: readonly InstitutionMetadata[] = [
  UNIVERSITY_OF_JORDAN,
  JORDAN_UNIVERSITY_OF_SCIENCE_AND_TECHNOLOGY
];
