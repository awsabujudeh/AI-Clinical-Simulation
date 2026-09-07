import {
  SafeLearnerActionCatalogueSchema,
  SubmitClinicalActionRequestSchema
} from "../../../packages/contracts/src/index.ts";
import { SYNTHETIC_SAFE_SESSION } from "./safe-session.ts";

export const V2_016_ACTION_PORTABILITY_EXPECTED =
  '{"catalogue_schema_version":"1.0","action_ids":["examination.synthetic-check","investigation.synthetic-panel","medication.synthetic-study-agent","procedure.synthetic-support","diagnosis.synthetic-entry","disposition.synthetic-choice"],"arabic_label":"إجراء فحص اصطناعي","medication_parameter_codes":["dose","unit","route"],"valid_request":true,"authority_injection_rejected":true,"strict_catalogue":true}' as const;

export function createV2016ActionPortabilitySnapshot() {
  const catalogue = SYNTHETIC_SAFE_SESSION.learner_action_catalogue;
  const medication = catalogue.actions.find((action) => action.action_type === "MEDICATION")!;
  const examination = catalogue.actions.find((action) => action.action_type === "EXAMINATION")!;
  const request = {
    command_id: "command.ui.portability",
    action_request_id: "action-request.ui.portability",
    action_id: examination.action_id,
    expected_state_version: SYNTHETIC_SAFE_SESSION.state_version,
    parameters: {},
    source: "UI"
  };
  return {
    catalogue_schema_version: catalogue.catalogue_schema_version,
    action_ids: catalogue.actions.map((action) => action.action_id),
    arabic_label: examination.labels.find((label) => label.locale === "ar-JO")?.label,
    medication_parameter_codes: medication.parameter_definitions.map(
      (parameter) => parameter.parameter_code
    ),
    valid_request: SubmitClinicalActionRequestSchema.safeParse(request).success,
    authority_injection_rejected: !SubmitClinicalActionRequestSchema.safeParse({
      ...request,
      patient_state: {}
    }).success,
    strict_catalogue: SafeLearnerActionCatalogueSchema.safeParse(catalogue).success
  };
}
