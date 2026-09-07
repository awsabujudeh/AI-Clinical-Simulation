import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";

import { patientLanguageDirection } from "./session-presentation";
import { STUDENT_SHELL_LOCALES, type StudentShellLocale } from "./types";

const enUS = {
  brand: "Clinical Simulation",
  skipToContent: "Skip to main content",
  publicEyebrow: "Server-authoritative learning",
  publicTitle: "AI Clinical Simulation Platform V2",
  publicIntro: "A focused clinical simulation workspace built for deliberate, evidence-aware learning.",
  publicPrimary: "Learner sign in",
  publicExpo: "Open Expo experience",
  publicAuthorityTitle: "Clinical truth stays authoritative",
  publicAuthorityBody: "Patient state, clinical time, investigations, and assessment are displayed only after trusted server commitment.",
  publicBilingualTitle: "Designed for Jordan",
  publicBilingualBody: "The learner shell supports Arabic and English without changing language-neutral clinical truth.",
  publicRecoveryTitle: "Calm under interruption",
  publicRecoveryBody: "Connection and recovery states remain visible without replaying clinical intent automatically.",
  loginTitle: "Learner sign in",
  loginBody: "Use your institution's secure sign-in to access assigned simulations.",
  loginAction: "Continue with secure sign in",
  loginUnavailable: "Secure sign-in is not configured in this local environment.",
  authLoading: "Checking your secure session",
  authExpired: "Your sign-in has expired. Sign in again to continue.",
  homeTitle: "Start or resume a simulation",
  homeIntro: "Enter an authorized case access code or resume an existing session. The server confirms access and publication status.",
  caseAccessCode: "Case access code",
  caseAccessHint: "Only published cases assigned to you can start.",
  patientLanguage: "Patient language",
  simulationMode: "Simulation mode",
  practiceMode: "Practice / Demo",
  assessmentMode: "Assessment",
  practiceDescription: "Eligible deterministic learning notes may appear when the case permits.",
  assessmentDescription: "Correctness and scoring remain hidden until the simulation ends.",
  startSession: "Start secure session",
  startingSession: "Starting secure session",
  resumeTitle: "Resume a session",
  sessionId: "Session ID",
  resumeSession: "Resume session",
  expoLabel: "Expo learner experience",
  expoTitle: "Begin a guided clinical simulation",
  expoBody: "Practice / Demo is selected by default. Authentication and server case authority are still required.",
  authenticatedAs: "Signed in as",
  signOut: "Sign out",
  language: "Language",
  patientOverview: "Patient overview",
  currentPatient: "Current patient",
  sessionActive: "Active session",
  sessionEnded: "Session ended",
  clinicalTime: "Clinical time",
  connectionOnline: "Connected to authoritative session",
  connectionOffline: "Connection lost — showing last known state",
  connectionRecovering: "Reconnecting to the authoritative session",
  connectionSync: "Session updated — review the current patient before acting again",
  requestInDoubt: "Action status is uncertain. Recovery will reconcile the original request only.",
  requestStale: "The session changed before that request committed. Review the current patient before acting again.",
  staleDescription: "Values and clinical time are frozen at the last confirmed projection. No clinical work continues in this browser.",
  monitorTitle: "Clinical monitor",
  monitorSubtitle: "Committed observation projection",
  heartRate: "Heart rate",
  bloodPressure: "Blood pressure",
  respiratoryRate: "Respiratory rate",
  oxygenSaturation: "Oxygen saturation",
  temperature: "Temperature",
  rhythm: "Rhythm",
  consciousness: "Consciousness",
  visualTitle: "Visual Patient",
  visualBody: "A state-driven patient viewport will appear here in a later release.",
  visualStatus: "Integration surface reserved",
  visualFallback: "Static fallback required",
  interactionTitle: "Clinical interaction",
  interactionSubtitle: "Choose a domain to organize your next step",
  navHistory: "History",
  navExamination: "Examination",
  navInvestigations: "Investigations",
  navMedications: "Medications",
  navProcedures: "Procedures",
  navDiagnosis: "Diagnosis / Disposition",
  domainDeferred: "Action controls for this domain arrive in V2-016. No medical request is sent from this shell.",
  investigationsTitle: "Investigations",
  investigationsBody: "Authorized ordered, pending, and available results will appear here. No result or media is fabricated locally.",
  timelineTitle: "Session context",
  timelineBody: "The authoritative event timeline will be rendered in V2-017.",
  eventSequence: "Events confirmed through",
  recoveryTitle: "Recovery status",
  loadingSession: "Loading authoritative session",
  loadingNoPatient: "No patient data is displayed until authorization and validation complete.",
  unauthorizedTitle: "Session access denied",
  unauthorizedBody: "This account is not authorized to view that session.",
  notFoundTitle: "Session not found",
  notFoundBody: "The session may not exist or may not be available to this account.",
  unavailableTitle: "Clinical service unavailable",
  unavailableBody: "The secure clinical service could not be reached. No local medical continuation is available.",
  invalidSessionTitle: "Invalid session link",
  invalidSessionBody: "The session identifier in this link is not valid.",
  stateChangedTitle: "Patient state changed",
  stateChangedBody: "The request was not automatically repeated. Resynchronize and review the current patient.",
  invalidRequestTitle: "Request could not be accepted",
  invalidRequestBody: "Review the entered information and try again.",
  backHome: "Back to learner home",
  noActiveSession: "No active session selected",
  footerAuthority: "Server-authoritative clinical simulation",
  reviewOnly: "Review-only context",
  reviewOnlyBody: "This preview is not a published learner simulation.",
  comingLater: "Available in a later delivery"
} as const;

