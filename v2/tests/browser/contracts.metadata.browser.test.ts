import { describe, expect, test } from "vitest";

import {
  AuthoredLocaleSchema,
  CaseLifecycleSchema,
  CaseReviewTypeSchema,
  EXPO_INSTITUTIONS,
  FeedbackFindingCategorySchema,
  InstitutionMetadataSchema,
  JORDAN_UNIVERSITY_OF_SCIENCE_AND_TECHNOLOGY,
  PatientLanguageSchema,
  SessionModeSchema,
  TutorOutputLocaleSchema,
  UNIVERSITY_OF_JORDAN
} from "../../packages/contracts/src/index.ts";

describe("locale contracts", () => {
  test("accepts only the two patient language identifiers", () => {
    expect(PatientLanguageSchema.parse("ar-JO")).toBe("ar-JO");
    expect(PatientLanguageSchema.parse("en-US")).toBe("en-US");

    for (const invalid of ["en", "ar", "en-GB", "ar-JO-x-test"] as const) {
      expect(PatientLanguageSchema.safeParse(invalid).success).toBe(false);
    }
  });

  test("keeps tutor and authored locale boundaries independently validated", () => {
    expect(TutorOutputLocaleSchema.parse("en-US")).toBe("en-US");
    expect(AuthoredLocaleSchema.parse("ar-JO")).toBe("ar-JO");
    expect(TutorOutputLocaleSchema.safeParse("fr-FR").success).toBe(false);
  });
});

describe("institution metadata", () => {
  test("provides exact canonical Expo fixtures", () => {
    expect(UNIVERSITY_OF_JORDAN).toEqual({
      institution_id: "ju",
      institution_code: "JU",
      institution_name: "University of Jordan"
    });
    expect(JORDAN_UNIVERSITY_OF_SCIENCE_AND_TECHNOLOGY).toEqual({
      institution_id: "just",
      institution_code: "JUST",
      institution_name: "Jordan University of Science and Technology"
    });
    expect(EXPO_INSTITUTIONS.map(({ institution_id, institution_code }) => ({
      institution_id,
      institution_code
    }))).toEqual([
      { institution_id: "ju", institution_code: "JU" },
      { institution_id: "just", institution_code: "JUST" }
    ]);
  });

  test("keeps the long-term institution type open and strict", () => {
    expect(InstitutionMetadataSchema.safeParse({
      institution_id: "future-university",
      institution_code: "FUTURE",
      institution_name: "Future University"
    }).success).toBe(true);
    expect(InstitutionMetadataSchema.safeParse({
      institution_id: "future-university",
      institution_code: "FUTURE",
      institution_name: "Future University",
      unexpected: true
    }).success).toBe(false);
  });
});

describe("lifecycle and mode enums", () => {
  test("accepts exactly the frozen lifecycle values", () => {
    expect(CaseLifecycleSchema.options).toEqual([
      "DRAFT",
      "UNDER_REVIEW",
      "APPROVED",
      "PUBLISHED"
    ]);
    expect(SessionModeSchema.options).toEqual(["PRACTICE_DEMO", "ASSESSMENT"]);
    expect(CaseReviewTypeSchema.options).toEqual([
      "CLINICAL",
      "CURRICULUM_UX",
      "VISUAL",
      "TECHNICAL"
    ]);
    expect(FeedbackFindingCategorySchema.options).toEqual([
      "CORRECT_ACTION",
      "UNSAFE_ACTION",
      "IMPORTANT_DELAY",
      "MISSED_OPPORTUNITY"
    ]);
  });

  test("rejects unknown lifecycle and mode values", () => {
    expect(CaseLifecycleSchema.safeParse("ARCHIVED").success).toBe(false);
    expect(SessionModeSchema.safeParse("DEMO").success).toBe(false);
    expect(CaseReviewTypeSchema.safeParse("GENERAL").success).toBe(false);
  });
});
