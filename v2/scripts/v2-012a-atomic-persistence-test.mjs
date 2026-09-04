import EmbeddedPostgres from "embedded-postgres";
import { mkdtemp, readFile, readdir } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  POSTGRES_SESSION_COMMIT_FUNCTION,
  POSTGRES_SESSION_LOAD_FUNCTION,
  PostgresSessionCommitAdapter,
  createSessionCommitToken,
  createSessionCoordinator,
  initializeReviewInMemorySession,
  processExternalLearnerCommand
} from "../packages/session-engine/src/index.ts";
import {
  createCoordinatorContext,
  createSyntheticCommandSession,
  createSyntheticExternalCommand,
  DETERMINISTIC_EVENT_ID_FACTORY,
  TEST_REAL_TIME_UTC,
  TEST_SESSION_COMMAND_DEPENDENCIES
} from "../tests/fixtures/session-engine/synthetic-command.ts";
import { createSyntheticScheduledItem } from "../tests/fixtures/session-engine/synthetic-session.ts";
import { prepareStemiReviewArtifact } from "../tests/fixtures/cases/stemi-review.ts";
import { TEST_HASH_ADAPTER } from "../tests/fixtures/cases/synthetic-case.ts";
import { canonicalSerialize } from "../packages/case-schema/src/index.ts";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const V2_ROOT = resolve(SCRIPT_DIR, "..");
const MIGRATION_DIR = join(V2_ROOT, "supabase", "migrations");
const TEST_USER = "11111111-1111-4111-8111-111111111111";
const REVIEW_SUBJECT = "b".repeat(64);
const PACKAGE_HASH = "a".repeat(64);
const EXPECTED_STEMI_REVIEW_SUBJECT =
  "46388c32e3ef74db413228adf837e90e828913a7db996a3ba57d181a2cbab11f";
const EXPECTED_STEMI_REVIEW_EXECUTION =
  "a8e76e5cd96c8b29461968796d295674f8de1ab3630a55a5568a25664c2b7ab7";

let passed = 0;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function check(name, fn) {
  await fn();
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
  if (port <= 0) throw new Error("Could not allocate native PostgreSQL test port.");
  return port;
}

async function loadMigrations() {
  const names = (await readdir(MIGRATION_DIR))
    .filter((name) => name.endsWith(".sql"))
    .sort();
  return Promise.all(names.map(async (name) => ({
    name,
    sql: await readFile(join(MIGRATION_DIR, name), "utf8")
  })));
}

async function applyMigrations(client, migrations) {
  for (const migration of migrations) await client.query(migration.sql);
}

async function bootstrapCluster(client) {
  await client.query(`
    do $roles$
    begin
      if not exists (select 1 from pg_catalog.pg_roles where rolname = 'anon') then
        create role anon nologin;
      end if;
      if not exists (select 1 from pg_catalog.pg_roles where rolname = 'authenticated') then
        create role authenticated nologin;
      end if;
      if not exists (select 1 from pg_catalog.pg_roles where rolname = 'service_role') then
        create role service_role nologin bypassrls;
      end if;
      alter role service_role bypassrls;
    end
    $roles$;
  `);
}

async function bootstrapAuth(client) {
  await client.query(`
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid()
    returns uuid language sql stable set search_path = ''
    as $function$
      select nullif(pg_catalog.current_setting('request.jwt.claim.sub', true), '')::uuid;
    $function$;
    revoke all on schema auth from public;
    revoke all on function auth.uid() from public;
    grant usage on schema auth to authenticated, service_role;
    grant execute on function auth.uid() to authenticated, service_role;
    grant all privileges on table auth.users to service_role;
  `);
}

class NativePostgresRpcClient {
  constructor(client) {
    this.client = client;
  }

  async rpc(functionName, parameters) {
    try {
      if (functionName === POSTGRES_SESSION_LOAD_FUNCTION) {
        const result = await this.client.query(
          "select public.load_authoritative_session_v2_012a($1::public.contract_identifier) as data",
          [parameters.p_session_id]
        );
        return { data: result.rows[0]?.data ?? null, error: null };
      }
      if (functionName === POSTGRES_SESSION_COMMIT_FUNCTION) {
        const result = await this.client.query(
          "select public.commit_authoritative_session_v2_012a($1::jsonb) as data",
          [JSON.stringify(parameters.p_request)]
        );
        return { data: result.rows[0]?.data ?? null, error: null };
      }
      return { data: null, error: { code: "42883", message: "Unknown RPC function." } };
    } catch (error) {
      return {
        data: null,
        error: {
          code: error?.code,
          message: error instanceof Error ? error.message : "Native PostgreSQL operation failed."
        }
      };
    }
  }
}

