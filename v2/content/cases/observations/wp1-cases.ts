import type {
  HashAdapter,
  ObservationChannel,
} from "../../../packages/contracts/src/index.ts";
import {
  CaseActionDefinitionSchema,
  DraftCasePackageSchema,
  generateRuleReachabilityEvidence,
  prepareReviewExecutionArtifact,
} from "../../../packages/case-schema/src/index.ts";
import { createStemiConversationCase } from "../stemi/v2-conversation/stemi-conversation-case.ts";
import { createDanaCase } from "../anaphylaxis/dana-case.ts";

export const WP1_ACTIONS = {
  bp: "examination.observe.bp",
  spo2: "examination.observe.pulse-ox",
  hr: "examination.observe.pulse",
  rr: "examination.observe.respirations",
  temperature: "examination.observe.temperature",
} as const;
/** Explicit review successors. Physiological mappings/rules/rubric/facts are inherited
 * unchanged. Durations below are Expo workflow fixtures, NOT medical standards. */
export async function createObservationCase(
  patient: "khalid" | "dana",
  hash: HashAdapter,
) {
  const parent = patient === "dana"
    ? await createDanaCase(hash)
    : await createStemiConversationCase(hash);
  const version = patient === "dana" ? "1.1.0" : "2.1.0";
  const id = patient === "dana"
    ? "anaphylaxis.dana.002"
    : "stemi.inferior-rv.003";
  const source = DraftCasePackageSchema.parse({
    ...parent,
    manifest: {
      ...parent.manifest,
      case_version: version,
      case_version_id: `case-version.${id}`,
      case_package_id: `case-package.${id}`,
    },
    initial_state: {
      ...parent.initial_state,
      patient_state: {
        ...parent.initial_state.patient_state,
        case_version: version,
      },
    },
  });
  const definitions: [string, string, string, ObservationChannel[], number][] =
    [
      [WP1_ACTIONS.bp, "Measure blood pressure", "قياس ضغط الدم", ["BP"], 30],
      [
        WP1_ACTIONS.spo2,
        "Apply pulse oximeter / measure oxygen saturation and pulse",
        "قياس الإشباع والنبض",
        ["SPO2", "HR"],
        15,
      ],
      [WP1_ACTIONS.hr, "Assess pulse rate", "قياس معدل النبض", ["HR"], 30],
      [
        WP1_ACTIONS.rr,
        "Assess respiratory rate",
        "قياس معدل التنفس",
        ["RR"],
        30,
      ],
      [WP1_ACTIONS.temperature, "Measure temperature", "قياس الحرارة", [
        "TEMPERATURE",
      ], 30],
    ];
  for (const [action_id, en, ar, channels, duration_seconds] of definitions) {
    source.action_catalogue.actions.push(CaseActionDefinitionSchema.parse({
      action_id: action_id as never,
      action_type: "EXAMINATION",
      parameter_definitions: [],
      aliases: [{
        locale: "en-US",
        phrases: [en],
        authority: "INTERPRETATION_ONLY",
      }, { locale: "ar-JO", phrases: [ar], authority: "INTERPRETATION_ONLY" }],
      prerequisite_action_ids: [],
      confirmation_policy: "NONE",
      repeat_policy: "REPEATABLE",
      source_ids: [],
      observation_acquisition: { channels, mode: "SAMPLE", duration_seconds },
    }));
  }
  for (const a of source.action_catalogue.actions) {
    const sample = (channels: ObservationChannel[], seconds: number) => {
      a.observation_acquisition = {
        channels,
        mode: "SAMPLE",
        duration_seconds: seconds,
      };
    };
    if (
      [
        "examination.hemodynamic-perfusion",
        "examination.hemodynamic-reassessment",
      ].includes(a.action_id)
    ) sample(["BP", "HR"], 30);
    if (
      a.action_id === "examination.lungs-jvp" ||
      a.action_id === "examination.dana.respiratory"
    ) sample(["RR"], 30);
    if (a.action_id === "examination.dana.abcde") sample(["CONSCIOUSNESS"], 30);
    if (a.action_id === "procedure.cardiac-monitor") {
      a.observation_acquisition = {
        channels: ["HR", "RHYTHM"],
        mode: "CONTINUOUS",
        duration_seconds: 15,
      };
    }
    if (a.action_id === "procedure.dana.monitor") {
      a.observation_acquisition = {
        channels: ["HR", "SPO2", "RHYTHM"],
        sample_channels: ["BP"],
        mode: "CONTINUOUS",
        duration_seconds: 30,
      };
    }
  }
  source.validation.deferred_checks = [
    (await generateRuleReachabilityEvidence(
      source,
      "2026-09-25T00:00:00Z",
      hash,
    )).evidence,
  ];
  return DraftCasePackageSchema.parse(source);
}
export async function prepareObservationCase(
  patient: "khalid" | "dana",
  hash: HashAdapter,
) {
  const r = await prepareReviewExecutionArtifact(
    await createObservationCase(patient, hash),
    hash,
  );
  if (!r.success) throw Error(`WP1_CASE_INVALID ${JSON.stringify(r.report)}`);
  return r.artifact;
}
