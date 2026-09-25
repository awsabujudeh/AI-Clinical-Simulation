/** Fixed synthetic baseline samples, not dynamically generated clinical results.
 * Conflicting targets are held for review; prior Case data wins. */
export const MEDICAL_SOURCE = "source.wp2.complete-case-authoring";
export const REVIEW_STATUS = "PENDING_PHYSICIAN_REVIEW" as const;
export const REFERENCE_CONFIG = "balsim.simulation-reference-bands.v1";
export type Patient = "khalid" | "dana";
// Simulation display bands only, not universal laboratory/assay reference ranges.
// CBC bands informed by Mayo CBC catalogue; other bands are explicit review configuration.
// No critical flag or treatment decision is inferred from these display bands.
export const LAB_DEFINITIONS: Record<string, {en:string; ar:string; unit:string; range?:readonly [number,number]}> = {
  wbc:{en:"White blood cell count",ar:"عدد الكريات البيضاء",unit:"x10e3-per-ul",range:[3.4,9.6]},
  hemoglobin:{en:"Hemoglobin",ar:"الهيموغلوبين",unit:"g-dl"},
  hematocrit:{en:"Hematocrit",ar:"الهيماتوكريت",unit:"percent"},
  platelets:{en:"Platelets",ar:"الصفائح",unit:"x10e3-per-ul",range:[150,400]},
  sodium:{en:"Sodium",ar:"الصوديوم",unit:"mmol-l",range:[135,145]},
  potassium:{en:"Potassium",ar:"البوتاسيوم",unit:"mmol-l",range:[3.5,5.0]},
  chloride:{en:"Chloride",ar:"الكلوريد",unit:"mmol-l",range:[98,107]},
  bicarbonate:{en:"Serum bicarbonate",ar:"بيكربونات المصل",unit:"mmol-l",range:[22,29]},
  bun:{en:"Blood urea nitrogen",ar:"نيتروجين يوريا الدم",unit:"mg-dl",range:[7,20]},
  creatinine:{en:"Creatinine",ar:"الكرياتينين",unit:"mg-dl",range:[0.6,1.2]},
  egfr:{en:"eGFR",ar:"معدل الترشيح الكبيبي المقدر",unit:"ml-min-1-73m2"},
  glucose:{en:"Blood glucose",ar:"سكر الدم",unit:"mg-dl"},
  magnesium:{en:"Magnesium",ar:"المغنيسيوم",unit:"mg-dl",range:[1.7,2.4]},
  pt:{en:"PT",ar:"زمن البروثرومبين",unit:"second",range:[11,13.5]},
  inr:{en:"INR",ar:"INR",unit:"ratio",range:[0.8,1.2]},
  aptt:{en:"aPTT",ar:"زمن الثرومبوبلاستين الجزئي المنشط",unit:"second",range:[25,35]},
  "hs-ctni":{en:"High-sensitivity cardiac troponin I",ar:"التروبونين القلبي I عالي الحساسية",unit:"ng-l",range:[0,34]},
  ph:{en:"Blood gas pH",ar:"حموضة غاز الدم",unit:"ph"},
  pco2:{en:"Blood gas pCO2",ar:"ضغط ثاني أكسيد الكربون",unit:"mm-hg"},
  po2:{en:"Arterial pO2",ar:"ضغط الأكسجين الشرياني",unit:"mm-hg",range:[80,100]},
  "gas-bicarbonate":{en:"Blood gas bicarbonate",ar:"بيكربونات غاز الدم",unit:"mmol-l",range:[22,26]},
  lactate:{en:"Lactate",ar:"اللاكتات",unit:"mmol-l",range:[0.5,2.2]},
  ast:{en:"AST",ar:"AST",unit:"u-l",range:[10,40]},
  alt:{en:"ALT",ar:"ALT",unit:"u-l",range:[7,56]},
  bilirubin:{en:"Total bilirubin",ar:"البيليروبين الكلي",unit:"mg-dl",range:[0.2,1.2]},
  alp:{en:"ALP",ar:"ALP",unit:"u-l",range:[40,130]},
  crp:{en:"CRP",ar:"CRP",unit:"mg-l",range:[0,5]},
  "d-dimer":{en:"D-dimer",ar:"دي دايمر",unit:"mg-l-feu",range:[0,0.5]},
};
// Exact numerical additions supplied by owner. Existing discrepant values preserved.
export const BASELINE_LABS: Record<Patient, Record<string,number>> = {
  khalid:{wbc:9.1,hemoglobin:14.3,hematocrit:43,platelets:238,sodium:138,potassium:4.2,chloride:102,bicarbonate:21,bun:22,creatinine:1.1,egfr:78,glucose:184,magnesium:1.9,"hs-ctni":286,pt:12.4,inr:1,aptt:30,ph:7.45,pco2:31,po2:67,"gas-bicarbonate":21,lactate:2.8,ast:42,alt:30,bilirubin:0.8,alp:88,crp:4,"d-dimer":0.35},
  dana:{wbc:8.5,hemoglobin:13,hematocrit:40,platelets:250,sodium:138,potassium:4,chloride:103,bicarbonate:20,bun:14,creatinine:0.8,egfr:90,glucose:112,pt:12.3,inr:1,aptt:29,ph:7.34,pco2:36,"gas-bicarbonate":19,lactate:2.8,ast:22,alt:18,bilirubin:0.6,alp:74,crp:2,"d-dimer":0.28},
};
export const PANELS = [
  ["cbc","CBC","تعداد الدم CBC",["wbc","hemoglobin","hematocrit","platelets"]],
  ["electrolytes","Electrolytes / basic metabolic panel","الشوارد / الاستقلاب الأساسي",["sodium","potassium","chloride","bicarbonate"]],
  ["renal","Renal function","وظائف الكلى",["bun","creatinine","egfr"]],
  ["glucose","Blood glucose","سكر الدم",["glucose"]],
  ["troponin","Cardiac troponin","التروبونين القلبي",["hs-ctni"]],
  ["coagulation","Coagulation profile — PT / INR / aPTT","ملف التخثر PT / INR / aPTT",["pt","inr","aptt"]],
  ["blood-gas","Blood gas","غاز الدم",["ph","pco2","gas-bicarbonate"]],
  ["lactate","Lactate","اللاكتات",["lactate"]],
  ["liver","Liver function tests","وظائف الكبد",["ast","alt","bilirubin","alp"]],
  ["crp","CRP","CRP",["crp"]],
  ["d-dimer","D-dimer","دي دايمر",["d-dimer"]],
] as const;
/** CENTRAL SIMULATION_TIMING_FIXTURE, in clinical seconds after committed order.
 * Existing result delays preserved (including inherited Dana VBG and ED panel). */
