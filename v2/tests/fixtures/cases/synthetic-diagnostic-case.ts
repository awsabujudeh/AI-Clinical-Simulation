import type { HashAdapter } from "../../../packages/contracts/src/index.ts";
import {
  DraftCasePackageSchema,
  preparePublicationCandidate,
  type DraftCasePackage
} from "../../../packages/case-schema/src/index.ts";

import {
  TEST_HASH_ADAPTER,
  bindSyntheticReviewAndReachabilityEvidence,
  createCandidateReadyUnderReviewCase,
  createPublicationApprovalRecord
} from "./synthetic-case.ts";

const SYNTHETIC_SOURCE_ID = "source.synthetic.001";
const SYNTHETIC_CLINICAL_REVIEW_ID = "review.synthetic.clinical";

function cloneCase(casePackage: DraftCasePackage): DraftCasePackage {
  return DraftCasePackageSchema.parse(JSON.parse(JSON.stringify(casePackage)));
}

function governedAsset(
  mediaAssetId: string,
  mediaKind: "STATIC_IMAGE" | "VIDEO",
  modality: "ECG" | "XRAY" | "ECHOCARDIOGRAPHY",
  hashCharacter: string
) {
  return {
    media_asset_id: mediaAssetId,
    media_kind: mediaKind,
    required: true,
    static_fallback: false,
    diagnostic_governance: {
      diagnostic_modality: modality,
      asset_version: "1.0.0",
      content_hash: hashCharacter.repeat(64),
      provenance_source_ids: [SYNTHETIC_SOURCE_ID],
      rights_status: "APPROVED" as const,
      rights_reference_code: `rights.synthetic-${modality.toLowerCase()}`,
      clinical_review_status: "APPROVED" as const,
      clinical_review_id: SYNTHETIC_CLINICAL_REVIEW_ID
    }
  };
}

const localizationEntries = [
  ["diagnostic.synthetic.analyte", "Synthetic analyte", "مُكوِّن اصطناعي"],
  ["diagnostic.synthetic.measurement", "Synthetic measurement", "قياس اصطناعي"],
  ["diagnostic.synthetic.lab-finding", "Synthetic laboratory finding", "نتيجة مختبرية اصطناعية"],
  ["diagnostic.synthetic.ecg-finding", "Synthetic tracing finding", "نتيجة تخطيط اصطناعية"],
  ["diagnostic.synthetic.image-finding", "Synthetic image finding", "نتيجة صورة اصطناعية"],
  ["diagnostic.synthetic.image-finding-alt", "Alternate synthetic image finding", "نتيجة صورة اصطناعية بديلة"],
  ["diagnostic.synthetic.ultrasound-finding", "Synthetic ultrasound finding", "نتيجة موجات فوق صوتية اصطناعية"],
  ["diagnostic.synthetic.report-finding", "Synthetic report finding", "نتيجة تقرير اصطناعية"],
  ["diagnostic.synthetic.machine-interpretation", "Synthetic machine interpretation", "تفسير آلي اصطناعي"],
  ["diagnostic.synthetic.ecg-report", "Synthetic tracing report", "تقرير تخطيط اصطناعي"],
  ["diagnostic.synthetic.image-report", "Synthetic image report", "تقرير صورة اصطناعي"],
  ["diagnostic.synthetic.ultrasound-report", "Synthetic ultrasound report", "تقرير موجات فوق صوتية اصطناعي"],
  ["diagnostic.synthetic.text-report", "Synthetic text report", "تقرير نصي اصطناعي"]
] as const;

const diagnosticFacts = [
  "lab-finding",
  "ecg-finding",
  "image-finding",
  "image-finding-alt",
  "ultrasound-finding",
  "report-finding"
].map((name) => ({
  fact_id: `fact.synthetic.${name}`,
  fact_type: "INVESTIGATION_RESULT" as const,
  clinical_code: `finding.synthetic-${name}`,
  content_key: `diagnostic.synthetic.${name}`,
  disclosure_mode: "after_result" as const,
  source_ids: [SYNTHETIC_SOURCE_ID]
}));

