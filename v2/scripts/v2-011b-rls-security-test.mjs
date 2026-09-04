import EmbeddedPostgres from "embedded-postgres";
import { mkdtemp, readFile, readdir } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const V2_ROOT = resolve(SCRIPT_DIR, "..");
const MIGRATION_DIR = join(V2_ROOT, "supabase", "migrations");
const RLS_MIGRATION = "202609030004_v2_011b_rls_security.sql";
const APPLICATION_TABLES = [
  "institutions",
  "profiles",
  "institution_memberships",
  "clinical_cases",
  "case_versions",
  "case_modules",
  "clinical_sources",
  "clinical_source_versions",
  "case_source_links",
  "curriculum_sources",
  "curriculum_source_versions",
  "learning_objectives",
  "curriculum_mappings",
  "case_reviews",
  "case_approvals",
  "case_approval_review_refs",
  "review_execution_artifacts",
  "case_packages",
  "media_assets",
  "visual_manifests",
  "simulation_sessions",
  "session_events",
  "session_commands",
  "patient_state_checkpoints",
  "assessments",
  "assessment_domain_scores",
  "assessment_findings",
  "assessment_debriefs"
];

const EXPECTED_POLICIES = [
  "case_modules_select_own_institution_faculty",
  "case_source_links_select_own_institution_faculty",
  "case_versions_select_own_institution_faculty",
  "clinical_cases_select_own_institution_faculty",
  "clinical_source_versions_select_faculty_scope",
  "clinical_sources_select_faculty_scope",
  "curriculum_mappings_select_case_owner_faculty",
  "curriculum_source_versions_select_own_institution_faculty",
  "curriculum_sources_select_own_institution_faculty",
  "institution_memberships_select_own",
  "institutions_select_active_membership",
  "learning_objectives_select_own_institution_faculty",
  "profiles_select_own",
  "profiles_update_safe_own"
];

const USERS = {
  juLearnerA: "11111111-1111-4111-8111-111111111111",
  juLearnerB: "22222222-2222-4222-8222-222222222222",
  juFaculty: "33333333-3333-4333-8333-333333333333",
  juReviewer: "44444444-4444-4444-8444-444444444444",
  justLearner: "55555555-5555-4555-8555-555555555555",
  justFaculty: "66666666-6666-4666-8666-666666666666",
  justReviewer: "77777777-7777-4777-8777-777777777777",
  disabledLearner: "88888888-8888-4888-8888-888888888888"
};

const PRINCIPALS = {
  anon: ["v2_011b_anon", null],
  juLearnerA: ["v2_011b_ju_learner_a", USERS.juLearnerA],
  juLearnerB: ["v2_011b_ju_learner_b", USERS.juLearnerB],
  juFaculty: ["v2_011b_ju_faculty", USERS.juFaculty],
  juReviewer: ["v2_011b_ju_reviewer", USERS.juReviewer],
  justLearner: ["v2_011b_just_learner", USERS.justLearner],
  justFaculty: ["v2_011b_just_faculty", USERS.justFaculty],
  justReviewer: ["v2_011b_just_reviewer", USERS.justReviewer],
  disabledLearner: ["v2_011b_disabled_learner", USERS.disabledLearner],
  service: ["service_role", null]
};

const HASH = Object.freeze({
  juReviewSubject: "a".repeat(64),
  juReviewExecution: "b".repeat(64),
  juPackage: "c".repeat(64),
  juPublishedReview: "d".repeat(64),
  justReviewSubject: "e".repeat(64),
  justReviewExecution: "f".repeat(64),
  justPackage: "1".repeat(64),
  justPublishedReview: "2".repeat(64),
  rubric: "3".repeat(64),
  request: "4".repeat(64),
  checkpoint: "5".repeat(64),
  source: "6".repeat(64),
  asset: "7".repeat(64)
});

let passed = 0;

