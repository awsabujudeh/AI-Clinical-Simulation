import type { HashAdapter } from "../../../packages/contracts/src/index.ts";
import {
  CaseActionDefinitionSchema,
  DraftCasePackageSchema,
  generateRuleReachabilityEvidence,
  prepareReviewExecutionArtifact,
} from "../../../packages/case-schema/src/index.ts";
import { createObservationCase } from "../observations/wp1-cases.ts";
import { EXPO_SHARED_CATALOGUE } from "./expo-catalogue.ts";

export const WP2_SOURCES = {
  acs: "source.wp2.acs-2025",
  rcuk: "source.wp2.rcuk-anaphylaxis-2021",
  parameter: "source.wp2.anaphylaxis-2023",
  modeling: "source.wp2.expo-modeling-decision",
} as const;
/** Reference metadata only: no copied guideline, no RAG promotion, no physician approval. */
export const WP2_REFERENCES = [
  {
    id: WP2_SOURCES.acs,
    title: "2025 ACC/AHA/ACEP/NAEMSP/SCAI ACS guideline",
    url:
      "https://professional.heart.org/en/science-news/2025-guideline-for-the-management-of-patients-with-acute-coronary-syndromes/top-things-to-know",
    locator:
      "Recommendations 1–3; existing BALSIM fixed ACS orders remain primary",
  },
  {
    id: WP2_SOURCES.rcuk,
    title: "RCUK Emergency treatment of anaphylaxis (May 2021)",
    url:
      "https://www.resus.org.uk/sites/default/files/2021-05/Emergency%20Treatment%20of%20Anaphylaxis%20May%202021_0.pdf",
    locator:
      "Sections 4–5: ABC, IM adrenaline, oxygen, crystalloid; adjunct boundaries",
  },
  {
    id: WP2_SOURCES.parameter,
    title: "Anaphylaxis: A 2023 practice parameter update",
    url:
      "https://www.aaaai.org/Aaaai/media/Media-Library-PDFs/Allergist%20Resources/Statements%20and%20Practice%20Parameters/Anaphylaxis-Practice-Paramaters-2023.pdf",
    locator:
      "Epinephrine treatment and adult IM dosing; doi:10.1016/j.anai.2023.09.015",
  },
  {
    id: WP2_SOURCES.modeling,
    title: "Owner-authorized WP2 bounded synthetic modeling decision",
    url: "planning_input/medical_review/EXPO_SHARED_CATALOGUE_REVIEW.md",
    locator:
      "No modeled benefit is a limited simulation decision, NOT universal pharmacology or guideline endorsement",
  },
];
// Stable parent action identities are preserved. Missing bindings get new, explicit actions.
const pairs: Record<string, readonly [string, string]> = {
  bp: ["examination.observe.bp", "examination.observe.bp"],
  pulse: ["examination.observe.pulse", "examination.observe.pulse"],
  "pulse-ox": ["examination.observe.pulse-ox", "examination.observe.pulse-ox"],
  respirations: [
    "examination.observe.respirations",
    "examination.observe.respirations",
  ],
  temperature: [
    "examination.observe.temperature",
    "examination.observe.temperature",
  ],
  ecg: ["investigation.ecg-standard", "investigation.dana.ecg"],
  cxr: ["investigation.chest-xray", "investigation.dana.cxr"],
  aspirin: [
    "medication.aspirin-324-chewed",
    "medication.expo.aspirin-324-chewed",
  ],
  ticagrelor: ["medication.ticagrelor-180", "medication.expo.ticagrelor-180"],
  clopidogrel: [
    "medication.clopidogrel-600",
    "medication.expo.clopidogrel-600",
  ],
  ufh: ["medication.ufh-70-units-kg", "medication.expo.ufh-70-units-kg"],
  atorvastatin: [
    "medication.atorvastatin-80",
    "medication.expo.atorvastatin-80",
  ],
  epinephrine: [
    "medication.expo.epinephrine-im-05",
    "medication.dana.epinephrine-im-05",
  ],
  "repeat-epinephrine": [
    "medication.expo.repeat-epinephrine-im-05",
    "medication.dana.repeat-epinephrine-im-05",
  ],
  iv: ["procedure.peripheral-iv", "procedure.dana.iv-access"],
  "saline-250": [
    "procedure.normal-saline-250",
    "procedure.expo.normal-saline-250",
  ],
  "crystalloid-500": [
    "procedure.expo.crystalloid-500",
    "procedure.dana.crystalloid-500",
  ],
  oxygen: ["procedure.supplemental-oxygen", "procedure.dana.oxygen"],
  monitor: ["procedure.cardiac-monitor", "procedure.dana.monitor"],
  help: ["consult.expo.call-help", "consult.dana.call-help"],
  cath: ["consult.activate-cath-lab", "consult.expo.activate-cath-lab"],
};
export async function createExpoCatalogueCase(
  patient: "khalid" | "dana",
  hash: HashAdapter,
) {
  const c = await createObservationCase(patient, hash);
  const suffix = patient === "khalid"
    ? "stemi.inferior-rv.004"
    : "anaphylaxis.dana.003";
  const version = patient === "khalid" ? "2.2.0" : "1.2.0";
  c.manifest = {
    ...c.manifest,
    case_version: version as never,
    case_version_id: `case-version.${suffix}` as never,
    case_package_id: `case-package.${suffix}` as never,
  };
  c.initial_state.patient_state.case_version = version as never;
  c.validation.sources.push(
    ...WP2_REFERENCES.map((r) => ({
      source_id: r.id as never,
      source_version_id: `${
        r.id.replace("source.", "source-version.")
      }.v1` as never,
      status: "UNRESOLVED" as const,
      required: true,
    })),
  );
  c.validation.required_source_ids.push(
    ...WP2_REFERENCES.map((r) => r.id as never),
  );
  const bindings = EXPO_SHARED_CATALOGUE.actions.map((concept) => {
    const key = concept.action_id.slice("concept.expo.".length);
    return {
      concept_id: concept.action_id,
      case_action_id: pairs[key]![patient === "khalid" ? 0 : 1] as never,
    };
  });
  c.action_catalogue.shared = {
    catalogue: structuredClone(EXPO_SHARED_CATALOGUE),
    bindings,
  };
  for (const binding of bindings) {
    const concept = EXPO_SHARED_CATALOGUE.actions.find((x) =>
      x.action_id === binding.concept_id
    )!;
    const key = concept.action_id.slice("concept.expo.".length);
    let action = c.action_catalogue.actions.find((a) =>
      a.action_id === binding.case_action_id
    );
    const inherited = !!action;
    if (!action) {
      action = CaseActionDefinitionSchema.parse({
        action_id: binding.case_action_id,
        action_type: concept.action_type,
        parameter_definitions: concept.parameter_definitions,
        aliases: concept.aliases!.map((a) => ({
          ...a,
          authority: "INTERPRETATION_ONLY",
        })),
        prerequisite_action_ids: [],
        confirmation_policy: concept.confirmation_policy,
        repeat_policy: concept.repeat_policy,
        source_ids: [WP2_SOURCES.modeling],
      });
      c.action_catalogue.actions.push(action);
    }
    // New successor prerequisites; old frozen versions are not changed.
    action.prerequisite_action_ids = (concept.prerequisite_concept_ids ?? [])
      .map((id) => bindings.find((b) => b.concept_id === id)!.case_action_id);
    const rule_ids = c.rules.rules.filter((r) =>
      r.referenced_action_ids.includes(action.action_id) ||
      (r.trigger.trigger_type === "COMMITTED_EVENT" &&
        r.trigger.action_id === action.action_id)
    ).map((r) => r.rule_id);
    action.outcome_policy = {
      policy_version: "1.0",
      outcome_code: `outcome.wp2.${patient}.${key}`,
      behavior: inherited ? "AUTHORED_CASE_BEHAVIOR" : "NO_MODELED_BENEFIT",
      unmatched_rule_behavior: "NO_MODELED_BENEFIT",
      duration_seconds: action.observation_acquisition?.duration_seconds ??
        (concept.action_type === "MEDICATION" ? 30 : 15),
      duration_basis: "EXPO_SIMULATION_FIXTURE",
      rule_ids,
      source_ids: [
        WP2_SOURCES.modeling,
        ...(concept.action_type === "MEDICATION"
          ? [WP2_SOURCES.acs, WP2_SOURCES.rcuk, WP2_SOURCES.parameter]
          : []),
        ...action.source_ids,
      ].filter((id, i, a) => a.indexOf(id) === i) as never,
      review_status: "PENDING_PHYSICIAN_REVIEW",
    };
  }
  c.validation.deferred_checks = [
    (await generateRuleReachabilityEvidence(c, "2026-09-25T00:00:00Z", hash))
      .evidence,
  ];
  return DraftCasePackageSchema.parse(c);
}
export async function prepareExpoCatalogueCase(
  patient: "khalid" | "dana",
  hash: HashAdapter,
) {
  const result = await prepareReviewExecutionArtifact(
    await createExpoCatalogueCase(patient, hash),
    hash,
  );
  if (!result.success) {
    throw Error(`WP2_CASE_INVALID ${JSON.stringify(result.report)}`);
  }
  return result.artifact;
}
