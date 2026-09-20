import { createStemiKnowledgeRetrieval } from "../content/knowledge/stemi/index.ts";
import { KnowledgeRetrievalResultSchema, UNIVERSITY_OF_JORDAN, JORDAN_UNIVERSITY_OF_SCIENCE_AND_TECHNOLOGY, type HashAdapter } from "../packages/contracts/src/index.ts";
import { createAiGatewayEdgeComposition, TrustedCapabilityRegistry, TUTOR_CAPABILITY,
  type ServerEnvironmentReader, type AiCapacityAuthority, type AiGatewayClock, type TutorRetrieval } from "../packages/ai-gateway/src/index.ts";

/** Trusted server composition only. Never accepts a browser institution, model or source. */
export function createTutorGateway(input: { environment: ServerEnvironmentReader; capacity: AiCapacityAuthority; clock: AiGatewayClock }) {
  return createAiGatewayEdgeComposition({ ...input, registry: new TrustedCapabilityRegistry([TUTOR_CAPABILITY]), logger: { log() {} } });
}

export async function createStemiTutorRetrieval(hash: HashAdapter): Promise<TutorRetrieval> {
  const service = await createStemiKnowledgeRetrieval(hash);
  if (!service.success) return async () => { throw Error("RETRIEVAL_UNAVAILABLE"); };
  return async input => {
    const query = { case_version_id: input.case_version_id, topic_code: "stemi.action-reasoning", locale: input.locale,
      source_types: ["CLINICAL_GUIDELINE"], as_of: input.as_of, limit: 3 };
    const clinical = await service.retrieve(query);
    const institution = [UNIVERSITY_OF_JORDAN, JORDAN_UNIVERSITY_OF_SCIENCE_AND_TECHNOLOGY].find(i => i.institution_id === input.institution_id);
    // No invented program/year/objective: current context remains source-pending.
    const curriculum = institution ? await service.retrieve({ ...query, source_types: ["CURRICULUM"], curriculum: {
      institution, program_code: null, course_code: null, academic_year: null } }) : undefined;
    const available = clinical.clinical_evidence.length > 0 || (curriculum?.curriculum_evidence.length ?? 0) > 0;
    return KnowledgeRetrievalResultSchema.parse({ authority: "NON_AUTHORITATIVE_EVIDENCE", status: available ? "AVAILABLE" : "SOURCE_PENDING",
      retrieval_mode: clinical.retrieval_mode, index_hash: clinical.index_hash,
      clinical_evidence: clinical.clinical_evidence, curriculum_evidence: curriculum?.curriculum_evidence ?? [] });
  };
}
