import {
  InMemorySessionAggregateSchema,
  SessionAdapterCommitRequestSchema,
  createSessionCommitToken,
  sessionCommitTokensEqual,
  createSessionCommandIssue,
  createSessionCoordinator,
  type InMemorySessionAggregate,
  type SessionAdapterCommitResult,
  type SessionAdapterLoadResult,
  type SessionCommitAdapter
} from "../../../packages/session-engine/src/index.ts";
import {
  createSecureApiApp,
  type ApiAuthorityRepository,
  type AuthorityResult,
  type AuthorizedProductionCase,
  type AuthorizedReviewCase,
  type AuthorizedSession,
  type AuthenticationVerifier,
  type SessionStartCommitResult,
  type SessionStartRepository
} from "../../../packages/api-core/src/index.ts";
import type {
  CompiledCasePackage,
  ReviewExecutionArtifact
} from "../../../packages/case-schema/src/index.ts";
import { createCompiledAssessmentCase } from "../assessment-engine/synthetic-assessment.ts";
import { prepareStemiReviewArtifact } from "../cases/stemi-review.ts";
import { TEST_HASH_ADAPTER } from "../cases/synthetic-case.ts";
import { DETERMINISTIC_EVENT_ID_FACTORY } from "../session-engine/synthetic-command.ts";

export const API_TEST_USERS = Object.freeze({
  learner: "10000000-0000-4000-8000-000000000001",
  other_learner: "10000000-0000-4000-8000-000000000002",
  faculty: "10000000-0000-4000-8000-000000000003",
  cross_tenant_reviewer: "10000000-0000-4000-8000-000000000004",
  inactive: "10000000-0000-4000-8000-000000000005"
});

export const V2_013_API_PORTABILITY_EXPECTED =
  '{"statuses":[201,200,200,200],"session_id":"session.api.0001.idempotency-api-portability-start","initial_state_version":0,"action_state_version":1,"action_event_ids":["00000000-0000-4000-8000-000000000001"],"retry_replayed":true,"retry_event_ids":["00000000-0000-4000-8000-000000000001"],"final_event_sequence":1,"assessment_projection_type":"ACTIVE_ASSESSMENT_WITHHELD"}' as const;

const roles = Object.freeze({
  [API_TEST_USERS.learner]: { membership_id: "membership.api.learner", institution_id: "ju", role: "LEARNER" as const },
  [API_TEST_USERS.other_learner]: { membership_id: "membership.api.other", institution_id: "ju", role: "LEARNER" as const },
  [API_TEST_USERS.faculty]: { membership_id: "membership.api.faculty", institution_id: "ju", role: "FACULTY" as const },
  [API_TEST_USERS.cross_tenant_reviewer]: { membership_id: "membership.api.cross", institution_id: "just", role: "REVIEWER" as const }
});

function cloneSession(input: unknown): InMemorySessionAggregate {
  return InMemorySessionAggregateSchema.parse(input);
}

export class ApiTestSessionStore implements SessionCommitAdapter, SessionStartRepository {
  readonly sessions = new Map<string, InMemorySessionAggregate>();
  readonly owners = new Map<string, string>();
  readonly startRecords = new Map<string, { request_hash: string; session_id: string }>();
  failNextCommit = false;

  async load(sessionId: unknown): Promise<SessionAdapterLoadResult> {
    const stored = typeof sessionId === "string" ? this.sessions.get(sessionId) : undefined;
    if (stored === undefined) {
      return { success: false, issues: [createSessionCommandIssue({
        code: "SESSION_NOT_FOUND",
        path: "$.session_id",
        message: "Session not found."
      })] };
    }
    const session = cloneSession(stored);
    return { success: true, issues: [], session, commit_token: createSessionCommitToken(session) };
  }

  async commit(input: unknown): Promise<SessionAdapterCommitResult> {
    if (this.failNextCommit) {
      this.failNextCommit = false;
      return { success: false, issues: [createSessionCommandIssue({
        code: "SESSION_ADAPTER_FAILURE",
        path: "$.adapter",
        message: "Synthetic adapter failure."
      })] };
    }
    const request = SessionAdapterCommitRequestSchema.safeParse(input);
    if (!request.success) {
      return { success: false, issues: [createSessionCommandIssue({
        code: "INVALID_COORDINATOR_INPUT",
        path: "$.adapter",
        message: "Invalid commit request."
      })] };
    }
    const current = this.sessions.get(request.data.session_id);
    if (current === undefined) {
      return { success: false, issues: [createSessionCommandIssue({
        code: "SESSION_NOT_FOUND",
        path: "$.session_id",
        message: "Session not found."
      })] };
    }
    if (!sessionCommitTokensEqual(createSessionCommitToken(current), request.data.expected_token)) {
      return { success: false, issues: [createSessionCommandIssue({
        code: "SESSION_VERSION_CONFLICT",
        path: "$.expected_token",
        message: "Session changed."
      })] };
    }
    const stored = cloneSession(request.data.proposed_session);
    this.sessions.set(stored.session_id, stored);
    const session = cloneSession(stored);
    return { success: true, issues: [], session, commit_token: createSessionCommitToken(session) };
  }

