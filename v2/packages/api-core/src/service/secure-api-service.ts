import {
  ASSESSMENT_DISCLOSURE_SCHEMA_VERSION,
  ASSESSMENT_FINALIZATION_BOUNDARY_SCHEMA_VERSION,
  AssessmentFinalizationBoundarySchema,
  EndSimulationResponseDataSchema,
  LEARNER_TIMELINE_SCHEMA_VERSION,
  PatientLanguageSchema,
  SafeFinalAssessmentProjectionSchema,
  SafeInvestigationProjectionSchema,
  SafeLearnerTimelineProjectionSchema,
  SafeLearnerActionCatalogueSchema,
  SafeSessionProjectionSchema,
  StartSessionResponseDataSchema,
  SubmitClinicalActionResponseDataSchema,
  type EndSimulationRequest,
  type EventType,
  type HashAdapter,
  type SafeFinalAssessmentProjection,
  type SafeLearnerTimelineItem,
  type SafeLearnerTimelineProjection,
  type SafeSessionProjection,
  type StartSessionRequest,
  type SubmitClinicalActionRequest
} from "../../../contracts/src/index.ts";
import { canonicalSerialize } from "../../../case-schema/src/index.ts";
import {
  evaluateAssessment,
  evaluateReviewAssessment,
  projectAssessmentDisclosure
} from "../../../assessment-engine/src/index.ts";
import { projectObservations } from "../../../clinical-engine/src/index.ts";
import {
  EXTERNAL_LEARNER_COMMAND_SCHEMA_VERSION,
  InMemorySessionAggregateSchema,
  SESSION_COORDINATOR_SCHEMA_VERSION,
  createSessionCoordinator,
  initializeInMemorySession,
  initializeReviewInMemorySession,
  projectAssessmentEvidenceFromSession,
  type InMemorySessionAggregate,
  type SessionCommitAdapter,
  type SessionCoordinator
} from "../../../session-engine/src/index.ts";

import type { VerifiedPrincipal } from "../auth/verified-principal.ts";
import type {
  ApiAuthorityRepository,
  AuthorizedCase,
  AuthorizedSession
} from "../authorization/api-authority.ts";
import { ERRORS, type ApiServiceResult } from "../errors/api-service-error.ts";
import type { SessionStartRepository } from "../persistence/session-start.ts";

const LEARNER_ACTION_EVENT_TYPES = new Set<EventType>([
  "EXAM_PERFORMED",
  "INVESTIGATION_ORDERED",
  "INVESTIGATION_PERFORMED",
  "MEDICATION_ORDERED",
  "MEDICATION_ADMINISTERED",
  "PROCEDURE_ORDERED",
  "PROCEDURE_PERFORMED",
  "CONSULT_REQUESTED",
  "DIAGNOSIS_SUBMITTED",
  "DISPOSITION_SELECTED"
]);

const STATIC_TIMELINE_LABELS = Object.freeze({
  SESSION_STARTED: [
    { locale: "ar-JO", text: "بدأت الجلسة" },
    { locale: "en-US", text: "Session started" }
  ],
  SESSION_PAUSED: [
    { locale: "ar-JO", text: "أُوقفت الجلسة مؤقتًا" },
    { locale: "en-US", text: "Session paused" }
  ],
  SESSION_RESUMED: [
    { locale: "ar-JO", text: "استؤنفت الجلسة" },
    { locale: "en-US", text: "Session resumed" }
  ],
  SESSION_ENDED: [
    { locale: "ar-JO", text: "انتهت الجلسة" },
    { locale: "en-US", text: "Session ended" }
  ]
} as const);

function sourceCase(authorization: AuthorizedSession) {
  return "review_execution_hash" in authorization.artifact
    ? authorization.artifact.source_case
    : authorization.artifact;
}

function localizedLabelsForKey(
  authorization: AuthorizedSession,
  localizationKey: string
) {
  const entry = sourceCase(authorization).localization.entries.find(
    (candidate) => candidate.key === localizationKey
  );
  return entry?.translations
    .map((translation) => ({
      locale: PatientLanguageSchema.parse(translation.locale),
      text: translation.text
    }))
    .sort((left, right) => left.locale < right.locale ? -1 : left.locale > right.locale ? 1 : 0)
    ?? [];
}

function actionLabels(authorization: AuthorizedSession, actionId: string) {
  const action = sourceCase(authorization).action_catalogue.actions.find(
    (candidate) => candidate.action_id === actionId
  );
  return action?.aliases
    .flatMap((alias) => alias.phrases[0] === undefined
      ? []
      : [{ locale: PatientLanguageSchema.parse(alias.locale), text: alias.phrases[0] }])
    .sort((left, right) => left.locale < right.locale ? -1 : left.locale > right.locale ? 1 : 0)
    ?? [];
}

