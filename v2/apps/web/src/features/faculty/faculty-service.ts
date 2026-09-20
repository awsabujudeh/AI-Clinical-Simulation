import { FacultyCaseViewSchema, type FacultyCaseView, type FacultyDraftMetadata } from "../../../../../packages/case-schema/src/faculty-metadata.ts";

export interface FacultyDemoService {
  list(): Promise<FacultyCaseView[]>;
  save(metadata: FacultyDraftMetadata, current?: FacultyCaseView): Promise<FacultyCaseView>;
}
export function createFacultyDemoService(): FacultyDemoService {
  async function request(path: string, body?: unknown) {
    const r = await fetch(`/__faculty${path}`, { method: body === undefined ? "GET" : "POST",
      headers: { "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    if (!r.ok) throw Error(r.status === 409 ? "VERSION_CONFLICT — reload before editing" : "Faculty demo unavailable or request rejected");
    return r.json();
  }
  return {
    async list() { return FacultyCaseViewSchema.array().parse((await request("/cases")).data); },
    async save(metadata, current) {
      const body = current ? { metadata, expected_revision: current.revision } : metadata;
      return FacultyCaseViewSchema.parse((await request(current ? `/cases/${encodeURIComponent(current.identity.case_id)}` : "/cases", body)).data);
    }
  };
}
