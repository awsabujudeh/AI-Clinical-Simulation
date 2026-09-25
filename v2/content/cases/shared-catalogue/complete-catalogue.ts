import { SafeLearnerActionCatalogueSchema } from "../../../packages/contracts/src/index.ts";
import { EXPO_SHARED_CATALOGUE } from "./expo-catalogue.ts";
import { PANELS } from "./medical-dataset.ts";

/** Successor; v1.0.0 is not changed. Public vocabulary has no Case outcomes. */
export const COMPLETE_EXPO_CATALOGUE = SafeLearnerActionCatalogueSchema.parse({
  ...structuredClone(EXPO_SHARED_CATALOGUE),
  identity: { catalogue_id: "catalogue.balsim.expo-clinical", version: "1.1.0" },
  actions: [...EXPO_SHARED_CATALOGUE.actions, ...[
    ...PANELS.map(([id,en,ar]) => [id,en,ar,"Blood Tests"] as const),
    ["focused-echo","Focused cardiac ultrasound / FoCUS","تصوير القلب بالموجات فوق الصوتية المركّز","Cardiology"] as const,
  ].map(([id,en,ar,subcategory]) => ({
    action_id: `concept.expo.${id}`, action_type: "INVESTIGATION", category: "INVESTIGATIONS",
    subcategory, labels: [{locale:"en-US",label:en},{locale:"ar-JO",label:ar}],
    aliases: [{locale:"en-US",phrases:[en]},{locale:"ar-JO",phrases:[ar]}],
    parameter_definitions: [], prerequisite_concept_ids: [], confirmation_policy:"NONE", repeat_policy:"NOT_REPEATABLE",
  }))].sort((a,b) => a.action_id < b.action_id ? -1 : a.action_id > b.action_id ? 1 : 0),
});
