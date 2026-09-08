import EmbeddedPostgres from "embedded-postgres";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  POSTGRES_API_PRODUCTION_CASE_FUNCTION,
  POSTGRES_API_REVIEW_CASE_FUNCTION,
  POSTGRES_API_SESSION_AUTHORIZATION_FUNCTION,
  POSTGRES_SESSION_COMMIT_FUNCTION_V2_013,
  POSTGRES_SESSION_START_FUNCTION,
  PostgresApiAuthorityRepository,
  PostgresSessionStartRepository,
  createSecureApiApp
} from "../packages/api-core/src/index.ts";
import {
  POSTGRES_SESSION_LOAD_FUNCTION,
  PostgresSessionCommitAdapter,
  createSessionCoordinator
} from "../packages/session-engine/src/index.ts";
import { createCompiledAssessmentCase } from "../tests/fixtures/assessment-engine/synthetic-assessment.ts";
import { TEST_HASH_ADAPTER } from "../tests/fixtures/cases/synthetic-case.ts";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const V2_ROOT = resolve(SCRIPT_DIR, "..");
const MIGRATION_DIR = join(V2_ROOT, "supabase", "migrations");
const USER = "31000000-0000-4000-8000-000000000001";
const OTHER_USER = "31000000-0000-4000-8000-000000000002";
const MEMBERSHIP = "membership.api.native.learner";
const REVIEW_SUBJECT = "b".repeat(64);
let passed = 0;