function actionBase(actionId: string) {
  return {
    action_id: actionId,
    action_type: "INVESTIGATION" as const,
    parameter_definitions: [],
    aliases: [
      {
        locale: "en-US" as const,
        phrases: [`order ${actionId.replace("investigation.", "synthetic ")}`],
        authority: "INTERPRETATION_ONLY" as const
      }
    ],
    prerequisite_action_ids: [],
    confirmation_policy: "EXPLICIT_REQUEST" as const,
    repeat_policy: "NOT_REPEATABLE" as const,
    source_ids: [SYNTHETIC_SOURCE_ID]
  };
}

function milestones(
  prefix: string,
  entries: ReadonlyArray<readonly [
    "ORDERED" | "PERFORMED" | "RESULT_AVAILABLE" | "IMAGE_AVAILABLE" | "FORMAL_REPORT_AVAILABLE",
    number
  ]>
) {
  return entries.map(([milestoneType, offset]) => ({
    diagnostic_milestone_id: `diagnostic-milestone.synthetic.${prefix}-${milestoneType.toLowerCase().replaceAll("_", "-")}`,
    milestone_type: milestoneType,
    offset_clinical_seconds: offset
  }));
}

function diagnosticActions() {
  return [
    {
      ...actionBase("investigation.synthetic-laboratory"),
      investigation: {
        investigation_schema_version: "1.0" as const,
        execution_mode: "ASYNC_PARALLEL" as const,
        result: {
          result_schema_version: "1.0" as const,
          diagnostic_result_id: "diagnostic-result.synthetic.laboratory",
          source_ids: [SYNTHETIC_SOURCE_ID],
          result_type: "STRUCTURED_LAB" as const,
          modality: "LABORATORY" as const,
          panel_code: "panel.synthetic-neutral",
          analytes: [
            {
              analyte_id: "analyte.synthetic.component",
              analyte_code: "analyte-code.synthetic-neutral",
              display_label_key: "diagnostic.synthetic.analyte",
              value: 1,
              unit_code: "unit.synthetic-neutral",
              reference_interval: {
                lower_bound: 0,
                upper_bound: 2,
                lower_inclusive: true,
                upper_inclusive: true
              },
              abnormal_flag: "NORMAL" as const
            }
          ],
          finding_fact_ids: ["fact.synthetic.lab-finding"]
        },
        milestones: milestones("laboratory", [
          ["ORDERED", 0],
          ["PERFORMED", 2],
          ["RESULT_AVAILABLE", 7]
        ]),
        learner_visibility: {
          structured_result: "AT_COMPONENT_AVAILABILITY" as const,
          media: "NEVER" as const,
          machine_interpretation: "NEVER" as const,
          formal_report: "NEVER" as const
        }
      }
    },
    {
      ...actionBase("investigation.synthetic-ecg"),
      investigation: {
        investigation_schema_version: "1.0" as const,
        execution_mode: "ASYNC_PARALLEL" as const,
        result: {
          result_schema_version: "1.0" as const,
          diagnostic_result_id: "diagnostic-result.synthetic.ecg",
          source_ids: [SYNTHETIC_SOURCE_ID],
          result_type: "ECG" as const,
          modality: "ECG" as const,
          finding_fact_ids: ["fact.synthetic.ecg-finding"],
          fallback_fact_ids: ["fact.synthetic.ecg-finding"],
          asset_references: [
            { media_asset_id: "asset.synthetic.ecg-tracing", asset_role: "TRACING" as const }
          ],
          structured_measurements: [
            {
              measurement_id: "measurement.synthetic.ecg-component",
              measurement_code: "measurement-code.synthetic-neutral",
              display_label_key: "diagnostic.synthetic.measurement",
              value: 1,
              unit_code: "unit.synthetic-neutral"
            }
          ],
          machine_interpretation_key: "diagnostic.synthetic.machine-interpretation",
          formal_report_key: "diagnostic.synthetic.ecg-report"
        },
        milestones: milestones("ecg", [
          ["ORDERED", 0],
          ["PERFORMED", 1],
          ["IMAGE_AVAILABLE", 2],
          ["RESULT_AVAILABLE", 3],
          ["FORMAL_REPORT_AVAILABLE", 5]
        ]),
        learner_visibility: {
          structured_result: "AT_COMPONENT_AVAILABILITY" as const,
          media: "AT_COMPONENT_AVAILABILITY" as const,
          machine_interpretation: "NEVER" as const,
          formal_report: "AFTER_SESSION_END" as const
        }
      }
    },
    {
      ...actionBase("investigation.synthetic-imaging"),
      investigation: {
        investigation_schema_version: "1.0" as const,
        execution_mode: "ASYNC_PARALLEL" as const,
        result: {
          result_schema_version: "1.0" as const,
          diagnostic_result_id: "diagnostic-result.synthetic.imaging",
          source_ids: [SYNTHETIC_SOURCE_ID],
          result_type: "IMAGING" as const,
          modality: "XRAY" as const,
          finding_fact_ids: [
            "fact.synthetic.image-finding",
            "fact.synthetic.image-finding-alt"
          ],
          fallback_fact_ids: ["fact.synthetic.image-finding"],
          asset_references: [
            { media_asset_id: "asset.synthetic.xray-image", asset_role: "PRIMARY_IMAGE" as const }
          ],
          formal_report_key: "diagnostic.synthetic.image-report"
        },
        milestones: milestones("imaging", [
          ["ORDERED", 0],
          ["PERFORMED", 4],
          ["IMAGE_AVAILABLE", 6],
          ["RESULT_AVAILABLE", 9],
          ["FORMAL_REPORT_AVAILABLE", 12]
        ]),
        learner_visibility: {
          structured_result: "AT_COMPONENT_AVAILABILITY" as const,
          media: "AT_COMPONENT_AVAILABILITY" as const,
          machine_interpretation: "NEVER" as const,
          formal_report: "AT_COMPONENT_AVAILABILITY" as const
        }
      }
    },
    {
      ...actionBase("investigation.synthetic-ultrasound"),
      investigation: {
        investigation_schema_version: "1.0" as const,
        execution_mode: "ASYNC_PARALLEL" as const,
        result: {
          result_schema_version: "1.0" as const,
          diagnostic_result_id: "diagnostic-result.synthetic.ultrasound",
          source_ids: [SYNTHETIC_SOURCE_ID],
          result_type: "ULTRASOUND" as const,
          modality: "ECHOCARDIOGRAPHY" as const,
          finding_fact_ids: ["fact.synthetic.ultrasound-finding"],
          fallback_fact_ids: ["fact.synthetic.ultrasound-finding"],
          asset_references: [
            { media_asset_id: "asset.synthetic.echo-still", asset_role: "STILL" as const },
            { media_asset_id: "asset.synthetic.echo-loop", asset_role: "LOOP" as const }
          ],
          structured_measurements: [
            {
              measurement_id: "measurement.synthetic.ultrasound-component",
              measurement_code: "measurement-code.synthetic-neutral",
              display_label_key: "diagnostic.synthetic.measurement",
              value: 1,
              unit_code: "unit.synthetic-neutral"
            }
          ],
          formal_report_key: "diagnostic.synthetic.ultrasound-report"
        },
        milestones: milestones("ultrasound", [
          ["ORDERED", 0],
          ["PERFORMED", 5],
          ["IMAGE_AVAILABLE", 8],
          ["RESULT_AVAILABLE", 15],
          ["FORMAL_REPORT_AVAILABLE", 18]
        ]),
        learner_visibility: {
          structured_result: "AT_COMPONENT_AVAILABILITY" as const,
          media: "AT_COMPONENT_AVAILABILITY" as const,
          machine_interpretation: "NEVER" as const,
          formal_report: "AT_COMPONENT_AVAILABILITY" as const
        }
      }
    },
    {
      ...actionBase("investigation.synthetic-text-report"),
      investigation: {
        investigation_schema_version: "1.0" as const,
        execution_mode: "ASYNC_PARALLEL" as const,
        result: {
          result_schema_version: "1.0" as const,
          diagnostic_result_id: "diagnostic-result.synthetic.text-report",
          source_ids: [SYNTHETIC_SOURCE_ID],
          result_type: "TEXT_REPORT" as const,
          modality: "TEXT_REPORT" as const,
          finding_fact_ids: ["fact.synthetic.report-finding"],
          report_content_key: "diagnostic.synthetic.text-report"
        },
        milestones: milestones("text-report", [
          ["ORDERED", 0],
          ["PERFORMED", 2],
          ["RESULT_AVAILABLE", 6],
          ["FORMAL_REPORT_AVAILABLE", 6]
        ]),
        learner_visibility: {
          structured_result: "AT_COMPONENT_AVAILABILITY" as const,
          media: "NEVER" as const,
          machine_interpretation: "NEVER" as const,
          formal_report: "AT_COMPONENT_AVAILABILITY" as const
        }
      }
    }
  ];
}