function investigationAvailabilityIsLearnerVisible(
  authorization: AuthorizedSession,
  actionId: string,
  eventType: EventType,
  ended: boolean
): boolean {
  const action = sourceCase(authorization).action_catalogue.actions.find(
    (candidate) => candidate.action_id === actionId
  );
  if (action?.investigation === undefined) return false;
  const visibility = action.investigation.learner_visibility;
  const policy = eventType === "INVESTIGATION_IMAGE_AVAILABLE"
    ? visibility.media
    : eventType === "INVESTIGATION_FORMAL_REPORT_AVAILABLE"
      ? visibility.formal_report
      : visibility.structured_result;
  return policy === "AT_COMPONENT_AVAILABILITY"
    || (policy === "AFTER_SESSION_END" && ended);
}

function safeTimelineItem(
  event: InMemorySessionAggregate["committed_events"][number],
  authorization: AuthorizedSession,
  ended: boolean
): SafeLearnerTimelineItem | undefined {
  const common = {
    event_id: event.event_id,
    sequence_no: event.sequence_no,
    clinical_time: event.clinical_time
  };
  if (event.event_type === "SESSION_STARTED"
    || event.event_type === "SESSION_PAUSED"
    || event.event_type === "SESSION_RESUMED") {
    return {
      ...common,
      item_type: event.event_type,
      labels: STATIC_TIMELINE_LABELS[event.event_type].map((label) => ({
        locale: PatientLanguageSchema.parse(label.locale),
        text: label.text
      }))
    };
  }
  if (event.event_type === "SIMULATION_ENDED") {
    return {
      ...common,
      item_type: "SESSION_ENDED",
      labels: STATIC_TIMELINE_LABELS.SESSION_ENDED.map((label) => ({
        locale: PatientLanguageSchema.parse(label.locale),
        text: label.text
      }))
    };
  }
  if (event.action_id !== undefined && LEARNER_ACTION_EVENT_TYPES.has(event.event_type)) {
    const labels = actionLabels(authorization, event.action_id);
    return labels.length === 0
      ? undefined
      : { ...common, item_type: "ACTION_COMMITTED", labels, action_id: event.action_id };
  }
  if (
    event.action_id !== undefined
    && [
      "INVESTIGATION_RESULT_AVAILABLE",
      "INVESTIGATION_IMAGE_AVAILABLE",
      "INVESTIGATION_FORMAL_REPORT_AVAILABLE"
    ].includes(event.event_type)
    && investigationAvailabilityIsLearnerVisible(
      authorization,
      event.action_id,
      event.event_type,
      ended
    )
  ) {
    const action = actionLabels(authorization, event.action_id);
    const labels = action.map((label) => ({
      locale: label.locale,
      text: label.locale === "ar-JO"
        ? `أصبحت نتيجة ${label.text} متاحة`
        : `${label.text} result available`
    }));
    return labels.length === 0
      ? undefined
      : {
          ...common,
          item_type: "INVESTIGATION_RESULT_AVAILABLE",
          labels,
          action_id: event.action_id
        };
  }
  return undefined;
}

export type ApiRequestAuthority = Readonly<{
  principal: VerifiedPrincipal;
  request_id: string;
  correlation_id: string;
  idempotency_key?: string;
}>;

export type SecureApiIdFactories = Readonly<{
  createSessionId(input: { principal_user_id: string; idempotency_key: string }): unknown;
  createAssessmentId(input: { session_id: string }): unknown;
}>;

export type SecureApiDependencies = Readonly<{
  authority_repository: ApiAuthorityRepository;
  session_start_repository: SessionStartRepository;
  session_adapter: SessionCommitAdapter;
  session_coordinator: SessionCoordinator;
  hash_adapter: HashAdapter;
  id_factories: SecureApiIdFactories;
  trusted_time_utc: () => unknown;
}>;

function sessionFailure(issues: readonly { code: string }[]): ApiServiceResult<never> {
  const codes = new Set(issues.map((issue) => issue.code));
  if (codes.has("IDEMPOTENCY_CONFLICT")) return { success: false, error: ERRORS.idempotency };
  if (codes.has("STATE_VERSION_CONFLICT") || codes.has("SESSION_VERSION_CONFLICT")) {
    return { success: false, error: ERRORS.stale };
  }
  if (codes.has("SESSION_ENDED")) return { success: false, error: ERRORS.ended };
  if (codes.has("SESSION_NOT_FOUND")) return { success: false, error: ERRORS.authorization };
  if ([...codes].some((code) => code.includes("PERSISTENCE") || code.includes("ADAPTER"))) {
    return { success: false, error: ERRORS.persistence };
  }
  if (codes.has("INVALID_COORDINATOR_INPUT") || codes.has("INVALID_COMMAND_INPUT")) {
    return { success: false, error: ERRORS.malformed };
  }
  return { success: false, error: ERRORS.domainRejected };
}