const NATIVE_EVENT_ID_FACTORY = Object.freeze({
  createEventId(input) {
    const digest = createHash("sha256")
      .update(`${input.session_id}:${input.sequence_no}`, "utf8")
      .digest("hex");
    return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-4${digest.slice(13, 16)}-8${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
  }
});

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function check(name, operation) {
  await operation();
  passed += 1;
  process.stdout.write(`ok ${passed} - ${name}\n`);
}

async function findFreePort() {
  const server = createServer();
  await new Promise((resolvePromise, rejectPromise) => {
    server.once("error", rejectPromise);
    server.listen(0, "127.0.0.1", resolvePromise);
  });
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  await new Promise((resolvePromise, rejectPromise) => {
    server.close((error) => error ? rejectPromise(error) : resolvePromise());
  });
  if (port <= 0) throw new Error("Could not allocate native PostgreSQL port.");
  return port;
}

async function bootstrap(client) {
  await client.query(`
    do $roles$
    begin
      if not exists (select 1 from pg_catalog.pg_roles where rolname = 'anon') then create role anon nologin; end if;
      if not exists (select 1 from pg_catalog.pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
      if not exists (select 1 from pg_catalog.pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
      alter role service_role bypassrls;
    end
    $roles$;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable set search_path = ''
    as $function$ select nullif(pg_catalog.current_setting('request.jwt.claim.sub', true), '')::uuid $function$;
    revoke all on schema auth from public;
    revoke all on function auth.uid() from public;
    grant usage on schema auth to authenticated, service_role;
    grant execute on function auth.uid() to authenticated, service_role;
    grant all privileges on table auth.users to service_role;
  `);
}

async function migrations() {
  const names = (await readdir(MIGRATION_DIR)).filter((name) => name.endsWith(".sql")).sort();
  return Promise.all(names.map(async (name) => ({
    name,
    sql: await readFile(join(MIGRATION_DIR, name), "utf8")
  })));
}

async function seedProduction(client, artifact) {
  const manifest = artifact.manifest;
  await client.query("insert into auth.users(id) values ($1), ($2)", [USER, OTHER_USER]);
  await client.query(`
    insert into public.profiles(user_id, display_alias, preferred_locale)
    values ($1, 'Native API learner', 'en-US'), ($2, 'Other learner', 'en-US')
  `, [USER, OTHER_USER]);
  await client.query(`
    insert into public.institution_memberships(
      membership_id, institution_id, user_id, membership_role, membership_status
    ) values
      ($1, 'ju', $2, 'LEARNER', 'ACTIVE'),
      ('membership.api.native.other', 'just', $3, 'LEARNER', 'ACTIVE')
  `, [MEMBERSHIP, USER, OTHER_USER]);
  await client.query(`
    insert into public.clinical_cases(case_id, institution_id, case_slug, title, topic_code, owner_membership_id)
    values ($1, 'ju', 'native-api-case', 'Native API synthetic Case', 'topic.synthetic', $2)
  `, [manifest.case_id, MEMBERSHIP]);
  const authored = structuredClone(artifact);
  authored.manifest.status = "APPROVED";
  await client.query(`
    insert into public.case_versions(
      case_version_id, case_id, institution_id, case_package_id, semantic_version,
      case_schema_version, lifecycle_status, review_subject_hash,
      publication_candidate_hash, authored_case_payload, created_by_membership_id
    ) values ($1, $2, 'ju', $3, $4, $5, 'APPROVED', $6, $7, $8::jsonb, $9)
  `, [
    manifest.case_version_id,
    manifest.case_id,
    manifest.case_package_id,
    manifest.case_version,
    manifest.schema_version,
    REVIEW_SUBJECT,
    artifact.package_hash,
    JSON.stringify(authored),
    MEMBERSHIP
  ]);
  await client.query(`
    insert into public.case_approvals(
      approval_id, institution_id, case_version_id, case_package_id,
      approved_case_version, approved_package_hash, review_subject_hash,
      approval_scope, approval_status, approver_ref_id, approver_membership_id,
      approver_role_code, approved_at, approval_payload
    ) values (
      'approval.api.native', 'ju', $1, $2, $3, $4, $5,
      'CASE_PACKAGE_PUBLICATION', 'APPROVED', 'approver.api.native', $6,
      'role.api.publisher', '2026-09-06T00:00:00Z', '{}'::jsonb
    )
  `, [manifest.case_version_id, manifest.case_package_id, manifest.case_version, artifact.package_hash, REVIEW_SUBJECT, MEMBERSHIP]);
  await client.query(`
    insert into public.case_packages(
      case_package_id, institution_id, case_version_id, case_version,
      package_schema_version, package_hash, review_subject_hash, approval_id,
      approval_status, execution_authority, package_lifecycle, module_hashes,
      package_payload, published_at
    ) values (
      $1, 'ju', $2, $3, $4, $5, $6, 'approval.api.native',
      'APPROVED', 'PUBLISHED_PRODUCTION', 'PUBLISHED', $7::jsonb, $8::jsonb,
      '2026-09-06T00:00:00Z'
    )
  `, [
    manifest.case_package_id,
    manifest.case_version_id,
    manifest.case_version,
    manifest.schema_version,
    artifact.package_hash,
    REVIEW_SUBJECT,
    JSON.stringify(manifest.module_hashes),
    JSON.stringify(artifact)
  ]);
}

class NativeRpcClient {
  constructor(client) { this.client = client; }
  async rpc(functionName, parameters) {
    const calls = {
      [POSTGRES_SESSION_LOAD_FUNCTION]: ["select public.load_authoritative_session_v2_012a($1) as data", [parameters.p_session_id]],
      [POSTGRES_SESSION_COMMIT_FUNCTION_V2_013]: ["select public.commit_authoritative_session_v2_013($1::jsonb) as data", [JSON.stringify(parameters.p_request)]],
      [POSTGRES_SESSION_START_FUNCTION]: ["select public.start_authoritative_session_v2_013($1::jsonb) as data", [JSON.stringify(parameters.p_request)]],
      [POSTGRES_API_PRODUCTION_CASE_FUNCTION]: ["select public.resolve_api_production_case_v2_013($1::uuid, $2) as data", [parameters.p_user_id, parameters.p_case_id]],
      [POSTGRES_API_REVIEW_CASE_FUNCTION]: ["select public.resolve_api_review_case_v2_013($1::uuid, $2) as data", [parameters.p_user_id, parameters.p_case_id]],
      [POSTGRES_API_SESSION_AUTHORIZATION_FUNCTION]: ["select public.authorize_api_session_v2_013($1::uuid, $2) as data", [parameters.p_user_id, parameters.p_session_id]]
    };
    const call = calls[functionName];
    if (call === undefined) return { data: null, error: { message: "Unknown RPC" } };
    try {
      const result = await this.client.query(call[0], call[1]);
      return { data: result.rows[0]?.data ?? null, error: null };
    } catch (error) {
      this.lastError = { code: error?.code, message: error instanceof Error ? error.message : String(error) };
      return { data: null, error: { code: error?.code, message: "Native PostgreSQL operation failed." } };
    }
  }
}

function headers(idempotency) {
  return {
    Authorization: "Bearer native.valid",
    "Content-Type": "application/json",
    "X-Api-Schema-Version": "1.0",
    "X-Request-Id": "request.api.native",
    "X-Correlation-Id": "correlation.api.native",
    ...(idempotency === undefined ? {} : { "Idempotency-Key": idempotency })
  };
}

async function main() {
  const allMigrations = await migrations();
  assert(allMigrations.at(-1)?.name === "202609060006_v2_013_api_session_start_finalize.sql", "V2-013 migration must be additive tail.");
  const port = await findFreePort();
  const databaseDir = await mkdtemp(join(tmpdir(), "v2-013-native-api-"));
  const postgres = new EmbeddedPostgres({
    databaseDir,
    user: "postgres",
    password: "local-api-test",
    port,
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
    persistent: false,
    onLog: () => undefined,
    onError: () => undefined
  });
  let admin;
  let full;
  let service;
  try {
    await postgres.initialise();
    await postgres.start();
    admin = postgres.getPgClient();
    await admin.connect();
    await bootstrap(admin);
    await postgres.createDatabase("v2_013_api");
    full = postgres.getPgClient("v2_013_api");
    await full.connect();
    await bootstrap(full);
    for (const migration of allMigrations) await full.query(migration.sql);
    const artifact = await createCompiledAssessmentCase();
    await seedProduction(full, artifact);

    service = postgres.getPgClient("v2_013_api");
    await service.connect();
    await service.query("set role service_role");
    const rpc = new NativeRpcClient(service);
    const authority = new PostgresApiAuthorityRepository(rpc);
    const startRepository = new PostgresSessionStartRepository(rpc);
    const adapter = new PostgresSessionCommitAdapter(rpc, {
      load: POSTGRES_SESSION_LOAD_FUNCTION,
      commit: POSTGRES_SESSION_COMMIT_FUNCTION_V2_013
    });
    const coordinator = createSessionCoordinator({
      adapter,
      hash_adapter: TEST_HASH_ADAPTER,
      event_id_factory: NATIVE_EVENT_ID_FACTORY
    });
    const app = createSecureApiApp({
      authentication_verifier: {
        async verifyAuthorizationHeader(header) {
          return header === "Bearer native.valid"
            ? { success: true, principal: {
                authentication_authority: "VERIFIED_SUPABASE_JWT",
                user_id: USER,
                issuer: "https://auth.native.invalid/",
                audience: "authenticated"
              } }
            : header === "Bearer native.other"
              ? { success: true, principal: {
                  authentication_authority: "VERIFIED_SUPABASE_JWT",
                  user_id: OTHER_USER,
                  issuer: "https://auth.native.invalid/",
                  audience: "authenticated"
                } }
              : { success: false, code: "AUTHENTICATION_INVALID" };
        }
      },
      allowed_origins: ["http://localhost:5173"],
      authority_repository: authority,
      session_start_repository: startRepository,
      session_adapter: adapter,
      session_coordinator: coordinator,
      hash_adapter: TEST_HASH_ADAPTER,
      id_factories: {
        createSessionId({ idempotency_key }) { return `session.api.native.${idempotency_key.replaceAll(/[^A-Za-z0-9]/gu, "-")}`; },
        createAssessmentId({ session_id }) { return `assessment.api.${session_id}`; }
      },
      trusted_time_utc: () => "2026-09-06T10:00:00Z"
    });
    const startBody = JSON.stringify({
      case_id: artifact.manifest.case_id,
      patient_language: "en-US",
      mode: "ASSESSMENT",
      client_capabilities: { supports_static_visual_fallback: true, supports_audio: false }
    });
    async function startNativeSession(idempotencyKey) {
      const response = await app.request("/v1/sessions", {
        method: "POST",
        headers: headers(idempotencyKey),
        body: startBody
      });
      const body = await response.json();
      assert(response.status === 201, JSON.stringify(body));
      return body.data.session.session_id;
    }
    async function endNativeSession(sessionId, idempotencyKey) {
      return app.request(`/v1/sessions/${sessionId}/end`, {
        method: "POST",
        headers: headers(idempotencyKey),
        body: JSON.stringify({ expected_state_version: 0, reason: "LEARNER_COMPLETED" })
      });
    }
    async function checkpointHistory(sessionId) {
      const result = await full.query(`select coalesce(
        jsonb_agg(to_jsonb(checkpoint) order by checkpoint.checkpoint_id),
        '[]'::jsonb
      ) history
      from public.patient_state_checkpoints as checkpoint
      where checkpoint.session_id=$1`, [sessionId]);
      return result.rows[0].history;
    }
    async function persistenceSummary(sessionId) {
      const result = await full.query(`select session.session_status,
        session.clock_status,
        session.next_event_sequence,
        (select count(*)::int from public.session_events where session_id=$1) event_count,
        (select count(*)::int from public.patient_state_checkpoints where session_id=$1) checkpoint_count
      from public.simulation_sessions as session where session.session_id=$1`, [sessionId]);
      return result.rows[0];
    }
    const startOptions = { method: "POST", headers: headers("idempotency.api.native-start"), body: startBody };
    const firstStart = await app.request("/v1/sessions", startOptions);
    const firstStartBody = await firstStart.json();
    const sessionId = firstStartBody.data?.session?.session_id;

    await check("native PostgreSQL migrations include the V2-013 gate", async () => {
      assert(firstStart.status === 201 && typeof sessionId === "string", JSON.stringify(firstStartBody));
    });
    await check("startSession atomically creates Session plus initial checkpoint", async () => {
      const result = await full.query(`select
        (select count(*)::int from public.simulation_sessions where session_id=$1) sessions,
        (select count(*)::int from public.patient_state_checkpoints where session_id=$1) checkpoints`, [sessionId]);
      assert(result.rows[0].sessions === 1 && result.rows[0].checkpoints === 1, JSON.stringify(result.rows[0]));
    });
    await check("exact start retry returns durable replay", async () => {
      const response = await app.request("/v1/sessions", startOptions);
      const body = await response.json();
      assert(response.status === 201 && body.data.replayed === true && body.data.session.session_id === sessionId, JSON.stringify(body));
    });
    await check("conflicting start retry fails without a second Session", async () => {
      const changed = JSON.stringify({ ...JSON.parse(startBody), patient_language: "ar-JO" });
      const response = await app.request("/v1/sessions", { ...startOptions, body: changed });
      const count = await full.query("select count(*)::int count from public.simulation_sessions");
      assert(response.status === 409 && count.rows[0].count === 1, `status=${response.status} count=${count.rows[0].count}`);
    });
    await check("foreign verified principal cannot authorize the Session", async () => {
      const response = await app.request(`/v1/sessions/${sessionId}/state`, {
        headers: { ...headers(), Authorization: "Bearer native.other" }
      });
      assert(response.status === 404, `status=${response.status}`);
    });
    await check("cross-tenant learner cannot resolve the production Case", async () => {
      const response = await app.request("/v1/sessions", {
        method: "POST",
        headers: { ...headers("idempotency.api.native-cross-tenant"), Authorization: "Bearer native.other" },
        body: startBody
      });
      assert(response.status === 404, `status=${response.status}`);
    });
    const actionOptions = {
      method: "POST",
      headers: headers("idempotency.api.native-action"),
      body: JSON.stringify({
        command_id: "command.api.native",
        action_request_id: "action-request.api.native",
        action_id: "examination.synthetic-check",
        expected_state_version: 0,
        parameters: {},
        source: "UI"
      })
    };
    const action = await app.request(`/v1/sessions/${sessionId}/actions/propose`, actionOptions);
    const actionBody = await action.json();
    await check("clinical action reaches persistent Session Coordinator", async () => {
      assert(action.status === 200 && actionBody.data.execution_status === "EXECUTED", JSON.stringify(actionBody));
    });
    await check("successful action persists one Event and one replay record atomically", async () => {
      const result = await full.query(`select
        (select count(*)::int from public.session_events where session_id=$1) events,
        (select count(*)::int from public.session_commands where session_id=$1) commands`, [sessionId]);
      assert(result.rows[0].events === 1 && result.rows[0].commands === 1, JSON.stringify(result.rows[0]));
    });
    await check("lost-response retry replays without duplicate durable execution", async () => {
      const response = await app.request(`/v1/sessions/${sessionId}/actions/propose`, actionOptions);
      const body = await response.json();
      const result = await full.query("select count(*)::int count from public.session_events where session_id=$1", [sessionId]);
      assert(response.status === 200 && body.data.replayed === true && result.rows[0].count === 1, JSON.stringify(body));
    });
    await check("learner timeline is derived from the persisted committed Event sequence", async () => {
      const response = await app.request(`/v1/sessions/${sessionId}/timeline`, { headers: headers() });
      const body = await response.json();
      assert(
        response.status === 200
          && body.data.items.length === 1
          && body.data.items[0].sequence_no === 1
          && body.data.items[0].item_type === "ACTION_COMMITTED",
        JSON.stringify(body)
      );
    });
    await check("native learner timeline excludes internal Event and Case authority", async () => {
      const response = await app.request(`/v1/sessions/${sessionId}/timeline`, { headers: headers() });
      const serialized = JSON.stringify(await response.json());
      assert(
        !/payload|rule_id|scheduler|effect|patient_state|rubric|package_hash|review_subject|approval/iu.test(serialized),
        serialized
      );
    });
    await check("native timeline and Assessment reads enforce Session ownership", async () => {
      const deniedHeaders = { ...headers(), Authorization: "Bearer native.other" };
      const timeline = await app.request(`/v1/sessions/${sessionId}/timeline`, { headers: deniedHeaders });
      const assessment = await app.request(`/v1/sessions/${sessionId}/assessment`, { headers: deniedHeaders });
      assert(timeline.status === 404 && assessment.status === 404, `timeline=${timeline.status} assessment=${assessment.status}`);
    });
    await check("conflicting action key maps to HTTP 409", async () => {
      const response = await app.request(`/v1/sessions/${sessionId}/actions/propose`, {
        ...actionOptions,
        body: JSON.stringify({ ...JSON.parse(actionOptions.body), command_id: "command.api.native-conflict" })
      });
      assert(response.status === 409, `status=${response.status}`);
    });
    await check("stale action maps to HTTP 409 without automatic medical retry", async () => {
      const response = await app.request(`/v1/sessions/${sessionId}/actions/propose`, {
        method: "POST",
        headers: headers("idempotency.api.native-stale"),
        body: JSON.stringify({ ...JSON.parse(actionOptions.body), command_id: "command.api.native-stale", action_request_id: "action-request.api.native-stale" })
      });
      assert(response.status === 409, `status=${response.status}`);
    });
    await check("start transaction rolls back when checkpoint insertion fails", async () => {
      await full.query(`create function public.fail_v2_013_checkpoint() returns trigger language plpgsql as $$ begin raise exception 'synthetic rollback'; end $$`);
      await full.query(`create trigger fail_v2_013_checkpoint before insert on public.patient_state_checkpoints for each row execute function public.fail_v2_013_checkpoint()`);
      const response = await app.request("/v1/sessions", {
        method: "POST",
        headers: headers("idempotency.api.native-rollback"),
        body: startBody
      });
      await full.query("drop trigger fail_v2_013_checkpoint on public.patient_state_checkpoints");
      await full.query("drop function public.fail_v2_013_checkpoint()");
      const count = await full.query("select count(*)::int count from public.simulation_sessions where start_idempotency_key='idempotency.api.native-rollback'");
      assert(response.status === 503 && count.rows[0].count === 0, `status=${response.status} count=${count.rows[0].count}`);
    });
    const historicalBeforeEnd = await checkpointHistory(sessionId);
    const ended = await app.request(`/v1/sessions/${sessionId}/end`, {
      method: "POST",
      headers: headers("idempotency.api.native-end"),
      body: JSON.stringify({ expected_state_version: actionBody.data.session.state_version, reason: "LEARNER_COMPLETED" })
    });
    const endedBody = await ended.json();
    await check("endSimulation commits terminal Session and deterministic assessment", async () => {
      assert(ended.status === 200 && endedBody.data.session.status === "ENDED" && endedBody.data.assessment.assessment_status === "FINAL", `${JSON.stringify(endedBody)} rpc=${JSON.stringify(rpc.lastError)}`);
    });
    await check("final Assessment transport contains six localized safe domains without rubric internals", async () => {
      const response = await app.request(`/v1/sessions/${sessionId}/assessment`, { headers: headers() });
      const body = await response.json();
      const serialized = JSON.stringify(body);
      assert(
        response.status === 200
          && body.data.assessment_status === "FINAL"
          && body.data.domain_scores.length === 6
          && body.data.domain_scores.every((domain) => domain.labels.length > 0)
          && !/rubric_item_id|criterion|trace_code|package_hash|scheduler|approval/iu.test(serialized),
        serialized
      );
    });
    await check("terminal status and event persist in PostgreSQL", async () => {
      const result = await full.query(`select session_status,
        (select event_type from public.session_events where session_id=$1 order by event_sequence desc limit 1) last_event
        from public.simulation_sessions where session_id=$1`, [sessionId]);
      assert(result.rows[0].session_status === "ENDED" && result.rows[0].last_event === "SIMULATION_ENDED", JSON.stringify(result.rows[0]));
    });
    await check("finalization appends a terminal checkpoint without mutating prior history", async () => {
      const originalIds = historicalBeforeEnd.map((checkpoint) => checkpoint.checkpoint_id);
      const result = await full.query(`select jsonb_agg(to_jsonb(checkpoint) order by checkpoint.checkpoint_id) history
        from public.patient_state_checkpoints as checkpoint
        where checkpoint.session_id=$1 and checkpoint.checkpoint_id = any($2::bigint[])`, [sessionId, originalIds]);
      const after = result.rows[0].history;
      const summary = await persistenceSummary(sessionId);
      assert(
        JSON.stringify(after) === JSON.stringify(historicalBeforeEnd)
          && summary.checkpoint_count === historicalBeforeEnd.length + 2,
        `before=${JSON.stringify(historicalBeforeEnd)} after=${JSON.stringify(after)} summary=${JSON.stringify(summary)}`
      );
    });
    await check("exact end retry returns prior authoritative result", async () => {
      const before = await persistenceSummary(sessionId);
      const response = await app.request(`/v1/sessions/${sessionId}/end`, {
        method: "POST",
        headers: headers("idempotency.api.native-end"),
        body: JSON.stringify({ expected_state_version: actionBody.data.session.state_version, reason: "LEARNER_COMPLETED" })
      });
      const body = await response.json();
      const after = await persistenceSummary(sessionId);
      assert(
        response.status === 200
          && body.data.replayed === true
          && JSON.stringify(after) === JSON.stringify(before),
        `${JSON.stringify(body)} before=${JSON.stringify(before)} after=${JSON.stringify(after)}`
      );
    });
    await check("an already-paused Session finalizes with a new append-only checkpoint", async () => {
      const pausedStartKey = "idempotency.api.native-paused-start";
      const started = await app.request("/v1/sessions", {
        method: "POST",
        headers: headers(pausedStartKey),
        body: startBody
      });
      const startedBody = await started.json();
      const pausedSessionId = startedBody.data.session.session_id;
      const paused = await coordinator.pauseSession({
        coordinator_schema_version: "1.0",
        session_id: pausedSessionId,
        trusted_real_time_utc: "2026-09-06T10:00:00Z",
        request_id: "request.api.native-pause",
        correlation_id: "correlation.api.native-pause",
        idempotency_key: "idempotency.api.native-pause"
      });
      assert(paused.success, JSON.stringify(paused));
      const response = await app.request(`/v1/sessions/${pausedSessionId}/end`, {
        method: "POST",
        headers: headers("idempotency.api.native-paused-end"),
        body: JSON.stringify({ expected_state_version: 0, reason: "LEARNER_COMPLETED" })
      });
      const rows = await full.query(
        "select count(*)::int count from public.patient_state_checkpoints where session_id=$1",
        [pausedSessionId]
      );
      assert(response.status === 200 && rows.rows[0].count === 3, `status=${response.status} checkpoints=${rows.rows[0].count}`);
    });
    await check("concurrent different-key actions preserve exactly one native PostgreSQL winner", async () => {
      const concurrentSessionId = await startNativeSession("idempotency.api.native-concurrent-start");
      const path = `/v1/sessions/${concurrentSessionId}/actions/propose`;
      const [first, second] = await Promise.all([
        app.request(path, {
          method: "POST",
          headers: headers("idempotency.api.native-concurrent-a"),
          body: JSON.stringify({
            ...JSON.parse(actionOptions.body),
            command_id: "command.api.native-concurrent-a",
            action_request_id: "action-request.api.native-concurrent-a"
          })
        }),
        app.request(path, {
          method: "POST",
          headers: headers("idempotency.api.native-concurrent-b"),
          body: JSON.stringify({
            ...JSON.parse(actionOptions.body),
            command_id: "command.api.native-concurrent-b",
            action_request_id: "action-request.api.native-concurrent-b"
          })
        })
      ]);
      const summary = await persistenceSummary(concurrentSessionId);
      assert(
        [first.status, second.status].sort().join(",") === "200,409"
          && summary.event_count === 1
          && summary.next_event_sequence === "2",
        `statuses=${first.status},${second.status} summary=${JSON.stringify(summary)}`
      );
    });
    await check("terminal Event insertion failure rolls finalization back atomically", async () => {
      const rollbackSessionId = await startNativeSession("idempotency.api.native-terminal-event-failure-start");
      const before = await persistenceSummary(rollbackSessionId);
      const history = await checkpointHistory(rollbackSessionId);
      await full.query(`create function public.fail_v2_013_terminal_event() returns trigger language plpgsql as $$
        begin
          if new.event_type = 'SIMULATION_ENDED' then raise exception 'synthetic terminal event failure'; end if;
          return new;
        end $$`);
      await full.query(`create trigger fail_v2_013_terminal_event before insert on public.session_events
        for each row execute function public.fail_v2_013_terminal_event()`);
      const response = await endNativeSession(rollbackSessionId, "idempotency.api.native-terminal-event-failure-end");
      await full.query("drop trigger fail_v2_013_terminal_event on public.session_events");
      await full.query("drop function public.fail_v2_013_terminal_event()");
      const after = await persistenceSummary(rollbackSessionId);
      assert(
        response.status === 503
          && JSON.stringify(after) === JSON.stringify(before)
          && JSON.stringify(await checkpointHistory(rollbackSessionId)) === JSON.stringify(history),
        `status=${response.status} before=${JSON.stringify(before)} after=${JSON.stringify(after)}`
      );
    });
    await check("terminal checkpoint insertion failure rolls Event and Session changes back", async () => {
      const rollbackSessionId = await startNativeSession("idempotency.api.native-terminal-checkpoint-failure-start");
      const before = await persistenceSummary(rollbackSessionId);
      const history = await checkpointHistory(rollbackSessionId);
      await full.query(`create function public.fail_v2_013_terminal_checkpoint() returns trigger language plpgsql as $$
        begin
          if new.aggregate_payload ->> 'status' = 'ENDED' then raise exception 'synthetic terminal checkpoint failure'; end if;
          return new;
        end $$`);
      await full.query(`create trigger fail_v2_013_terminal_checkpoint before insert on public.patient_state_checkpoints
        for each row execute function public.fail_v2_013_terminal_checkpoint()`);
      const response = await endNativeSession(rollbackSessionId, "idempotency.api.native-terminal-checkpoint-failure-end");
      await full.query("drop trigger fail_v2_013_terminal_checkpoint on public.patient_state_checkpoints");
      await full.query("drop function public.fail_v2_013_terminal_checkpoint()");
      const after = await persistenceSummary(rollbackSessionId);
      assert(
        response.status === 503
          && JSON.stringify(after) === JSON.stringify(before)
          && JSON.stringify(await checkpointHistory(rollbackSessionId)) === JSON.stringify(history),
        `status=${response.status} before=${JSON.stringify(before)} after=${JSON.stringify(after)}`
      );
    });
    await check("final Session update failure rolls terminal Event and checkpoint back", async () => {
      const rollbackSessionId = await startNativeSession("idempotency.api.native-terminal-session-failure-start");
      const before = await persistenceSummary(rollbackSessionId);
      const history = await checkpointHistory(rollbackSessionId);
      await full.query(`create function public.fail_v2_013_terminal_session_update() returns trigger language plpgsql as $$
        begin
          if new.session_status = 'ENDED' then raise exception 'synthetic terminal Session failure'; end if;
          return new;
        end $$`);
      await full.query(`create trigger fail_v2_013_terminal_session_update before update on public.simulation_sessions
        for each row execute function public.fail_v2_013_terminal_session_update()`);
      const response = await endNativeSession(rollbackSessionId, "idempotency.api.native-terminal-session-failure-end");
      await full.query("drop trigger fail_v2_013_terminal_session_update on public.simulation_sessions");
      await full.query("drop function public.fail_v2_013_terminal_session_update()");
      const after = await persistenceSummary(rollbackSessionId);
      assert(
        response.status === 503
          && JSON.stringify(after) === JSON.stringify(before)
          && JSON.stringify(await checkpointHistory(rollbackSessionId)) === JSON.stringify(history),
        `status=${response.status} before=${JSON.stringify(before)} after=${JSON.stringify(after)}`
      );
    });
    await check("trusted API functions remain unavailable to raw client roles", async () => {
      const result = await full.query(`select
        has_function_privilege('authenticated','public.start_authoritative_session_v2_013(jsonb)','EXECUTE') start_access,
        has_function_privilege('authenticated','public.commit_authoritative_session_v2_013(jsonb)','EXECUTE') commit_access,
        has_function_privilege('authenticated','public.authorize_api_session_v2_013(uuid,public.contract_identifier)','EXECUTE') auth_access`);
      assert(!result.rows[0].start_access && !result.rows[0].commit_access && !result.rows[0].auth_access, JSON.stringify(result.rows[0]));
    });
    await check("new migration contains no clinical or disease-specific SQL", async () => {
      const sql = allMigrations.at(-1).sql;
      assert(!/stemi|anaphyl|aspirin|cardiac_rhythm\s*=|hemodynamic_state\s*=|score\s*=/iu.test(sql), "Clinical logic detected in API SQL.");
    });
    await check("API boundary contains no remote Supabase project or service credential", async () => {
      const source = await readFile(join(V2_ROOT, "packages", "api-core", "src", "http", "create-api-app.ts"), "utf8");
      assert(!/service_role_key|supabase_service|https:\/\/[^\s"']+\.supabase\.co|eyJ[A-Za-z0-9_-]{20,}/iu.test(source), "Remote credential/config detected.");
    });
    await check("machine-readable API inventory parses and matches executable route ownership", async () => {
      const inventory = JSON.parse(await readFile(
        join(V2_ROOT, "supabase", "functions", "api", "openapi.v1.json"),
        "utf8"
      ));
      const paths = Object.keys(inventory.paths).sort();
      const expected = [
        "/health",
        "/v1/faculty/cases",
        "/v1/review-sessions",
        "/v1/sessions",
        "/v1/sessions/{session_id}/actions/propose",
        "/v1/sessions/{session_id}/assessment",
        "/v1/sessions/{session_id}/debriefs",
        "/v1/sessions/{session_id}/end",
        "/v1/sessions/{session_id}/investigations/{result_id}",
        "/v1/sessions/{session_id}/questions",
        "/v1/sessions/{session_id}/state"
        ,"/v1/sessions/{session_id}/timeline"
      ].sort();
      assert(JSON.stringify(paths) === JSON.stringify(expected), JSON.stringify(paths));
    });
  } finally {
    if (service) await service.end().catch(() => undefined);
    if (full) await full.end().catch(() => undefined);
    if (admin) await admin.end().catch(() => undefined);
    await postgres.stop().catch(() => undefined);
  }
  process.stdout.write(`V2-013 native PostgreSQL/API integration tests: ${passed} passed, 0 failed\n`);
}

await main();
