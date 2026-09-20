import { KnowledgeRegistrySchema, UNIVERSITY_OF_JORDAN, JORDAN_UNIVERSITY_OF_SCIENCE_AND_TECHNOLOGY,
  type KnowledgeSource } from "../../../packages/contracts/src/index.ts";

const pending={language:"en-US",scope:{case_version_ids:["case-version.stemi.inferior-rv.002"],
  topic_codes:["stemi.inferior-recognition","stemi.timely-escalation","stemi.action-reasoning"]},
  visibility:"GLOBAL",curriculum:null,objective_id:null,rights_status:"UNRESOLVED",rights_reference:null,
  access_status:"SOURCE_PENDING",ingestion_status:"SOURCE_PENDING",review_status:"UNRESOLVED",approval:null,
  lifecycle:"DRAFT",effective_from:null,effective_to:null,retrieval_eligible:false,content_hash:null} as const;
const references=[
  ["acc-aha-acs-2025","2025 ACC/AHA/ACEP/NAEMSP/SCAI Guideline for the Management of Patients With Acute Coronary Syndromes","ACC/AHA/ACEP/NAEMSP/SCAI","2025","10.1016/j.jacc.2024.11.009"],
  ["esc-acs-2023","2023 ESC Guidelines for the management of acute coronary syndromes","ESC","2023","10.1093/eurheartj/ehad191"],
  ["acc-shock-2025","2025 Concise Clinical Guidance: ACC Expert Consensus Statement on Evaluation and Management of Cardiogenic Shock","ACC","2025","10.1016/j.jacc.2025.02.018"],
  ["aha-chest-pain-2021","2021 AHA/ACC Chest Pain Guideline","AHA/ACC","2021","10.1016/j.jacc.2021.07.052"]
] as const;

// A discovery/allow-list registry, not approval. DOI metadata is transcribed from
// the existing source register; no external content has been downloaded.
export const STEMI_KNOWLEDGE_REGISTRY=KnowledgeRegistrySchema.parse({schema_version:"1.0",registry_version:"stemi-expo.1",
  sources:[
    ...references.map(([id,title,publisher,version,doi])=>({...pending,source_id:`source.stemi.${id}`,source_version_id:`source-version.stemi.${id}`,
      title,publisher,document_version:version,source_type:"CLINICAL_GUIDELINE",location:`doi:${doi}`,
      provenance:"planning_input/v2-009/STEMI_SOURCE_REGISTER.md — PENDING HUMAN SOURCE REVIEW; no permitted local excerpt or recorded approval"})),
    ...[UNIVERSITY_OF_JORDAN,JORDAN_UNIVERSITY_OF_SCIENCE_AND_TECHNOLOGY].map(institution=>({...pending,
      source_id:`source.curriculum.${institution.institution_id}-pending`,source_version_id:`source-version.curriculum.${institution.institution_id}-pending`,
      title:`${institution.institution_code} official curriculum source pending`,publisher:institution.institution_name,
      document_version:"UNKNOWN_PENDING_SOURCE_REVIEW",location:"SOURCE_PENDING",source_type:"CURRICULUM",visibility:"INSTITUTION",
      curriculum:{institution,program_code:null,course_code:null,academic_year:null},objective_id:"UNKNOWN_PENDING_SOURCE_REVIEW",
      provenance:"Existing Case curriculum mappings are UNKNOWN; no official objective wording or permission has been supplied"})),
    ...(["CASE_GROUND_TRUTH","SIMULATION_RUBRIC"] as const).map((layer,index)=>({...pending,
      source_id:`source.stemi.structured-${index===0?"case":"rubric"}`,source_version_id:`source-version.stemi.structured-${index===0?"case":"rubric"}.002`,
      title:index===0?"STEMI 2.0.1 structured Case truth":"STEMI 2.0.1 structured assessment rubric",publisher:"AI Clinical Simulation project",
      document_version:"2.0.1",source_type:layer,location:`v2/content/cases/stemi/v2-conversation/stemi-conversation-case.ts#${index===0?"clinical_facts":"assessment_rubric"}`,
      access_status:"STRUCTURED_CASE_ONLY",ingestion_status:"DIRECT_LOOKUP_ONLY",
      provenance:"UNDER_REVIEW / REVIEW_ONLY; direct pinned Case consumers only, never educational retrieval or a guideline replacement"}))
  ]});

// Explicitly empty. Unknown rights/review are not repaired with model knowledge.
export const STEMI_APPROVED_KNOWLEDGE_DOCUMENTS:readonly unknown[]=[];
export const STEMI_PENDING_SOURCES:readonly KnowledgeSource[]=STEMI_KNOWLEDGE_REGISTRY.sources;