function artifactMatchesSession(
  authorization: AuthorizedSession,
  session: InMemorySessionAggregate
): boolean {
  const artifact = authorization.artifact;
  if (session.pinned_case.execution_authority === "PUBLISHED_PRODUCTION") {
    return "package_hash" in artifact
      && artifact.manifest.case_package_id === session.pinned_case.case_package_id
      && artifact.manifest.case_version_id === session.pinned_case.case_version_id
      && artifact.manifest.case_version === session.pinned_case.case_version
      && artifact.package_hash === session.pinned_case.package_hash;
  }
  return "review_execution_hash" in artifact
    && artifact.source_identity.case_package_id === session.pinned_case.case_package_id
    && artifact.source_identity.case_version_id === session.pinned_case.case_version_id
    && artifact.source_identity.case_version === session.pinned_case.case_version
    && artifact.review_execution_hash === session.pinned_case.review_execution_hash;
}

function activeAssessmentProjection(
  session: InMemorySessionAggregate,
  authorization: AuthorizedSession,
  assessmentId: string
) {
  const evidence = projectAssessmentEvidenceFromSession(session);
  if (!evidence.success) return undefined;
  const evaluated = session.pinned_case.execution_authority === "PUBLISHED_PRODUCTION"
    && "package_hash" in authorization.artifact
    ? evaluateAssessment({
        evaluation_schema_version: "1.0",
        execution_authority: "PUBLISHED_PRODUCTION",
        evaluation_phase: "LIVE",
        assessment_id: assessmentId,
        compiled_case_package: authorization.artifact,
        session_evidence: evidence.evidence
      })
    : session.pinned_case.execution_authority === "REVIEW_ONLY"
      && "review_execution_hash" in authorization.artifact
      ? evaluateReviewAssessment({
          evaluation_schema_version: "1.0",
          execution_authority: "REVIEW_ONLY",
          evaluation_phase: "LIVE",
          assessment_id: assessmentId,
          review_execution_artifact: authorization.artifact,
          session_evidence: evidence.evidence
        })
      : undefined;
  if (evaluated === undefined || !evaluated.success) return undefined;
  const disclosure = projectAssessmentDisclosure({
    assessment_result: evaluated.result,
    disclosure_context: {
      context_schema_version: ASSESSMENT_DISCLOSURE_SCHEMA_VERSION,
      authority: "TRUSTED_ASSESSMENT_DISCLOSURE",
      assessment_id: assessmentId,
      session_id: session.session_id,
      session_mode: session.mode,
      disclosure_phase: "ACTIVE"
    }
  });
  return disclosure.success ? disclosure.projection : undefined;
}

function safeSessionProjection(
  session: InMemorySessionAggregate,
  authorization: AuthorizedSession,
  assessmentId: string
): ApiServiceResult<SafeSessionProjection> {
  const observations = projectObservations(
    session.patient_state,
    session.pinned_case.clinical_policy.observation_projection
  );
  if (!observations.success) return { success: false, error: ERRORS.internal };
  const caseActions = "review_execution_hash" in authorization.artifact
    ? authorization.artifact.source_case.action_catalogue.actions
    : authorization.artifact.action_catalogue.actions;
  const pinnedActionIds = new Set(
    session.pinned_case.action_catalogue.map((action) => action.action_id)
  );
  const learnerActionCatalogue = SafeLearnerActionCatalogueSchema.safeParse({
    catalogue_schema_version: "1.0",
    actions: caseActions
      .filter((action) => pinnedActionIds.has(action.action_id))
      .map((action) => ({
        action_id: action.action_id,
        action_type: action.action_type,
        labels: action.aliases
          .flatMap((alias) => alias.phrases[0] === undefined
            ? []
            : [{ locale: alias.locale, label: alias.phrases[0] }])
          .sort((left, right) => left.locale < right.locale ? -1 : left.locale > right.locale ? 1 : 0),
        parameter_definitions: action.parameter_definitions,
        confirmation_policy: action.confirmation_policy,
        repeat_policy: action.repeat_policy
      }))
      .sort((left, right) => left.action_id < right.action_id ? -1 : left.action_id > right.action_id ? 1 : 0)
  });
  if (!learnerActionCatalogue.success) {
    return { success: false, error: ERRORS.internal };
  }
  const projection = SafeSessionProjectionSchema.safeParse({
    session_id: session.session_id,
    status: session.status,
    mode: session.mode,
    pinned_case: {
      execution_authority: session.pinned_case.execution_authority,
      case_package_id: session.pinned_case.case_package_id,
      case_version_id: session.pinned_case.case_version_id,
      case_version: session.pinned_case.case_version
    },
    state_version: session.patient_state.state_version,
    clinical_time: session.patient_state.clinical_time,
    event_sequence_through: session.next_sequence_no - 1,
    clock_status: session.clinical_clock.status,
    observations: observations.observations,
    learner_action_catalogue: learnerActionCatalogue.data,
    ...(session.status === "ACTIVE"
      ? { assessment_disclosure: activeAssessmentProjection(session, authorization, assessmentId) }
      : {})
  });
  return projection.success
    ? { success: true, data: projection.data }
    : { success: false, error: ERRORS.internal };
}