  async start(input: unknown): Promise<SessionStartCommitResult> {
    const request = input as {
      aggregate: unknown;
      principal_user_id: string;
      idempotency_key: string;
      request_hash: string;
    };
    const session = InMemorySessionAggregateSchema.safeParse(request.aggregate);
    if (!session.success) return { success: false, code: "INVALID_START" };
    const key = `${request.principal_user_id}\u0000${request.idempotency_key}`;
    const prior = this.startRecords.get(key);
    if (prior !== undefined) {
      if (prior.request_hash !== request.request_hash) {
        return { success: false, code: "IDEMPOTENCY_CONFLICT" };
      }
      return {
        success: true,
        status: "REPLAYED",
        session: cloneSession(this.sessions.get(prior.session_id))
      };
    }
    this.sessions.set(session.data.session_id, cloneSession(session.data));
    this.owners.set(session.data.session_id, request.principal_user_id);
    this.startRecords.set(key, {
      request_hash: request.request_hash,
      session_id: session.data.session_id
    });
    return { success: true, status: "CREATED", session: cloneSession(session.data) };
  }
}

export type ApiTestHarness = Awaited<ReturnType<typeof createApiTestHarness>>;

export async function createApiTestHarness(input?: {
  include_stemi?: boolean;
  production_package?: CompiledCasePackage;
}) {
  const productionPackage = input?.production_package ?? await createCompiledAssessmentCase();
  const reviewArtifact = input?.include_stemi === false
    ? undefined
    : await prepareStemiReviewArtifact();
  const store = new ApiTestSessionStore();
  const authority: ApiAuthorityRepository = {
    async resolveProductionCase({ principal_user_id, case_id }) {
      const membership = roles[principal_user_id as keyof typeof roles];
      if (membership === undefined || membership.role !== "LEARNER") {
        return { success: false, code: "NOT_AUTHORIZED" };
      }
      if (case_id !== productionPackage.manifest.case_id) {
        return { success: false, code: "NOT_FOUND" };
      }
      return { success: true, value: {
        authority: "PUBLISHED_PRODUCTION",
        membership,
        artifact: productionPackage
      } } as AuthorityResult<AuthorizedProductionCase>;
    },
    async resolveReviewCase({ principal_user_id, case_id }) {
      const membership = roles[principal_user_id as keyof typeof roles];
      if (membership === undefined || membership.role === "LEARNER") {
        return { success: false, code: "NOT_AUTHORIZED" };
      }
      if (reviewArtifact === undefined || case_id !== reviewArtifact.source_case.manifest.case_id
        || membership.institution_id !== "ju") {
        return { success: false, code: "NOT_FOUND" };
      }
      return { success: true, value: {
        authority: "REVIEW_ONLY",
        membership,
        artifact: reviewArtifact
      } } as AuthorityResult<AuthorizedReviewCase>;
    },
    async authorizeSession({ principal_user_id, session_id }) {
      if (store.owners.get(session_id) !== principal_user_id) {
        return { success: false, code: "NOT_FOUND" };
      }
      const session = store.sessions.get(session_id);
      const membership = roles[principal_user_id as keyof typeof roles];
      if (session === undefined || membership === undefined) {
        return { success: false, code: "NOT_FOUND" };
      }
      const artifact = session.pinned_case.execution_authority === "PUBLISHED_PRODUCTION"
        ? productionPackage
        : reviewArtifact;
      if (artifact === undefined) return { success: false, code: "NOT_FOUND" };
      return { success: true, value: {
        membership,
        institution_id: membership.institution_id,
        artifact
      } } as AuthorityResult<AuthorizedSession>;
    }
  };
  const authentication: AuthenticationVerifier = {
    async verifyAuthorizationHeader(header) {
      const token = /^Bearer test\.([a-z-]+)$/u.exec(header ?? "")?.[1];
      const user = token === "learner" ? API_TEST_USERS.learner
        : token === "other-learner" ? API_TEST_USERS.other_learner
          : token === "faculty" ? API_TEST_USERS.faculty
            : token === "cross-reviewer" ? API_TEST_USERS.cross_tenant_reviewer
              : token === "inactive" ? API_TEST_USERS.inactive
                : undefined;
      return user === undefined || user === API_TEST_USERS.inactive
        ? { success: false, code: "AUTHENTICATION_INVALID" }
        : { success: true, principal: {
            authentication_authority: "VERIFIED_SUPABASE_JWT",
            user_id: user,
            issuer: "https://auth.test.invalid/",
            audience: "authenticated"
          } };
    }
  };
  let trustedTime = "2026-09-06T10:00:00Z";
  const coordinator = createSessionCoordinator({
    adapter: store,
    hash_adapter: TEST_HASH_ADAPTER,
    event_id_factory: DETERMINISTIC_EVENT_ID_FACTORY
  });
  const app = createSecureApiApp({
    authentication_verifier: authentication,
    allowed_origins: ["http://localhost:5173"],
    authority_repository: authority,
    session_start_repository: store,
    session_adapter: store,
    session_coordinator: coordinator,
    hash_adapter: TEST_HASH_ADAPTER,
    id_factories: {
      createSessionId({ principal_user_id, idempotency_key }) {
        return `session.api.${principal_user_id.slice(-4)}.${idempotency_key.replaceAll(/[^A-Za-z0-9]/gu, "-")}`;
      },
      createAssessmentId({ session_id }) {
        return `assessment.api.${session_id}`;
      }
    },
    trusted_time_utc: () => trustedTime
  });
  return {
    app,
    store,
    productionPackage,
    reviewArtifact,
    setTrustedTime(value: string) { trustedTime = value; }
  };
}