export const LAB_TIMING: Record<Patient,Record<string,number>> = {
  khalid:{cbc:480,electrolytes:480,renal:480,glucose:60,troponin:600,coagulation:480,"blood-gas":180,lactate:180,liver:480,crp:480,"d-dimer":480},
  dana:{cbc:480,electrolytes:480,renal:480,glucose:480,troponin:600,coagulation:480,"blood-gas":180,lactate:180,liver:480,crp:480,"d-dimer":480},
};
export const MEDICAL_CONFLICTS = [
  ["Khalid CBC","9.1 / 14.3 / 43 / 238","10.8 / 14.1 / 42 / 230","Preserve original four values"],
  ["Khalid chloride / BUN / glucose","102 / 22 / 184","101 / 32 / 178","Preserve original values, including POC glucose"],
  ["Khalid troponin","hs-cTnI 286 ng/L; ULN 34","cTnI 4.80 ng/mL (4800 ng/L)","Preserve original assay/value; no serial rise invented"],
  ["Dana CBC WBC / Hb / platelets","8.5 / 13 / 250","11.2 / 13.4 / 265","Preserve original values; Hct 40 is a new addition"],
  ["Dana potassium / glucose","4.0 / 112","3.8 / 132","Preserve original values"],
  ["Dana blood gas","VBG pH 7.34 / pCO2 36 / HCO3 19","ABG 7.46 / 30 / 21; PaO2 69","Preserve authored VBG as allowed equivalent; no arterial O2 inference"],
  ["Dana lactate","2.8 mmol/L","2.6 mmol/L","Preserve original value"],
  ["Dana tryptase","Sample sent; result pending beyond simulation","Acute result 18.0 microgram/L during encounter","Hold new value/workflow pending explicit decision"],
  ["Khalid visual response","Modest support; pain 7, persistent; pain face retained","Clearer improved pain/face","Preserve existing behavior pending authored visual decision"],
] as const;