type MessageKey = keyof typeof enUS;

const arJO: Record<MessageKey, string> = {
  brand: "المحاكاة السريرية",
  skipToContent: "الانتقال إلى المحتوى الرئيسي",
  publicEyebrow: "تعلّم يستند إلى مصدر سريري موثوق",
  publicTitle: "منصة المحاكاة السريرية بالذكاء الاصطناعي V2",
  publicIntro: "مساحة محاكاة سريرية مركّزة للتعلّم المتأني القابل للتتبّع بالأدلة.",
  publicPrimary: "دخول الطالب",
  publicExpo: "فتح تجربة المعرض",
  publicAuthorityTitle: "الحقيقة السريرية تبقى موثوقة",
  publicAuthorityBody: "لا تُعرض حالة المريض أو الزمن السريري أو الفحوصات أو التقييم إلا بعد اعتماد الخادم.",
  publicBilingualTitle: "مصممة للأردن",
  publicBilingualBody: "تدعم الواجهة العربية والإنجليزية دون تغيير الحقيقة السريرية المحايدة لغويًا.",
  publicRecoveryTitle: "وضوح عند انقطاع الاتصال",
  publicRecoveryBody: "تظهر حالة الاتصال والاستعادة بوضوح دون إعادة تنفيذ الأوامر السريرية تلقائيًا.",
  loginTitle: "دخول الطالب",
  loginBody: "استخدم تسجيل الدخول الآمن الخاص بمؤسستك للوصول إلى المحاكاة المخصصة لك.",
  loginAction: "المتابعة إلى تسجيل الدخول الآمن",
  loginUnavailable: "تسجيل الدخول الآمن غير مهيأ في هذه البيئة المحلية.",
  authLoading: "جارٍ التحقق من الجلسة الآمنة",
  authExpired: "انتهت صلاحية تسجيل الدخول. سجّل الدخول مجددًا للمتابعة.",
  homeTitle: "ابدأ محاكاة أو استأنفها",
  homeIntro: "أدخل رمز حالة مصرحًا به أو استأنف جلسة قائمة. يتحقق الخادم من الصلاحية وحالة النشر.",
  caseAccessCode: "رمز الوصول إلى الحالة",
  caseAccessHint: "يمكن بدء الحالات المنشورة والمخصصة لك فقط.",
  patientLanguage: "لغة المريض",
  simulationMode: "وضع المحاكاة",
  practiceMode: "تدريب / عرض",
  assessmentMode: "تقييم",
  practiceDescription: "قد تظهر ملاحظات تعليمية حتمية عندما تسمح الحالة بذلك.",
  assessmentDescription: "تبقى صحة الإجابات والدرجات مخفية حتى انتهاء المحاكاة.",
  startSession: "بدء جلسة آمنة",
  startingSession: "جارٍ بدء الجلسة الآمنة",
  resumeTitle: "استئناف جلسة",
  sessionId: "معرّف الجلسة",
  resumeSession: "استئناف الجلسة",
  expoLabel: "تجربة الطالب في المعرض",
  expoTitle: "ابدأ محاكاة سريرية موجّهة",
  expoBody: "يُختار وضع التدريب / العرض افتراضيًا، مع بقاء المصادقة وسلطة الخادم مطلوبة.",
  authenticatedAs: "تم الدخول باسم",
  signOut: "تسجيل الخروج",
  language: "اللغة",
  patientOverview: "ملخص المريض",
  currentPatient: "المريض الحالي",
  sessionActive: "جلسة نشطة",
  sessionEnded: "انتهت الجلسة",
  clinicalTime: "الزمن السريري",
  connectionOnline: "متصل بالجلسة الموثوقة",
  connectionOffline: "انقطع الاتصال — تُعرض آخر حالة معروفة",
  connectionRecovering: "جارٍ إعادة الاتصال بالجلسة الموثوقة",
  connectionSync: "تحدّثت الجلسة — راجع حالة المريض قبل أي إجراء جديد",
  requestInDoubt: "حالة الإجراء غير مؤكدة. ستتم مطابقة الطلب الأصلي نفسه فقط.",
  requestStale: "تغيرت الجلسة قبل اعتماد الطلب. راجع حالة المريض قبل أي إجراء جديد.",
  staleDescription: "القيم والزمن السريري متوقفان عند آخر عرض مؤكد، ولا يستمر أي عمل سريري داخل المتصفح.",
  monitorTitle: "المراقبة السريرية",
  monitorSubtitle: "عرض الملاحظات المعتمد",
  heartRate: "معدل القلب",
  bloodPressure: "ضغط الدم",
  respiratoryRate: "معدل التنفس",
  oxygenSaturation: "تشبع الأكسجين",
  temperature: "الحرارة",
  rhythm: "النظم القلبي",
  consciousness: "الوعي",
  visualTitle: "المريض المرئي",
  visualBody: "ستظهر هنا لاحقًا نافذة مريض تتغير وفق الحالة المعتمدة.",
  visualStatus: "مساحة التكامل محجوزة",
  visualFallback: "يلزم بديل ثابت",
  interactionTitle: "التفاعل السريري",
  interactionSubtitle: "اختر مجالًا لتنظيم خطوتك التالية",
  navHistory: "القصة المرضية",
  navExamination: "الفحص",
  navInvestigations: "الاستقصاءات",
  navMedications: "الأدوية",
  navProcedures: "الإجراءات",
  navDiagnosis: "التشخيص / الخطة النهائية",
  domainDeferred: "تصل أدوات هذا المجال في V2-016. لا ترسل هذه الواجهة أي طلب طبي.",
  investigationsTitle: "الاستقصاءات",
  investigationsBody: "ستظهر هنا النتائج المصرح بها عند طلبها أو انتظارها أو توفرها، دون اختلاق نتائج أو وسائط محليًا.",
  timelineTitle: "سياق الجلسة",
  timelineBody: "سيُعرض الخط الزمني الموثوق للأحداث في V2-017.",
  eventSequence: "الأحداث المؤكدة حتى",
  recoveryTitle: "حالة الاستعادة",
  loadingSession: "جارٍ تحميل الجلسة الموثوقة",
  loadingNoPatient: "لا تُعرض بيانات المريض قبل اكتمال التحقق والتفويض.",
  unauthorizedTitle: "الوصول إلى الجلسة مرفوض",
  unauthorizedBody: "هذا الحساب غير مخول لعرض هذه الجلسة.",
  notFoundTitle: "الجلسة غير موجودة",
  notFoundBody: "قد لا تكون الجلسة موجودة أو متاحة لهذا الحساب.",
  unavailableTitle: "الخدمة السريرية غير متاحة",
  unavailableBody: "تعذر الوصول إلى الخدمة الآمنة. لا تتوفر متابعة طبية محلية.",
  invalidSessionTitle: "رابط الجلسة غير صالح",
  invalidSessionBody: "معرّف الجلسة في هذا الرابط غير صالح.",
  stateChangedTitle: "تغيرت حالة المريض",
  stateChangedBody: "لم يُعَد الطلب تلقائيًا. أعد المزامنة وراجع حالة المريض.",
  invalidRequestTitle: "تعذر قبول الطلب",
  invalidRequestBody: "راجع المعلومات المدخلة ثم حاول مجددًا.",
  backHome: "العودة إلى صفحة الطالب",
  noActiveSession: "لم تُحدّد جلسة نشطة",
  footerAuthority: "محاكاة سريرية موثوقة من الخادم",
  reviewOnly: "سياق للمراجعة فقط",
  reviewOnlyBody: "هذه المعاينة ليست محاكاة منشورة للطلاب.",
  comingLater: "متاح في إصدار لاحق"
};

type LocalizationContextValue = Readonly<{
  locale: StudentShellLocale;
  direction: "ltr" | "rtl";
  setLocale(locale: StudentShellLocale): void;
  t(key: MessageKey): string;
}>;

const LocalizationContext = createContext<LocalizationContextValue | undefined>(
  undefined
);

export function LocalizationProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<StudentShellLocale>(
    STUDENT_SHELL_LOCALES.EN_US
  );
  const direction = patientLanguageDirection(locale);
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = direction;
  }, [direction, locale]);
  const value = useMemo<LocalizationContextValue>(() => ({
    locale,
    direction,
    setLocale,
    t: (key) => (locale === "ar-JO" ? arJO[key] : enUS[key])
  }), [direction, locale]);
  return (
    <LocalizationContext.Provider value={value}>
      {children}
    </LocalizationContext.Provider>
  );
}

export function useLocalization(): LocalizationContextValue {
  const value = useContext(LocalizationContext);
  if (value === undefined) {
    throw new Error("LocalizationProvider is required.");
  }
  return value;
}

export type { MessageKey };