function safeLearnerTimelineProjection(
  session: InMemorySessionAggregate,
  authorization: AuthorizedSession
): ApiServiceResult<SafeLearnerTimelineProjection> {
  const allSafeItems = session.committed_events.flatMap((event) => {
    if (event.status !== "COMMITTED" || event.clinical_time > session.patient_state.clinical_time) {
      return [];
    }
    const item = safeTimelineItem(event, authorization, session.status === "ENDED");
    return item === undefined ? [] : [item];
  });
  const firstIncludedIndex = Math.max(0, allSafeItems.length - 256);
  const items = allSafeItems.slice(firstIncludedIndex);
  const projection = SafeLearnerTimelineProjectionSchema.safeParse({
    timeline_schema_version: LEARNER_TIMELINE_SCHEMA_VERSION,
    session_id: session.session_id,
    event_sequence_through: session.next_sequence_no - 1,
    items,
    ...(firstIncludedIndex === 0
      ? {}
      : { truncated_before_sequence: allSafeItems[firstIncludedIndex]!.sequence_no })
  });
  return projection.success
    ? { success: true, data: projection.data }
    : { success: false, error: ERRORS.internal };
}

function safeFinalAssessment(result: {
  assessment_id: string;
  session_id: string;
  overall_score_basis_points: number;
  maximum_score_basis_points: 10000;
  unsafe: boolean;
  assessed_through_clinical_time: number;
  event_sequence_through: number;
  domain_scores: readonly {
    domain_id: string;
    score_basis_points: number;
    weight_basis_points: number;
    weighted_contribution_basis_points: number;
  }[];
  criterion_results: readonly {
    rubric_item_id: string;
    criterion_kind: "AWARD" | "PENALTY" | "CRITICAL_ACTION" | "CRITICAL_ERROR";
    status: "PENDING" | "SATISFIED" | "MISSED" | "TRIGGERED" | "NOT_TRIGGERED";
    evidence_ref_ids: readonly string[];
    trace_codes: readonly string[];
  }[];
  evidence_records: readonly {
    evidence_ref_id: string;
    evidence_kind: string;
    event_id?: string;
    sequence_no?: number;
    clinical_time?: number;
    action_id?: string;
  }[];
}, authorization: AuthorizedSession): ApiServiceResult<SafeFinalAssessmentProjection> {
  const eventByEvidence = new Map(
    result.evidence_records.flatMap((evidence) =>
      evidence.evidence_kind === "COMMITTED_EVENT"
        && evidence.event_id !== undefined
        && evidence.sequence_no !== undefined
        && evidence.clinical_time !== undefined
        ? [[evidence.evidence_ref_id, {
            event_id: evidence.event_id,
            sequence_no: evidence.sequence_no,
            clinical_time: evidence.clinical_time,
            ...(evidence.action_id === undefined ? {} : { action_id: evidence.action_id })
          }] as const]
        : []
    )
  );
  const rubric = sourceCase(authorization).assessment_rubric;
  const findingCandidates = result.criterion_results.filter((criterion) =>
    (criterion.criterion_kind === "AWARD"
      && (criterion.status === "SATISFIED" || criterion.status === "MISSED"))
    || (criterion.criterion_kind !== "AWARD" && criterion.status === "TRIGGERED")
  );
  const projection = SafeFinalAssessmentProjectionSchema.safeParse({
    assessment_id: result.assessment_id,
    session_id: result.session_id,
    assessment_status: "FINAL",
    overall_score_basis_points: result.overall_score_basis_points,
    maximum_score_basis_points: result.maximum_score_basis_points,
    unsafe: result.unsafe,
    assessed_through_clinical_time: result.assessed_through_clinical_time,
    event_sequence_through: result.event_sequence_through,
    domain_scores: result.domain_scores.map((domain) => {
      const definition = rubric.domains.find(
        (candidate) => candidate.domain_code === domain.domain_id
      );
      return {
        domain_id: domain.domain_id,
        labels: definition === undefined
          ? []
          : localizedLabelsForKey(authorization, definition.title_key),
        score_basis_points: domain.score_basis_points,
        weight_basis_points: domain.weight_basis_points,
        weighted_contribution_basis_points: domain.weighted_contribution_basis_points
      };
    }),
    findings: findingCandidates.map((criterion, index) => ({
      finding_id: `finding:${result.assessment_id}:final-${index + 1}`,
      category: criterion.criterion_kind === "AWARD"
        ? criterion.status === "SATISFIED"
          ? "CORRECT_ACTION"
          : criterion.trace_codes.includes("OUTSIDE_CLINICAL_TIME_WINDOW")
            ? "IMPORTANT_DELAY"
            : "MISSED_OPPORTUNITY"
        : "UNSAFE_ACTION",
      resolution: "RESOLVED",
      evidence: criterion.evidence_ref_ids.flatMap((id) => {
        const evidence = eventByEvidence.get(id);
        return evidence === undefined ? [] : [evidence];
      })
    }))
  });
  return projection.success
    ? { success: true, data: projection.data }
    : { success: false, error: ERRORS.internal };
}

