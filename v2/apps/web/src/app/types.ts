import {
  type ConnectivityState,
  type JsonObject,
  PatientLanguageSchema,
  type SafeLearnerAction,
  type LastKnownSafeSessionProjection,
  type PatientLanguage,
  type SafeSessionProjection,
  type SessionMode,
  type StartSessionRequest
} from "@ai-clinical-simulation/contracts";

/*
 * These are parsed once from the shared contract; the UI does not define a
 * competing locale authority.
 */
export const STUDENT_SHELL_LOCALES = Object.freeze({
  AR_JO: PatientLanguageSchema.parse("ar-JO"),
  EN_US: PatientLanguageSchema.parse("en-US")
});

export type AuthSnapshot =
  | Readonly<{ status: "UNAUTHENTICATED" | "EXPIRED" }>
  | Readonly<{
      status: "AUTHENTICATED";
      principal_user_id: string;
      display_name?: string;
    }>;

export interface StudentAuthService {
  resolve(): Promise<AuthSnapshot>;
  beginSignIn?(): Promise<void>;
  signOut?(): Promise<void>;
}

export type SessionLoadResult =
  | Readonly<{
      kind: "AUTHORITATIVE";
      connectivity: "ONLINE" | "SYNC_REQUIRED" | "RECOVERING";
      projection: SafeSessionProjection;
      request_status?: "IN_DOUBT" | "STALE_NOT_EXECUTED";
    }>
  | Readonly<{
      kind: "STALE";
      connectivity: "OFFLINE_OR_UNREACHABLE";
      cached: LastKnownSafeSessionProjection;
      request_status?: "IN_DOUBT" | "STALE_NOT_EXECUTED";
    }>
  | Readonly<{
      kind: "UNAUTHORIZED" | "NOT_FOUND" | "API_UNAVAILABLE";
      http_status?: number;
    }>;

export type StartSessionResult =
  | Readonly<{
      success: true;
      projection: SafeSessionProjection;
      patient_language: PatientLanguage;
      replayed: boolean;
    }>
  | Readonly<{
      success: false;
      kind:
        | "UNAUTHENTICATED"
        | "UNAUTHORIZED"
        | "NOT_FOUND"
        | "CONFLICT"
        | "INVALID"
        | "API_UNAVAILABLE"
        | "IN_DOUBT";
      http_status?: number;
    }>;

export interface StudentSessionService {
  load(sessionId: string): Promise<SessionLoadResult>;
  start(request: StartSessionRequest): Promise<StartSessionResult>;
}

export type StudentClinicalActionIntent = Readonly<{
  principal_user_id: string;
  session_id: string;
  expected_state_version: number;
  action: SafeLearnerAction;
  parameters: JsonObject;
  connectivity_state: ConnectivityState;
}>;

export type StudentClinicalActionResult =
  | Readonly<{
      kind: "COMMITTED";
      replayed: boolean;
      idempotency_key: string;
      committed_event_ids: readonly string[];
      projection: SafeSessionProjection;
    }>
  | Readonly<{
      kind:
        | "INVALID"
        | "NOT_SENT"
        | "IN_DOUBT"
        | "STALE"
        | "IDEMPOTENCY_CONFLICT"
        | "UNAUTHENTICATED"
        | "UNAUTHORIZED"
        | "REJECTED"
        | "UNAVAILABLE";
      idempotency_key?: string;
      http_status?: number;
      requires_authoritative_sync: boolean;
    }>;

export interface StudentClinicalActionService {
  submit(intent: StudentClinicalActionIntent): Promise<StudentClinicalActionResult>;
}

export type StudentUiServices = Readonly<{
  auth: StudentAuthService;
  sessions: StudentSessionService;
  actions: StudentClinicalActionService;
}>;

export type StudentShellLocale = PatientLanguage;

export type SessionPresentationState = Readonly<{
  kind:
    | "ACTIVE_ONLINE"
    | "ACTIVE_STALE"
    | "RECOVERING"
    | "SYNC_REQUIRED"
    | "ENDED";
  projection: SafeSessionProjection;
  mutation_authority: "SERVER_ONLY" | "NONE";
  request_status?: "IN_DOUBT" | "STALE_NOT_EXECUTED";
}>;

export type SessionEntryDefaults = Readonly<{
  mode: SessionMode;
  patient_language: PatientLanguage;
}>;
