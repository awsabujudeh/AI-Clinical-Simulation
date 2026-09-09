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
  POSTGRES_PATIENT_CONVERSATION_BEGIN_FUNCTION,
  POSTGRES_PATIENT_CONVERSATION_COMPLETE_FUNCTION,
  POSTGRES_PATIENT_CONVERSATION_LIST_FUNCTION,
  POSTGRES_SESSION_COMMIT_FUNCTION_V2_013,
  POSTGRES_SESSION_START_FUNCTION,
  PostgresApiAuthorityRepository,
  PostgresPatientConversationRepository,
  PostgresSessionStartRepository,
  createSecureApiApp
} from "../packages/api-core/src/index.ts";
import {
  SecureAiGateway,
  TrustedCapabilityRegistry
} from "../packages/ai-gateway/src/index.ts";
import { createPatientConversationCapability } from "../packages/patient-conversation/src/index.ts";
import {
  POSTGRES_SESSION_LOAD_FUNCTION,
  PostgresSessionCommitAdapter,
  createSessionCoordinator
} from "../packages/session-engine/src/index.ts";
import { createCompiledAssessmentCase } from "../tests/fixtures/assessment-engine/synthetic-assessment.ts";
import { enableSyntheticPatientConversation } from "../tests/fixtures/patient-conversation.ts";
import { TEST_HASH_ADAPTER } from "../tests/fixtures/cases/synthetic-case.ts";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const V2_ROOT = resolve(SCRIPT_DIR, "..");
const MIGRATION_DIR = join(V2_ROOT, "supabase", "migrations");
const USER = "39000000-0000-4000-8000-000000000001";
const OTHER_USER = "39000000-0000-4000-8000-000000000002";
const MEMBERSHIP = "membership.patient.native.learner";
const REVIEW_SUBJECT = "c".repeat(64);
let passed = 0;

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
    values ($1, 'Patient learner', 'en-US'), ($2, 'Foreign learner', 'en-US')
  `, [USER, OTHER_USER]);
  await client.query(`
    insert into public.institution_memberships(
      membership_id, institution_id, user_id, membership_role, membership_status
    ) values
      ($1, 'ju', $2, 'LEARNER', 'ACTIVE'),
      ('membership.patient.native.other', 'just', $3, 'LEARNER', 'ACTIVE')
  `, [MEMBERSHIP, USER, OTHER_USER]);
  await client.query(`
    insert into public.clinical_cases(case_id, institution_id, case_slug, title, topic_code, owner_membership_id)
    values ($1, 'ju', 'native-patient-case', 'Native patient conversation Case', 'topic.synthetic', $2)
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
    manifest.case_version_id, manifest.case_id, manifest.case_package_id,
    manifest.case_version, manifest.schema_version, REVIEW_SUBJECT,
    artifact.package_hash, JSON.stringify(authored), MEMBERSHIP
  ]);
  await client.query(`
    insert into public.case_approvals(
      approval_id, institution_id, case_version_id, case_package_id,
      approved_case_version, approved_package_hash, review_subject_hash,
      approval_scope, approval_status, approver_ref_id, approver_membership_id,
      approver_role_code, approved_at, approval_payload
    ) values (
      'approval.patient.native', 'ju', $1, $2, $3, $4, $5,
      'CASE_PACKAGE_PUBLICATION', 'APPROVED', 'approver.patient.native', $6,
      'role.patient.publisher', '2026-09-08T00:00:00Z', '{}'::jsonb
    )
  `, [manifest.case_version_id, manifest.case_package_id, manifest.case_version, artifact.package_hash, REVIEW_SUBJECT, MEMBERSHIP]);
  await client.query(`
    insert into public.case_packages(
      case_package_id, institution_id, case_version_id, case_version,
      package_schema_version, package_hash, review_subject_hash, approval_id,
      approval_status, execution_authority, package_lifecycle, module_hashes,
      package_payload, published_at
    ) values (
      $1, 'ju', $2, $3, $4, $5, $6, 'approval.patient.native',
      'APPROVED', 'PUBLISHED_PRODUCTION', 'PUBLISHED', $7::jsonb, $8::jsonb,
      '2026-09-08T00:00:00Z'
    )
  `, [
    manifest.case_package_id, manifest.case_version_id, manifest.case_version,
    manifest.schema_version, artifact.package_hash, REVIEW_SUBJECT,
    JSON.stringify(manifest.module_hashes), JSON.stringify(artifact)
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
      [POSTGRES_API_SESSION_AUTHORIZATION_FUNCTION]: ["select public.authorize_api_session_v2_013($1::uuid, $2) as data", [parameters.p_user_id, parameters.p_session_id]],
      [POSTGRES_PATIENT_CONVERSATION_BEGIN_FUNCTION]: ["select public.begin_patient_conversation_v2_019a($1::jsonb) as data", [JSON.stringify(parameters.p_request)]],
      [POSTGRES_PATIENT_CONVERSATION_COMPLETE_FUNCTION]: ["select public.complete_patient_conversation_v2_019a($1::jsonb) as data", [JSON.stringify(parameters.p_request)]],
      [POSTGRES_PATIENT_CONVERSATION_LIST_FUNCTION]: ["select public.list_patient_conversation_v2_019a($1, $2::uuid, $3) as data", [parameters.p_session_id, parameters.p_principal_user_id, parameters.p_limit]]
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

function eventId(input) {
  const digest = createHash("sha256").update(input, "utf8").digest("hex");
  return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-4${digest.slice(13, 16)}-8${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
}

function headers(idempotency, token = "native.valid") {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "X-Api-Schema-Version": "1.0",
    "X-Request-Id": "request.patient.native",
    "X-Correlation-Id": "correlation.patient.native",
    ...(idempotency === undefined ? {} : { "Idempotency-Key": idempotency })
  };
}

async function main() {
  const allMigrations = await migrations();
  assert(allMigrations.at(-1)?.name === "202609080007_v2_019a_patient_conversation.sql", "V2-019A migration must be the additive tail.");
  const port = await findFreePort();
  const databaseDir = await mkdtemp(join(tmpdir(), "v2-019a-native-patient-"));
  const postgres = new EmbeddedPostgres({
    databaseDir,
    user: "postgres",
    password: "local-patient-test",
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
    await postgres.createDatabase("v2_019a_patient");
    full = postgres.getPgClient("v2_019a_patient");
    await full.connect();
    await bootstrap(full);
    for (const migration of allMigrations) await full.query(migration.sql);
    const artifact = await createCompiledAssessmentCase(enableSyntheticPatientConversation);
    await seedProduction(full, artifact);

    service = postgres.getPgClient("v2_019a_patient");
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
      event_id_factory: {
        createEventId(input) { return eventId(`${input.session_id}:${input.sequence_no}`); }
      }
    });
    let providerCalls = 0;
    let observedDurableQuestion = false;
    const provider = {
      async execute() {
        providerCalls += 1;
        const row = await full.query(`select turn_status,
          exists(select 1 from public.session_events where event_type='QUESTION_ASKED') question_exists
          from public.patient_conversation_turns order by claimed_at_utc desc limit 1`);
        observedDurableQuestion = row.rows[0]?.turn_status === "PENDING" && row.rows[0]?.question_exists === true;
        return {
          success: true,
          provider: "OPENAI",
          output_text: JSON.stringify({
            output_schema_version: "1.0",
            utterance: "I can describe the reviewed synthetic concern.",
            locale: "en-US",
            answer_mode: "GROUNDED",
            grounding_fact_ids: ["fact.synthetic.concern"],
            grounding_state_refs: [],
            safety_flags: [],
            disclosure_status: "WITHIN_PATIENT_BOUNDARY"
          }),
          provider_response_id: `resp_native_${providerCalls}`,
          provider_model: "gpt-5.6-luna",
          retry_count: 0
        };
      }
    };

    function createApp() {
      return createSecureApiApp({
        authentication_verifier: {
          async verifyAuthorizationHeader(header) {
            return header === "Bearer native.valid"
              ? { success: true, principal: { authentication_authority: "VERIFIED_SUPABASE_JWT", user_id: USER, issuer: "https://auth.native.invalid/", audience: "authenticated" } }
              : header === "Bearer native.other"
                ? { success: true, principal: { authentication_authority: "VERIFIED_SUPABASE_JWT", user_id: OTHER_USER, issuer: "https://auth.native.invalid/", audience: "authenticated" } }
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
          createSessionId({ idempotency_key }) { return `session.patient.native.${idempotency_key.replaceAll(/[^A-Za-z0-9]/gu, "-")}`; },
          createAssessmentId({ session_id }) { return `assessment.patient.${session_id}`; }
        },
        trusted_time_utc: () => "2026-09-08T10:00:00Z",
        patient_conversation: {
          repository: new PostgresPatientConversationRepository(rpc),
          gateway: new SecureAiGateway({
            registry: new TrustedCapabilityRegistry([
              createPatientConversationCapability({ enabled: true, candidate_model: "gpt-5.6-luna" })
            ]),
            provider,
            capacity: { async authorize() { return { allowed: true }; } },
            clock: { nowMilliseconds: () => 10 },
            logger: { log() {} }
          }),
          create_turn_id({ session_id, idempotency_key }) { return `conversation-turn.${eventId(`${session_id}:${idempotency_key}`).slice(0, 18)}`; },
          create_event_id({ session_id, kind, idempotency_key }) { return eventId(`${session_id}:${kind}:${idempotency_key}`); },
          create_claim_token({ session_id, idempotency_key }) { return `claim.${eventId(`${session_id}:${idempotency_key}`).replaceAll("-", "")}`; },
          claim_expires_at_utc() { return "2026-09-08T10:05:00Z"; }
        }
      });
    }

    let app = createApp();
    const startBody = JSON.stringify({
      case_id: artifact.manifest.case_id,
      patient_language: "en-US",
      mode: "ASSESSMENT",
      client_capabilities: { supports_static_visual_fallback: true, supports_audio: false }
    });
    async function startSession(key) {
      const response = await app.request("/v1/sessions", { method: "POST", headers: headers(key), body: startBody });
      const body = await response.json();
      assert(response.status === 201, JSON.stringify(body));
      return body.data.session.session_id;
    }
    function questionRequest(sessionId, key, text = "How do you feel?") {
      return app.request(`/v1/sessions/${sessionId}/questions`, {
        method: "POST",
        headers: headers(key),
        body: JSON.stringify({ text, locale: "en-US", source: "TEXT", utterance_id: `utterance.${key}` })
      });
    }

    const sessionA = await startSession("idempotency.patient.native.start-a");
    const keyA = "idempotency.patient.native.question-a";
    const first = await questionRequest(sessionA, keyA);
    const firstBody = await first.json();
    await check("QUESTION_ASKED is durable before the provider call", async () => {
      assert(first.status === 200 && observedDurableQuestion, JSON.stringify(firstBody));
    });
    await check("patient response completion is durable and ordered", async () => {
      const result = await full.query(`select turn_status, turn_sequence, response_event_id,
        (select array_agg(event_type order by event_sequence) from public.session_events where session_id=$1) events
        from public.patient_conversation_turns where session_id=$1`, [sessionA]);
      const row = result.rows[0];
      assert(row.turn_status === "COMPLETED" && row.turn_sequence === "1" && row.response_event_id !== null
        && JSON.stringify(row.events) === JSON.stringify(["QUESTION_ASKED", "PATIENT_RESPONSE_RECORDED"]), JSON.stringify(row));
    });
    const callsAfterFirst = providerCalls;
    const retry = await questionRequest(sessionA, keyA);
    const retryBody = await retry.json();
    await check("exact retry returns the durable response with zero provider call", async () => {
      assert(retry.status === 200 && retryBody.data.replayed === true
        && JSON.stringify(retryBody.data.turn) === JSON.stringify(firstBody.data.turn)
        && providerCalls === callsAfterFirst, JSON.stringify(retryBody));
    });
    await check("lost HTTP response is recovered by exact replay", async () => {
      const rows = await full.query("select count(*)::int count from public.patient_conversation_turns where session_id=$1", [sessionA]);
      assert(rows.rows[0].count === 1 && providerCalls === callsAfterFirst, JSON.stringify(rows.rows[0]));
    });
    const conflict = await questionRequest(sessionA, keyA, "A different question");
    await check("same key with a different question fails closed", async () => {
      assert(conflict.status === 409 && providerCalls === callsAfterFirst, `status=${conflict.status}`);
    });
    app = createApp();
    const afterRestart = await questionRequest(sessionA, keyA);
    await check("fresh repository/application instance rehydrates durable replay", async () => {
      const body = await afterRestart.json();
      assert(afterRestart.status === 200 && body.data.replayed === true && providerCalls === callsAfterFirst, JSON.stringify(body));
    });

    const sessionB = await startSession("idempotency.patient.native.start-b");
    await questionRequest(sessionB, "idempotency.patient.native.question-b");
    await check("turn sequence is authoritative per Session", async () => {
      const result = await full.query("select session_id, turn_sequence from public.patient_conversation_turns where session_id in ($1,$2) order by session_id", [sessionA, sessionB]);
      assert(result.rows.every((row) => row.turn_sequence === "1"), JSON.stringify(result.rows));
    });

    const sessionRace = await startSession("idempotency.patient.native.start-race");
    const raceKey = "idempotency.patient.native.race";
    const callsBeforeRace = providerCalls;
    const raceResponses = await Promise.all([
      questionRequest(sessionRace, raceKey),
      questionRequest(sessionRace, raceKey)
    ]);
    await check("concurrent same-key requests create one turn and one provider answer", async () => {
      const result = await full.query("select count(*)::int count from public.patient_conversation_turns where session_id=$1", [sessionRace]);
      assert(raceResponses.some((response) => response.status === 200)
        && raceResponses.every((response) => response.status === 200 || response.status === 409)
        && result.rows[0].count === 1 && providerCalls === callsBeforeRace + 1,
      `statuses=${raceResponses.map((response) => response.status)} calls=${providerCalls}`);
    });

    const foreign = await app.request(`/v1/sessions/${sessionA}/questions`, { headers: headers(undefined, "native.other") });
    await check("foreign and cross-tenant learner cannot read a transcript", async () => {
      assert(foreign.status === 404, `status=${foreign.status}`);
    });
    await full.query("update public.institution_memberships set membership_status='INACTIVE' where membership_id=$1", [MEMBERSHIP]);
    const disabled = await app.request(`/v1/sessions/${sessionA}/questions`, { headers: headers() });
    await check("disabled membership cannot read a transcript", async () => {
      assert(disabled.status === 404, `status=${disabled.status}`);
    });
    await full.query("update public.institution_memberships set membership_status='ACTIVE' where membership_id=$1", [MEMBERSHIP]);
    const finalized = await app.request(`/v1/sessions/${sessionB}/end`, {
      method: "POST",
      headers: headers("idempotency.patient.native.end-b"),
      body: JSON.stringify({ expected_state_version: 0, reason: "LEARNER_COMPLETED" })
    });
    assert(finalized.status === 200, `finalize status=${finalized.status}`);
    const ended = await questionRequest(sessionB, "idempotency.patient.native.ended");
    await check("ended Session rejects a new patient question", async () => {
      assert(ended.status === 409, `status=${ended.status}`);
    });

    const rls = await full.query(`select c.relrowsecurity, c.relforcerowsecurity
      from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname='patient_conversation_turns'`);
    await check("patient conversation persistence has ENABLE and FORCE RLS", async () => {
      assert(rls.rows[0]?.relrowsecurity === true && rls.rows[0]?.relforcerowsecurity === true, JSON.stringify(rls.rows[0]));
    });
    const privileges = await full.query(`select
      has_table_privilege('authenticated','public.patient_conversation_turns','SELECT') authenticated_select,
      has_table_privilege('authenticated','public.patient_conversation_turns','INSERT') authenticated_insert,
      has_function_privilege('authenticated','public.begin_patient_conversation_v2_019a(jsonb)','EXECUTE') authenticated_begin`);
    await check("raw authenticated clients have no table mutation or RPC authority", async () => {
      const row = privileges.rows[0];
      assert(row.authenticated_select === false && row.authenticated_insert === false && row.authenticated_begin === false, JSON.stringify(row));
    });
    await check("learner-safe transcript excludes provider metadata", async () => {
      const loaded = await app.request(`/v1/sessions/${sessionA}/questions`, { headers: headers() });
      const serialized = JSON.stringify(await loaded.json());
      assert(loaded.status === 200 && !serialized.includes("provider_metadata") && !serialized.includes("provider_model"), serialized);
    });

    process.stdout.write(`V2-019A native PostgreSQL Patient Conversation tests: ${passed} passed, 0 failed\n`);
  } finally {
    if (service !== undefined) await service.end().catch(() => undefined);
    if (full !== undefined) await full.end().catch(() => undefined);
    if (admin !== undefined) await admin.end().catch(() => undefined);
    await postgres.stop().catch(() => undefined);
  }
}

await main();