async function hashCanonical(hashAdapter: HashAdapter, value: unknown) {
  try {
    return await hashAdapter.sha256(canonicalSerialize(value));
  } catch {
    return undefined;
  }
}

export function createSecureApiService(dependencies: SecureApiDependencies) {
  async function authorizeAndLoad(
    authority: ApiRequestAuthority,
    sessionId: string
  ): Promise<ApiServiceResult<{
    authorization: AuthorizedSession;
    session: InMemorySessionAggregate;
  }>> {
    const authorized = await dependencies.authority_repository.authorizeSession({
      principal_user_id: authority.principal.user_id,
      session_id: sessionId
    });
    if (!authorized.success) {
      return {
        success: false,
        error: authorized.code === "AUTHORITY_UNAVAILABLE"
          ? ERRORS.persistence
          : ERRORS.authorization
      };
    }
    const loaded = await dependencies.session_adapter.load(sessionId);
    if (!loaded.success) return sessionFailure(loaded.issues);
    if (!artifactMatchesSession(authorized.value, loaded.session)) {
      return { success: false, error: ERRORS.authorization };
    }
    return {
      success: true,
      data: { authorization: authorized.value, session: loaded.session }
    };
  }

  async function startSession(input: {
    authority: ApiRequestAuthority;
    request: StartSessionRequest;
    review: boolean;
  }) {
    if (input.authority.idempotency_key === undefined) {
      return { success: false, error: ERRORS.malformed } as const;
    }
    const resolved = input.review
      ? await dependencies.authority_repository.resolveReviewCase({
          principal_user_id: input.authority.principal.user_id,
          case_id: input.request.case_id
        })
      : await dependencies.authority_repository.resolveProductionCase({
          principal_user_id: input.authority.principal.user_id,
          case_id: input.request.case_id
        });
    if (!resolved.success) {
      return {
        success: false,
        error: resolved.code === "AUTHORITY_UNAVAILABLE"
          ? ERRORS.persistence
          : resolved.code === "NOT_AUTHORIZED"
            ? ERRORS.forbidden
            : ERRORS.notFound
      } as const;
    }
    const exactCase: AuthorizedCase = resolved.value;
    const trustedTime = dependencies.trusted_time_utc();
    const sessionId = dependencies.id_factories.createSessionId({
      principal_user_id: input.authority.principal.user_id,
      idempotency_key: input.authority.idempotency_key
    });
    const initialized = exactCase.authority === "PUBLISHED_PRODUCTION"
      ? initializeInMemorySession({
          session_id: sessionId,
          mode: input.request.mode,
          compiled_case_package: exactCase.artifact,
          trusted_real_time_anchor_utc: trustedTime
        })
      : initializeReviewInMemorySession({
          session_id: sessionId,
          mode: input.request.mode,
          review_execution_artifact: exactCase.artifact,
          trusted_real_time_anchor_utc: trustedTime
        });
    if (!initialized.success) return { success: false, error: ERRORS.internal } as const;
    const requestHash = await hashCanonical(dependencies.hash_adapter, {
      principal_user_id: input.authority.principal.user_id,
      authority: exactCase.authority,
      request: input.request,
      artifact_identity: exactCase.authority === "PUBLISHED_PRODUCTION"
        ? exactCase.artifact.package_hash
        : exactCase.artifact.review_execution_hash
    });
    if (requestHash === undefined) return { success: false, error: ERRORS.internal } as const;
    const committed = await dependencies.session_start_repository.start({
      aggregate: initialized.session,
      principal_user_id: input.authority.principal.user_id,
      membership_id: exactCase.membership.membership_id,
      institution_id: exactCase.membership.institution_id,
      idempotency_key: input.authority.idempotency_key,
      request_hash: requestHash
    });
    if (!committed.success) {
      return {
        success: false,
        error: committed.code === "IDEMPOTENCY_CONFLICT"
          ? ERRORS.idempotency
          : committed.code === "NOT_AUTHORIZED"
            ? ERRORS.forbidden
            : committed.code === "INVALID_START"
              ? ERRORS.domainRejected
              : ERRORS.persistence
      } as const;
    }
    const authorization: AuthorizedSession = {
      membership: exactCase.membership,
      institution_id: exactCase.membership.institution_id,
      artifact: exactCase.artifact
    };
    const assessmentId = String(dependencies.id_factories.createAssessmentId({
      session_id: committed.session.session_id
    }));
    const projected = safeSessionProjection(committed.session, authorization, assessmentId);
    if (!projected.success) return projected;
    const response = StartSessionResponseDataSchema.safeParse({
      session: projected.data,
      patient_language: input.request.patient_language,
      visual_preload: {
        status: "DELIVERY_PENDING",
        static_fallback_required: true
      },
      replayed: committed.status === "REPLAYED"
    });
    return response.success
      ? { success: true, data: response.data } as const
      : { success: false, error: ERRORS.internal } as const;
  }

  async function getPatientState(authority: ApiRequestAuthority, sessionId: string) {
    const loaded = await authorizeAndLoad(authority, sessionId);
    if (!loaded.success) return loaded;
    return safeSessionProjection(
      loaded.data.session,
      loaded.data.authorization,
      String(dependencies.id_factories.createAssessmentId({ session_id: sessionId }))
    );
  }

  async function submitClinicalAction(input: {
    authority: ApiRequestAuthority;
    session_id: string;
    request: SubmitClinicalActionRequest;
  }) {
    if (input.authority.idempotency_key === undefined) {
      return { success: false, error: ERRORS.malformed } as const;
    }
    const loaded = await authorizeAndLoad(input.authority, input.session_id);
    if (!loaded.success) return loaded;
    if (loaded.data.session.status === "ENDED") {
      return { success: false, error: ERRORS.ended } as const;
    }
    const pinned = loaded.data.session.pinned_case;
    const expectedCase = pinned.execution_authority === "PUBLISHED_PRODUCTION"
      ? {
          execution_authority: "PUBLISHED_PRODUCTION" as const,
          case_package_id: pinned.case_package_id,
          case_version_id: pinned.case_version_id,
          case_version: pinned.case_version,
          package_hash: pinned.package_hash
        }
      : {
          execution_authority: "REVIEW_ONLY" as const,
          case_package_id: pinned.case_package_id,
          case_version_id: pinned.case_version_id,
          case_version: pinned.case_version,
          review_execution_hash: pinned.review_execution_hash
        };
    const result = await dependencies.session_coordinator.submitExternalClinicalCommand({
      coordinator_schema_version: SESSION_COORDINATOR_SCHEMA_VERSION,
      session_id: input.session_id,
      trusted_real_time_utc: dependencies.trusted_time_utc(),
      request_id: input.authority.request_id,
      correlation_id: input.authority.correlation_id,
      idempotency_key: input.authority.idempotency_key,
      command: {
        command_schema_version: EXTERNAL_LEARNER_COMMAND_SCHEMA_VERSION,
        request_id: input.authority.request_id,
        correlation_id: input.authority.correlation_id,
        learner_actor_id: input.authority.principal.user_id,
        expected_case: expectedCase,
        action_request: {
          action_request_id: input.request.action_request_id,
          catalogue_membership: "UNVERIFIED",
          command_id: input.request.command_id,
          session_id: input.session_id,
          action_id: input.request.action_id,
          request_schema_version: "1.0",
          expected_state_version: input.request.expected_state_version,
          requested_at_clinical_time: loaded.data.session.patient_state.clinical_time,
          parameters: input.request.parameters,
          source: input.request.source,
          idempotency_key: input.authority.idempotency_key
        }
      }
    });
    if (!result.success) return sessionFailure(result.issues);
    if (result.status === "INTERRUPTED" || result.command_result?.command_executed !== true) {
      return { success: false, error: ERRORS.domainRejected } as const;
    }
    const projected = safeSessionProjection(
      result.authoritative_session,
      loaded.data.authorization,
      String(dependencies.id_factories.createAssessmentId({ session_id: input.session_id }))
    );
    if (!projected.success) return projected;
    const response = SubmitClinicalActionResponseDataSchema.safeParse({
      execution_status: "EXECUTED",
      replayed: result.status === "REPLAYED",
      committed_event_ids: result.command_result.committed_events.map((event) => event.event_id),
      session: projected.data
    });
    return response.success
      ? { success: true, data: response.data } as const
      : { success: false, error: ERRORS.internal } as const;
  }

  async function getInvestigationResult(
    authority: ApiRequestAuthority,
    sessionId: string,
    resultId: string
  ) {
    const loaded = await authorizeAndLoad(authority, sessionId);
    if (!loaded.success) return loaded;
    const action = loaded.data.session.pinned_case.action_catalogue.find(
      (candidate) => candidate.investigation?.result.diagnostic_result_id === resultId
    );
    if (action?.investigation === undefined) {
      return { success: false, error: ERRORS.notFound } as const;
    }
    const eventTypes = new Set(
      loaded.data.session.committed_events
        .filter((event) => event.action_id === action.action_id)
        .map((event) => event.event_type)
    );
    const ended = loaded.data.session.status === "ENDED";
    const available = (visibility: "AT_COMPONENT_AVAILABILITY" | "AFTER_SESSION_END" | "NEVER", eventType: EventType) =>
      visibility === "NEVER" ? "WITHHELD" as const
        : visibility === "AFTER_SESSION_END" ? ended ? "AVAILABLE" as const : "PENDING" as const
          : eventTypes.has(eventType) ? "AVAILABLE" as const : "PENDING" as const;
    const visibility = action.investigation.learner_visibility;
    const structured = available(visibility.structured_result, "INVESTIGATION_RESULT_AVAILABLE");
    const media = available(visibility.media, "INVESTIGATION_IMAGE_AVAILABLE");
    const machine = available(visibility.machine_interpretation, "INVESTIGATION_RESULT_AVAILABLE");
    const formal = available(visibility.formal_report, "INVESTIGATION_FORMAL_REPORT_AVAILABLE");
    if ([structured, media, machine, formal].every((status) => status !== "AVAILABLE")) {
      return { success: false, error: ERRORS.resultPending } as const;
    }
    const result = action.investigation.result;
    const learnerStructured = result.result_type === "STRUCTURED_LAB"
      ? { result_type: result.result_type, modality: result.modality, panel_code: result.panel_code, analytes: result.analytes }
      : result.result_type === "ECG"
        ? { result_type: result.result_type, modality: result.modality, structured_measurements: result.structured_measurements }
        : result.result_type === "IMAGING"
          ? { result_type: result.result_type, modality: result.modality }
          : result.result_type === "ULTRASOUND"
            ? { result_type: result.result_type, modality: result.modality, structured_measurements: result.structured_measurements }
            : { result_type: result.result_type, modality: result.modality, report_content_key: result.report_content_key };
    const projection = SafeInvestigationProjectionSchema.safeParse({
      diagnostic_result_id: result.diagnostic_result_id,
      clinical_time: loaded.data.session.patient_state.clinical_time,
      component_status: {
        structured_result: structured,
        media,
        machine_interpretation: machine,
        formal_report: formal
      },
      ...(structured === "AVAILABLE" ? { structured_result: learnerStructured } : {}),
      ...(media === "AVAILABLE" && "asset_references" in result
        ? { media_assets: result.asset_references }
        : {}),
      ...(machine === "AVAILABLE" && "machine_interpretation_key" in result
        && result.machine_interpretation_key !== undefined
        ? { machine_interpretation_key: result.machine_interpretation_key }
        : {}),
      ...(formal === "AVAILABLE"
        ? result.result_type === "TEXT_REPORT"
          ? { formal_report_key: result.report_content_key }
          : "formal_report_key" in result && result.formal_report_key !== undefined
            ? { formal_report_key: result.formal_report_key }
            : {}
        : {})
    });
    return projection.success
      ? { success: true, data: projection.data } as const
      : { success: false, error: ERRORS.internal } as const;
  }

  async function evaluateFinal(
    session: InMemorySessionAggregate,
    authorization: AuthorizedSession
  ): Promise<ApiServiceResult<SafeFinalAssessmentProjection>> {
    if (session.status !== "ENDED" || session.finalization === undefined) {
      return { success: false, error: ERRORS.assessmentPending };
    }
    if (session.pinned_case.execution_authority !== "PUBLISHED_PRODUCTION"
      || !("package_hash" in authorization.artifact)) {
      return { success: false, error: ERRORS.domainRejected };
    }
    const evidence = projectAssessmentEvidenceFromSession(session);
    if (!evidence.success) return { success: false, error: ERRORS.internal };
    const casePackage = authorization.artifact;
    const boundary = AssessmentFinalizationBoundarySchema.safeParse({
      boundary_schema_version: ASSESSMENT_FINALIZATION_BOUNDARY_SCHEMA_VERSION,
      authority: "TRUSTED_SESSION_FINALIZATION",
      assessment_id: session.finalization.assessment_id,
      session_id: session.session_id,
      case_package_id: casePackage.manifest.case_package_id,
      case_version_id: casePackage.manifest.case_version_id,
      case_version: casePackage.manifest.case_version,
      package_hash: casePackage.package_hash,
      rubric_id: casePackage.assessment_rubric.rubric_id,
      rubric_version: casePackage.assessment_rubric.rubric_version,
      rubric_module_hash: casePackage.manifest.module_hashes.assessment_rubric,
      event_sequence_through: session.next_sequence_no - 1,
      clinical_time_through: session.patient_state.clinical_time
    });
    if (!boundary.success) return { success: false, error: ERRORS.internal };
    const evaluated = evaluateAssessment({
      evaluation_schema_version: "1.0",
      execution_authority: "PUBLISHED_PRODUCTION",
      evaluation_phase: "FINAL",
      assessment_id: session.finalization.assessment_id,
      compiled_case_package: casePackage,
      session_evidence: evidence.evidence,
      finalization_boundary: boundary.data
    });
    return evaluated.success
      ? safeFinalAssessment(evaluated.result, authorization)
      : { success: false, error: ERRORS.internal };
  }

  async function endSimulation(input: {
    authority: ApiRequestAuthority;
    session_id: string;
    request: EndSimulationRequest;
  }) {
    if (input.authority.idempotency_key === undefined) {
      return { success: false, error: ERRORS.malformed } as const;
    }
    const loaded = await authorizeAndLoad(input.authority, input.session_id);
    if (!loaded.success) return loaded;
    if (loaded.data.session.pinned_case.execution_authority !== "PUBLISHED_PRODUCTION") {
      return { success: false, error: ERRORS.domainRejected } as const;
    }
    const assessmentId = dependencies.id_factories.createAssessmentId({
      session_id: input.session_id
    });
    const ended = await dependencies.session_coordinator.endSession({
      coordinator_schema_version: SESSION_COORDINATOR_SCHEMA_VERSION,
      session_id: input.session_id,
      trusted_real_time_utc: dependencies.trusted_time_utc(),
      request_id: input.authority.request_id,
      correlation_id: input.authority.correlation_id,
      idempotency_key: input.authority.idempotency_key,
      assessment_id: assessmentId,
      expected_state_version: input.request.expected_state_version,
      reason: input.request.reason
    });
    if (!ended.success) return sessionFailure(ended.issues);
    if (ended.status === "INTERRUPTED") {
      return { success: false, error: ERRORS.domainRejected } as const;
    }
    const assessment = await evaluateFinal(
      ended.authoritative_session,
      loaded.data.authorization
    );
    if (!assessment.success) return assessment;
    const projected = safeSessionProjection(
      ended.authoritative_session,
      loaded.data.authorization,
      String(assessmentId)
    );
    if (!projected.success) return projected;
    const response = EndSimulationResponseDataSchema.safeParse({
      replayed: ended.status === "REPLAYED",
      session: projected.data,
      assessment: assessment.data
    });
    return response.success
      ? { success: true, data: response.data } as const
      : { success: false, error: ERRORS.internal } as const;
  }

  async function getAssessment(authority: ApiRequestAuthority, sessionId: string) {
    const loaded = await authorizeAndLoad(authority, sessionId);
    if (!loaded.success) return loaded;
    if (loaded.data.session.status === "ENDED") {
      return evaluateFinal(loaded.data.session, loaded.data.authorization);
    }
    const assessmentId = String(dependencies.id_factories.createAssessmentId({ session_id: sessionId }));
    const projection = activeAssessmentProjection(
      loaded.data.session,
      loaded.data.authorization,
      assessmentId
    );
    return projection === undefined
      ? { success: false, error: ERRORS.internal } as const
      : { success: true, data: projection } as const;
  }

  async function getLearnerTimeline(authority: ApiRequestAuthority, sessionId: string) {
    const loaded = await authorizeAndLoad(authority, sessionId);
    if (!loaded.success) return loaded;
    return safeLearnerTimelineProjection(
      loaded.data.session,
      loaded.data.authorization
    );
  }

  return Object.freeze({
    startSession,
    getPatientState,
    submitClinicalAction,
    getInvestigationResult,
    endSimulation,
    getAssessment,
    getLearnerTimeline,
    authorizeAndLoad
  });
}
