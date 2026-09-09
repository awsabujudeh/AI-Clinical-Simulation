import { DraftCasePackageSchema } from "@ai-clinical-simulation/case-schema";
import { PatientStateSchema } from "@ai-clinical-simulation/contracts";

import { MINIMAL_DRAFT_CASE } from "./cases/synthetic-case.ts";

export function enableSyntheticPatientConversation(fixture: any): void {
  fixture.instructor_notes.patient_ai_access = "ALLOWED";
  fixture.localization.entries.push(
    {
      key: "fact.synthetic.absent",
      translations: [
        { locale: "en-US", text: "I do not have the authored synthetic feature." },
        { locale: "ar-JO", text: "لا توجد لدي الصفة الاصطناعية المؤلفة." }
      ]
    },
    {
      key: "fact.synthetic.unknown",
      translations: [
        { locale: "en-US", text: "I do not know the authored synthetic detail." },
        { locale: "ar-JO", text: "لا أعرف التفصيل الاصطناعي المؤلف." }
      ]
    },
    {
      key: "manifestation.synthetic.pain-none",
      translations: [
        { locale: "en-US", text: "I have no synthetic discomfort right now." },
        { locale: "ar-JO", text: "لا أشعر بانزعاج اصطناعي الآن." }
      ]
    },
    {
      key: "manifestation.synthetic.pain-present",
      translations: [
        { locale: "en-US", text: "I have the current authored synthetic discomfort." },
        { locale: "ar-JO", text: "أشعر الآن بالانزعاج الاصطناعي المؤلف." }
      ]
    }
  );
  for (const entry of fixture.localization.entries) {
    if (entry.key === "fact.synthetic.concern") {
      entry.translations.push({ locale: "ar-JO", text: "لدي شكوى اصطناعية مؤلفة." });
    }
    if (entry.key === "dialogue.synthetic.fallback") {
      entry.translations.push({ locale: "ar-JO", text: "لست متأكدًا." });
    }
  }
  fixture.clinical_facts.facts[0].patient_truth_status = "PRESENT";
  fixture.clinical_facts.facts.push(
    {
      fact_id: "fact.synthetic.absent",
      fact_type: "HISTORY",
      clinical_code: "finding.synthetic-absent",
      content_key: "fact.synthetic.absent",
      disclosure_mode: "on_direct_question",
      patient_truth_status: "ABSENT",
      source_ids: ["source.synthetic.001"]
    },
    {
      fact_id: "fact.synthetic.unknown",
      fact_type: "HISTORY",
      clinical_code: "finding.synthetic-unknown",
      content_key: "fact.synthetic.unknown",
      disclosure_mode: "on_direct_question",
      patient_truth_status: "UNKNOWN",
      source_ids: ["source.synthetic.001"]
    }
  );
  fixture.dialogue_policy.disclosable_fact_ids = [
    "fact.synthetic.concern",
    "fact.synthetic.absent",
    "fact.synthetic.unknown"
  ];
  fixture.dialogue_policy.patient_state_manifestations = [
    {
      manifestation_id: "patient-manifestation.synthetic.pain-none",
      selector: {
        selector_type: "PAIN_SEVERITY_RANGE",
        minimum: 0,
        maximum: 0
      },
      truth_status: "ABSENT",
      content_key: "manifestation.synthetic.pain-none",
      replaces_fact_ids: []
    },
    {
      manifestation_id: "patient-manifestation.synthetic.pain-present",
      selector: {
        selector_type: "PAIN_SEVERITY_RANGE",
        minimum: 1,
        maximum: 10
      },
      truth_status: "PRESENT",
      content_key: "manifestation.synthetic.pain-present",
      replaces_fact_ids: ["fact.synthetic.concern"]
    }
  ];
}

export function createPatientConversationCase() {
  const fixture = JSON.parse(JSON.stringify(MINIMAL_DRAFT_CASE));
  enableSyntheticPatientConversation(fixture);
  return DraftCasePackageSchema.parse(fixture);
}

export function createPatientConversationState(pain = 0) {
  const fixture = JSON.parse(JSON.stringify(MINIMAL_DRAFT_CASE.initial_state.patient_state));
  fixture.session_id = "session.synthetic.patient-conversation";
  fixture.pain_state.severity_0_10 = pain;
  return PatientStateSchema.parse(fixture);
}