async function seedGovernance(client, reviewArtifact) {
  await client.query("insert into auth.users (id) values ($1)", [TEST_USER]);
  await client.query(
    "insert into public.profiles (user_id, display_alias, preferred_locale) values ($1, 'Synthetic persistence learner', 'en-US')",
    [TEST_USER]
  );
  await client.query(`
    insert into public.institution_memberships (
      membership_id, institution_id, user_id, membership_role, membership_status
    ) values (
      'membership.synthetic.persistence', 'ju', $1, 'LEARNER', 'ACTIVE'
    )
  `, [TEST_USER]);
  await client.query(`
    insert into public.clinical_cases (
      case_id, institution_id, case_slug, title, topic_code, owner_membership_id
    ) values
      ('case.synthetic.001', 'ju', 'synthetic-persistence', 'Synthetic persistence Case',
       'topic.synthetic', 'membership.synthetic.persistence'),
      ('case.stemi.inferior-rv.001', 'ju', 'stemi-review-structural',
       'STEMI review structural fixture', 'topic.review-only',
       'membership.synthetic.persistence')
  `);

  const productionAuthoring = {
    manifest: {
      case_id: "case.synthetic.001",
      case_version_id: "case-version.synthetic.001",
      case_package_id: "case-package.synthetic.001",
      case_version: "2.0.0",
      schema_version: "2.0",
      status: "APPROVED"
    }
  };
  await client.query(`
    insert into public.case_versions (
      case_version_id, case_id, institution_id, case_package_id,
      semantic_version, case_schema_version, lifecycle_status,
      review_subject_hash, publication_candidate_hash, authored_case_payload,
      created_by_membership_id
    ) values (
      'case-version.synthetic.001', 'case.synthetic.001', 'ju',
      'case-package.synthetic.001', '2.0.0', '2.0', 'APPROVED',
      $1, $2, $3::jsonb, 'membership.synthetic.persistence'
    )
  `, [REVIEW_SUBJECT, PACKAGE_HASH, JSON.stringify(productionAuthoring)]);

  await client.query(`
    insert into public.case_approvals (
      approval_id, institution_id, case_version_id, case_package_id,
      approved_case_version, approved_package_hash, review_subject_hash,
      approval_scope, approval_status, approver_ref_id,
      approver_membership_id, approver_role_code, approved_at, approval_payload
    ) values (
      'approval.synthetic.persistence', 'ju', 'case-version.synthetic.001',
      'case-package.synthetic.001', '2.0.0', $1, $2,
      'CASE_PACKAGE_PUBLICATION', 'APPROVED', 'approver.synthetic.persistence',
      'membership.synthetic.persistence', 'role.synthetic',
      '2026-09-01T00:00:00Z', '{}'::jsonb
    )
  `, [PACKAGE_HASH, REVIEW_SUBJECT]);

  const packagePayload = {
    package_hash: PACKAGE_HASH,
    manifest: {
      case_package_id: "case-package.synthetic.001",
      case_version_id: "case-version.synthetic.001",
      case_version: "2.0.0",
      schema_version: "2.0",
      status: "PUBLISHED"
    }
  };
  await client.query(`
    insert into public.case_packages (
      case_package_id, institution_id, case_version_id, case_version,
      package_schema_version, package_hash, review_subject_hash, approval_id,
      approval_status, execution_authority, package_lifecycle, module_hashes,
      package_payload, published_at
    ) values (
      'case-package.synthetic.001', 'ju', 'case-version.synthetic.001', '2.0.0',
      '2.0', $1, $2, 'approval.synthetic.persistence', 'APPROVED',
      'PUBLISHED_PRODUCTION', 'PUBLISHED', '{}'::jsonb, $3::jsonb,
      '2026-09-01T00:00:00Z'
    )
  `, [PACKAGE_HASH, REVIEW_SUBJECT, JSON.stringify(packagePayload)]);

  await client.query(`
    insert into public.case_versions (
      case_version_id, case_id, institution_id, case_package_id,
      semantic_version, case_schema_version, lifecycle_status,
      review_subject_hash, authored_case_payload, created_by_membership_id
    ) values ($1, 'case.stemi.inferior-rv.001', 'ju', $2, $3, '2.0',
      'UNDER_REVIEW', $4, $5::jsonb, 'membership.synthetic.persistence')
  `, [
    reviewArtifact.source_identity.case_version_id,
    reviewArtifact.source_identity.case_package_id,
    reviewArtifact.source_identity.case_version,
    reviewArtifact.review_subject_hash,
    JSON.stringify(reviewArtifact.source_case)
  ]);
  await client.query(`
    insert into public.review_execution_artifacts (
      review_execution_hash, institution_id, case_package_id, case_version_id,
      case_version, case_schema_version, artifact_schema_version, artifact_kind,
      execution_authority, source_lifecycle, review_subject_hash, module_hashes,
      artifact_payload
    ) values ($1, 'ju', $2, $3, $4, '2.0', '1.0',
      'REVIEW_EXECUTION_ARTIFACT', 'REVIEW_ONLY', 'UNDER_REVIEW', $5,
      $6::jsonb, $7::jsonb)
  `, [
    reviewArtifact.review_execution_hash,
    reviewArtifact.source_identity.case_package_id,
    reviewArtifact.source_identity.case_version_id,
    reviewArtifact.source_identity.case_version,
    reviewArtifact.review_subject_hash,
    JSON.stringify(reviewArtifact.module_hashes),
    JSON.stringify(reviewArtifact)
  ]);
}