export async function createDiagnosticCandidateReadyCase(
  hashAdapter: HashAdapter = TEST_HASH_ADAPTER
): Promise<DraftCasePackage> {
  const source = await createCandidateReadyUnderReviewCase(hashAdapter);
  const casePackage = DraftCasePackageSchema.parse({
    ...source,
    localization: {
      ...source.localization,
      entries: [
        ...source.localization.entries,
        ...localizationEntries.map(([key, english, arabic]) => ({
          key,
          translations: [
            { locale: "en-US", text: english },
            { locale: "ar-JO", text: arabic }
          ]
        }))
      ]
    },
    clinical_facts: {
      ...source.clinical_facts,
      facts: [...source.clinical_facts.facts, ...diagnosticFacts]
    },
    action_catalogue: {
      ...source.action_catalogue,
      actions: [...source.action_catalogue.actions, ...diagnosticActions()]
    },
    visual_manifest: {
      ...source.visual_manifest,
      media_assets: [
        ...source.visual_manifest.media_assets,
        governedAsset("asset.synthetic.ecg-tracing", "STATIC_IMAGE", "ECG", "1"),
        governedAsset("asset.synthetic.xray-image", "STATIC_IMAGE", "XRAY", "2"),
        governedAsset("asset.synthetic.echo-still", "STATIC_IMAGE", "ECHOCARDIOGRAPHY", "3"),
        governedAsset("asset.synthetic.echo-still-secondary", "STATIC_IMAGE", "ECHOCARDIOGRAPHY", "5"),
        governedAsset("asset.synthetic.echo-loop", "VIDEO", "ECHOCARDIOGRAPHY", "4")
      ]
    }
  });

  await bindSyntheticReviewAndReachabilityEvidence(casePackage, hashAdapter);
  return DraftCasePackageSchema.parse(casePackage);
}

export async function createDiagnosticPublicationFixture(
  hashAdapter: HashAdapter = TEST_HASH_ADAPTER
) {
  const underReview = await createDiagnosticCandidateReadyCase(hashAdapter);
  const prepared = await preparePublicationCandidate(underReview, hashAdapter);
  if (!prepared.success) {
    throw new Error("Synthetic diagnostic fixture did not produce a publication candidate.");
  }

  const approved = cloneCase(underReview);
  approved.manifest.status = "APPROVED";
  return {
    underReview,
    approved: DraftCasePackageSchema.parse(approved),
    approval: createPublicationApprovalRecord(
      approved,
      prepared.candidate.candidate_package_hash
    )
  };
}

export function cloneDiagnosticCase(casePackage: DraftCasePackage): DraftCasePackage {
  return cloneCase(casePackage);
}
