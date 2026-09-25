// Presentation labels mirror the authored STEMI diagnostic localization entries.
// Values, units, reference intervals and disclosure remain owned by the returned projection.
const labels: Readonly<Record<string, readonly [string, string]>> = {
  "lab.wbc": ["White blood cell count", "عدد الكريات البيضاء"],
  "lab.hemoglobin": ["Hemoglobin", "الهيموغلوبين"],
  "lab.hematocrit": ["Hematocrit", "الهيماتوكريت"],
  "lab.platelets": ["Platelets", "الصفائح"],
  "lab.sodium": ["Sodium", "الصوديوم"],
  "lab.potassium": ["Potassium", "البوتاسيوم"],
  "lab.chloride": ["Chloride", "الكلوريد"],
  "lab.bicarbonate": ["Bicarbonate", "البيكربونات"],
  "lab.bun": ["Blood urea nitrogen", "نيتروجين يوريا الدم"],
  "lab.creatinine": ["Creatinine", "الكرياتينين"],
  "lab.glucose": ["Glucose", "الغلوكوز"],
  "lab.magnesium": ["Magnesium", "المغنيسيوم"],
  "lab.inr": ["INR", "النسبة المعيارية الدولية"],
  "lab.aptt": ["aPTT", "زمن الثرومبوبلاستين الجزئي المنشط"],
  "lab.hs-ctni": ["High-sensitivity cardiac troponin I", "التروبونين القلبي I عالي الحساسية"],
  "ecg.pr-ms": ["PR interval", "فترة PR"],
  "ecg.qrs-ms": ["QRS duration", "مدة QRS"],
  "ecg.qtc-ms": ["QTc", "QTc"],
  "ecg.st-elevation-ii-mm": ["ST elevation II", "ارتفاع ST في II"],
  "ecg.st-elevation-iii-mm": ["ST elevation III", "ارتفاع ST في III"],
  "ecg.st-elevation-avf-mm": ["ST elevation aVF", "ارتفاع ST في aVF"],
  "ecg.st-elevation-v3r-mm": ["ST elevation V3R", "ارتفاع ST في V3R"],
  "ecg.st-elevation-v4r-mm": ["ST elevation V4R", "ارتفاع ST في V4R"],
  "echo.lvef-percent": ["Left ventricular ejection fraction", "الكسر القذفي للبطين الأيسر"],
  "echo.tapse-mm": ["TAPSE", "TAPSE"]
};

const units: Readonly<Record<string, readonly [string, string]>> = {
  "unit.millisecond": ["ms", "مللي ثانية"],
  "unit.millimeter": ["mm", "ملم"],
  "unit.percent": ["%", "%"],
  "unit.mg-dl": ["mg/dL", "ملغ/دل"],
  "unit.g-dl": ["g/dL", "غ/دل"],
  "unit.mmol-l": ["mmol/L", "مليمول/لتر"],
  "unit.ng-l": ["ng/L", "نانوغرام/لتر"],
  "unit.x10e3-per-ul": ["×10³/µL", "×10³/ميكرولتر"],
  "unit.second": ["s", "ثانية"],
  "unit.ratio": ["ratio", "نسبة"]
};

function knownLabel(mapping: Readonly<Record<string, readonly [string, string]>>, code: string, locale: string) {
  return Object.hasOwn(mapping, code) ? mapping[code]![locale === "ar-JO" ? 1 : 0] : code;
}

export const diagnosticValueLabel = (code: string, locale: string) => knownLabel(labels, code, locale);
export const diagnosticUnitLabel = (code: string, locale: string) => knownLabel(units, code, locale);