async function insertSession(client, aggregate) {
  const pinned = aggregate.pinned_case;
  await client.query(`
    insert into public.simulation_sessions (
      session_id, institution_id, learner_user_id, learner_membership_id,
      aggregate_schema_version, session_status, simulation_mode,
      execution_authority, case_package_id, case_version_id, case_version,
      published_package_hash, review_execution_hash, review_subject_hash,
      patient_state_version, clinical_time_seconds, clock_status,
      next_event_sequence, trusted_real_time_anchor_utc, patient_state_payload,
      scheduler_state_payload, clinical_clock_payload, aggregate_payload
    ) values (
      $1, 'ju', $2, 'membership.synthetic.persistence', $3, $4, $5,
      $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
      $18::jsonb, $19::jsonb, $20::jsonb, $21::jsonb
    )
  `, [
    aggregate.session_id,
    TEST_USER,
    aggregate.aggregate_schema_version,
    aggregate.status,
    aggregate.mode,
    pinned.execution_authority,
    pinned.case_package_id,
    pinned.case_version_id,
    pinned.case_version,
    pinned.execution_authority === "PUBLISHED_PRODUCTION" ? pinned.package_hash : null,
    pinned.execution_authority === "REVIEW_ONLY" ? pinned.review_execution_hash : null,
    pinned.execution_authority === "REVIEW_ONLY" ? pinned.review_subject_hash : null,
    aggregate.patient_state.state_version,
    aggregate.patient_state.clinical_time,
    aggregate.clinical_clock.status,
    aggregate.next_sequence_no,
    aggregate.trusted_real_time_anchor_utc ?? null,
    JSON.stringify(aggregate.patient_state),
    JSON.stringify(aggregate.scheduler_state),
    JSON.stringify(aggregate.clinical_clock),
    JSON.stringify(aggregate)
  ]);
}

async function insertRawEvent(client, event) {
  await client.query(`
    insert into public.session_events (
      event_id, session_id, event_sequence, event_schema_version,
      clinical_time_seconds, real_time_utc, actor_type, actor_id, event_source,
      correlation_id, causation_event_id, action_request_id, action_id, rule_id,
      event_type, event_status, state_version_before, state_version_after,
      idempotency_key, supersedes_event_id, envelope_payload
    ) values (
      $1::uuid, $2, $3, $4, $5, $6::timestamptz, $7, $8, $9, $10,
      $11::uuid, $12, $13, $14, $15, $16, $17, $18, $19, $20::uuid,
      $21::jsonb
    )
  `, [
    event.event_id,
    event.session_id,
    event.sequence_no,
    event.event_schema_version,
    event.clinical_time,
    event.real_time_utc,
    event.actor_type,
    event.actor_id ?? null,
    event.source,
    event.correlation_id,
    event.causation_event_id ?? null,
    event.action_request_id ?? null,
    event.action_id ?? null,
    event.rule_id ?? null,
    event.event_type,
    event.status,
    event.state_version_before,
    event.state_version_after,
    event.idempotency_key,
    event.supersedes_event_id ?? null,
    JSON.stringify(event)
  ]);
}

function requireSuccess(result, label) {
  if (!result.success) throw new Error(`${label}: ${JSON.stringify(result.issues)}`);
  return result;
}

async function counts(client, sessionId) {
  const result = await client.query(`
    select
      (select count(*)::int from public.session_events where session_id = $1) as events,
      (select count(*)::int from public.session_commands where session_id = $1) as commands,
      (select count(*)::int from public.patient_state_checkpoints where session_id = $1) as checkpoints,
      (select next_event_sequence::int from public.simulation_sessions where session_id = $1) as next_sequence
  `, [sessionId]);
  return result.rows[0];
}

function clone(value) {
  return structuredClone(value);
}

function semanticallyEqual(left, right) {
  return canonicalSerialize(left) === canonicalSerialize(right);
}