export function apiHeaders(input?: {
  token?: string;
  idempotency?: string;
  origin?: string;
  version?: string;
}) {
  return {
    Authorization: `Bearer test.${input?.token ?? "learner"}`,
    "Content-Type": "application/json",
    "X-Api-Schema-Version": input?.version ?? "1.0",
    "X-Request-Id": "request.api.test-001",
    "X-Correlation-Id": "correlation.api.test-001",
    ...(input?.idempotency === undefined ? {} : { "Idempotency-Key": input.idempotency }),
    ...(input?.origin === undefined ? {} : { Origin: input.origin })
  };
}

export function startBody(caseId: string, overrides: Record<string, unknown> = {}) {
  return {
    case_id: caseId,
    patient_language: "en-US",
    mode: "ASSESSMENT",
    client_capabilities: {
      supports_static_visual_fallback: true,
      supports_audio: false
    },
    ...overrides
  };
}

export function actionBody(stateVersion = 0, overrides: Record<string, unknown> = {}) {
  return {
    command_id: "command.api.001",
    action_request_id: "action-request.api.001",
    action_id: "examination.synthetic-check",
    expected_state_version: stateVersion,
    parameters: {},
    source: "UI",
    ...overrides
  };
}

export async function createV2013ApiPortabilitySnapshot() {
  const harness = await createApiTestHarness({ include_stemi: false });
  const caseId = harness.productionPackage.manifest.case_id;
  const startedResponse = await harness.app.request("/v1/sessions", {
    method: "POST",
    headers: apiHeaders({ idempotency: "idempotency.api.portability-start" }),
    body: JSON.stringify(startBody(caseId))
  });
  const started = await startedResponse.json() as Record<string, any>;
  const session = started.data.session;
  const actionResponse = await harness.app.request(
    `/v1/sessions/${session.session_id}/actions/propose`,
    {
      method: "POST",
      headers: apiHeaders({ idempotency: "idempotency.api.portability-action" }),
      body: JSON.stringify(actionBody(session.state_version))
    }
  );
  const action = await actionResponse.json() as Record<string, any>;
  const retryResponse = await harness.app.request(
    `/v1/sessions/${session.session_id}/actions/propose`,
    {
      method: "POST",
      headers: apiHeaders({ idempotency: "idempotency.api.portability-action" }),
      body: JSON.stringify(actionBody(session.state_version))
    }
  );
  const retry = await retryResponse.json() as Record<string, any>;
  const stateResponse = await harness.app.request(
    `/v1/sessions/${session.session_id}/state`,
    { headers: apiHeaders() }
  );
  const state = await stateResponse.json() as Record<string, any>;
  return {
    statuses: [startedResponse.status, actionResponse.status, retryResponse.status, stateResponse.status],
    session_id: session.session_id,
    initial_state_version: session.state_version,
    action_state_version: action.data.session.state_version,
    action_event_ids: action.data.committed_event_ids,
    retry_replayed: retry.data.replayed,
    retry_event_ids: retry.data.committed_event_ids,
    final_event_sequence: state.data.event_sequence_through,
    assessment_projection_type: state.data.assessment_disclosure.projection_type
  };
}
