import { describe, expect, it, beforeAll } from "vitest";
import { prepareStemiConversationArtifact } from "../../../content/cases/stemi/v2-conversation/stemi-conversation-case.ts";
import { PORTABLE_SHA256_ADAPTER } from "../../fixtures/portable-sha256.ts";
import { createFacultyDemoStore, projectFacultyStemi } from "../../../runtime/v2-025-faculty-store.ts";
import { type FacultyCaseView } from "../../../packages/case-schema/src/faculty-metadata.ts";
import { DraftCasePackageSchema } from "../../../packages/case-schema/src/index.ts";

const faculty = { membership_id: "demo", institution_id: "institution.demo", role: "FACULTY" as const };
const metadata = { title: "Demo metadata shell", specialty: "specialty.emergency-medicine", difficulty: "difficulty.beginner", language: "en-US", description: "Educational metadata only" };
let seed: FacultyCaseView;
beforeAll(async () => { seed = projectFacultyStemi(await prepareStemiConversationArtifact(PORTABLE_SHA256_ADAPTER)); });
const store = () => createFacultyDemoStore(seed, faculty.institution_id);
describe("V2-025 constrained Faculty demo", () => {
  it("projects real STEMI 2.0.1, review authority, existing objectives and media discrepancy", () => {
    expect(seed.identity.case_version).toBe("2.0.1"); expect(seed.identity.status).toBe("UNDER_REVIEW");
    expect(seed.execution_authority).toBe("REVIEW_ONLY"); expect(seed.curriculum?.official_alignment_claimed).toBe(false);
    expect(seed.competencies.length).toBeGreaterThan(0); expect(seed.critical_actions.length).toBeGreaterThan(0);
    expect(seed.media_status.join(" ")).toContain("84 bpm"); expect(seed.media_status.join(" ")).toContain("112 bpm");
    expect(JSON.stringify(seed)).not.toContain("instructions");
  });
  it("denies unauthenticated, learner, reviewer and other-institution access", () => {
    const s = store();
    for (const m of [null, { ...faculty, role: "LEARNER" as const }, { ...faculty, role: "REVIEWER" as const }, { ...faculty, institution_id: "other" }]) {
      expect(s.list(m)).toEqual({ success: false, code: "FORBIDDEN" });
      expect(s.create(m, metadata)).toEqual({ success: false, code: "FORBIDDEN" });
      expect(s.update(m, seed.identity.case_id, {})).toEqual({ success: false, code: "FORBIDDEN" });
    }
  });
  it("creates only non-executable DRAFT metadata and reloads from memory", () => {
    const s = store(); const r = s.create(faculty, metadata); expect(r.success).toBe(true); if (!r.success) return;
    expect(r.data.identity.status).toBe("DRAFT"); expect(r.data.execution_authority).toBeNull();
    expect(DraftCasePackageSchema.safeParse(r.data).success).toBe(false);
    const list = s.list(faculty); expect(list.success && list.data).toHaveLength(2);
    expect(store().list(faculty)).toEqual({ success: true, data: [seed] }); // restart loses local drafts
  });
  it("rejects status, clinical state, actions and identity injection", () => {
    for (const extra of [{ status: "PUBLISHED" }, { patient_state: {} }, { rules: [] }, { case_id: "case.override" }, { role: "FACULTY" }])
      expect(store().create(faculty, { ...metadata, ...extra })).toEqual({ success: false, code: "INVALID" });
  });
  it("edits only metadata with revision conflict protection", () => {
    const s = store(); const r = s.create(faculty, metadata); if (!r.success) throw Error();
    const updated = s.update(faculty, r.data.identity.case_id, { expected_revision: 0, metadata: { ...metadata, title: "Changed" } });
    expect(updated.success && updated.data.revision).toBe(1);
    expect(updated.success && updated.data.identity.status).toBe("DRAFT");
    expect(s.update(faculty, r.data.identity.case_id, { expected_revision: 0, metadata })).toEqual({ success: false, code: "VERSION_CONFLICT" });
    expect(s.update(faculty, r.data.identity.case_id, { expected_revision: 1, metadata, status: "PUBLISHED" })).toEqual({ success: false, code: "INVALID" });
  });
  it("cannot edit seeded review or published content", () => {
    for (const status of ["UNDER_REVIEW", "PUBLISHED"] as const) {
      const s = createFacultyDemoStore({ ...seed, identity: { ...seed.identity, status } }, faculty.institution_id);
      expect(s.update(faculty, seed.identity.case_id, { expected_revision: 0, metadata })).toEqual({ success: false, code: "READ_ONLY" });
    }
  });
  it("rejects malformed metadata and unknown/prototype IDs safely", () => {
    const s = store(); expect(s.create(faculty, { ...metadata, title: " " })).toEqual({ success: false, code: "INVALID" });
    for (const id of ["constructor", "__proto__", "case.missing"]) expect(s.update(faculty, id, { expected_revision: 0, metadata })).toEqual({ success: false, code: "NOT_FOUND" });
  });
  it("copies input/output references; has no approve/publish operation", () => {
    const s = store(); const r = s.create(faculty, metadata); if (!r.success) throw Error();
    r.data.metadata.title = "tampered";
    const list = s.list(faculty); expect(list.success && list.data[1]?.metadata.title).toBe(metadata.title);
    expect(Object.keys(s)).toEqual(["list", "create", "update"]);
  });
});