async function check(name, fn) {
  await fn();
  passed += 1;
  process.stdout.write(`ok ${passed} - ${name}\n`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
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
  if (port <= 0) throw new Error("Could not allocate a local PostgreSQL test port.");
  return port;
}

async function loadMigrations() {
  const names = (await readdir(MIGRATION_DIR))
    .filter((name) => name.endsWith(".sql"))
    .sort();
  const migrations = [];
  for (const name of names) {
    migrations.push({ name, sql: await readFile(join(MIGRATION_DIR, name), "utf8") });
  }
  return migrations;
}

async function applyMigrations(client, migrations) {
  for (const migration of migrations) {
    await client.query(migration.sql);
  }
}

async function bootstrapCluster(client) {
  await client.query(`
    do $roles$
    declare
      role_name text;
    begin
      foreach role_name in array array[
        'anon',
        'authenticated',
        'service_role',
        'v2_011b_anon',
        'v2_011b_ju_learner_a',
        'v2_011b_ju_learner_b',
        'v2_011b_ju_faculty',
        'v2_011b_ju_reviewer',
        'v2_011b_just_learner',
        'v2_011b_just_faculty',
        'v2_011b_just_reviewer',
        'v2_011b_disabled_learner'
      ] loop
        if not exists (select 1 from pg_catalog.pg_roles where rolname = role_name) then
          execute format('create role %I nologin inherit', role_name);
        end if;
      end loop;
      alter role service_role bypassrls;
    end
    $roles$;

    grant anon to v2_011b_anon;
    grant authenticated to
      v2_011b_ju_learner_a,
      v2_011b_ju_learner_b,
      v2_011b_ju_faculty,
      v2_011b_ju_reviewer,
      v2_011b_just_learner,
      v2_011b_just_faculty,
      v2_011b_just_reviewer,
      v2_011b_disabled_learner;
  `);
}

async function bootstrapAuth(client) {
  await client.query(`
    create schema auth;
    create table auth.users (id uuid primary key);

    create function auth.uid()
    returns uuid
    language sql
    stable
    set search_path = ''
    as $function$
      select coalesce(
        nullif(pg_catalog.current_setting('request.jwt.claim.sub', true), ''),
        nullif(pg_catalog.current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
      )::uuid;
    $function$;

    revoke all on schema auth from public;
    revoke all on function auth.uid() from public;
    grant usage on schema auth to authenticated, service_role;
    grant execute on function auth.uid() to authenticated, service_role;
    grant all privileges on table auth.users to service_role;
  `);
}

function quoteIdentifier(identifier) {
  if (!/^[a-z0-9_]+$/.test(identifier)) throw new Error("Unsafe test role identifier.");
  return `"${identifier}"`;
}

async function asPrincipal(client, principal, fn) {
  const [role, userId] = principal;
  await client.query("begin");
  try {
    await client.query("select pg_catalog.set_config('request.jwt.claim.sub', $1, true)", [userId ?? ""]);
    await client.query("set local row_security = on");
    await client.query(`set local role ${quoteIdentifier(role)}`);
    return await fn();
  } finally {
    await client.query("rollback").catch(() => undefined);
  }
}

async function queryAs(client, principal, sql, params = []) {
  return asPrincipal(client, principal, () => client.query(sql, params));
}

async function expectSqlState(client, principal, sql, expectedCodes, params = []) {
  let caught;
  try {
    await queryAs(client, principal, sql, params);
  } catch (error) {
    caught = error;
  }
  assert(caught, `Expected SQL failure for: ${sql}`);
  assert(expectedCodes.includes(caught.code), `Expected SQLSTATE ${expectedCodes.join("/")}, received ${caught.code}: ${caught.message}`);
  return caught;
}

async function expectPermissionDenied(client, principal, sql, params = []) {
  return expectSqlState(client, principal, sql, ["42501"], params);
}

async function seedDatabase(client) {
  const userRows = Object.values(USERS).map((id) => `('${id}')`).join(",\n");
  await client.query(`insert into auth.users (id) values ${userRows}`);

  await client.query(`
    insert into public.profiles (user_id, display_alias, preferred_locale) values
      ('${USERS.juLearnerA}', 'JU learner A', 'en-US'),
      ('${USERS.juLearnerB}', 'JU learner B', 'ar-JO'),
      ('${USERS.juFaculty}', 'JU faculty', 'en-US'),
      ('${USERS.juReviewer}', 'JU reviewer', 'en-US'),
      ('${USERS.justLearner}', 'JUST learner', 'ar-JO'),
      ('${USERS.justFaculty}', 'JUST faculty', 'en-US'),
      ('${USERS.justReviewer}', 'JUST reviewer', 'en-US'),
      ('${USERS.disabledLearner}', 'Disabled learner', 'en-US');

    insert into public.institution_memberships (
      membership_id, institution_id, user_id, membership_role, membership_status
    ) values
      ('membership.ju.learner-a', 'ju', '${USERS.juLearnerA}', 'LEARNER', 'ACTIVE'),
      ('membership.ju.learner-b', 'ju', '${USERS.juLearnerB}', 'LEARNER', 'ACTIVE'),
      ('membership.ju.faculty', 'ju', '${USERS.juFaculty}', 'FACULTY', 'ACTIVE'),
      ('membership.ju.reviewer', 'ju', '${USERS.juReviewer}', 'REVIEWER', 'ACTIVE'),
      ('membership.just.learner', 'just', '${USERS.justLearner}', 'LEARNER', 'ACTIVE'),
      ('membership.just.faculty', 'just', '${USERS.justFaculty}', 'FACULTY', 'ACTIVE'),
      ('membership.just.reviewer', 'just', '${USERS.justReviewer}', 'REVIEWER', 'ACTIVE'),
      ('membership.ju.disabled', 'ju', '${USERS.disabledLearner}', 'LEARNER', 'INACTIVE');

    insert into public.clinical_cases (
      case_id, institution_id, case_slug, title, topic_code, owner_membership_id
    ) values
      ('case.synthetic-ju', 'ju', 'synthetic-ju', 'Synthetic JU Case', 'topic.synthetic', 'membership.ju.faculty'),
      ('case.synthetic-just', 'just', 'synthetic-just', 'Synthetic JUST Case', 'topic.synthetic', 'membership.just.faculty');
  `);

  for (const fixture of [
    {
      tenant: "ju", caseId: "case.synthetic-ju", versionId: "case-version.synthetic-ju-review",
      packageId: "case-package.synthetic-ju-review", version: "1.0.0", status: "UNDER_REVIEW",
      reviewHash: HASH.juReviewSubject, candidateHash: null, creator: "membership.ju.faculty"
    },
    {
      tenant: "ju", caseId: "case.synthetic-ju", versionId: "case-version.synthetic-ju-published",
      packageId: "case-package.synthetic-ju-published", version: "1.0.1", status: "APPROVED",
      reviewHash: HASH.juPublishedReview, candidateHash: HASH.juPackage, creator: "membership.ju.faculty"
    },
    {
      tenant: "just", caseId: "case.synthetic-just", versionId: "case-version.synthetic-just-review",
      packageId: "case-package.synthetic-just-review", version: "1.0.0", status: "UNDER_REVIEW",
      reviewHash: HASH.justReviewSubject, candidateHash: null, creator: "membership.just.faculty"
    },
    {
      tenant: "just", caseId: "case.synthetic-just", versionId: "case-version.synthetic-just-published",
      packageId: "case-package.synthetic-just-published", version: "1.0.1", status: "APPROVED",
      reviewHash: HASH.justPublishedReview, candidateHash: HASH.justPackage, creator: "membership.just.faculty"
    }
  ]) {
    const payload = {
      manifest: {
        case_id: fixture.caseId,
        case_version_id: fixture.versionId,
        case_package_id: fixture.packageId,
        case_version: fixture.version,
        schema_version: "2.0",
        status: fixture.status
      }
    };
    await client.query(`
      insert into public.case_versions (
        case_version_id, case_id, institution_id, case_package_id,
        semantic_version, case_schema_version, lifecycle_status,
        review_subject_hash, publication_candidate_hash,
        authored_case_payload, created_by_membership_id
      ) values ($1, $2, $3, $4, $5, '2.0', $6, $7, $8, $9::jsonb, $10)
    `, [
      fixture.versionId, fixture.caseId, fixture.tenant, fixture.packageId,
      fixture.version, fixture.status, fixture.reviewHash, fixture.candidateHash,
      JSON.stringify(payload), fixture.creator
    ]);
  }

  await client.query(`
    insert into public.case_modules (
      case_version_id, institution_id, module_name, module_schema_version,
      content_hash, content_jsonb
    ) values
      ('case-version.synthetic-ju-review', 'ju', 'manifest', '2.0', '${HASH.juReviewSubject}', '{}'::jsonb),
      ('case-version.synthetic-just-review', 'just', 'manifest', '2.0', '${HASH.justReviewSubject}', '{}'::jsonb);

    insert into public.clinical_sources (
      source_id, source_scope, owner_institution_id, source_title
    ) values
      ('source.synthetic-global', 'GLOBAL', null, 'Synthetic Global Source'),
      ('source.synthetic-ju', 'INSTITUTION', 'ju', 'Synthetic JU Source'),
      ('source.synthetic-just', 'INSTITUTION', 'just', 'Synthetic JUST Source');

    insert into public.clinical_source_versions (
      source_version_id, source_id, semantic_version, content_hash, rights_status
    ) values
      ('source-version.synthetic-global', 'source.synthetic-global', '1.0.0', '${HASH.source}', 'APPROVED'),
      ('source-version.synthetic-ju', 'source.synthetic-ju', '1.0.0', '${HASH.source}', 'APPROVED'),
      ('source-version.synthetic-just', 'source.synthetic-just', '1.0.0', '${HASH.source}', 'APPROVED');

    insert into public.case_source_links (
      case_version_id, institution_id, source_id, source_version_id,
      target_module, source_status, required_for_publication
    ) values
      ('case-version.synthetic-ju-review', 'ju', 'source.synthetic-ju', 'source-version.synthetic-ju', 'manifest', 'APPROVED', true),
      ('case-version.synthetic-just-review', 'just', 'source.synthetic-just', 'source-version.synthetic-just', 'manifest', 'APPROVED', true);

    insert into public.curriculum_sources (
      curriculum_source_id, institution_id, source_title, rights_status
    ) values
      ('source.curriculum-ju', 'ju', 'Synthetic JU Curriculum', 'APPROVED'),
      ('source.curriculum-just', 'just', 'Synthetic JUST Curriculum', 'APPROVED');

    insert into public.curriculum_source_versions (
      curriculum_source_version_id, curriculum_source_id, institution_id,
      semantic_version, content_hash, version_status
    ) values
      ('source-version.curriculum-ju', 'source.curriculum-ju', 'ju', '1.0.0', '${HASH.source}', 'APPROVED'),
      ('source-version.curriculum-just', 'source.curriculum-just', 'just', '1.0.0', '${HASH.source}', 'APPROVED');

    insert into public.learning_objectives (
      objective_id, institution_id, curriculum_source_version_id,
      objective_code, objective_status
    ) values
      ('objective.synthetic-ju', 'ju', 'source-version.curriculum-ju', 'objective-code.synthetic', 'APPROVED'),
      ('objective.synthetic-just', 'just', 'source-version.curriculum-just', 'objective-code.synthetic', 'APPROVED');

    insert into public.curriculum_mappings (
      mapping_id, case_version_id, case_owner_institution_id,
      curriculum_institution_id, objective_id, competency_code, mapping_status
    ) values
      ('mapping.synthetic-ju', 'case-version.synthetic-ju-review', 'ju', 'ju', 'objective.synthetic-ju', 'competency.synthetic', 'APPROVED'),
      ('mapping.synthetic-just', 'case-version.synthetic-just-review', 'just', 'just', 'objective.synthetic-just', 'competency.synthetic', 'APPROVED');

    insert into public.case_reviews (
      review_id, case_version_id, institution_id, review_type,
      reviewer_ref_id, reviewer_membership_id, review_status,
      reviewed_case_version, reviewed_content_hash, reviewed_at
    ) values
      ('review.synthetic-ju', 'case-version.synthetic-ju-review', 'ju', 'CLINICAL',
       'reviewer.synthetic-ju', 'membership.ju.reviewer', 'APPROVED', '1.0.0', '${HASH.juReviewSubject}', '2026-01-01T00:00:00Z'),
      ('review.synthetic-just', 'case-version.synthetic-just-review', 'just', 'CLINICAL',
       'reviewer.synthetic-just', 'membership.just.reviewer', 'APPROVED', '1.0.0', '${HASH.justReviewSubject}', '2026-01-01T00:00:00Z');
  `);

  for (const fixture of [
    {
      tenant: "ju", packageId: "case-package.synthetic-ju-review", versionId: "case-version.synthetic-ju-review",
      version: "1.0.0", reviewHash: HASH.juReviewSubject, executionHash: HASH.juReviewExecution
    },
    {
      tenant: "just", packageId: "case-package.synthetic-just-review", versionId: "case-version.synthetic-just-review",
      version: "1.0.0", reviewHash: HASH.justReviewSubject, executionHash: HASH.justReviewExecution
    }
  ]) {
    const payload = {
      artifact_kind: "REVIEW_EXECUTION_ARTIFACT",
      execution_authority: "REVIEW_ONLY",
      review_execution_hash: fixture.executionHash,
      review_subject_hash: fixture.reviewHash,
      source_identity: {
        case_package_id: fixture.packageId,
        case_version_id: fixture.versionId,
        case_version: fixture.version
      }
    };
    await client.query(`
      insert into public.review_execution_artifacts (
        review_execution_hash, institution_id, case_package_id, case_version_id,
        case_version, case_schema_version, artifact_schema_version, artifact_kind,
        execution_authority, source_lifecycle, review_subject_hash,
        module_hashes, artifact_payload
      ) values ($1, $2, $3, $4, $5, '2.0', '1.0',
        'REVIEW_EXECUTION_ARTIFACT', 'REVIEW_ONLY', 'UNDER_REVIEW', $6,
        '{}'::jsonb, $7::jsonb)
    `, [
      fixture.executionHash, fixture.tenant, fixture.packageId, fixture.versionId,
      fixture.version, fixture.reviewHash, JSON.stringify(payload)
    ]);
  }

  for (const fixture of [
    {
      tenant: "ju", versionId: "case-version.synthetic-ju-published",
      packageId: "case-package.synthetic-ju-published", packageHash: HASH.juPackage,
      reviewHash: HASH.juPublishedReview, approvalId: "approval.synthetic-ju",
      approver: "membership.ju.faculty", approverRef: "approver.synthetic-ju"
    },
    {
      tenant: "just", versionId: "case-version.synthetic-just-published",
      packageId: "case-package.synthetic-just-published", packageHash: HASH.justPackage,
      reviewHash: HASH.justPublishedReview, approvalId: "approval.synthetic-just",
      approver: "membership.just.faculty", approverRef: "approver.synthetic-just"
    }
  ]) {
    await client.query(`
      insert into public.case_approvals (
        approval_id, institution_id, case_version_id, case_package_id,
        approved_case_version, approved_package_hash, review_subject_hash,
        approval_scope, approval_status, approver_ref_id,
        approver_membership_id, approver_role_code, approved_at, approval_payload
      ) values ($1, $2, $3, $4, '1.0.1', $5, $6,
        'CASE_PACKAGE_PUBLICATION', 'APPROVED', $7, $8, 'role.faculty',
        '2026-01-01T00:00:00Z', '{}'::jsonb)
    `, [
      fixture.approvalId, fixture.tenant, fixture.versionId, fixture.packageId,
      fixture.packageHash, fixture.reviewHash, fixture.approverRef, fixture.approver
    ]);
    const payload = {
      package_hash: fixture.packageHash,
      manifest: {
        case_package_id: fixture.packageId,
        case_version_id: fixture.versionId,
        case_version: "1.0.1",
        schema_version: "2.0",
        status: "PUBLISHED"
      }
    };
    await client.query(`
      insert into public.case_packages (
        case_package_id, institution_id, case_version_id, case_version,
        package_schema_version, package_hash, review_subject_hash,
        approval_id, approval_status, execution_authority, package_lifecycle,
        module_hashes, package_payload, published_at
      ) values ($1, $2, $3, '1.0.1', '2.0', $4, $5, $6, 'APPROVED',
        'PUBLISHED_PRODUCTION', 'PUBLISHED', '{}'::jsonb, $7::jsonb,
        '2026-01-01T00:00:00Z')
    `, [
      fixture.packageId, fixture.tenant, fixture.versionId, fixture.packageHash,
      fixture.reviewHash, fixture.approvalId, JSON.stringify(payload)
    ]);
  }

  await client.query(`
    insert into public.media_assets (
      media_asset_id, asset_scope, owner_institution_id, asset_version,
      media_kind, content_hash, rights_status, clinical_review_status
    ) values
      ('asset.synthetic-ju', 'INSTITUTION', 'ju', '1.0.0', 'STATIC_IMAGE', '${HASH.asset}', 'UNRESOLVED', 'UNRESOLVED'),
      ('asset.synthetic-just', 'INSTITUTION', 'just', '1.0.0', 'STATIC_IMAGE', '${HASH.asset}', 'UNRESOLVED', 'UNRESOLVED');

    insert into public.visual_manifests (
      visual_manifest_id, institution_id, case_version_id,
      visual_manifest_version, manifest_schema_version, manifest_hash,
      fallback_coverage_status, required_static_fallback_asset_id, manifest_payload
    ) values
      ('visual.synthetic-ju', 'ju', 'case-version.synthetic-ju-review', '1.0.0', '1.0', '${HASH.asset}', 'COMPLETE', 'asset.synthetic-ju', '{}'::jsonb),
      ('visual.synthetic-just', 'just', 'case-version.synthetic-just-review', '1.0.0', '1.0', '${HASH.asset}', 'COMPLETE', 'asset.synthetic-just', '{}'::jsonb);
  `);

  await insertProductionSession(client, {
    sessionId: "session.synthetic.ju-a", tenant: "ju", userId: USERS.juLearnerA,
    membershipId: "membership.ju.learner-a", packageId: "case-package.synthetic-ju-published",
    versionId: "case-version.synthetic-ju-published", packageHash: HASH.juPackage
  });
  await insertProductionSession(client, {
    sessionId: "session.synthetic.ju-b", tenant: "ju", userId: USERS.juLearnerB,
    membershipId: "membership.ju.learner-b", packageId: "case-package.synthetic-ju-published",
    versionId: "case-version.synthetic-ju-published", packageHash: HASH.juPackage
  });
  await insertProductionSession(client, {
    sessionId: "session.synthetic.just", tenant: "just", userId: USERS.justLearner,
    membershipId: "membership.just.learner", packageId: "case-package.synthetic-just-published",
    versionId: "case-version.synthetic-just-published", packageHash: HASH.justPackage
  });
  await insertReviewSession(client);

  await insertEvent(client, "session.synthetic.ju-a", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
  await insertEvent(client, "session.synthetic.ju-b", "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
  await insertEvent(client, "session.synthetic.just", "cccccccc-cccc-4ccc-8ccc-cccccccccccc");

  await client.query(`
    insert into public.session_commands (
      command_id, session_id, idempotency_key, canonical_request_hash,
      expected_patient_state_version, command_status,
      first_event_sequence, last_event_sequence, committed_event_ids,
      command_event_id, resulting_patient_state_version,
      resulting_clinical_time_seconds, committed_result_payload, committed_at
    ) values (
      'command.synthetic.ju-a', 'session.synthetic.ju-a', 'idempotency.synthetic.ju-a',
      '${HASH.request}', 0, 'COMMITTED', 1, 1,
      '["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"]'::jsonb,
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 0, 0,
      jsonb_build_object(
        'idempotency_key', 'idempotency.synthetic.ju-a',
        'command_id', 'command.synthetic.ju-a',
        'command_fingerprint', '${HASH.request}',
        'result_event_range', jsonb_build_object('first_sequence_no', 1, 'last_sequence_no', 1),
        'command_event_id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        'committed_event_ids', '["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"]'::jsonb,
        'resulting_state_version', 0,
        'resulting_clinical_time', 0
      ),
      '2026-01-01T00:00:00Z'
    );

    insert into public.patient_state_checkpoints (
      session_id, state_schema_version, patient_state_version,
      last_event_sequence, clinical_time_seconds, clock_status,
      trusted_real_time_anchor_utc, patient_state_payload,
      scheduler_state_payload, clinical_clock_payload, aggregate_payload,
      checkpoint_hash
    )
    select session_id, '2.0', patient_state_version, next_event_sequence - 1,
      clinical_time_seconds, clock_status, trusted_real_time_anchor_utc,
      patient_state_payload, scheduler_state_payload, clinical_clock_payload,
      aggregate_payload, '${HASH.checkpoint}'
    from public.simulation_sessions
    where session_id = 'session.synthetic.ju-a';
  `);

  await insertAssessment(client, {
    assessmentId: "assessment.synthetic.ju-active", sessionId: "session.synthetic.ju-a",
    tenant: "ju", packageId: "case-package.synthetic-ju-published",
    versionId: "case-version.synthetic-ju-published", authority: "PUBLISHED_PRODUCTION",
    packageHash: HASH.juPackage, phase: "LIVE"
  });
  await insertAssessment(client, {
    assessmentId: "assessment.synthetic.ju-final", sessionId: "session.synthetic.ju-a",
    tenant: "ju", packageId: "case-package.synthetic-ju-published",
    versionId: "case-version.synthetic-ju-published", authority: "PUBLISHED_PRODUCTION",
    packageHash: HASH.juPackage, phase: "FINAL"
  });
  await insertAssessment(client, {
    assessmentId: "assessment.synthetic.just", sessionId: "session.synthetic.just",
    tenant: "just", packageId: "case-package.synthetic-just-published",
    versionId: "case-version.synthetic-just-published", authority: "PUBLISHED_PRODUCTION",
    packageHash: HASH.justPackage, phase: "LIVE"
  });
  await insertAssessment(client, {
    assessmentId: "assessment.synthetic.ju-review", sessionId: "session.synthetic.ju-review",
    tenant: "ju", packageId: "case-package.synthetic-ju-review",
    versionId: "case-version.synthetic-ju-review", authority: "REVIEW_ONLY",
    reviewExecutionHash: HASH.juReviewExecution, reviewSubjectHash: HASH.juReviewSubject,
    phase: "LIVE"
  });

  await client.query(`
    insert into public.assessment_domain_scores (
      assessment_id, domain_id, earned_points, maximum_points,
      score_basis_points, weight_basis_points,
      weighted_contribution_basis_points, evidence_payload
    ) values (
      'assessment.synthetic.ju-final', 'domain.synthetic', 5, 10,
      5000, 10000, 5000, '{"evidence":"synthetic"}'::jsonb
    );

    insert into public.assessment_findings (
      finding_id, assessment_id, finding_category, rubric_item_id,
      finding_status, reveal_policy, evidence_payload
    ) values (
      'finding.synthetic.ju-final', 'assessment.synthetic.ju-final',
      'CORRECT_ACTION', 'rubric-item.synthetic', 'FINAL',
      'FINAL_DEBRIEF_ONLY', '{"evidence":"synthetic"}'::jsonb
    );

    insert into public.assessment_debriefs (
      assessment_id, debrief_schema_version, authority, evidence_package_payload
    ) values (
      'assessment.synthetic.ju-final', '1.0',
      'DETERMINISTIC_ASSESSMENT_EVIDENCE', '{"evidence":"synthetic"}'::jsonb
    );
  `);
}

async function insertProductionSession(client, fixture) {
  const patient = { state_version: 0, clinical_time: 0 };
  const scheduler = { pending: [] };
  const clock = { status: "PAUSED", clinical_time: 0 };
  const aggregate = {
    session_id: fixture.sessionId,
    aggregate_schema_version: "1.0",
    status: "ACTIVE",
    mode: "PRACTICE_DEMO",
    pinned_case: {
      execution_authority: "PUBLISHED_PRODUCTION",
      case_package_id: fixture.packageId,
      case_version_id: fixture.versionId,
      case_version: "1.0.1",
      package_hash: fixture.packageHash
    },
    patient_state: patient,
    scheduler_state: scheduler,
    clinical_clock: clock,
    next_sequence_no: 2,
    trusted_real_time_anchor_utc: null
  };
  await client.query(`
    insert into public.simulation_sessions (
      session_id, institution_id, learner_user_id, learner_membership_id,
      aggregate_schema_version, session_status, simulation_mode,
      execution_authority, case_package_id, case_version_id, case_version,
      published_package_hash, patient_state_version, clinical_time_seconds,
      clock_status, next_event_sequence, patient_state_payload,
      scheduler_state_payload, clinical_clock_payload, aggregate_payload
    ) values ($1, $2, $3, $4, '1.0', 'ACTIVE', 'PRACTICE_DEMO',
      'PUBLISHED_PRODUCTION', $5, $6, '1.0.1', $7, 0, 0, 'PAUSED', 2,
      $8::jsonb, $9::jsonb, $10::jsonb, $11::jsonb)
  `, [
    fixture.sessionId, fixture.tenant, fixture.userId, fixture.membershipId,
    fixture.packageId, fixture.versionId, fixture.packageHash,
    JSON.stringify(patient), JSON.stringify(scheduler), JSON.stringify(clock),
    JSON.stringify(aggregate)
  ]);
}

async function insertReviewSession(client) {
  const patient = { state_version: 0, clinical_time: 0 };
  const scheduler = { pending: [] };
  const clock = { status: "PAUSED", clinical_time: 0 };
  const aggregate = {
    session_id: "session.synthetic.ju-review",
    aggregate_schema_version: "1.0",
    status: "ACTIVE",
    mode: "PRACTICE_DEMO",
    pinned_case: {
      execution_authority: "REVIEW_ONLY",
      case_package_id: "case-package.synthetic-ju-review",
      case_version_id: "case-version.synthetic-ju-review",
      case_version: "1.0.0",
      review_execution_hash: HASH.juReviewExecution,
      review_subject_hash: HASH.juReviewSubject
    },
    patient_state: patient,
    scheduler_state: scheduler,
    clinical_clock: clock,
    next_sequence_no: 1,
    trusted_real_time_anchor_utc: null
  };
  await client.query(`
    insert into public.simulation_sessions (
      session_id, institution_id, learner_user_id, learner_membership_id,
      aggregate_schema_version, session_status, simulation_mode,
      execution_authority, case_package_id, case_version_id, case_version,
      review_execution_hash, review_subject_hash,
      patient_state_version, clinical_time_seconds, clock_status,
      next_event_sequence, patient_state_payload, scheduler_state_payload,
      clinical_clock_payload, aggregate_payload
    ) values (
      'session.synthetic.ju-review', 'ju', '${USERS.juReviewer}',
      'membership.ju.reviewer', '1.0', 'ACTIVE', 'PRACTICE_DEMO',
      'REVIEW_ONLY', 'case-package.synthetic-ju-review',
      'case-version.synthetic-ju-review', '1.0.0',
      '${HASH.juReviewExecution}', '${HASH.juReviewSubject}',
      0, 0, 'PAUSED', 1, $1::jsonb, $2::jsonb, $3::jsonb, $4::jsonb
    )
  `, [JSON.stringify(patient), JSON.stringify(scheduler), JSON.stringify(clock), JSON.stringify(aggregate)]);
}

async function insertEvent(client, sessionId, eventId) {
  const idempotencyKey = `idempotency.${sessionId}`;
  const envelope = {
    event_id: eventId,
    session_id: sessionId,
    sequence_no: 1,
    event_schema_version: "1.0",
    clinical_time: 0,
    event_type: "SESSION_STARTED",
    status: "COMMITTED",
    actor_type: "SYSTEM",
    source: "ENGINE",
    correlation_id: `correlation.${sessionId}`,
    idempotency_key: idempotencyKey
  };
  await client.query(`
    insert into public.session_events (
      event_id, session_id, event_sequence, event_schema_version,
      clinical_time_seconds, real_time_utc, actor_type, event_source,
      correlation_id, event_type, event_status, idempotency_key,
      envelope_payload
    ) values ($1, $2, 1, '1.0', 0, '2026-01-01T00:00:00Z',
      'SYSTEM', 'ENGINE', $3, 'SESSION_STARTED', 'COMMITTED', $4, $5::jsonb)
  `, [eventId, sessionId, envelope.correlation_id, idempotencyKey, JSON.stringify(envelope)]);
}

async function insertAssessment(client, fixture) {
  const payload = {
    assessment_id: fixture.assessmentId,
    session_id: fixture.sessionId,
    execution_authority: fixture.authority,
    case_package_id: fixture.packageId,
    case_version_id: fixture.versionId,
    case_version: fixture.authority === "REVIEW_ONLY" ? "1.0.0" : "1.0.1",
    rubric_id: `rubric.synthetic-${fixture.tenant}`,
    rubric_module_hash: HASH.rubric,
    overall_score_basis_points: 5000,
    ...(fixture.packageHash ? { package_hash: fixture.packageHash } : {}),
    ...(fixture.reviewExecutionHash ? {
      review_execution_hash: fixture.reviewExecutionHash,
      review_subject_hash: fixture.reviewSubjectHash
    } : {})
  };
  await client.query(`
    insert into public.assessments (
      assessment_id, session_id, institution_id, result_schema_version,
      trace_version, execution_authority, case_package_id, case_version_id,
      case_version, package_hash, review_execution_hash, review_subject_hash,
      rubric_id, rubric_version, rubric_module_schema_version,
      rubric_module_hash, evaluation_phase, assessed_through_clinical_time,
      event_sequence_through, overall_score_basis_points,
      maximum_score_basis_points, unsafe, finalization_boundary_payload,
      assessment_result_payload
    ) values (
      $1, $2, $3, '1.0', '1.0', $4, $5, $6, $7, $8, $9, $10,
      $11, '1.0.0', '2.0', '${HASH.rubric}', $12, 0, 1, 5000,
      10000, false, $13::jsonb, $14::jsonb
    )
  `, [
    fixture.assessmentId, fixture.sessionId, fixture.tenant, fixture.authority,
    fixture.packageId, fixture.versionId,
    fixture.authority === "REVIEW_ONLY" ? "1.0.0" : "1.0.1",
    fixture.packageHash ?? null, fixture.reviewExecutionHash ?? null,
    fixture.reviewSubjectHash ?? null, `rubric.synthetic-${fixture.tenant}`,
    fixture.phase,
    fixture.phase === "FINAL" ? JSON.stringify({ event_sequence_through: 1 }) : null,
    JSON.stringify(payload)
  ]);
}

async function main() {
  const migrations = await loadMigrations();
  const v2_011a = migrations.filter(({ name }) => name !== RLS_MIGRATION);
  const v2_011b = migrations.filter(({ name }) => name === RLS_MIGRATION);
  assert(v2_011b.length === 1, "Expected exactly one V2-011B migration.");

  const port = await findFreePort();
  const databaseDir = await mkdtemp(join(tmpdir(), "v2-011b-native-postgres-"));
  const postgres = new EmbeddedPostgres({
    databaseDir,
    user: "postgres",
    password: "local-rls-test",
    port,
    persistent: false,
    onLog: () => undefined,
    onError: () => undefined
  });

  let admin;
  let full;
  let upgrade;
  let reset;
  try {
    await postgres.initialise();
    await postgres.start();
    admin = postgres.getPgClient();
    await admin.connect();
    await bootstrapCluster(admin);
    for (const databaseName of ["v2_011b_full", "v2_011b_upgrade", "v2_011b_reset"]) {
      await postgres.createDatabase(databaseName);
    }

    full = postgres.getPgClient("v2_011b_full");
    upgrade = postgres.getPgClient("v2_011b_upgrade");
    reset = postgres.getPgClient("v2_011b_reset");
    await Promise.all([full.connect(), upgrade.connect(), reset.connect()]);
    await Promise.all([bootstrapAuth(full), bootstrapAuth(upgrade), bootstrapAuth(reset)]);

    await check("real native PostgreSQL 16.14 executes the RLS gate", async () => {
      const result = await full.query("select version() as version, current_setting('row_security') as row_security");
      assert(result.rows[0].version.startsWith("PostgreSQL 16.14"), result.rows[0].version);
      assert(result.rows[0].row_security === "on", "row_security must be on.");
    });

    await check("empty database applies V2-011A plus V2-011B", async () => {
      await applyMigrations(full, migrations);
    });

    await check("V2-011A to V2-011B upgrade path applies", async () => {
      await applyMigrations(upgrade, v2_011a);
      const before = await upgrade.query("select count(*)::int as count from pg_policies where schemaname = 'public'");
      assert(before.rows[0].count === 0, "V2-011A must begin with zero policies.");
      await applyMigrations(upgrade, v2_011b);
    });

    await check("reset and clean reapply succeeds", async () => {
      await applyMigrations(reset, migrations);
    });

    await seedDatabase(full);

    await check("all 28 application tables retain RLS", async () => {
      const result = await full.query(`
        select relname
        from pg_class
        join pg_namespace on pg_namespace.oid = pg_class.relnamespace
        where nspname = 'public' and relkind = 'r' and relrowsecurity
        order by relname
      `);
      assert(result.rows.length === 28, `Expected 28 RLS tables, got ${result.rows.length}.`);
      assert(JSON.stringify(result.rows.map(({ relname }) => relname)) === JSON.stringify([...APPLICATION_TABLES].sort()), "RLS table inventory mismatch.");
    });

    await check("all 28 application tables use FORCE RLS", async () => {
      const result = await full.query(`
        select count(*)::int as count
        from pg_class
        join pg_namespace on pg_namespace.oid = pg_class.relnamespace
        where nspname = 'public' and relkind = 'r' and relforcerowsecurity
      `);
      assert(result.rows[0].count === 28, `Expected 28 FORCE RLS tables, got ${result.rows[0].count}.`);
    });

    await check("the exact 14-policy inventory is installed", async () => {
      const result = await full.query("select policyname from pg_policies where schemaname = 'public' order by policyname");
      assert(JSON.stringify(result.rows.map(({ policyname }) => policyname)) === JSON.stringify(EXPECTED_POLICIES), "Policy inventory mismatch.");
    });

    await check("the membership helper is SECURITY DEFINER with an empty search_path", async () => {
      const result = await full.query(`
        select prosecdef, proconfig
        from pg_proc
        join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
        where nspname = 'public' and proname = 'current_user_has_active_membership'
      `);
      assert(result.rows.length === 1, "Expected one membership helper.");
      assert(result.rows[0].prosecdef === true, "Helper must be SECURITY DEFINER.");
      assert(result.rows[0].proconfig?.includes("search_path=\"\"") === true, `Unexpected proconfig ${result.rows[0].proconfig}.`);
    });

    await check("test principals are non-owner and cannot bypass RLS", async () => {
      const result = await full.query(`
        select rolname, rolsuper, rolbypassrls
        from pg_roles
        where rolname like 'v2_011b_%'
        order by rolname
      `);
      assert(result.rows.length === 9, `Expected nine test principals, got ${result.rows.length}.`);
      assert(result.rows.every((row) => !row.rolsuper && !row.rolbypassrls), "Client test principal bypasses RLS.");
    });

    await check("anonymous cannot execute the membership helper", async () => {
      await expectPermissionDenied(full, PRINCIPALS.anon, "select public.current_user_has_active_membership('ju', array['LEARNER']::text[])");
    });

    for (const table of APPLICATION_TABLES) {
      await check(`anonymous cannot read ${table}`, async () => {
        await expectPermissionDenied(full, PRINCIPALS.anon, `select * from public.${table} limit 1`);
      });
    }

    await check("anonymous cannot insert a profile", async () => {
      await expectPermissionDenied(full, PRINCIPALS.anon, `insert into public.profiles (user_id) values ('99999999-9999-4999-8999-999999999999')`);
    });
    await check("anonymous cannot update an institution", async () => {
      await expectPermissionDenied(full, PRINCIPALS.anon, "update public.institutions set institution_name = 'Changed' where institution_id = 'ju'");
    });
    await check("anonymous cannot delete an institution", async () => {
      await expectPermissionDenied(full, PRINCIPALS.anon, "delete from public.institutions where institution_id = 'ju'");
    });

    await check("authenticated user reads only own profile", async () => {
      const own = await queryAs(full, PRINCIPALS.juLearnerA, "select user_id from public.profiles order by user_id");
      assert(own.rows.length === 1 && own.rows[0].user_id === USERS.juLearnerA, "Own-profile isolation failed.");
    });
    await check("cross-tenant profile access is denied", async () => {
      const result = await queryAs(full, PRINCIPALS.juLearnerA, "select user_id from public.profiles where user_id = $1", [USERS.justLearner]);
      assert(result.rows.length === 0, "Foreign profile leaked.");
    });
    await check("safe own-profile display update is allowed", async () => {
      const result = await queryAs(full, PRINCIPALS.juLearnerA, "update public.profiles set display_alias = 'Safe alias' where user_id = $1 returning display_alias", [USERS.juLearnerA]);
      assert(result.rows[0]?.display_alias === "Safe alias", "Safe profile update failed.");
    });
    await check("another profile cannot be updated", async () => {
      const result = await queryAs(full, PRINCIPALS.juLearnerA, "update public.profiles set display_alias = 'Attack' where user_id = $1 returning user_id", [USERS.juLearnerB]);
      assert(result.rows.length === 0, "Foreign profile update succeeded.");
    });
    await check("profile auth linkage cannot be changed", async () => {
      await expectPermissionDenied(full, PRINCIPALS.juLearnerA, "update public.profiles set user_id = $1 where user_id = $2", [USERS.juLearnerB, USERS.juLearnerA]);
    });
    await check("profile schema and operational timestamps are not client-editable", async () => {
      await expectPermissionDenied(full, PRINCIPALS.juLearnerA, "update public.profiles set profile_schema_version = '9.9' where user_id = $1", [USERS.juLearnerA]);
    });

    await check("learner reads only own active membership", async () => {
      const result = await queryAs(full, PRINCIPALS.juLearnerA, "select membership_id from public.institution_memberships order by membership_id");
      assert(JSON.stringify(result.rows.map(({ membership_id }) => membership_id)) === JSON.stringify(["membership.ju.learner-a"]), "Membership isolation failed.");
    });
    await check("cross-tenant membership read is denied", async () => {
      const result = await queryAs(full, PRINCIPALS.juLearnerA, "select membership_id from public.institution_memberships where institution_id = 'just'");
      assert(result.rows.length === 0, "Foreign membership leaked.");
    });
    await check("learner cannot self-elevate to faculty", async () => {
      await expectPermissionDenied(full, PRINCIPALS.juLearnerA, "update public.institution_memberships set membership_role = 'FACULTY' where membership_id = 'membership.ju.learner-a'");
    });
    await check("learner cannot self-elevate to reviewer", async () => {
      await expectPermissionDenied(full, PRINCIPALS.juLearnerA, "update public.institution_memberships set membership_role = 'REVIEWER' where membership_id = 'membership.ju.learner-a'");
    });
    await check("learner cannot move membership to another institution", async () => {
      await expectPermissionDenied(full, PRINCIPALS.juLearnerA, "update public.institution_memberships set institution_id = 'just' where membership_id = 'membership.ju.learner-a'");
    });
    await check("disabled membership cannot reactivate itself", async () => {
      await expectPermissionDenied(full, PRINCIPALS.disabledLearner, "update public.institution_memberships set membership_status = 'ACTIVE' where membership_id = 'membership.ju.disabled'");
    });
    await check("learner cannot insert a foreign membership claim", async () => {
      await expectPermissionDenied(full, PRINCIPALS.juLearnerA, `insert into public.institution_memberships (membership_id, institution_id, user_id, membership_role) values ('membership.attack', 'just', '${USERS.juLearnerA}', 'FACULTY')`);
    });
    await check("faculty cannot grant itself backend-like membership authority", async () => {
      await expectPermissionDenied(full, PRINCIPALS.juFaculty, "update public.institution_memberships set membership_role = 'REVIEWER' where membership_id = 'membership.ju.faculty'");
    });

    await check("JU learner sees only JU institution metadata", async () => {
      const result = await queryAs(full, PRINCIPALS.juLearnerA, "select institution_id from public.institutions order by institution_id");
      assert(JSON.stringify(result.rows.map(({ institution_id }) => institution_id)) === JSON.stringify(["ju"]), "Institution isolation failed.");
    });
    await check("inactive membership grants no institution access", async () => {
      const result = await queryAs(full, PRINCIPALS.disabledLearner, "select institution_id from public.institutions");
      assert(result.rows.length === 0, "Inactive membership granted access.");
    });

    await check("JU faculty reads JU Case source only", async () => {
      const result = await queryAs(full, PRINCIPALS.juFaculty, "select case_id from public.clinical_cases order by case_id");
      assert(JSON.stringify(result.rows.map(({ case_id }) => case_id)) === JSON.stringify(["case.synthetic-ju"]), "JU faculty Case isolation failed.");
    });
    await check("JUST faculty reads JUST Case source only", async () => {
      const result = await queryAs(full, PRINCIPALS.justFaculty, "select case_id from public.clinical_cases order by case_id");
      assert(JSON.stringify(result.rows.map(({ case_id }) => case_id)) === JSON.stringify(["case.synthetic-just"]), "JUST faculty Case isolation failed.");
    });
    await check("learner cannot read authored Case source", async () => {
      const result = await queryAs(full, PRINCIPALS.juLearnerA, "select case_id from public.clinical_cases");
      assert(result.rows.length === 0, "Learner saw authored Case source.");
    });
    await check("learner cannot read global clinical source metadata", async () => {
      const result = await queryAs(full, PRINCIPALS.juLearnerA, "select source_id from public.clinical_sources");
      assert(result.rows.length === 0, "Learner saw raw global clinical source metadata.");
    });
    await check("unassigned reviewer cannot read authored Cases", async () => {
      const result = await queryAs(full, PRINCIPALS.juReviewer, "select case_id from public.clinical_cases");
      assert(result.rows.length === 0, "Reviewer assignment dependency was bypassed.");
    });
    await check("JU faculty cannot read JUST Case Versions", async () => {
      const result = await queryAs(full, PRINCIPALS.juFaculty, "select case_version_id from public.case_versions where institution_id = 'just'");
      assert(result.rows.length === 0, "Foreign Case Version leaked.");
    });
    await check("JU faculty cannot read JUST modules", async () => {
      const result = await queryAs(full, PRINCIPALS.juFaculty, "select case_version_id from public.case_modules where institution_id = 'just'");
      assert(result.rows.length === 0, "Foreign module leaked.");
    });
    await check("faculty source visibility is global plus own institution", async () => {
      const result = await queryAs(full, PRINCIPALS.juFaculty, "select source_id from public.clinical_sources order by source_id");
      assert(JSON.stringify(result.rows.map(({ source_id }) => source_id)) === JSON.stringify(["source.synthetic-global", "source.synthetic-ju"]), "Clinical source scope failed.");
    });
    await check("clinical source versions cannot leak a foreign source", async () => {
      const result = await queryAs(full, PRINCIPALS.juFaculty, "select source_version_id from public.clinical_source_versions order by source_version_id");
      assert(JSON.stringify(result.rows.map(({ source_version_id }) => source_version_id)) === JSON.stringify(["source-version.synthetic-global", "source-version.synthetic-ju"]), "Clinical source version scope failed.");
    });
    await check("curriculum mappings are scoped to the Case owner institution", async () => {
      const result = await queryAs(full, PRINCIPALS.juFaculty, "select mapping_id from public.curriculum_mappings order by mapping_id");
      assert(JSON.stringify(result.rows.map(({ mapping_id }) => mapping_id)) === JSON.stringify(["mapping.synthetic-ju"]), "Curriculum mapping isolation failed.");
    });
    await check("faculty cannot mutate Case source", async () => {
      await expectPermissionDenied(full, PRINCIPALS.juFaculty, "update public.clinical_cases set title = 'Attack' where case_id = 'case.synthetic-ju'");
    });
    await check("faculty cannot mutate Case Version", async () => {
      await expectPermissionDenied(full, PRINCIPALS.juFaculty, "update public.case_versions set institution_id = 'just' where case_version_id = 'case-version.synthetic-ju-review'");
    });
    await check("faculty cannot insert a Case before assignment workflow exists", async () => {
      await expectPermissionDenied(full, PRINCIPALS.juFaculty, "insert into public.clinical_cases (case_id, institution_id, case_slug, title, topic_code, owner_membership_id) values ('case.attack', 'ju', 'attack', 'Attack', 'topic.attack', 'membership.ju.faculty')");
    });
    await check("JU faculty cannot insert a JUST Case claim", async () => {
      await expectPermissionDenied(full, PRINCIPALS.juFaculty, "insert into public.clinical_cases (case_id, institution_id, case_slug, title, topic_code, owner_membership_id) values ('case.cross-tenant-attack', 'just', 'cross-tenant-attack', 'Attack', 'topic.attack', 'membership.just.faculty')");
    });
    await check("JU faculty cannot update a JUST Case", async () => {
      await expectPermissionDenied(full, PRINCIPALS.juFaculty, "update public.clinical_cases set title = 'Attack' where case_id = 'case.synthetic-just'");
    });
    await check("JU faculty cannot delete a JUST Case", async () => {
      await expectPermissionDenied(full, PRINCIPALS.juFaculty, "delete from public.clinical_cases where case_id = 'case.synthetic-just'");
    });
    await check("duplicate privileged membership insertion is denied", async () => {
      await expectPermissionDenied(full, PRINCIPALS.juLearnerA, `insert into public.institution_memberships (membership_id, institution_id, user_id, membership_role) values ('membership.attack-duplicate', 'ju', '${USERS.juLearnerA}', 'FACULTY')`);
    });

    const governanceTables = ["case_reviews", "case_approvals", "case_approval_review_refs", "review_execution_artifacts", "case_packages"];
    for (const table of governanceTables) {
      await check(`learner cannot read governance table ${table}`, async () => {
        await expectPermissionDenied(full, PRINCIPALS.juLearnerA, `select * from public.${table} limit 1`);
      });
    }
    await check("learner cannot create a review artifact", async () => {
      await expectPermissionDenied(full, PRINCIPALS.juLearnerA, "insert into public.review_execution_artifacts default values");
    });
    await check("learner cannot create a Published package", async () => {
      await expectPermissionDenied(full, PRINCIPALS.juLearnerA, "insert into public.case_packages default values");
    });
    await check("learner cannot create an Approval Record", async () => {
      await expectPermissionDenied(full, PRINCIPALS.juLearnerA, "insert into public.case_approvals default values");
    });
    await check("faculty cannot create an Approval Record", async () => {
      await expectPermissionDenied(full, PRINCIPALS.juFaculty, "insert into public.case_approvals default values");
    });
    await check("reviewer cannot read foreign review artifact", async () => {
      await expectPermissionDenied(full, PRINCIPALS.juReviewer, "select * from public.review_execution_artifacts where institution_id = 'just'");
    });
    await check("reviewer cannot rewrite historical review", async () => {
      await expectPermissionDenied(full, PRINCIPALS.juReviewer, "update public.case_reviews set review_status = 'REJECTED' where review_id = 'review.synthetic-ju'");
    });
    await check("reviewer cannot move a review target across tenants", async () => {
      await expectPermissionDenied(full, PRINCIPALS.juReviewer, "update public.case_reviews set institution_id = 'just', case_version_id = 'case-version.synthetic-just-review' where review_id = 'review.synthetic-ju'");
    });
    await check("faculty cannot bypass Published artifact governance", async () => {
      await expectPermissionDenied(full, PRINCIPALS.juFaculty, "update public.case_packages set package_hash = $1 where institution_id = 'ju'", ["9".repeat(64)]);
    });
    await check("stale package hash remains structurally rejected for trusted backend", async () => {
      await expectSqlState(full, PRINCIPALS.service, `
        insert into public.case_approvals (
          approval_id, institution_id, case_version_id, case_package_id,
          approved_case_version, approved_package_hash, review_subject_hash,
          approval_scope, approval_status, approver_ref_id,
          approver_membership_id, approver_role_code, approved_at, approval_payload
        ) values (
          'approval.stale-hash', 'ju', 'case-version.synthetic-ju-published',
          'case-package.synthetic-ju-published', '1.0.1', $1, $2,
          'CASE_PACKAGE_PUBLICATION', 'APPROVED', 'approver.synthetic-ju',
          'membership.ju.faculty', 'role.faculty', '2026-01-01T00:00:00Z', '{}'::jsonb
        )
      `, ["23503"], ["9".repeat(64), HASH.juPublishedReview]);
    });

    const sessionTables = ["simulation_sessions", "session_events", "session_commands", "patient_state_checkpoints"];
    for (const table of sessionTables) {
      await check(`learner has no raw access to ${table}`, async () => {
        await expectPermissionDenied(full, PRINCIPALS.juLearnerA, `select * from public.${table} limit 1`);
      });
    }
    await check("learner A cannot read learner B Session", async () => {
      await expectPermissionDenied(full, PRINCIPALS.juLearnerA, "select * from public.simulation_sessions where session_id = 'session.synthetic.ju-b'");
    });
    await check("JU learner cannot read JUST Session", async () => {
      await expectPermissionDenied(full, PRINCIPALS.juLearnerA, "select * from public.simulation_sessions where session_id = 'session.synthetic.just'");
    });
    await check("learner cannot change Session institution", async () => {
      await expectPermissionDenied(full, PRINCIPALS.juLearnerA, "update public.simulation_sessions set institution_id = 'just' where session_id = 'session.synthetic.ju-a'");
    });
    await check("learner cannot change Session owner", async () => {
      await expectPermissionDenied(full, PRINCIPALS.juLearnerA, "update public.simulation_sessions set learner_user_id = $1 where session_id = 'session.synthetic.ju-a'", [USERS.juLearnerB]);
    });
    await check("learner cannot change Session execution authority", async () => {
      await expectPermissionDenied(full, PRINCIPALS.juLearnerA, "update public.simulation_sessions set execution_authority = 'REVIEW_ONLY' where session_id = 'session.synthetic.ju-a'");
    });
    await check("learner cannot change pinned package hash", async () => {
      await expectPermissionDenied(full, PRINCIPALS.juLearnerA, "update public.simulation_sessions set published_package_hash = $1 where session_id = 'session.synthetic.ju-a'", ["9".repeat(64)]);
    });
    await check("learner cannot mutate Patient State", async () => {
      await expectPermissionDenied(full, PRINCIPALS.juLearnerA, "update public.simulation_sessions set patient_state_payload = '{}'::jsonb where session_id = 'session.synthetic.ju-a'");
    });
    await check("learner cannot mutate Clinical Time", async () => {
      await expectPermissionDenied(full, PRINCIPALS.juLearnerA, "update public.simulation_sessions set clinical_time_seconds = 99 where session_id = 'session.synthetic.ju-a'");
    });
    await check("learner cannot mutate scheduler state", async () => {
      await expectPermissionDenied(full, PRINCIPALS.juLearnerA, "update public.simulation_sessions set scheduler_state_payload = '{}'::jsonb where session_id = 'session.synthetic.ju-a'");
    });
    await check("learner cannot mutate event sequence", async () => {
      await expectPermissionDenied(full, PRINCIPALS.juLearnerA, "update public.simulation_sessions set next_event_sequence = 99 where session_id = 'session.synthetic.ju-a'");
    });
    await check("learner cannot convert review Session to production", async () => {
      await expectPermissionDenied(full, PRINCIPALS.juLearnerA, "update public.simulation_sessions set execution_authority = 'PUBLISHED_PRODUCTION' where session_id = 'session.synthetic.ju-review'");
    });
    await check("learner cannot rebind production Session to review artifact", async () => {
      await expectPermissionDenied(full, PRINCIPALS.juLearnerA, "update public.simulation_sessions set execution_authority = 'REVIEW_ONLY' where session_id = 'session.synthetic.ju-a'");
    });
    await check("learner cannot insert committed Event", async () => {
      await expectPermissionDenied(full, PRINCIPALS.juLearnerA, "insert into public.session_events default values");
    });
    await check("learner cannot update committed Event", async () => {
      await expectPermissionDenied(full, PRINCIPALS.juLearnerA, "update public.session_events set event_sequence = 2 where session_id = 'session.synthetic.ju-a'");
    });
    await check("learner cannot delete committed Event", async () => {
      await expectPermissionDenied(full, PRINCIPALS.juLearnerA, "delete from public.session_events where session_id = 'session.synthetic.ju-a'");
    });
    await check("cross-tenant Event access is denied", async () => {
      await expectPermissionDenied(full, PRINCIPALS.juLearnerA, "select * from public.session_events where session_id = 'session.synthetic.just'");
    });
    await check("learner cannot forge committed idempotency record", async () => {
      await expectPermissionDenied(full, PRINCIPALS.juLearnerA, "insert into public.session_commands default values");
    });
    await check("learner cannot rewrite idempotency record", async () => {
      await expectPermissionDenied(full, PRINCIPALS.juLearnerA, "update public.session_commands set canonical_request_hash = $1 where session_id = 'session.synthetic.ju-a'", ["9".repeat(64)]);
    });
    await check("learner cannot delete idempotency record", async () => {
      await expectPermissionDenied(full, PRINCIPALS.juLearnerA, "delete from public.session_commands where session_id = 'session.synthetic.ju-a'");
    });

    const assessmentTables = ["assessments", "assessment_domain_scores", "assessment_findings", "assessment_debriefs"];
    for (const table of assessmentTables) {
      await check(`active learner cannot read raw ${table}`, async () => {
        await expectPermissionDenied(full, PRINCIPALS.juLearnerA, `select * from public.${table} limit 1`);
      });
    }
    await check("learner cannot create Assessment score", async () => {
      await expectPermissionDenied(full, PRINCIPALS.juLearnerA, "insert into public.assessments default values");
    });
    await check("learner cannot update overall score", async () => {
      await expectPermissionDenied(full, PRINCIPALS.juLearnerA, "update public.assessments set overall_score_basis_points = 10000 where assessment_id = 'assessment.synthetic.ju-final'");
    });
    await check("learner cannot remove unsafe marker", async () => {
      await expectPermissionDenied(full, PRINCIPALS.juLearnerA, "update public.assessments set unsafe = false where assessment_id = 'assessment.synthetic.ju-final'");
    });
    await check("learner cannot fabricate finalization", async () => {
      await expectPermissionDenied(full, PRINCIPALS.juLearnerA, "update public.assessments set evaluation_phase = 'FINAL' where assessment_id = 'assessment.synthetic.ju-active'");
    });
    await check("learner cannot alter domain score", async () => {
      await expectPermissionDenied(full, PRINCIPALS.juLearnerA, "update public.assessment_domain_scores set score_basis_points = 10000 where assessment_id = 'assessment.synthetic.ju-final'");
    });
    await check("learner cannot alter Assessment evidence", async () => {
      await expectPermissionDenied(full, PRINCIPALS.juLearnerA, "update public.assessment_findings set evidence_payload = '{}'::jsonb where assessment_id = 'assessment.synthetic.ju-final'");
    });
    await check("learner cannot delete penalties/findings", async () => {
      await expectPermissionDenied(full, PRINCIPALS.juLearnerA, "delete from public.assessment_findings where assessment_id = 'assessment.synthetic.ju-final'");
    });
    await check("review Assessment cannot be converted to production", async () => {
      await expectPermissionDenied(full, PRINCIPALS.juReviewer, "update public.assessments set execution_authority = 'PUBLISHED_PRODUCTION' where assessment_id = 'assessment.synthetic.ju-review'");
    });
    await check("learner cannot move Assessment tenant binding", async () => {
      await expectPermissionDenied(full, PRINCIPALS.juLearnerA, "update public.assessments set institution_id = 'just' where assessment_id = 'assessment.synthetic.ju-final'");
    });
    await check("cross-tenant Assessment read is denied", async () => {
      await expectPermissionDenied(full, PRINCIPALS.juLearnerA, "select * from public.assessments where assessment_id = 'assessment.synthetic.just'");
    });
    await check("cross-tenant Assessment mutation is denied", async () => {
      await expectPermissionDenied(full, PRINCIPALS.juLearnerA, "update public.assessments set overall_score_basis_points = 0 where assessment_id = 'assessment.synthetic.just'");
    });

    await check("JU faculty cannot access JUST private authoring", async () => {
      const result = await queryAs(full, PRINCIPALS.juFaculty, "select case_id from public.clinical_cases where institution_id = 'just'");
      assert(result.rows.length === 0, "JU faculty crossed tenant boundary.");
    });
    await check("JUST faculty cannot access JU private authoring", async () => {
      const result = await queryAs(full, PRINCIPALS.justFaculty, "select case_id from public.clinical_cases where institution_id = 'ju'");
      assert(result.rows.length === 0, "JUST faculty crossed tenant boundary.");
    });
    await check("reviewer cannot access foreign-tenant reviews", async () => {
      await expectPermissionDenied(full, PRINCIPALS.juReviewer, "select * from public.case_reviews where institution_id = 'just'");
    });
    await check("faculty cannot access raw asset governance", async () => {
      await expectPermissionDenied(full, PRINCIPALS.juFaculty, "select * from public.media_assets where owner_institution_id = 'ju'");
    });

    await check("trusted backend can read and insert through BYPASSRLS", async () => {
      const result = await queryAs(full, PRINCIPALS.service, `
        insert into public.clinical_cases (
          case_id, institution_id, case_slug, title, topic_code, owner_membership_id
        ) values (
          'case.synthetic-trusted', 'ju', 'synthetic-trusted',
          'Synthetic trusted Case', 'topic.synthetic', 'membership.ju.faculty'
        ) returning case_id
      `);
      assert(result.rows[0]?.case_id === "case.synthetic-trusted", "Trusted backend insert failed.");
    });
    await check("trusted backend can append an authoritative Event", async () => {
      const eventId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
      const result = await queryAs(full, PRINCIPALS.service, `
        insert into public.session_events (
          event_id, session_id, event_sequence, event_schema_version,
          clinical_time_seconds, real_time_utc, actor_type, event_source,
          correlation_id, event_type, event_status, idempotency_key,
          envelope_payload
        ) values (
          $1::uuid, 'session.synthetic.ju-a', 2, '1.0', 0,
          '2026-01-01T00:00:01Z', 'SYSTEM', 'ENGINE',
          'correlation.synthetic.trusted', 'SESSION_PAUSED', 'COMMITTED',
          'idempotency.synthetic.trusted',
          jsonb_build_object(
            'event_id', $1::text,
            'session_id', 'session.synthetic.ju-a',
            'sequence_no', 2,
            'event_schema_version', '1.0',
            'clinical_time', 0,
            'event_type', 'SESSION_PAUSED',
            'status', 'COMMITTED',
            'actor_type', 'SYSTEM',
            'source', 'ENGINE',
            'correlation_id', 'correlation.synthetic.trusted',
            'idempotency_key', 'idempotency.synthetic.trusted'
          )
        ) returning event_id
      `, [eventId]);
      assert(result.rows[0]?.event_id === eventId, "Trusted Event append failed.");
    });

    for (const [table, assignment, predicate] of [
      ["review_execution_artifacts", "created_at = created_at", `review_execution_hash = '${HASH.juReviewExecution}'`],
      ["case_packages", "created_at = created_at", `package_hash = '${HASH.juPackage}'`],
      ["session_events", "committed_at = committed_at", "session_id = 'session.synthetic.ju-a'"],
      ["patient_state_checkpoints", "created_at = created_at", "session_id = 'session.synthetic.ju-a'"],
      ["assessments", "created_at = created_at", "assessment_id = 'assessment.synthetic.ju-final'"],
      ["assessment_domain_scores", "earned_points = earned_points", "assessment_id = 'assessment.synthetic.ju-final'"],
      ["assessment_findings", "created_at = created_at", "assessment_id = 'assessment.synthetic.ju-final'"],
      ["assessment_debriefs", "created_at = created_at", "assessment_id = 'assessment.synthetic.ju-final'"]
    ]) {
      await check(`immutable trigger blocks trusted UPDATE of ${table}`, async () => {
        await expectSqlState(full, PRINCIPALS.service, `update public.${table} set ${assignment} where ${predicate}`, ["55000"]);
      });
    }

    for (const [table, predicate] of [
      ["review_execution_artifacts", `review_execution_hash = '${HASH.juReviewExecution}'`],
      ["case_packages", `package_hash = '${HASH.juPackage}'`],
      ["session_events", "session_id = 'session.synthetic.ju-a'"],
      ["patient_state_checkpoints", "session_id = 'session.synthetic.ju-a'"],
      ["assessments", "assessment_id = 'assessment.synthetic.ju-final'"],
      ["assessment_domain_scores", "assessment_id = 'assessment.synthetic.ju-final'"],
      ["assessment_findings", "assessment_id = 'assessment.synthetic.ju-final'"],
      ["assessment_debriefs", "assessment_id = 'assessment.synthetic.ju-final'"]
    ]) {
      await check(`immutable trigger blocks trusted DELETE of ${table}`, async () => {
        await expectSqlState(full, PRINCIPALS.service, `delete from public.${table} where ${predicate}`, ["55000"]);
      });
    }

    await check("policy SQL contains no permissive true expression or broad FOR ALL", async () => {
      const sql = v2_011b[0].sql;
      assert(!/using\s*\(\s*true\s*\)/i.test(sql), "USING(true) is forbidden.");
      assert(!/with\s+check\s*\(\s*true\s*\)/i.test(sql), "WITH CHECK(true) is forbidden.");
      assert(!/for\s+all\s+to\s+authenticated/i.test(sql), "Broad FOR ALL authenticated policy is forbidden.");
      assert(!/execute\s+format|execute\s+\$/i.test(sql), "Dynamic SQL is forbidden in policy helpers.");
    });

    await check("no authenticated INSERT or DELETE table grant exists", async () => {
      const result = await full.query(`
        select privilege_type
        from information_schema.role_table_grants
        where grantee = 'authenticated'
          and table_schema = 'public'
          and privilege_type in ('INSERT', 'DELETE')
      `);
      assert(result.rows.length === 0, "Authenticated mutation grant escaped the inventory.");
    });

    await check("authenticated UPDATE grant is column-limited to safe profile fields", async () => {
      const result = await full.query(`
        select table_name, column_name
        from information_schema.column_privileges
        where grantee = 'authenticated'
          and privilege_type = 'UPDATE'
        order by table_name, column_name
      `);
      assert(JSON.stringify(result.rows) === JSON.stringify([
        { table_name: "profiles", column_name: "display_alias" },
        { table_name: "profiles", column_name: "preferred_locale" }
      ]), `Unexpected UPDATE grants: ${JSON.stringify(result.rows)}`);
    });
  } finally {
    for (const client of [full, upgrade, reset, admin]) {
      if (client) await client.end().catch(() => undefined);
    }
    await postgres.stop().catch(() => undefined);
  }

  process.stdout.write(`V2-011B real PostgreSQL RLS tests: ${passed} passed, 0 failed\n`);
}

await main();
