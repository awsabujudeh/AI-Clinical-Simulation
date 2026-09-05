import EmbeddedPostgres from "embedded-postgres";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  InMemorySessionAggregateSchema,
  POSTGRES_SESSION_COMMIT_FUNCTION,
  POSTGRES_SESSION_LOAD_FUNCTION,
  PostgresSessionCommitAdapter,
  createSessionCommitToken,
  createSessionCoordinator,
  initializeReviewInMemorySession,
  processExternalLearnerCommand
} from "../packages/session-engine/src/index.ts";
import { canonicalSerialize } from "../packages/case-schema/src/index.ts";
import {
  createCoordinatorContext,
  createSyntheticCommandSession,
  createSyntheticExternalCommand,
  TEST_REAL_TIME_UTC
} from "../tests/fixtures/session-engine/synthetic-command.ts";
import {
  DELAYED_TRANSITION_RULE
} from "../tests/fixtures/clinical-engine/synthetic-transitions.ts";
import {
  STEMI_PORTABILITY_SNAPSHOT_SHA256,
  prepareStemiReviewArtifact
} from "../tests/fixtures/cases/stemi-review.ts";
import { TEST_HASH_ADAPTER } from "../tests/fixtures/cases/synthetic-case.ts";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const V2_ROOT = resolve(SCRIPT_DIR, "..");
const MIGRATION_DIR = join(V2_ROOT, "supabase", "migrations");
const DATABASE_NAME = "v2_012b_durability";
const JU_USER = "11111111-1111-4111-8111-111111111111";
const JUST_USER = "22222222-2222-4222-8222-222222222222";
const JU_MEMBERSHIP = "membership.synthetic.persistence";
const JUST_MEMBERSHIP = "membership.synthetic.just.persistence";
const REVIEW_SUBJECT = "b".repeat(64);
const JU_PACKAGE_HASH = "a".repeat(64);
const JUST_PACKAGE_HASH = "c".repeat(64);
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

function clone(value) {
  return structuredClone(value);
}

function same(left, right) {
  return canonicalSerialize(left) === canonicalSerialize(right);
}

function requireSuccess(result, label) {
  if (!result.success) throw new Error(`${label}: ${JSON.stringify(result.issues)}`);
  return result;
}