async function main() {
  const migrations = await loadMigrations();
  assert(migrations.at(-1)?.name === "202609040005_v2_012a_atomic_session_commit.sql",
    "V2-012A migration must be the additive migration tail.");
  const port = await findFreePort();
  const databaseDir = await mkdtemp(join(tmpdir(), "v2-012a-native-postgres-"));
  const postgres = new EmbeddedPostgres({
    databaseDir,
    user: "postgres",
    password: "local-atomic-test",
    port,
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
    persistent: false,
    onLog: () => undefined,
    onError: () => undefined
  });

  let admin;
  let full;
  let reset;
  let service;
  try {
    await postgres.initialise();
    await postgres.start();
    admin = postgres.getPgClient();
    await admin.connect();
    await bootstrapCluster(admin);
    await postgres.createDatabase("v2_012a_full");
    await postgres.createDatabase("v2_012a_reset");
    full = postgres.getPgClient("v2_012a_full");
    reset = postgres.getPgClient("v2_012a_reset");
    await Promise.all([full.connect(), reset.connect()]);
    await Promise.all([bootstrapAuth(full), bootstrapAuth(reset)]);

    await check("native PostgreSQL 16.14 is the atomicity authority", async () => {
      const result = await full.query("select version() as version");
      assert(result.rows[0].version.startsWith("PostgreSQL 16.14"), result.rows[0].version);
    });
    await check("empty database applies every migration through V2-012A", async () => {
      await applyMigrations(full, migrations);
    });
    await check("reset database reapplies every migration", async () => {
      await applyMigrations(reset, migrations);
    });

    const reviewArtifact = await prepareStemiReviewArtifact();
    await seedGovernance(full, reviewArtifact);
    const scheduled = createSyntheticScheduledItem({
      id: "scheduled-item.synthetic.persistence-future",
      due: 90,
      eventType: "PATIENT_STATE_CHANGED"
    });
    const initial = createSyntheticCommandSession({
      schedulerItems: [scheduled],
      trustedRealTimeUtc: TEST_REAL_TIME_UTC
    });
    await insertSession(full, initial);
    const sequenceBase = clone(initial);
    sequenceBase.session_id = "session.synthetic.sequence-race";
    sequenceBase.patient_state.session_id = sequenceBase.session_id;
    await insertSession(full, sequenceBase);
    const reviewInitialized = initializeReviewInMemorySession({
      session_id: "session.stemi.persistence-review",
      mode: "ASSESSMENT",
      review_execution_artifact: reviewArtifact,
      trusted_real_time_anchor_utc: "2026-09-03T12:00:00Z"
    });
    const reviewSession = requireSuccess(reviewInitialized, "review initialization").session;
    await insertSession(full, reviewSession);

    service = postgres.getPgClient("v2_012a_full");
    await service.connect();
    await service.query("set role service_role");
    const rpc = new NativePostgresRpcClient(service);
    const adapter = new PostgresSessionCommitAdapter(rpc);

    await check("atomic functions are SECURITY INVOKER", async () => {
      const result = await full.query(`
        select proname, prosecdef
        from pg_proc join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
        where nspname = 'public' and proname like '%authoritative_session_v2_012a'
        order by proname
      `);
      assert(result.rows.length === 2 && result.rows.every((row) => row.prosecdef === false),
        JSON.stringify(result.rows));
    });
    await check("anonymous role cannot call the load function", async () => {
      let error;
      await full.query("begin");
      try {
        await full.query("set local role anon");
        await full.query("select public.load_authoritative_session_v2_012a('session.synthetic.001')");
      } catch (caught) {
        error = caught;
      } finally {
        await full.query("rollback");
      }
      assert(error?.code === "42501", `Expected 42501, got ${error?.code}`);
    });

    const loadedInitial = requireSuccess(await adapter.load(initial.session_id), "initial load");
    await check("Session aggregate reloads with exact semantic equality", () => {
      assert(semanticallyEqual(loadedInitial.session, initial), "aggregate mismatch");
    });
    await check("Patient State reloads losslessly", () => {
      assert(semanticallyEqual(loadedInitial.session.patient_state, initial.patient_state), "Patient State mismatch");
    });
    await check("Patient State version round-trips", () => {
      assert(loadedInitial.session.patient_state.state_version === initial.patient_state.state_version, "state version mismatch");
    });
    await check("Clinical Time round-trips", () => {
      assert(loadedInitial.session.patient_state.clinical_time === initial.patient_state.clinical_time, "Clinical Time mismatch");
    });
    await check("clock and trusted anchor round-trip", () => {
      assert(semanticallyEqual(loadedInitial.session.clinical_clock, initial.clinical_clock), "clock mismatch");
      assert(loadedInitial.session.trusted_real_time_anchor_utc === initial.trusted_real_time_anchor_utc, "anchor mismatch");
    });
    await check("pending scheduler state round-trips", () => {
      assert(semanticallyEqual(loadedInitial.session.scheduler_state, initial.scheduler_state), "scheduler mismatch");
    });
    await check("event sequence position round-trips", () => {
      assert(loadedInitial.session.next_sequence_no === 1, "sequence mismatch");
    });
    await check("production authority and artifact hash round-trip", () => {
      assert(loadedInitial.session.pinned_case.execution_authority === "PUBLISHED_PRODUCTION", "authority mismatch");
      assert(loadedInitial.session.pinned_case.package_hash === PACKAGE_HASH, "package hash mismatch");
    });

    const loadedReview = requireSuccess(await adapter.load(reviewSession.session_id), "review load");
    await check("REVIEW_ONLY authority round-trips", () => {
      assert(loadedReview.session.pinned_case.execution_authority === "REVIEW_ONLY", "review authority changed");
    });
    await check("real STEMI review hashes remain exact", () => {
      assert(loadedReview.session.pinned_case.review_subject_hash === EXPECTED_STEMI_REVIEW_SUBJECT, "review subject hash changed");
      assert(loadedReview.session.pinned_case.review_execution_hash === EXPECTED_STEMI_REVIEW_EXECUTION, "review execution hash changed");
    });
    await check("STEMI source remains UNDER_REVIEW in persistence", async () => {
      const result = await full.query("select lifecycle_status from public.case_versions where case_version_id = $1", [reviewArtifact.source_identity.case_version_id]);
      assert(result.rows[0]?.lifecycle_status === "UNDER_REVIEW", "STEMI lifecycle changed");
    });

    const command1 = createSyntheticExternalCommand(initial);
    const computed1 = requireSuccess(await processExternalLearnerCommand(
      initial,
      command1,
      TEST_SESSION_COMMAND_DEPENDENCIES
    ), "command computation");
    const committed1 = requireSuccess(await adapter.commit({
      session_id: initial.session_id,
      expected_token: loadedInitial.commit_token,
      proposed_session: computed1.authoritative_session
    }), "first persistent commit");

    await check("successful commit updates authoritative Session once", async () => {
      const row = await full.query("select aggregate_payload from public.simulation_sessions where session_id = $1", [initial.session_id]);
      assert(semanticallyEqual(row.rows[0].aggregate_payload, committed1.session), "Session update mismatch");
    });
    await check("successful commit writes every new Event", async () => {
      const state = await counts(full, initial.session_id);
      assert(state.events === computed1.committed_events.length, JSON.stringify(state));
    });
    await check("EventIds persist exactly", async () => {
      const rows = await full.query("select event_id::text from public.session_events where session_id = $1 order by event_sequence", [initial.session_id]);
      assert(JSON.stringify(rows.rows.map((row) => row.event_id)) === JSON.stringify(computed1.committed_events.map((event) => event.event_id)), "EventId mismatch");
    });
    await check("Event sequence persists exactly", async () => {
      const rows = await full.query("select event_sequence::int from public.session_events where session_id = $1 order by event_sequence", [initial.session_id]);
      assert(JSON.stringify(rows.rows.map((row) => row.event_sequence)) === JSON.stringify(computed1.committed_events.map((event) => event.sequence_no)), "sequence mismatch");
    });
    await check("Event Clinical Time persists exactly", async () => {
      const rows = await full.query("select clinical_time_seconds::float8 as clinical_time from public.session_events where session_id = $1 order by event_sequence", [initial.session_id]);
      assert(JSON.stringify(rows.rows.map((row) => row.clinical_time)) === JSON.stringify(computed1.committed_events.map((event) => event.clinical_time)), "Event Clinical Time mismatch");
    });
    await check("successful command replay identity persists atomically", async () => {
      const state = await counts(full, initial.session_id);
      assert(state.commands === 1, JSON.stringify(state));
    });
    await check("checkpoint persists the exact aggregate", async () => {
      const result = await full.query("select aggregate_payload from public.patient_state_checkpoints where session_id = $1 order by checkpoint_id desc limit 1", [initial.session_id]);
      assert(semanticallyEqual(result.rows[0].aggregate_payload, committed1.session), "checkpoint mismatch");
    });
    await check("new composite commit token reflects persisted state", () => {
      assert(JSON.stringify(committed1.commit_token) === JSON.stringify(createSessionCommitToken(committed1.session)), "commit token mismatch");
    });

    const postCommit = requireSuccess(await adapter.load(initial.session_id), "post-commit load");
    await check("post-commit adapter load validates Event/replay/checkpoint agreement", () => {
      assert(semanticallyEqual(postCommit.session, committed1.session), "post-commit load mismatch");
    });
    await check("exact durable retry replays without persistent commit", async () => {
      const replay = requireSuccess(await processExternalLearnerCommand(
        postCommit.session,
        command1,
        TEST_SESSION_COMMAND_DEPENDENCIES
      ), "durable replay");
      assert(replay.status === "REPLAYED", replay.status);
    });
    const beforeReplayCounts = await counts(full, initial.session_id);
    const coordinator = createSessionCoordinator({
      adapter,
      hash_adapter: TEST_HASH_ADAPTER,
      event_id_factory: DETERMINISTIC_EVENT_ID_FACTORY
    });
    const replayResult = requireSuccess(await coordinator.submitExternalClinicalCommand({
      ...createCoordinatorContext(postCommit.session, TEST_REAL_TIME_UTC, "persistent-replay"),
      command: command1
    }), "coordinator replay");
    const afterReplayCounts = await counts(full, initial.session_id);
    await check("coordinator exact retry returns REPLAYED", () => {
      assert(replayResult.status === "REPLAYED", replayResult.status);
    });
    await check("exact retry creates no duplicate Event", () => {
      assert(afterReplayCounts.events === beforeReplayCounts.events, "retry duplicated Event");
    });
    await check("exact retry does not advance sequence", () => {
      assert(afterReplayCounts.next_sequence === beforeReplayCounts.next_sequence, "retry advanced sequence");
    });
    await check("exact retry does not advance Patient State", () => {
      assert(replayResult.authoritative_session.patient_state.state_version === postCommit.session.patient_state.state_version, "retry advanced state");
    });

    const conflicting = createSyntheticExternalCommand(postCommit.session, {
      actionRequestId: "action-request.synthetic.conflict",
      commandId: "command.synthetic.conflict",
      parameters: { conflicting: true }
    });
    const conflictResult = await coordinator.submitExternalClinicalCommand({
      ...createCoordinatorContext(postCommit.session, TEST_REAL_TIME_UTC, "persistent-conflict"),
      command: conflicting
    });
    await check("conflicting durable idempotency reuse fails closed", () => {
      assert(!conflictResult.success && conflictResult.issues.some((issue) => issue.code === "IDEMPOTENCY_CONFLICT"), JSON.stringify(conflictResult));
    });
    await check("conflicting reuse mutates nothing", async () => {
      assert(JSON.stringify(await counts(full, initial.session_id)) === JSON.stringify(afterReplayCounts), "conflict mutated persistence");
    });

    const command2 = createSyntheticExternalCommand(postCommit.session, {
      idempotencyKey: "idempotency.synthetic.command-002",
      commandId: "command.synthetic.002",
      actionRequestId: "action-request.synthetic.002",
      requestId: "request.synthetic.command-002",
      correlationId: "correlation.synthetic.command-002"
    });
    const computed2 = requireSuccess(await processExternalLearnerCommand(
      postCommit.session,
      command2,
      TEST_SESSION_COMMAND_DEPENDENCIES
    ), "second command computation");
    const staleResult = await adapter.commit({
      session_id: initial.session_id,
      expected_token: loadedInitial.commit_token,
      proposed_session: computed2.authoritative_session
    });
    await check("stale expected token returns SESSION_VERSION_CONFLICT", () => {
      assert(!staleResult.success && staleResult.issues[0]?.code === "SESSION_VERSION_CONFLICT", JSON.stringify(staleResult));
    });
    await check("stale token causes zero Session mutation", async () => {
      const reloaded = requireSuccess(await adapter.load(initial.session_id), "stale verification");
      assert(semanticallyEqual(reloaded.session, postCommit.session), "stale commit changed Session");
    });
    await check("stale token causes zero Event insertion", async () => {
      assert((await counts(full, initial.session_id)).events === beforeReplayCounts.events, "stale Event inserted");
    });
    await check("stale token causes zero replay insertion", async () => {
      assert((await counts(full, initial.session_id)).commands === beforeReplayCounts.commands, "stale replay inserted");
    });

    const directCommit = (request) => rpc.rpc(POSTGRES_SESSION_COMMIT_FUNCTION, { p_request: request });
    const duplicateEvent = clone(computed2.authoritative_session);
    duplicateEvent.committed_events[1].event_id = duplicateEvent.committed_events[0].event_id;
    duplicateEvent.idempotency_records[1].committed_event_ids = [duplicateEvent.committed_events[0].event_id];
    duplicateEvent.idempotency_records[1].command_event_id = duplicateEvent.committed_events[0].event_id;
    const duplicateFailure = await directCommit({
      session_id: initial.session_id,
      expected_token: postCommit.commit_token,
      proposed_session: duplicateEvent
    });
    await check("duplicate EventId constraint rejects the transaction", () => {
      assert(duplicateFailure.error !== null, "duplicate EventId unexpectedly committed");
    });
    await check("duplicate EventId failure leaves Session unchanged", async () => {
      const reloaded = requireSuccess(await adapter.load(initial.session_id), "duplicate rollback");
      assert(semanticallyEqual(reloaded.session, postCommit.session), "duplicate changed Session");
    });
    await check("duplicate EventId failure stores no replay record", async () => {
      assert((await counts(full, initial.session_id)).commands === 1, "duplicate poisoned idempotency");
    });
    const invalidSequence = clone(computed2.authoritative_session);
    invalidSequence.committed_events[1].sequence_no = 99;
    const sequenceFailure = await directCommit({
      session_id: initial.session_id,
      expected_token: postCommit.commit_token,
      proposed_session: invalidSequence
    });
    await check("invalid proposed Event sequence fails closed before persistence", () => {
      assert(sequenceFailure.data?.status === "INVALID_COMMIT", JSON.stringify(sequenceFailure));
    });
    await check("Event sequence rejection leaves no persistent gap or mutation", async () => {
      const state = await counts(full, initial.session_id);
      assert(state.events === 1 && state.commands === 1 && state.next_sequence === 2, JSON.stringify(state));
    });
    const sequenceCommand = createSyntheticExternalCommand(sequenceBase, {
      idempotencyKey: "idempotency.synthetic.sequence-race",
      commandId: "command.synthetic.sequence-race",
      actionRequestId: "action-request.synthetic.sequence-race",
      requestId: "request.synthetic.sequence-race",
      correlationId: "correlation.synthetic.sequence-race"
    });
    const sequenceComputed = requireSuccess(await processExternalLearnerCommand(
      sequenceBase,
      sequenceCommand,
      TEST_SESSION_COMMAND_DEPENDENCIES
    ), "sequence race computation");
    const hiddenSequenceEvent = clone(sequenceComputed.committed_events[0]);
    hiddenSequenceEvent.event_id = "00000000-0000-4000-8000-999999999999";
    hiddenSequenceEvent.sequence_no = 2;
    await insertRawEvent(full, hiddenSequenceEvent);
    const twoEventProposal = clone(sequenceComputed.authoritative_session);
    const secondEvent = clone(sequenceComputed.committed_events[0]);
    secondEvent.event_id = "00000000-0000-4000-8000-888888888888";
    secondEvent.sequence_no = 2;
    twoEventProposal.committed_events.push(secondEvent);
    twoEventProposal.next_sequence_no = 3;
    twoEventProposal.idempotency_records[0].result_event_range.last_sequence_no = 2;
    twoEventProposal.idempotency_records[0].committed_event_ids.push(secondEvent.event_id);
    const sequenceConstraintFailure = await directCommit({
      session_id: sequenceBase.session_id,
      expected_token: createSessionCommitToken(sequenceBase),
      proposed_session: twoEventProposal
    });
    await check("database Event-sequence constraint fails after an earlier tentative insert", () => {
      assert(sequenceConstraintFailure.error?.code === "23505", JSON.stringify(sequenceConstraintFailure));
    });
    await check("late Event-sequence constraint failure rolls back the earlier Event", async () => {
      const result = await full.query("select event_sequence::int from public.session_events where session_id = $1 order by event_sequence", [sequenceBase.session_id]);
      assert(JSON.stringify(result.rows.map((row) => row.event_sequence)) === "[2]", JSON.stringify(result.rows));
      const state = await counts(full, sequenceBase.session_id);
      assert(state.next_sequence === 1 && state.commands === 0 && state.checkpoints === 0, JSON.stringify(state));
    });

    await full.query(`
      create function public.v2_012a_fail_command_insert()
      returns trigger language plpgsql set search_path = '' as $$
      begin raise exception using errcode = 'P0001', message = 'forced command insert failure'; end;
      $$;
      create trigger v2_012a_force_command_failure
      before insert on public.session_commands
      for each row execute function public.v2_012a_fail_command_insert();
    `);
    const commandFailure = await adapter.commit({
      session_id: initial.session_id,
      expected_token: postCommit.commit_token,
      proposed_session: computed2.authoritative_session
    });
    await check("forced idempotency write failure is typed persistence failure", () => {
      assert(!commandFailure.success && commandFailure.issues[0]?.code === "SESSION_PERSISTENCE_FAILURE", JSON.stringify(commandFailure));
    });
    await full.query("drop trigger v2_012a_force_command_failure on public.session_commands; drop function public.v2_012a_fail_command_insert()");
    await check("forced idempotency failure rolls back Event writes", async () => {
      assert((await counts(full, initial.session_id)).events === 1, "Event survived command failure");
    });
    await check("forced idempotency failure rolls back Session update", async () => {
      const reloaded = requireSuccess(await adapter.load(initial.session_id), "command rollback");
      assert(semanticallyEqual(reloaded.session, postCommit.session), "Session survived command failure");
    });
    await check("failed transaction does not poison idempotency key", async () => {
      assert((await counts(full, initial.session_id)).commands === 1, "idempotency key was poisoned");
    });

    await full.query(`
      create function public.v2_012a_fail_checkpoint_insert()
      returns trigger language plpgsql set search_path = '' as $$
      begin raise exception using errcode = 'P0001', message = 'forced checkpoint failure'; end;
      $$;
      create trigger v2_012a_force_checkpoint_failure
      before insert on public.patient_state_checkpoints
      for each row execute function public.v2_012a_fail_checkpoint_insert();
    `);
    const checkpointFailure = await adapter.commit({
      session_id: initial.session_id,
      expected_token: postCommit.commit_token,
      proposed_session: computed2.authoritative_session
    });
    await check("forced late checkpoint failure is typed", () => {
      assert(!checkpointFailure.success && checkpointFailure.issues[0]?.code === "SESSION_PERSISTENCE_FAILURE", JSON.stringify(checkpointFailure));
    });
    await full.query("drop trigger v2_012a_force_checkpoint_failure on public.patient_state_checkpoints; drop function public.v2_012a_fail_checkpoint_insert()");
    await check("checkpoint failure rolls back Events and command", async () => {
      const state = await counts(full, initial.session_id);
      assert(state.events === 1 && state.commands === 1 && state.checkpoints === 1, JSON.stringify(state));
    });
    await check("checkpoint failure rolls back Session state and sequence", async () => {
      const reloaded = requireSuccess(await adapter.load(initial.session_id), "checkpoint rollback");
      assert(semanticallyEqual(reloaded.session, postCommit.session), "checkpoint failure changed Session");
    });

    await full.query(`
      create function public.v2_012a_fail_session_update()
      returns trigger language plpgsql set search_path = '' as $$
      begin raise exception using errcode = 'P0001', message = 'forced Session update failure'; end;
      $$;
      create trigger v2_012a_force_session_failure
      before update on public.simulation_sessions
      for each row execute function public.v2_012a_fail_session_update();
    `);
    const sessionFailure = await adapter.commit({
      session_id: initial.session_id,
      expected_token: postCommit.commit_token,
      proposed_session: computed2.authoritative_session
    });
    await check("forced final Session update failure is typed", () => {
      assert(!sessionFailure.success && sessionFailure.issues[0]?.code === "SESSION_PERSISTENCE_FAILURE", JSON.stringify(sessionFailure));
    });
    await full.query("drop trigger v2_012a_force_session_failure on public.simulation_sessions; drop function public.v2_012a_fail_session_update()");
    await check("final Session failure rolls back checkpoint, command, and Event", async () => {
      const state = await counts(full, initial.session_id);
      assert(state.events === 1 && state.commands === 1 && state.checkpoints === 1, JSON.stringify(state));
    });

    const committed2 = requireSuccess(await adapter.commit({
      session_id: initial.session_id,
      expected_token: postCommit.commit_token,
      proposed_session: computed2.authoritative_session
    }), "second successful commit");
    await check("successful retry after failures uses the next gap-free sequence", () => {
      assert(committed2.session.committed_events[1]?.sequence_no === 2 && committed2.session.next_sequence_no === 3, "persistent sequence gap");
    });
    await check("scheduler and authoritative state remain exact after commit", () => {
      assert(semanticallyEqual(committed2.session.scheduler_state, computed2.authoritative_session.scheduler_state), "scheduler changed");
      assert(semanticallyEqual(committed2.session.patient_state, computed2.authoritative_session.patient_state), "Patient State changed");
    });
    await check("operational timestamps do not alter persisted Clinical Time", async () => {
      const result = await full.query("select clinical_time_seconds::float8 as clinical_time, created_at from public.simulation_sessions where session_id = $1", [initial.session_id]);
      assert(result.rows[0].clinical_time === computed2.authoritative_session.patient_state.clinical_time, "database time affected Clinical Time");
    });

    const authoritySwap = clone(committed2.session);
    authoritySwap.pinned_case.execution_authority = "REVIEW_ONLY";
    const authorityResult = await directCommit({
      session_id: initial.session_id,
      expected_token: committed2.commit_token,
      proposed_session: authoritySwap
    });
    await check("production authority cannot become REVIEW_ONLY", () => {
      assert(authorityResult.data?.status === "AUTHORITY_MISMATCH", JSON.stringify(authorityResult));
    });
    const hashSwap = clone(committed2.session);
    hashSwap.pinned_case.package_hash = "9".repeat(64);
    const hashResult = await directCommit({
      session_id: initial.session_id,
      expected_token: committed2.commit_token,
      proposed_session: hashSwap
    });
    await check("production artifact hash cannot be rebound", () => {
      assert(hashResult.data?.status === "AUTHORITY_MISMATCH", JSON.stringify(hashResult));
    });
    const reviewSwap = clone(reviewSession);
    reviewSwap.pinned_case.review_execution_hash = "9".repeat(64);
    const reviewSwapResult = await directCommit({
      session_id: reviewSession.session_id,
      expected_token: createSessionCommitToken(reviewSession),
      proposed_session: reviewSwap
    });
    await check("review artifact hash cannot be rebound", () => {
      assert(reviewSwapResult.data?.status === "AUTHORITY_MISMATCH", JSON.stringify(reviewSwapResult));
    });
    const reviewAuthoritySwap = clone(reviewSession);
    reviewAuthoritySwap.pinned_case.execution_authority = "PUBLISHED_PRODUCTION";
    const reviewAuthorityResult = await directCommit({
      session_id: reviewSession.session_id,
      expected_token: createSessionCommitToken(reviewSession),
      proposed_session: reviewAuthoritySwap
    });
    await check("REVIEW_ONLY Session cannot become PUBLISHED_PRODUCTION", () => {
      assert(reviewAuthorityResult.data?.status === "AUTHORITY_MISMATCH", JSON.stringify(reviewAuthorityResult));
    });

    const notFound = await adapter.load("session.synthetic.missing");
    await check("missing persistent Session returns typed not-found", () => {
      assert(!notFound.success && notFound.issues[0]?.code === "SESSION_NOT_FOUND", JSON.stringify(notFound));
    });
    await check("trusted backend service role can load and commit", async () => {
      const result = await service.query("select current_user, public.load_authoritative_session_v2_012a($1)->>'status' as status", [initial.session_id]);
      assert(result.rows[0].current_user === "service_role" && result.rows[0].status === "LOADED", JSON.stringify(result.rows[0]));
    });
    await check("RLS remains forced on all authoritative Session tables", async () => {
      const result = await full.query(`
        select count(*)::int as count
        from pg_class join pg_namespace on pg_namespace.oid = pg_class.relnamespace
        where nspname = 'public' and relname in (
          'simulation_sessions','session_events','session_commands','patient_state_checkpoints'
        ) and relrowsecurity and relforcerowsecurity
      `);
      assert(result.rows[0].count === 4, JSON.stringify(result.rows[0]));
    });
    await check("raw authenticated client Session writes remain denied", async () => {
      let error;
      await full.query("begin");
      try {
        await full.query("set local role authenticated");
        await full.query("update public.simulation_sessions set next_event_sequence = 99 where session_id = 'session.synthetic.001'");
      } catch (caught) {
        error = caught;
      } finally {
        await full.query("rollback");
      }
      assert(error?.code === "42501", `Expected 42501, got ${error?.code}`);
    });
    await check("migration contains row lock and no database clinical timer", async () => {
      const sql = migrations.at(-1).sql;
      assert(/for update/i.test(sql), "row lock missing");
      assert(!/pg_cron|create\s+extension|set_interval|scheduler.*execute/i.test(sql), "database clinical timer detected");
    });
    await check("SQL transaction mechanism contains no disease or medical rules", async () => {
      const sql = migrations.at(-1).sql;
      assert(!/stemi|anaphyl|aspirin|medication_effect|hemodynamic_state\s*=|cardiac_rhythm\s*=/i.test(sql), "medical logic detected in SQL");
    });
    await check("production adapter has no Node, Deno, browser, or provider import", async () => {
      const source = await readFile(join(V2_ROOT, "packages", "session-engine", "src", "adapters", "postgres", "postgres-session-adapter.ts"), "utf8");
      assert(!/from\s+["'](?:node:|fs["']|path["']|embedded-postgres|@supabase|openai|@azure)|\bDeno\.|\bwindow\.|\bdocument\./i.test(source), "runtime-specific production dependency detected");
    });
    await check("no service credential or remote Supabase configuration is present", async () => {
      const changedSources = [
        migrations.at(-1).sql,
        await readFile(join(V2_ROOT, "packages", "session-engine", "src", "adapters", "postgres", "postgres-session-adapter.ts"), "utf8")
      ].join("\n");
      assert(!/service_role_key|supabase_service|https:\/\/.*supabase\.co|eyJ[A-Za-z0-9_-]{20,}/i.test(changedSources), "credential or remote project detected");
    });
  } finally {
    for (const client of [service, full, reset, admin]) {
      if (client) await client.end().catch(() => undefined);
    }
    await postgres.stop().catch(() => undefined);
  }

  process.stdout.write(`V2-012A native PostgreSQL atomic persistence tests: ${passed} passed, 0 failed\n`);
}

await main();