function failureCode(result) {
  return result.success ? undefined : result.issues[0]?.code;
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

async function seedPrincipal(client, input) {
  await client.query("insert into auth.users (id) values ($1)", [input.userId]);
  await client.query(
    "insert into public.profiles (user_id, display_alias, preferred_locale) values ($1, $2, 'en-US')",
    [input.userId, input.alias]
  );
  await client.query(`
    insert into public.institution_memberships (
      membership_id, institution_id, user_id, membership_role, membership_status
    ) values ($1, $2, $3, 'LEARNER', 'ACTIVE')
  `, [input.membershipId, input.institutionId, input.userId]);
}

async function seedProductionAuthority(client, input) {
  const authoring = {
    manifest: {
      case_id: input.caseId,
      case_version_id: input.caseVersionId,
      case_package_id: input.casePackageId,
      case_version: "2.0.0",
      schema_version: "2.0",
      status: "APPROVED"
    }
  };
  await client.query(`
    insert into public.clinical_cases (
      case_id, institution_id, case_slug, title, topic_code, owner_membership_id
    ) values ($1, $2, $3, $4, 'topic.synthetic', $5)
  `, [input.caseId, input.institutionId, input.slug, input.title, input.membershipId]);
  await client.query(`
    insert into public.case_versions (
      case_version_id, case_id, institution_id, case_package_id,
      semantic_version, case_schema_version, lifecycle_status,
      review_subject_hash, publication_candidate_hash, authored_case_payload,
      created_by_membership_id
    ) values ($1, $2, $3, $4, '2.0.0', '2.0', 'APPROVED',
      $5, $6, $7::jsonb, $8)
  `, [
    input.caseVersionId,
    input.caseId,
    input.institutionId,
    input.casePackageId,
    REVIEW_SUBJECT,
    input.packageHash,
    JSON.stringify(authoring),
    input.membershipId
  ]);
  await client.query(`
    insert into public.case_approvals (
      approval_id, institution_id, case_version_id, case_package_id,
      approved_case_version, approved_package_hash, review_subject_hash,
      approval_scope, approval_status, approver_ref_id,
      approver_membership_id, approver_role_code, approved_at, approval_payload
    ) values ($1, $2, $3, $4, '2.0.0', $5, $6,
      'CASE_PACKAGE_PUBLICATION', 'APPROVED', $7, $8, 'role.synthetic',
      '2026-09-01T00:00:00Z', '{}'::jsonb)
  `, [
    input.approvalId,
    input.institutionId,
    input.caseVersionId,
    input.casePackageId,
    input.packageHash,
    REVIEW_SUBJECT,
    input.approverRef,
    input.membershipId
  ]);
  const packagePayload = {
    package_hash: input.packageHash,
    manifest: {
      case_package_id: input.casePackageId,
      case_version_id: input.caseVersionId,
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
    ) values ($1, $2, $3, '2.0.0', '2.0', $4, $5, $6, 'APPROVED',
      'PUBLISHED_PRODUCTION', 'PUBLISHED', '{}'::jsonb, $7::jsonb,
      '2026-09-01T00:00:00Z')
  `, [
    input.casePackageId,
    input.institutionId,
    input.caseVersionId,
    input.packageHash,
    REVIEW_SUBJECT,
    input.approvalId,
    JSON.stringify(packagePayload)
  ]);
}

async function seedReviewAuthority(client, reviewArtifact) {
  await client.query(`
    insert into public.clinical_cases (
      case_id, institution_id, case_slug, title, topic_code, owner_membership_id
    ) values ('case.stemi.inferior-rv.001', 'ju', 'stemi-review-structural',
      'STEMI review structural fixture', 'topic.review-only', $1)
  `, [JU_MEMBERSHIP]);
  await client.query(`
    insert into public.case_versions (
      case_version_id, case_id, institution_id, case_package_id,
      semantic_version, case_schema_version, lifecycle_status,
      review_subject_hash, authored_case_payload, created_by_membership_id
    ) values ($1, 'case.stemi.inferior-rv.001', 'ju', $2, $3, '2.0',
      'UNDER_REVIEW', $4, $5::jsonb, $6)
  `, [
    reviewArtifact.source_identity.case_version_id,
    reviewArtifact.source_identity.case_package_id,
    reviewArtifact.source_identity.case_version,
    reviewArtifact.review_subject_hash,
    JSON.stringify(reviewArtifact.source_case),
    JU_MEMBERSHIP
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

async function seedGovernance(client, reviewArtifact) {
  await seedPrincipal(client, {
    userId: JU_USER,
    membershipId: JU_MEMBERSHIP,
    institutionId: "ju",
    alias: "Synthetic JU persistence learner"
  });
  await seedPrincipal(client, {
    userId: JUST_USER,
    membershipId: JUST_MEMBERSHIP,
    institutionId: "just",
    alias: "Synthetic JUST persistence learner"
  });
  await seedProductionAuthority(client, {
    institutionId: "ju",
    membershipId: JU_MEMBERSHIP,
    caseId: "case.synthetic.001",
    caseVersionId: "case-version.synthetic.001",
    casePackageId: "case-package.synthetic.001",
    packageHash: JU_PACKAGE_HASH,
    approvalId: "approval.synthetic.persistence",
    approverRef: "approver.synthetic.persistence",
    slug: "synthetic-persistence",
    title: "Synthetic JU persistence Case"
  });
  await seedProductionAuthority(client, {
    institutionId: "just",
    membershipId: JUST_MEMBERSHIP,
    caseId: "case.synthetic.just.001",
    caseVersionId: "case-version.synthetic.just.001",
    casePackageId: "case-package.synthetic.just.001",
    packageHash: JUST_PACKAGE_HASH,
    approvalId: "approval.synthetic.just.persistence",
    approverRef: "approver.synthetic.just.persistence",
    slug: "synthetic-just-persistence",
    title: "Synthetic JUST persistence Case"
  });
  await seedReviewAuthority(client, reviewArtifact);
}

function productionSession(sessionId, input = {}) {
  const session = clone(createSyntheticCommandSession({
    rules: input.rules ?? [],
    trustedRealTimeUtc: input.trustedRealTimeUtc ?? TEST_REAL_TIME_UTC
  }));
  session.session_id = sessionId;
  session.patient_state.session_id = sessionId;
  if (input.institutionId === "just") {
    session.pinned_case.case_package_id = "case-package.synthetic.just.001";
    session.pinned_case.case_version_id = "case-version.synthetic.just.001";
    session.pinned_case.package_hash = JUST_PACKAGE_HASH;
    session.pinned_case.clinical_policy.case_package_id =
      "case-package.synthetic.just.001";
    session.pinned_case.clinical_policy.case_version_id =
      "case-version.synthetic.just.001";
    session.pinned_case.clinical_policy.package_hash = JUST_PACKAGE_HASH;
  }
  return InMemorySessionAggregateSchema.parse(session);
}

async function insertSession(client, aggregate, institutionId = "ju") {
  const pinned = aggregate.pinned_case;
  const userId = institutionId === "just" ? JUST_USER : JU_USER;
  const membershipId = institutionId === "just" ? JUST_MEMBERSHIP : JU_MEMBERSHIP;
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
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
      $15, $16, $17, $18, $19, $20::jsonb, $21::jsonb, $22::jsonb, $23::jsonb
    )
  `, [
    aggregate.session_id,
    institutionId,
    userId,
    membershipId,
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

function commandFor(session, suffix, overrides = {}) {
  return createSyntheticExternalCommand(session, {
    idempotencyKey: overrides.idempotencyKey ?? `idempotency.synthetic.${suffix}`,
    commandId: overrides.commandId ?? `command.synthetic.${suffix}`,
    actionRequestId: overrides.actionRequestId ?? `action-request.synthetic.${suffix}`,
    requestId: overrides.requestId ?? `request.synthetic.${suffix}`,
    correlationId: overrides.correlationId ?? `correlation.synthetic.${suffix}`,
    parameters: overrides.parameters ?? {},
    ...(overrides.expectedStateVersion === undefined
      ? {}
      : { expectedStateVersion: overrides.expectedStateVersion })
  });
}

const EVENT_ID_FACTORY = Object.freeze({
  createEventId(input) {
    const digest = createHash("sha256")
      .update(canonicalSerialize(input))
      .digest("hex")
      .slice(0, 32)
      .split("");
    digest[12] = "4";
    digest[16] = "8";
    const value = digest.join("");
    return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
  }
});

function commandDependencies() {
  return {
    hash_adapter: TEST_HASH_ADAPTER,
    event_id_factory: EVENT_ID_FACTORY,
    real_time_utc: TEST_REAL_TIME_UTC
  };
}

async function computeCommand(session, command, label) {
  return requireSuccess(await processExternalLearnerCommand(
    session,
    command,
    commandDependencies()
  ), label);
}

class NativePostgresRpcClient {
  constructor(client, commitBarrier) {
    this.client = client;
    this.commitBarrier = commitBarrier;
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
        if (this.commitBarrier) await this.commitBarrier.arrive();
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

class CommitBarrier {
  constructor(expected) {
    this.expected = expected;
    this.arrived = 0;
    this.release = undefined;
    this.promise = new Promise((resolvePromise) => {
      this.release = resolvePromise;
    });
  }

  async arrive() {
    this.arrived += 1;
    if (this.arrived === this.expected) this.release();
    await Promise.race([
      this.promise,
      new Promise((_, rejectPromise) => setTimeout(
        () => rejectPromise(new Error(`Commit barrier timed out at ${this.arrived}/${this.expected}.`)),
        15_000
      ))
    ]);
  }
}

async function openClient(postgres, role = "service_role") {
  const client = postgres.getPgClient(DATABASE_NAME);
  await client.connect();
  if (role) await client.query(`set role ${role}`);
  return client;
}

async function closeClients(clients) {
  await Promise.all(clients.map((client) => client.end().catch(() => undefined)));
}

function coordinatorFor(client, barrier) {
  return createSessionCoordinator({
    adapter: new PostgresSessionCommitAdapter(new NativePostgresRpcClient(client, barrier)),
    hash_adapter: TEST_HASH_ADAPTER,
    event_id_factory: EVENT_ID_FACTORY
  });
}

async function coordinatorRace(postgres, session, commands) {
  const barrier = new CommitBarrier(commands.length);
  const clients = await Promise.all(commands.map(() => openClient(postgres)));
  try {
    return await Promise.all(commands.map((command, index) =>
      coordinatorFor(clients[index], barrier).submitExternalClinicalCommand({
        ...createCoordinatorContext(session, TEST_REAL_TIME_UTC, `race-${index}`),
        command
      })
    ));
  } finally {
    await closeClients(clients);
  }
}

async function syncRace(postgres, session, trustedTimes) {
  const barrier = new CommitBarrier(trustedTimes.length);
  const clients = await Promise.all(trustedTimes.map(() => openClient(postgres)));
  try {
    return await Promise.all(trustedTimes.map((trustedTime, index) =>
      coordinatorFor(clients[index], barrier).syncRunningSession(
        createCoordinatorContext(session, trustedTime, `sync-race-${index}`)
      )
    ));
  } finally {
    await closeClients(clients);
  }
}

async function durableCounts(client, sessionId) {
  const result = await client.query(`
    select
      (select count(*)::int from public.session_events where session_id = $1) as events,
      (select count(*)::int from public.session_commands where session_id = $1) as commands,
      (select count(*)::int from public.patient_state_checkpoints where session_id = $1) as checkpoints,
      (select next_event_sequence::int from public.simulation_sessions where session_id = $1) as next_sequence,
      (select patient_state_version::int from public.simulation_sessions where session_id = $1) as state_version,
      (select clinical_time_seconds::float8 from public.simulation_sessions where session_id = $1) as clinical_time
  `, [sessionId]);
  return result.rows[0];
}

async function loadWithFreshAdapter(postgres, sessionId) {
  const client = await openClient(postgres);
  try {
    const adapter = new PostgresSessionCommitAdapter(new NativePostgresRpcClient(client));
    return await adapter.load(sessionId);
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function waitForLock(admin, pid) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const result = await admin.query(`
      select wait_event_type, wait_event
      from pg_catalog.pg_stat_activity
      where pid = $1
    `, [pid]);
    if (result.rows[0]?.wait_event_type === "Lock") return result.rows[0];
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 10));
  }
  throw new Error(`Backend ${pid} did not enter a PostgreSQL lock wait.`);
}

async function disableUserTriggers(client, table, action) {
  await client.query(`alter table public.${table} disable trigger user`);
  try {
    await action();
  } finally {
    await client.query(`alter table public.${table} enable trigger user`);
  }
}

async function directCommit(client, request) {
  return new NativePostgresRpcClient(client).rpc(
    POSTGRES_SESSION_COMMIT_FUNCTION,
    { p_request: request }
  );
}

async function commitOne(adapter, session, command, label) {
  const computed = await computeCommand(session, command, `${label} computation`);
  return requireSuccess(await adapter.commit({
    session_id: session.session_id,
    expected_token: createSessionCommitToken(session),
    proposed_session: computed.authoritative_session
  }), `${label} persistence`);
}

async function seedCommittedSession(postgres, full, sessionId) {
  const initial = productionSession(sessionId);
  await insertSession(full, initial);
  const client = await openClient(postgres);
  try {
    const adapter = new PostgresSessionCommitAdapter(new NativePostgresRpcClient(client));
    const command = commandFor(initial, `${sessionId}.seed`);
    const committed = await commitOne(adapter, initial, command, `${sessionId} seed`);
    return { initial, command, committed };
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function main() {
  const migrations = await loadMigrations();
  assert(migrations.at(-1)?.name === "202609040005_v2_012a_atomic_session_commit.sql",
    "V2-012B must not add or rewrite a migration.");
  const port = await findFreePort();
  const databaseDir = await mkdtemp(join(tmpdir(), "v2-012b-native-postgres-"));
  const postgres = new EmbeddedPostgres({
    databaseDir,
    user: "postgres",
    password: "local-durability-test",
    port,
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
    persistent: false,
    onLog: () => undefined,
    onError: () => undefined
  });

  let admin;
  let full;
  try {
    await postgres.initialise();
    await postgres.start();
    admin = postgres.getPgClient();
    await admin.connect();
    await bootstrapCluster(admin);
    await postgres.createDatabase(DATABASE_NAME);
    full = postgres.getPgClient(DATABASE_NAME);
    await full.connect();
    await bootstrapAuth(full);
    await applyMigrations(full, migrations);
    const reviewArtifact = await prepareStemiReviewArtifact();
    await seedGovernance(full, reviewArtifact);

    await check("real native PostgreSQL 16.14 is the concurrency authority", async () => {
      const result = await full.query("select version() as version");
      assert(result.rows[0].version.startsWith("PostgreSQL 16.14"), result.rows[0].version);
    });
    await check("PostgreSQL default transaction isolation is READ COMMITTED", async () => {
      const result = await full.query("show transaction_isolation");
      assert(result.rows[0].transaction_isolation === "read committed", JSON.stringify(result.rows[0]));
    });
    await check("V2-012B uses the committed V2-012A migration tail", () => {
      assert(migrations.length === 5, `Expected 5 migrations, got ${migrations.length}.`);
    });

    const differentBase = productionSession("session.synthetic.race-different");
    await insertSession(full, differentBase);
    const differentCommands = Array.from({ length: 8 }, (_, index) =>
      commandFor(differentBase, `race-different-${index}`));
    const differentResults = await coordinatorRace(postgres, differentBase, differentCommands);
    const differentWinnerCount = differentResults.filter((result) =>
      result.success && result.status === "COMMITTED").length;
    const differentLosers = differentResults.filter((result) => !result.success);
    await check("different-key same-base race has exactly one winner", () => {
      assert(differentWinnerCount === 1, JSON.stringify(differentResults));
    });
    await check("different-key race losers are typed stale conflicts", () => {
      assert(differentLosers.length === 7
        && differentLosers.every((result) => failureCode(result) === "SESSION_VERSION_CONFLICT"),
      JSON.stringify(differentResults));
    });
    await check("different-key losers persist no Events or replay records", async () => {
      const counts = await durableCounts(full, differentBase.session_id);
      assert(counts.events === 1 && counts.commands === 1 && counts.checkpoints === 1,
        JSON.stringify(counts));
    });
    await check("different-key race leaves a gap-free winner sequence", async () => {
      const loaded = requireSuccess(await loadWithFreshAdapter(postgres, differentBase.session_id), "different-key load");
      assert(loaded.session.next_sequence_no === 2
        && loaded.session.committed_events[0]?.sequence_no === 1,
      JSON.stringify(loaded.session));
    });

    const stressBase = productionSession("session.synthetic.race-stress-32");
    await insertSession(full, stressBase);
    const stressCommands = Array.from({ length: 32 }, (_, index) =>
      commandFor(stressBase, `stress-${String(index).padStart(2, "0")}`));
    const stressResults = await coordinatorRace(postgres, stressBase, stressCommands);
    await check("32-contender native PostgreSQL race has exactly one winner", () => {
      assert(stressResults.filter((result) => result.success && result.status === "COMMITTED").length === 1,
        JSON.stringify(stressResults));
    });
    await check("31 stress losers are stale conflicts with zero durable suffix", async () => {
      const losers = stressResults.filter((result) => !result.success);
      const counts = await durableCounts(full, stressBase.session_id);
      assert(losers.length === 31
        && losers.every((result) => failureCode(result) === "SESSION_VERSION_CONFLICT")
        && counts.events === 1 && counts.commands === 1 && counts.checkpoints === 1,
      JSON.stringify({ losers: losers.map(failureCode), counts }));
    });

    const sameRequestBase = productionSession("session.synthetic.race-same-request");
    await insertSession(full, sameRequestBase);
    const sameRequest = commandFor(sameRequestBase, "same-request");
    const sameRequestResults = await coordinatorRace(
      postgres,
      sameRequestBase,
      Array.from({ length: 8 }, () => sameRequest)
    );
    await check("same-key same-request race commits clinically once", () => {
      assert(sameRequestResults.filter((result) =>
        result.success && result.status === "COMMITTED").length === 1,
      JSON.stringify(sameRequestResults));
    });
    await check("same-key same-request losers resolve as durable replay", () => {
      assert(sameRequestResults.filter((result) =>
        result.success && result.status === "REPLAYED").length === 7,
      JSON.stringify(sameRequestResults));
    });
    await check("same-request race creates one Event, replay, and checkpoint", async () => {
      const counts = await durableCounts(full, sameRequestBase.session_id);
      assert(counts.events === 1 && counts.commands === 1
        && counts.checkpoints === 1 && counts.next_sequence === 2,
      JSON.stringify(counts));
    });

    const conflictingBase = productionSession("session.synthetic.race-conflicting-request");
    await insertSession(full, conflictingBase);
    const conflictingCommands = Array.from({ length: 8 }, (_, index) => commandFor(
      conflictingBase,
      `conflicting-${index}`,
      {
        idempotencyKey: "idempotency.synthetic.shared-conflict"
      }
    ));
    const conflictingResults = await coordinatorRace(postgres, conflictingBase, conflictingCommands);
    await check("same-key different-request race has one durable canonical identity", () => {
      assert(conflictingResults.filter((result) =>
        result.success && result.status === "COMMITTED").length === 1,
      JSON.stringify(conflictingResults));
    });
    await check("incompatible same-key contenders fail as idempotency conflicts", () => {
      const losers = conflictingResults.filter((result) => !result.success);
      assert(losers.length === 7
        && losers.every((result) => failureCode(result) === "IDEMPOTENCY_CONFLICT"),
      JSON.stringify(conflictingResults));
    });
    await check("same-key conflict never overwrites or duplicates durable identity", async () => {
      const loaded = requireSuccess(await loadWithFreshAdapter(postgres, conflictingBase.session_id), "conflicting load");
      assert(loaded.session.idempotency_records.length === 1
        && loaded.session.committed_events.length === 1,
      JSON.stringify(loaded.session));
    });

    const retryNewBase = productionSession("session.synthetic.retry-vs-new");
    await insertSession(full, retryNewBase);
    const retrySeedClient = await openClient(postgres);
    const retrySeedAdapter = new PostgresSessionCommitAdapter(new NativePostgresRpcClient(retrySeedClient));
    const retryCommand = commandFor(retryNewBase, "retry-vs-new-seed");
    const retrySeed = await commitOne(retrySeedAdapter, retryNewBase, retryCommand, "retry-vs-new seed");
    await retrySeedClient.end();
    const retryClient = await openClient(postgres);
    const newClient = await openClient(postgres);
    try {
      const retryCoordinator = coordinatorFor(retryClient);
      const newCoordinator = coordinatorFor(newClient);
      const newCommand = commandFor(retrySeed.session, "retry-vs-new-next");
      const [replayResult, newResult] = await Promise.all([
        retryCoordinator.submitExternalClinicalCommand({
          ...createCoordinatorContext(retrySeed.session, TEST_REAL_TIME_UTC, "retry-vs-new-replay"),
          command: retryCommand
        }),
        newCoordinator.submitExternalClinicalCommand({
          ...createCoordinatorContext(retrySeed.session, TEST_REAL_TIME_UTC, "retry-vs-new-command"),
          command: newCommand
        })
      ]);
      await check("retry versus new command returns one replay and one commit", () => {
        assert(replayResult.success && replayResult.status === "REPLAYED"
          && newResult.success && newResult.status === "COMMITTED",
        JSON.stringify({ replayResult, newResult }));
      });
      await check("retry versus new command advances only the new command", async () => {
        const counts = await durableCounts(full, retryNewBase.session_id);
        assert(counts.events === 2 && counts.commands === 2
          && counts.checkpoints === 2 && counts.next_sequence === 3,
        JSON.stringify(counts));
      });
    } finally {
      await closeClients([retryClient, newClient]);
    }

    const staleBase = productionSession("session.synthetic.stale-loaded");
    await insertSession(full, staleBase);
    const staleClientA = await openClient(postgres);
    const staleClientB = await openClient(postgres);
    try {
      const adapterA = new PostgresSessionCommitAdapter(new NativePostgresRpcClient(staleClientA));
      const adapterB = new PostgresSessionCommitAdapter(new NativePostgresRpcClient(staleClientB));
      const loadedA = requireSuccess(await adapterA.load(staleBase.session_id), "stale reader A");
      const loadedB = requireSuccess(await adapterB.load(staleBase.session_id), "stale reader B");
      const commandA = commandFor(loadedA.session, "stale-winner");
      const commandB = commandFor(loadedB.session, "stale-loser");
      const proposalA = await computeCommand(loadedA.session, commandA, "stale A");
      const proposalB = await computeCommand(loadedB.session, commandB, "stale B");
      requireSuccess(await adapterA.commit({
        session_id: staleBase.session_id,
        expected_token: loadedA.commit_token,
        proposed_session: proposalA.authoritative_session
      }), "stale winner commit");
      const staleLoser = await adapterB.commit({
        session_id: staleBase.session_id,
        expected_token: loadedB.commit_token,
        proposed_session: proposalB.authoritative_session
      });
      await check("stale loaded writer fails closed without recomputation", () => {
        assert(failureCode(staleLoser) === "SESSION_VERSION_CONFLICT", JSON.stringify(staleLoser));
      });
      await check("stale loaded writer persists no suffix", async () => {
        const counts = await durableCounts(full, staleBase.session_id);
        assert(counts.events === 1 && counts.commands === 1 && counts.next_sequence === 2,
          JSON.stringify(counts));
      });
    } finally {
      await closeClients([staleClientA, staleClientB]);
    }

    const lockBase = productionSession("session.synthetic.lock-proof");
    await insertSession(full, lockBase);
    const lockWinnerCommand = commandFor(lockBase, "lock-winner");
    const lockLoserCommand = commandFor(lockBase, "lock-loser");
    const lockWinnerProposal = await computeCommand(lockBase, lockWinnerCommand, "lock winner");
    const lockLoserProposal = await computeCommand(lockBase, lockLoserCommand, "lock loser");
    const lockWinnerClient = await openClient(postgres);
    const lockLoserClient = await openClient(postgres);
    try {
      await lockWinnerClient.query("begin");
      const uncommittedWinner = await directCommit(lockWinnerClient, {
        session_id: lockBase.session_id,
        expected_token: createSessionCommitToken(lockBase),
        proposed_session: lockWinnerProposal.authoritative_session
      });
      assert(uncommittedWinner.data?.status === "COMMITTED", JSON.stringify(uncommittedWinner));
      const lockLoserAdapter = new PostgresSessionCommitAdapter(
        new NativePostgresRpcClient(lockLoserClient)
      );
      const waitingCommit = lockLoserAdapter.commit({
        session_id: lockBase.session_id,
        expected_token: createSessionCommitToken(lockBase),
        proposed_session: lockLoserProposal.authoritative_session
      });
      const waitState = await waitForLock(full, lockLoserClient.processID);
      await check("independent loser connection blocks on the Session row lock", () => {
        assert(waitState.wait_event_type === "Lock", JSON.stringify(waitState));
      });
      await lockWinnerClient.query("commit");
      const serializedLoser = await waitingCommit;
      await check("CAS evaluates after lock wakeup and rejects the stale loser", () => {
        assert(failureCode(serializedLoser) === "SESSION_VERSION_CONFLICT",
          JSON.stringify(serializedLoser));
      });
      await check("row-lock serialization leaves only the winner durable", async () => {
        const counts = await durableCounts(full, lockBase.session_id);
        assert(counts.events === 1 && counts.commands === 1 && counts.checkpoints === 1,
          JSON.stringify(counts));
      });
    } finally {
      await lockWinnerClient.query("rollback").catch(() => undefined);
      await closeClients([lockWinnerClient, lockLoserClient]);
    }

    const timeoutBase = productionSession("session.synthetic.lock-timeout");
    await insertSession(full, timeoutBase);
    const timeoutCommand = commandFor(timeoutBase, "lock-timeout");
    const timeoutProposal = await computeCommand(timeoutBase, timeoutCommand, "timeout");
    const timeoutLocker = await openClient(postgres);
    const timeoutWaiter = await openClient(postgres);
    try {
      await timeoutLocker.query("begin");
      await timeoutLocker.query(
        "select session_id from public.simulation_sessions where session_id = $1 for update",
        [timeoutBase.session_id]
      );
      await timeoutWaiter.query("set lock_timeout = '100ms'");
      const timeoutAdapter = new PostgresSessionCommitAdapter(
        new NativePostgresRpcClient(timeoutWaiter)
      );
      const timeoutResult = await timeoutAdapter.commit({
        session_id: timeoutBase.session_id,
        expected_token: createSessionCommitToken(timeoutBase),
        proposed_session: timeoutProposal.authoritative_session
      });
      await check("lock timeout maps to typed persistence failure", () => {
        assert(failureCode(timeoutResult) === "SESSION_PERSISTENCE_FAILURE",
          JSON.stringify(timeoutResult));
      });
      await timeoutLocker.query("rollback");
      await check("lock timeout commits no partial Session data", async () => {
        const counts = await durableCounts(full, timeoutBase.session_id);
        assert(counts.events === 0 && counts.commands === 0
          && counts.checkpoints === 0 && counts.next_sequence === 1,
        JSON.stringify(counts));
      });
    } finally {
      await timeoutLocker.query("rollback").catch(() => undefined);
      await closeClients([timeoutLocker, timeoutWaiter]);
    }

    const beforeDbBase = productionSession("session.synthetic.crash-before-db");
    await insertSession(full, beforeDbBase);
    const beforeDbCommand = commandFor(beforeDbBase, "crash-before-db");
    await computeCommand(beforeDbBase, beforeDbCommand, "pre-DB crash computation");
    await check("application crash before DB call persists nothing", async () => {
      const counts = await durableCounts(full, beforeDbBase.session_id);
      assert(counts.events === 0 && counts.commands === 0
        && counts.checkpoints === 0 && counts.next_sequence === 1,
      JSON.stringify(counts));
    });

    const terminatedBase = productionSession("session.synthetic.crash-precommit");
    await insertSession(full, terminatedBase);
    const terminatedCommand = commandFor(terminatedBase, "crash-precommit");
    const terminatedProposal = await computeCommand(terminatedBase, terminatedCommand, "terminated transaction");
    const terminatedClient = await openClient(postgres);
    await terminatedClient.query("begin");
    const uncommitted = await directCommit(terminatedClient, {
      session_id: terminatedBase.session_id,
      expected_token: createSessionCommitToken(terminatedBase),
      proposed_session: terminatedProposal.authoritative_session
    });
    assert(uncommitted.data?.status === "COMMITTED", JSON.stringify(uncommitted));
    const terminatedPid = terminatedClient.processID;
    const terminated = await admin.query("select pg_terminate_backend($1) as terminated", [terminatedPid]);
    await check("native PostgreSQL backend is terminated before COMMIT", () => {
      assert(terminated.rows[0].terminated === true, JSON.stringify(terminated.rows[0]));
    });
    await terminatedClient.end().catch(() => undefined);
    await check("terminated pre-commit backend rolls back every write", async () => {
      const counts = await durableCounts(full, terminatedBase.session_id);
      assert(counts.events === 0 && counts.commands === 0
        && counts.checkpoints === 0 && counts.next_sequence === 1,
      JSON.stringify(counts));
    });

    const lostResponseBase = productionSession("session.synthetic.lost-response");
    await insertSession(full, lostResponseBase);
    const lostCommand = commandFor(lostResponseBase, "lost-response");
    const lostClient = await openClient(postgres);
    const lostAdapter = new PostgresSessionCommitAdapter(new NativePostgresRpcClient(lostClient));
    const durableLostResult = await commitOne(lostAdapter, lostResponseBase, lostCommand, "lost response");
    await lostClient.end();
    const beforeLostRetry = await durableCounts(full, lostResponseBase.session_id);
    const lostRetryClient = await openClient(postgres);
    try {
      let eventFactoryCalls = 0;
      const lostCoordinator = createSessionCoordinator({
        adapter: new PostgresSessionCommitAdapter(new NativePostgresRpcClient(lostRetryClient)),
        hash_adapter: TEST_HASH_ADAPTER,
        event_id_factory: {
          createEventId() {
            eventFactoryCalls += 1;
            throw new Error("Durable replay must not allocate an Event ID.");
          }
        }
      });
      const replay = await lostCoordinator.submitExternalClinicalCommand({
        ...createCoordinatorContext(durableLostResult.session, TEST_REAL_TIME_UTC, "lost-response-retry"),
        command: lostCommand
      });
      await check("discarded post-commit response is recovered as durable replay", () => {
        assert(replay.success && replay.status === "REPLAYED" && eventFactoryCalls === 0,
          JSON.stringify(replay));
      });
      await check("lost-response retry produces zero duplicate mutation", async () => {
        const after = await durableCounts(full, lostResponseBase.session_id);
        assert(same(beforeLostRetry, after), JSON.stringify({ beforeLostRetry, after }));
      });
    } finally {
      await lostRetryClient.end().catch(() => undefined);
    }

    const restartBase = productionSession("session.synthetic.restart");
    await insertSession(full, restartBase);
    let restartExpected = restartBase;
    for (let cycle = 1; cycle <= 10; cycle += 1) {
      const client = await openClient(postgres);
      const adapter = new PostgresSessionCommitAdapter(new NativePostgresRpcClient(client));
      const loaded = requireSuccess(await adapter.load(restartBase.session_id), `restart load ${cycle}`);
      assert(same(loaded.session, restartExpected), `Restart cycle ${cycle} rehydration drift.`);
      const command = commandFor(loaded.session, `restart-${cycle}`);
      const committed = await commitOne(adapter, loaded.session, command, `restart cycle ${cycle}`);
      restartExpected = committed.session;
      await client.end();
    }
    await check("10 adapter/process restart cycles rehydrate exactly", async () => {
      const loaded = requireSuccess(await loadWithFreshAdapter(postgres, restartBase.session_id), "final restart load");
      assert(same(loaded.session, restartExpected), "Final restart aggregate drifted.");
    });
    await check("restart cycles preserve sequence and replay history", async () => {
      const counts = await durableCounts(full, restartBase.session_id);
      assert(counts.events === 10 && counts.commands === 10
        && counts.checkpoints === 10 && counts.next_sequence === 11,
      JSON.stringify(counts));
    });

    const eventCorrupt = await seedCommittedSession(
      postgres,
      full,
      "session.synthetic.corrupt-event"
    );
    await disableUserTriggers(full, "session_events", async () => {
      await full.query(`
        update public.session_events
        set envelope_payload = jsonb_set(envelope_payload, '{payload,corrupted}', 'true'::jsonb)
        where session_id = $1
      `, [eventCorrupt.initial.session_id]);
    });
    const eventCorruptLoad = await loadWithFreshAdapter(postgres, eventCorrupt.initial.session_id);
    await check("durable Event corruption fails closed", () => {
      assert(failureCode(eventCorruptLoad) === "SESSION_PERSISTENCE_FAILURE",
        JSON.stringify(eventCorruptLoad));
    });

    const checkpointCorrupt = await seedCommittedSession(
      postgres,
      full,
      "session.synthetic.corrupt-checkpoint"
    );
    await disableUserTriggers(full, "patient_state_checkpoints", async () => {
      await full.query(`
        update public.patient_state_checkpoints
        set aggregate_payload = jsonb_set(
          aggregate_payload,
          '{pinned_case,package_hash}',
          to_jsonb($2::text)
        )
        where session_id = $1
      `, [checkpointCorrupt.initial.session_id, "f".repeat(64)]);
    });
    const checkpointCorruptLoad = await loadWithFreshAdapter(
      postgres,
      checkpointCorrupt.initial.session_id
    );
    await check("durable checkpoint corruption fails closed", () => {
      assert(failureCode(checkpointCorruptLoad) === "SESSION_PERSISTENCE_FAILURE",
        JSON.stringify(checkpointCorruptLoad));
    });

    const replayCorrupt = await seedCommittedSession(
      postgres,
      full,
      "session.synthetic.corrupt-replay"
    );
    await disableUserTriggers(full, "session_commands", async () => {
      await full.query(`
        update public.session_commands
        set committed_result_payload = jsonb_set(
          committed_result_payload,
          '{committed_at_utc}',
          '"2026-09-01T12:00:01Z"'::jsonb
        )
        where session_id = $1
      `, [replayCorrupt.initial.session_id]);
    });
    const replayCorruptLoad = await loadWithFreshAdapter(postgres, replayCorrupt.initial.session_id);
    await check("durable replay corruption fails closed", () => {
      assert(failureCode(replayCorruptLoad) === "SESSION_PERSISTENCE_FAILURE",
        JSON.stringify(replayCorruptLoad));
    });
    await check("corruption injection leaves production immutable triggers enabled", async () => {
      const result = await full.query(`
        select count(*)::int as count,
               array_agg(t.tgname order by t.tgname) as trigger_names
        from pg_catalog.pg_trigger t
        join pg_catalog.pg_class c on c.oid = t.tgrelid
        join pg_catalog.pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public'
          and c.relname in ('session_events','session_commands','patient_state_checkpoints')
          and not t.tgisinternal
          and t.tgenabled <> 'D'
      `);
      assert(result.rows[0].count === 2
        && result.rows[0].trigger_names
          === "{patient_state_checkpoints_are_immutable,session_events_are_immutable}",
      JSON.stringify(result.rows[0]));
    });

    const schedulerBase = productionSession("session.synthetic.scheduler-race", {
      rules: [DELAYED_TRANSITION_RULE]
    });
    await insertSession(full, schedulerBase);
    const schedulerCommands = Array.from({ length: 8 }, (_, index) =>
      commandFor(schedulerBase, `scheduler-race-${index}`));
    const schedulerResults = await coordinatorRace(postgres, schedulerBase, schedulerCommands);
    await check("scheduler contention has one authoritative winner", () => {
      assert(schedulerResults.filter((result) =>
        result.success && result.status === "COMMITTED").length === 1,
      JSON.stringify(schedulerResults));
    });
    const schedulerLoaded = requireSuccess(
      await loadWithFreshAdapter(postgres, schedulerBase.session_id),
      "scheduler race load"
    );
    await check("scheduler loser work does not persist or duplicate", () => {
      assert(schedulerLoaded.session.scheduler_state.pending_items.length === 1
        && schedulerLoaded.session.scheduler_state.pending_items[0]?.scheduled_item_id
          === "scheduled-item.synthetic.alteration",
      JSON.stringify(schedulerLoaded.session.scheduler_state));
    });
    const schedulerWinnerIndex = schedulerResults.findIndex((result) =>
      result.success && result.status === "COMMITTED");
    const schedulerRetryClient = await openClient(postgres);
    try {
      const schedulerRetry = await coordinatorFor(schedulerRetryClient)
        .submitExternalClinicalCommand({
          ...createCoordinatorContext(
            schedulerLoaded.session,
            TEST_REAL_TIME_UTC,
            "scheduler-retry"
          ),
          command: schedulerCommands[schedulerWinnerIndex]
        });
      await check("scheduler exact retry does not duplicate pending work", async () => {
        const reloaded = requireSuccess(
          await loadWithFreshAdapter(postgres, schedulerBase.session_id),
          "scheduler retry load"
        );
        assert(schedulerRetry.success && schedulerRetry.status === "REPLAYED"
          && reloaded.session.scheduler_state.pending_items.length === 1,
        JSON.stringify({ schedulerRetry, scheduler: reloaded.session.scheduler_state }));
      });
    } finally {
      await schedulerRetryClient.end().catch(() => undefined);
    }

    const timeBase = productionSession("session.synthetic.clinical-time-race");
    await insertSession(full, timeBase);
    const timeResults = await syncRace(postgres, timeBase, [
      "2026-09-01T12:00:05Z",
      "2026-09-01T12:00:07Z"
    ]);
    await check("Clinical-Time contention has exactly one synchronized winner", () => {
      assert(timeResults.filter((result) => result.success && result.status === "COMMITTED").length === 1
        && timeResults.filter((result) => !result.success
          && failureCode(result) === "SESSION_VERSION_CONFLICT").length === 1,
      JSON.stringify(timeResults));
    });
    await check("Clinical Time reflects one winner rather than summed contenders", async () => {
      const loaded = requireSuccess(await loadWithFreshAdapter(postgres, timeBase.session_id), "time load");
      const expectedTimes = [
        timeBase.patient_state.clinical_time + 5,
        timeBase.patient_state.clinical_time + 7
      ];
      assert(expectedTimes.includes(loaded.session.patient_state.clinical_time),
        JSON.stringify(loaded.session.patient_state));
    });

    const reviewSession = requireSuccess(initializeReviewInMemorySession({
      session_id: "session.stemi.persistence-race-review",
      mode: "ASSESSMENT",
      review_execution_artifact: reviewArtifact,
      trusted_real_time_anchor_utc: "2026-09-03T12:00:00Z"
    }), "review initialization").session;
    await insertSession(full, reviewSession);
    const reviewResults = await syncRace(postgres, reviewSession, [
      "2026-09-03T12:00:01Z",
      "2026-09-03T12:00:02Z"
    ]);
    await check("REVIEW_ONLY race has one authoritative winner", () => {
      assert(reviewResults.filter((result) => result.success && result.status === "COMMITTED").length === 1,
        JSON.stringify(reviewResults));
    });
    await check("real STEMI review authority and hashes remain immutable under race", async () => {
      const loaded = requireSuccess(await loadWithFreshAdapter(postgres, reviewSession.session_id), "review race load");
      assert(loaded.session.pinned_case.execution_authority === "REVIEW_ONLY"
        && loaded.session.pinned_case.review_subject_hash === EXPECTED_STEMI_REVIEW_SUBJECT
        && loaded.session.pinned_case.review_execution_hash === EXPECTED_STEMI_REVIEW_EXECUTION,
      JSON.stringify(loaded.session.pinned_case));
    });

    const productionAuthorityBase = productionSession("session.synthetic.production-authority-race");
    await insertSession(full, productionAuthorityBase);
    const productionAuthorityResults = await coordinatorRace(
      postgres,
      productionAuthorityBase,
      Array.from({ length: 4 }, (_, index) =>
        commandFor(productionAuthorityBase, `production-authority-${index}`))
    );
    await check("production authority race has one winner", () => {
      assert(productionAuthorityResults.filter((result) =>
        result.success && result.status === "COMMITTED").length === 1,
      JSON.stringify(productionAuthorityResults));
    });
    await check("production package authority remains exactly pinned under race", async () => {
      const loaded = requireSuccess(
        await loadWithFreshAdapter(postgres, productionAuthorityBase.session_id),
        "production authority load"
      );
      assert(same(loaded.session.pinned_case, productionAuthorityBase.pinned_case),
        JSON.stringify(loaded.session.pinned_case));
    });

    const juBase = productionSession("session.synthetic.ju-concurrent");
    const justBase = productionSession("session.synthetic.just-concurrent", {
      institutionId: "just"
    });
    await insertSession(full, juBase, "ju");
    await insertSession(full, justBase, "just");
    const juClient = await openClient(postgres);
    const justClient = await openClient(postgres);
    try {
      const [juResult, justResult] = await Promise.all([
        coordinatorFor(juClient).submitExternalClinicalCommand({
          ...createCoordinatorContext(juBase, TEST_REAL_TIME_UTC, "ju-cross-tenant"),
          command: commandFor(juBase, "ju-cross-tenant")
        }),
        coordinatorFor(justClient).submitExternalClinicalCommand({
          ...createCoordinatorContext(justBase, TEST_REAL_TIME_UTC, "just-cross-tenant"),
          command: commandFor(justBase, "just-cross-tenant")
        })
      ]);
      await check("JU and JUST trusted commits both succeed independently", () => {
        assert(juResult.success && justResult.success, JSON.stringify({ juResult, justResult }));
      });
      await check("JU and JUST durable Sessions remain isolated", async () => {
        const rows = await full.query(`
          select session_id, institution_id, next_event_sequence::int
          from public.simulation_sessions
          where session_id in ($1, $2)
          order by institution_id
        `, [juBase.session_id, justBase.session_id]);
        assert(rows.rows.length === 2
          && rows.rows.every((row) => row.next_event_sequence === 2)
          && new Set(rows.rows.map((row) => row.institution_id)).size === 2,
        JSON.stringify(rows.rows));
      });
    } finally {
      await closeClients([juClient, justClient]);
    }

    const clientAttackBase = productionSession("session.synthetic.client-attack");
    await insertSession(full, clientAttackBase);
    const clientAttackCommand = commandFor(clientAttackBase, "client-attack");
    const clientAttackProposal = await computeCommand(clientAttackBase, clientAttackCommand, "client attack");
    const attackLocker = await openClient(postgres);
    const attackTrusted = await openClient(postgres);
    const attackClient = await openClient(postgres, "authenticated");
    try {
      await attackLocker.query("begin");
      await attackLocker.query(
        "select session_id from public.simulation_sessions where session_id = $1 for update",
        [clientAttackBase.session_id]
      );
      const trustedAdapter = new PostgresSessionCommitAdapter(
        new NativePostgresRpcClient(attackTrusted)
      );
      const waitingTrusted = trustedAdapter.commit({
        session_id: clientAttackBase.session_id,
        expected_token: createSessionCommitToken(clientAttackBase),
        proposed_session: clientAttackProposal.authoritative_session
      });
      await waitForLock(full, attackTrusted.processID);
      let clientAttackError;
      try {
        await attackClient.query(
          "update public.simulation_sessions set next_event_sequence = 99 where session_id = $1",
          [clientAttackBase.session_id]
        );
      } catch (error) {
        clientAttackError = error;
      }
      await check("raw authenticated mutation is denied during trusted lock wait", () => {
        assert(clientAttackError?.code === "42501", `Expected 42501, got ${clientAttackError?.code}.`);
      });
      await attackLocker.query("rollback");
      const trustedResult = await waitingTrusted;
      await check("RLS attack does not interfere with trusted atomic commit", () => {
        assert(trustedResult.success, JSON.stringify(trustedResult));
      });
    } finally {
      await attackLocker.query("rollback").catch(() => undefined);
      await closeClients([attackLocker, attackTrusted, attackClient]);
    }

    const sustainedBase = productionSession("session.synthetic.sustained-50");
    await insertSession(full, sustainedBase);
    let sustainedSession = sustainedBase;
    let sustainedClient = await openClient(postgres);
    let sustainedAdapter = new PostgresSessionCommitAdapter(
      new NativePostgresRpcClient(sustainedClient)
    );
    let sustainedRetries = 0;
    let sustainedStaleAttempts = 0;
    let sustainedRestarts = 0;
    try {
      for (let iteration = 1; iteration <= 50; iteration += 1) {
        const loaded = requireSuccess(
          await sustainedAdapter.load(sustainedBase.session_id),
          `sustained load ${iteration}`
        );
        assert(same(loaded.session, sustainedSession), `Sustained load ${iteration} drift.`);
        const command = commandFor(loaded.session, `sustained-${iteration}`);
        const computed = await computeCommand(loaded.session, command, `sustained ${iteration}`);
        const committed = requireSuccess(await sustainedAdapter.commit({
          session_id: sustainedBase.session_id,
          expected_token: loaded.commit_token,
          proposed_session: computed.authoritative_session
        }), `sustained commit ${iteration}`);
        sustainedSession = committed.session;

        if (iteration % 5 === 0) {
          const retryCoordinator = createSessionCoordinator({
            adapter: sustainedAdapter,
            hash_adapter: TEST_HASH_ADAPTER,
            event_id_factory: EVENT_ID_FACTORY
          });
          const retry = await retryCoordinator.submitExternalClinicalCommand({
            ...createCoordinatorContext(sustainedSession, TEST_REAL_TIME_UTC, `sustained-retry-${iteration}`),
            command
          });
          assert(retry.success && retry.status === "REPLAYED",
            `Sustained retry ${iteration}: ${JSON.stringify(retry)}`);
          sustainedRetries += 1;
        }

        if (iteration % 7 === 0) {
          const staleCommand = commandFor(loaded.session, `sustained-stale-${iteration}`);
          const staleProposal = await computeCommand(
            loaded.session,
            staleCommand,
            `sustained stale ${iteration}`
          );
          const stale = await sustainedAdapter.commit({
            session_id: sustainedBase.session_id,
            expected_token: loaded.commit_token,
            proposed_session: staleProposal.authoritative_session
          });
          assert(failureCode(stale) === "SESSION_VERSION_CONFLICT",
            `Sustained stale ${iteration}: ${JSON.stringify(stale)}`);
          sustainedStaleAttempts += 1;
        }

        if (iteration % 10 === 0 && iteration < 50) {
          await sustainedClient.end();
          sustainedClient = await openClient(postgres);
          sustainedAdapter = new PostgresSessionCommitAdapter(
            new NativePostgresRpcClient(sustainedClient)
          );
          sustainedRestarts += 1;
        }
      }
    } finally {
      await sustainedClient.end().catch(() => undefined);
    }
    await check("50-command sustained series remains coherent", async () => {
      const loaded = requireSuccess(await loadWithFreshAdapter(postgres, sustainedBase.session_id), "sustained final load");
      assert(same(loaded.session, sustainedSession)
        && loaded.session.committed_events.length === 50
        && loaded.session.idempotency_records.length === 50,
      JSON.stringify(loaded.session));
    });
    await check("sustained series preserves gap-free sequence and checkpoints", async () => {
      const counts = await durableCounts(full, sustainedBase.session_id);
      assert(counts.events === 50 && counts.commands === 50
        && counts.checkpoints === 50 && counts.next_sequence === 51,
      JSON.stringify(counts));
    });
    await check("sustained periodic retries, stale attempts, and restarts are exercised", () => {
      assert(sustainedRetries === 10 && sustainedStaleAttempts === 7
        && sustainedRestarts === 4,
      JSON.stringify({ sustainedRetries, sustainedStaleAttempts, sustainedRestarts }));
    });

    const mixedBase = productionSession("session.synthetic.mixed-adversarial");
    await insertSession(full, mixedBase);
    const mixedCommands = Array.from({ length: 4 }, (_, index) =>
      commandFor(mixedBase, `mixed-race-${index}`));
    const mixedResults = await coordinatorRace(postgres, mixedBase, mixedCommands);
    const mixedWinner = mixedResults.findIndex((result) =>
      result.success && result.status === "COMMITTED");
    assert(mixedWinner >= 0, JSON.stringify(mixedResults));
    const afterMixedRace = requireSuccess(
      await loadWithFreshAdapter(postgres, mixedBase.session_id),
      "mixed post-race"
    );
    const mixedRetryClient = await openClient(postgres);
    try {
      const mixedReplay = await coordinatorFor(mixedRetryClient)
        .submitExternalClinicalCommand({
          ...createCoordinatorContext(afterMixedRace.session, TEST_REAL_TIME_UTC, "mixed-replay"),
          command: mixedCommands[mixedWinner]
        });
      assert(mixedReplay.success && mixedReplay.status === "REPLAYED",
        JSON.stringify(mixedReplay));
    } finally {
      await mixedRetryClient.end().catch(() => undefined);
    }
    const mixedFailureCommand = commandFor(afterMixedRace.session, "mixed-forced-failure");
    const mixedFailureProposal = await computeCommand(
      afterMixedRace.session,
      mixedFailureCommand,
      "mixed forced failure"
    );
    await full.query(`
      create function public.v2_012b_fail_mixed_checkpoint()
      returns trigger language plpgsql set search_path = '' as $$
      begin
        if new.session_id = 'session.synthetic.mixed-adversarial' then
          raise exception using errcode = 'P0001', message = 'V2-012B mixed failure';
        end if;
        return new;
      end;
      $$;
      create trigger v2_012b_force_mixed_failure
      before insert on public.patient_state_checkpoints
      for each row execute function public.v2_012b_fail_mixed_checkpoint();
    `);
    const mixedFailureClient = await openClient(postgres);
    const mixedFailureAdapter = new PostgresSessionCommitAdapter(
      new NativePostgresRpcClient(mixedFailureClient)
    );
    const mixedFailure = await mixedFailureAdapter.commit({
      session_id: mixedBase.session_id,
      expected_token: afterMixedRace.commit_token,
      proposed_session: mixedFailureProposal.authoritative_session
    });
    await mixedFailureClient.end();
    await full.query("drop trigger v2_012b_force_mixed_failure on public.patient_state_checkpoints");
    await full.query("drop function public.v2_012b_fail_mixed_checkpoint()");
    await check("mixed forced transaction failure remains typed and rollback-only", () => {
      assert(failureCode(mixedFailure) === "SESSION_PERSISTENCE_FAILURE",
        JSON.stringify(mixedFailure));
    });
    const afterMixedFailure = requireSuccess(
      await loadWithFreshAdapter(postgres, mixedBase.session_id),
      "mixed post-failure"
    );
    await check("mixed failure leaves prior winner and replay coherent", () => {
      assert(same(afterMixedFailure.session, afterMixedRace.session),
        JSON.stringify(afterMixedFailure.session));
    });
    const mixedRecoveryClient = await openClient(postgres);
    try {
      const recoveredAdapter = new PostgresSessionCommitAdapter(
        new NativePostgresRpcClient(mixedRecoveryClient)
      );
      const recovered = requireSuccess(
        await recoveredAdapter.load(mixedBase.session_id),
        "mixed recovery load"
      );
      const mixedSuccess = requireSuccess(await recoveredAdapter.commit({
        session_id: mixedBase.session_id,
        expected_token: recovered.commit_token,
        proposed_session: mixedFailureProposal.authoritative_session
      }), "mixed recovery commit");
      await check("mixed adversarial sequence ends in one coherent authoritative load", async () => {
        const finalLoad = requireSuccess(
          await loadWithFreshAdapter(postgres, mixedBase.session_id),
          "mixed final load"
        );
        assert(same(finalLoad.session, mixedSuccess.session)
          && finalLoad.session.committed_events.length === 2
          && finalLoad.session.idempotency_records.length === 2,
        JSON.stringify(finalLoad.session));
      });
    } finally {
      await mixedRecoveryClient.end().catch(() => undefined);
    }

    await check("RLS remains enabled and forced on all 28 application tables", async () => {
      const result = await full.query(`
        select count(*)::int as count
        from pg_catalog.pg_class c
        join pg_catalog.pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public'
          and c.relkind = 'r'
          and c.relrowsecurity
          and c.relforcerowsecurity
      `);
      assert(result.rows[0].count === 28, JSON.stringify(result.rows[0]));
    });
    await check("atomic commit functions remain SECURITY INVOKER and service-role only", async () => {
      const result = await full.query(`
        select p.proname, p.prosecdef,
          has_function_privilege('anon', p.oid, 'execute') as anon_execute,
          has_function_privilege('authenticated', p.oid, 'execute') as authenticated_execute,
          has_function_privilege('service_role', p.oid, 'execute') as service_execute
        from pg_catalog.pg_proc p
        join pg_catalog.pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and p.proname in (
            'load_authoritative_session_v2_012a',
            'commit_authoritative_session_v2_012a'
          )
        order by p.proname
      `);
      assert(result.rows.length === 2
        && result.rows.every((row) => !row.prosecdef
          && !row.anon_execute && !row.authenticated_execute && row.service_execute),
      JSON.stringify(result.rows));
    });
    await check("single-row lock order has no multi-row deadlock cycle", async () => {
      const sql = migrations.at(-1).sql;
      const locks = sql.match(/for\s+update/gi) ?? [];
      assert(locks.length === 1 && !/advisory_lock|lock\s+table/i.test(sql),
        "Unexpected lock authority added.");
    });
    await check("production adapter assumes one atomic RPC and no sticky connection state", async () => {
      const source = await readFile(join(
        V2_ROOT,
        "packages",
        "session-engine",
        "src",
        "adapters",
        "postgres",
        "postgres-session-adapter.ts"
      ), "utf8");
      assert(!/\bbegin\b|\brollback\b|advisory_lock|sticky|mutex/i.test(source)
        && source.includes("this.#client.rpc("),
      "Adapter contains connection-local transaction assumptions.");
    });
    await check("no automatic clinical recomputation follows unrelated stale conflict", async () => {
      const source = await readFile(join(
        V2_ROOT,
        "packages",
        "session-engine",
        "src",
        "coordinator",
        "session-coordinator.ts"
      ), "utf8");
      assert(source.includes("A concurrent unrelated commit may have changed medical state")
        && !source.includes("remainingConflictRetries"),
      "Blind stale clinical retry path detected.");
    });
    await check("test-only corruption and crash hooks are absent from migrations", () => {
      const sql = migrations.map((migration) => migration.sql).join("\n");
      assert(!/v2_012b|fail_mixed|debug_corrupt|pg_terminate_backend/i.test(sql),
        "Production migration contains a test-only failpoint.");
    });
    await check("no service credential, remote Supabase, or region configuration exists", async () => {
      const sources = [
        migrations.at(-1).sql,
        await readFile(join(
          V2_ROOT,
          "packages",
          "session-engine",
          "src",
          "adapters",
          "postgres",
          "postgres-session-adapter.ts"
        ), "utf8")
      ].join("\n");
      assert(!/service_role_key|supabase_service|https:\/\/.*supabase\.co|eyJ[A-Za-z0-9_-]{20,}|aws[_-]?region/i.test(sources),
        "Remote credential or region configuration detected.");
    });
    await check("STEMI review and golden-trace identities remain exact", () => {
      assert(reviewArtifact.review_subject_hash === EXPECTED_STEMI_REVIEW_SUBJECT
        && reviewArtifact.review_execution_hash === EXPECTED_STEMI_REVIEW_EXECUTION
        && STEMI_PORTABILITY_SNAPSHOT_SHA256 === "14fcf7de8a969fba49eb3d0d96db783f1c77e1fb2a89594c81f453495ace9a58",
      JSON.stringify({
        review_subject_hash: reviewArtifact.review_subject_hash,
        review_execution_hash: reviewArtifact.review_execution_hash,
        golden_trace_digest: STEMI_PORTABILITY_SNAPSHOT_SHA256
      }));
    });
  } finally {
    for (const client of [full, admin]) {
      if (client) await client.end().catch(() => undefined);
    }
    await postgres.stop().catch(() => undefined);
  }

  process.stdout.write(`V2-012B native PostgreSQL durability tests: ${passed} passed, 0 failed\n`);
}

await main();
