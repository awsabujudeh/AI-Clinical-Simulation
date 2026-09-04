import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import { PGlite } from "@electric-sql/pglite";

import {
  compileCasePackage,
  prepareReviewExecutionArtifact
} from "../packages/case-schema/src/index.ts";
import {
  createDebriefEvidencePackage,
  evaluateReviewAssessment
} from "../packages/assessment-engine/src/index.ts";
import {
  InMemorySessionAggregateSchema,
  initializeInMemorySession,
  initializeReviewInMemorySession,
  projectAssessmentEvidenceFromSession
} from "../packages/session-engine/src/index.ts";
import {
  createFinalPublicationFixture,
  createReviewExecutableUnderReviewCase,
  TEST_HASH_ADAPTER
} from "../tests/fixtures/cases/synthetic-case.ts";
import {
  createExecutedSyntheticCheckEvent,
  evaluateSyntheticAssessment
} from "../tests/fixtures/assessment-engine/synthetic-assessment.ts";

const migrationsDirectory = path.resolve("supabase", "migrations");
const FACULTY_USER_ID = "11111111-1111-4111-8111-111111111111";
const LEARNER_USER_ID = "22222222-2222-4222-8222-222222222222";
const REVIEWER_USER_ID = "33333333-3333-4333-8333-333333333333";
const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);

let passed = 0;

async function check(name, operation) {
  await operation();
  passed += 1;
  process.stdout.write(`ok ${passed} - ${name}\n`);
}

async function expectRejected(name, operation) {
  await check(name, async () => {
    let rejected = false;
    try {
      await operation();
    } catch {
      rejected = true;
    }
    assert.equal(rejected, true, `${name} unexpectedly succeeded`);
  });
}

async function migrationFiles() {
  return (await readdir(migrationsDirectory))
    .filter((file) => file.includes("_v2_011a_") && file.endsWith(".sql"))
    .sort();
}

async function createMigratedDatabase() {
  const database = new PGlite();
  // Supabase owns auth.users. The embedded PostgreSQL harness supplies only its
  // minimum local shape before applying application migrations.
  await database.exec(
    "create schema auth; create table auth.users (id uuid primary key);"
  );
  for (const file of await migrationFiles()) {
    await database.exec(await readFile(path.join(migrationsDirectory, file), "utf8"));
  }
  return database;
}

function jsonClone(value) {
  return JSON.parse(JSON.stringify(value));
}

async function prepareContractFixtures() {
  const finalFixture = await createFinalPublicationFixture(TEST_HASH_ADAPTER);
  const compiled = await compileCasePackage(
    finalFixture.approved,
    finalFixture.approval,
    TEST_HASH_ADAPTER
  );
  assert.equal(compiled.success, true);
  if (!compiled.success) throw new Error("Synthetic package did not compile.");

  const reviewSource = await createReviewExecutableUnderReviewCase(TEST_HASH_ADAPTER);
  const review = await prepareReviewExecutionArtifact(reviewSource, TEST_HASH_ADAPTER);
  assert.equal(review.success, true);
  if (!review.success) throw new Error("Synthetic review artifact did not compile.");

  const initialized = initializeInMemorySession({
    session_id: "assessment-session",
    mode: "ASSESSMENT",
    compiled_case_package: compiled.package,
    trusted_real_time_anchor_utc: "2026-09-03T08:00:00Z"
  });
  assert.equal(initialized.success, true);
  if (!initialized.success) throw new Error("Synthetic production Session did not initialize.");

  const event = createExecutedSyntheticCheckEvent(compiled.package, 1, 30);
  const session = InMemorySessionAggregateSchema.parse({
    ...initialized.session,
    patient_state: {
      ...initialized.session.patient_state,
      clinical_time: 30
    },
    clinical_clock: {
      ...initialized.session.clinical_clock,
      clinical_time: 30
    },
    committed_events: [event],
    next_sequence_no: 2,
    idempotency_records: [{
      idempotency_key: event.idempotency_key,
      command_id: "command.persistence.001",
      command_fingerprint: HASH_A,
      result_event_range: {
        first_sequence_no: 1,
        last_sequence_no: 1
      },
      committed_event_ids: [event.event_id],
      command_event_id: event.event_id,
      resulting_state_version: 0,
      resulting_clinical_time: 30,
      committed_at_utc: event.real_time_utc
    }]
  });

  const assessment = evaluateSyntheticAssessment({
    casePackage: compiled.package,
    committedEvents: [event],
    assessedThroughClinicalTime: 30,
    evaluationPhase: "FINAL"
  });
  assert.equal(assessment.success, true);
  if (!assessment.success) throw new Error("Synthetic Assessment did not evaluate.");
  const debrief = createDebriefEvidencePackage(assessment.result);
  assert.equal(debrief.success, true);
  if (!debrief.success) throw new Error("Synthetic debrief evidence did not build.");

  const reviewSession = initializeReviewInMemorySession({
    session_id: "review-session",
    mode: "PRACTICE_DEMO",
    review_execution_artifact: review.artifact
  });
  assert.equal(reviewSession.success, true);
  if (!reviewSession.success) throw new Error("Synthetic review Session did not initialize.");
  const reviewEvidence = projectAssessmentEvidenceFromSession(reviewSession.session);
  assert.equal(reviewEvidence.success, true);
  if (!reviewEvidence.success) throw new Error("Review evidence did not project.");
  const reviewAssessment = evaluateReviewAssessment({
    evaluation_schema_version: "1.0",
    execution_authority: "REVIEW_ONLY",
    evaluation_phase: "LIVE",
    assessment_id: "assessment.synthetic.review-001",
    review_execution_artifact: review.artifact,
    session_evidence: reviewEvidence.evidence
  });
  assert.equal(reviewAssessment.success, true);
  if (!reviewAssessment.success) throw new Error("Synthetic review Assessment did not evaluate.");

  return {
    approval: finalFixture.approval,
    approvedSource: finalFixture.approved,
    assessment: assessment.result,
    compiledPackage: compiled.package,
    debrief: debrief.evidence,
    event,
    reviewArtifact: review.artifact,
    reviewAssessment: reviewAssessment.result,
    reviewSession: reviewSession.session,
    session
  };
}

async function seedUsersAndMemberships(database) {
  await database.query(
    "insert into auth.users (id) values ($1), ($2), ($3)",
    [FACULTY_USER_ID, LEARNER_USER_ID, REVIEWER_USER_ID]
  );
  for (const [userId, alias] of [
    [FACULTY_USER_ID, "Synthetic faculty"],
    [LEARNER_USER_ID, "Synthetic learner"],
    [REVIEWER_USER_ID, "Synthetic reviewer"]
  ]) {
    await database.query(
      `insert into public.profiles (user_id, display_alias, preferred_locale)
       values ($1, $2, 'en-US')`,
      [userId, alias]
    );
  }
  for (const [membershipId, userId, role] of [
    ["membership.faculty.001", FACULTY_USER_ID, "FACULTY"],
    ["membership.learner.001", LEARNER_USER_ID, "LEARNER"],
    ["membership.reviewer.001", REVIEWER_USER_ID, "REVIEWER"]
  ]) {
    await database.query(
      `insert into public.institution_memberships
         (membership_id, institution_id, user_id, membership_role)
       values ($1, 'ju', $2, $3)`,
      [membershipId, userId, role]
    );
  }
}

async function persistCaseGraph(database, fixture) {
  const source = fixture.approvedSource;
  const compiled = fixture.compiledPackage;
  const reviewSubjectHash = compiled.validation.reviews[0].reviewed_content_hash;
  assert.equal(typeof reviewSubjectHash, "string");

  await database.query(
    `insert into public.clinical_cases
       (case_id, institution_id, case_slug, title, topic_code, owner_membership_id)
     values ($1, 'ju', 'synthetic-neutral', 'Synthetic neutral persistence case',
       'topic.synthetic', 'membership.faculty.001')`,
    [compiled.manifest.case_id]
  );
  await database.query(
    `insert into public.case_versions
       (case_version_id, case_id, institution_id, case_package_id,
        semantic_version, case_schema_version, lifecycle_status, draft_revision,
        review_subject_hash, publication_candidate_hash, authored_case_payload,
        created_by_membership_id)
     values ($1, $2, 'ju', $3, $4, $5, 'APPROVED', 7, $6, $7,
       $8::jsonb, 'membership.faculty.001')`,
    [
      compiled.manifest.case_version_id,
      compiled.manifest.case_id,
      compiled.manifest.case_package_id,
      compiled.manifest.case_version,
      compiled.manifest.schema_version,
      reviewSubjectHash,
      compiled.package_hash,
      source
    ]
  );

  const moduleNames = Object.keys(compiled.manifest.module_hashes).sort();
  for (const moduleName of moduleNames) {
    await database.query(
      `insert into public.case_modules
         (case_version_id, institution_id, module_name, module_schema_version,
          draft_revision, content_hash, content_jsonb)
       values ($1, 'ju', $2, $3, 7, $4, $5::jsonb)`,
      [
        compiled.manifest.case_version_id,
        moduleName,
        moduleName === "manifest"
          ? compiled.manifest.schema_version
          : compiled[moduleName].module_schema_version,
        compiled.manifest.module_hashes[moduleName],
        source[moduleName]
      ]
    );
  }

  await database.query(
    `insert into public.clinical_sources
       (source_id, source_scope, source_title, source_metadata)
     values ('source.synthetic.001', 'GLOBAL',
       'Synthetic nonmedical source', '{}'::jsonb)`
  );
  await database.query(
    `insert into public.clinical_source_versions
       (source_version_id, source_id, semantic_version, content_hash,
        rights_status, locator, version_metadata)
     values ('source-version.synthetic.001', 'source.synthetic.001', '1.0.0',
       $1, 'APPROVED', 'fixture:synthetic', '{}'::jsonb)`,
    [HASH_A]
  );
  await database.query(
    `insert into public.case_source_links
       (case_version_id, institution_id, source_id, source_version_id,
        target_module, source_locator, source_status, required_for_publication)
     values ($1, 'ju', 'source.synthetic.001', 'source-version.synthetic.001',
       'validation', 'fixture:synthetic', 'APPROVED', true)`,
    [compiled.manifest.case_version_id]
  );

  for (const review of compiled.validation.reviews) {
    await database.query(
      `insert into public.case_reviews
         (review_id, review_revision, case_version_id, institution_id,
          review_type, reviewer_ref_id, reviewer_membership_id, review_status,
          reviewed_case_version, reviewed_content_hash, reviewed_at)
       values ($1, 1, $2, 'ju', $3, $4, 'membership.reviewer.001',
         $5, $6, $7, $8::timestamptz)`,
      [
        review.review_id,
        compiled.manifest.case_version_id,
        review.review_type,
        review.reviewer_ref_id,
        review.status,
        review.reviewed_case_version,
        review.reviewed_content_hash,
        review.reviewed_at_utc
      ]
    );
  }

  const approval = fixture.approval;
  await database.query(
    `insert into public.case_approvals
       (approval_id, institution_id, case_version_id, case_package_id,
        approved_case_version, approved_package_hash, review_subject_hash,
        approval_scope, approval_status, approver_ref_id,
        approver_membership_id, approver_role_code, approved_at,
        approval_payload)
     values ($1, 'ju', $2, $3, $4, $5, $6, $7, $8, $9,
       'membership.reviewer.001', $10, $11::timestamptz, $12::jsonb)`,
    [
      approval.approval_id,
      approval.case_version_id,
      compiled.manifest.case_package_id,
      approval.case_version,
      approval.approved_package_hash,
      reviewSubjectHash,
      approval.approval_scope,
      approval.status,
      approval.approver_ref_id,
      approval.approver_role_code,
      approval.approved_at_utc,
      approval
    ]
  );
  for (const reviewId of approval.required_review_ids) {
    await database.query(
      `insert into public.case_approval_review_refs
         (approval_id, review_id, review_revision, case_version_id,
          institution_id, reviewed_content_hash)
       values ($1, $2, 1, $3, 'ju', $4)`,
      [approval.approval_id, reviewId, approval.case_version_id, reviewSubjectHash]
    );
  }

  const artifact = fixture.reviewArtifact;
  await database.query(
    `insert into public.review_execution_artifacts
       (review_execution_hash, institution_id, case_package_id,
        case_version_id, case_version, case_schema_version,
        artifact_schema_version, artifact_kind, execution_authority,
        source_lifecycle, review_subject_hash, module_hashes, artifact_payload)
     values ($1, 'ju', $2, $3, $4, $5, $6, $7, $8, $9, $10,
       $11::jsonb, $12::jsonb)`,
    [
      artifact.review_execution_hash,
      artifact.source_identity.case_package_id,
      artifact.source_identity.case_version_id,
      artifact.source_identity.case_version,
      artifact.source_identity.case_schema_version,
      artifact.artifact_schema_version,
      artifact.artifact_kind,
      artifact.execution_authority,
      artifact.source_identity.source_lifecycle,
      artifact.review_subject_hash,
      artifact.module_hashes,
      artifact
    ]
  );

  await database.query(
    `insert into public.case_packages
       (case_package_id, institution_id, case_version_id, case_version,
        package_schema_version, package_hash, review_subject_hash,
        approval_id, approval_status, execution_authority, package_lifecycle,
        module_hashes, package_payload, published_at)
     values ($1, 'ju', $2, $3, $4, $5, $6, $7, 'APPROVED',
       'PUBLISHED_PRODUCTION', 'PUBLISHED', $8::jsonb, $9::jsonb,
       $10::timestamptz)`,
    [
      compiled.manifest.case_package_id,
      compiled.manifest.case_version_id,
      compiled.manifest.case_version,
      compiled.manifest.schema_version,
      compiled.package_hash,
      reviewSubjectHash,
      approval.approval_id,
      compiled.manifest.module_hashes,
      compiled,
      approval.approved_at_utc
    ]
  );

  await database.query(
    `insert into public.media_assets
       (media_asset_id, asset_scope, asset_version, media_kind,
        rights_status, clinical_review_status, asset_metadata)
     values ('asset.synthetic.fallback', 'GLOBAL', '1.0.0', 'STATIC_IMAGE',
       'UNRESOLVED', 'UNRESOLVED', $1::jsonb)`,
    [{ fixture_only: true, contains_media: false }]
  );
  await database.query(
    `insert into public.media_assets
       (media_asset_id, asset_scope, asset_version, media_kind,
        diagnostic_modality, content_hash, provenance_source_id,
        provenance_source_version_id, rights_status, rights_reference_code,
        clinical_review_status, fallback_media_asset_id, asset_metadata)
     values ('asset.synthetic.diagnostic', 'GLOBAL', '1.0.0', 'STATIC_IMAGE',
       'ECG', $1, 'source.synthetic.001', 'source-version.synthetic.001',
       'UNRESOLVED', 'rights.synthetic-unresolved', 'UNRESOLVED',
       'asset.synthetic.fallback', $2::jsonb)`,
    [HASH_B, { fixture_only: true, contains_media: false }]
  );
  await database.query(
    `insert into public.visual_manifests
       (visual_manifest_id, institution_id, case_version_id,
        visual_manifest_version, manifest_schema_version, manifest_hash,
        fallback_coverage_status, required_static_fallback_asset_id,
        manifest_payload)
     values ($1, 'ju', $2, $3, $4, $5, 'COMPLETE',
       'asset.synthetic.fallback', $6::jsonb)`,
    [
      compiled.visual_manifest.visual_manifest_id,
      compiled.manifest.case_version_id,
      compiled.visual_manifest.visual_manifest_version,
      compiled.visual_manifest.module_schema_version,
      compiled.manifest.module_hashes.visual_manifest,
      compiled.visual_manifest
    ]
  );
}

async function persistSession(database, session, institutionId = "ju") {
  const pinned = session.pinned_case;
  await database.query(
    `insert into public.simulation_sessions
       (session_id, institution_id, learner_user_id, learner_membership_id,
        aggregate_schema_version, session_status, simulation_mode,
        execution_authority, case_package_id, case_version_id, case_version,
        published_package_hash, review_execution_hash, review_subject_hash,
        patient_state_version, clinical_time_seconds, clock_status,
        next_event_sequence, trusted_real_time_anchor_utc,
        patient_state_payload, scheduler_state_payload, clinical_clock_payload,
        aggregate_payload)
     values ($1, $2, $3, 'membership.learner.001', $4, $5, $6, $7,
       $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18,
       $19::jsonb, $20::jsonb, $21::jsonb, $22::jsonb)`,
    [
      session.session_id,
      institutionId,
      LEARNER_USER_ID,
      session.aggregate_schema_version,
      session.status,
      session.mode,
      pinned.execution_authority,
      pinned.case_package_id,
      pinned.case_version_id,
      pinned.case_version,
      pinned.execution_authority === "PUBLISHED_PRODUCTION" ? pinned.package_hash : null,
      pinned.execution_authority === "REVIEW_ONLY" ? pinned.review_execution_hash : null,
      pinned.execution_authority === "REVIEW_ONLY" ? pinned.review_subject_hash : null,
      session.patient_state.state_version,
      session.patient_state.clinical_time,
      session.clinical_clock.status,
      session.next_sequence_no,
      session.trusted_real_time_anchor_utc ?? null,
      session.patient_state,
      session.scheduler_state,
      session.clinical_clock,
      session
    ]
  );
}

async function persistAssessment(database, result, institutionId = "ju") {
  await database.query(
    `insert into public.assessments
       (assessment_id, session_id, institution_id, result_schema_version,
        trace_version, execution_authority, case_package_id, case_version_id,
        case_version, package_hash, review_execution_hash, review_subject_hash,
        rubric_id, rubric_version, rubric_module_schema_version,
        rubric_module_hash, evaluation_phase, assessed_through_clinical_time,
        event_sequence_through, overall_score_basis_points,
        maximum_score_basis_points, unsafe, finalization_boundary_payload,
        assessment_result_payload)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
       $13, $14, $15, $16, $17, $18, $19, $20, $21, $22,
       $23::jsonb, $24::jsonb)`,
    [
      result.assessment_id,
      result.session_id,
      institutionId,
      result.result_schema_version,
      result.trace_version,
      result.execution_authority,
      result.case_package_id,
      result.case_version_id,
      result.case_version,
      result.execution_authority === "PUBLISHED_PRODUCTION" ? result.package_hash : null,
      result.execution_authority === "REVIEW_ONLY" ? result.review_execution_hash : null,
      result.execution_authority === "REVIEW_ONLY" ? result.review_subject_hash : null,
      result.rubric_id,
      result.rubric_version,
      result.rubric_module_schema_version,
      result.rubric_module_hash,
      result.evaluation_phase,
      result.assessed_through_clinical_time,
      result.event_sequence_through,
      result.overall_score_basis_points,
      result.maximum_score_basis_points,
      result.unsafe,
      result.finalization_boundary ?? null,
      result
    ]
  );
}

const migrationText = (
  await Promise.all((await migrationFiles()).map(
    async (file) => readFile(path.join(migrationsDirectory, file), "utf8")
  ))
).join("\n");

await check("Slice-A migration set contains three ordered V2-011A files", async () => {
  assert.deepEqual(await migrationFiles(), [
    "202609030001_v2_011a_case_governance.sql",
    "202609030002_v2_011a_session_assessment.sql",
    "202609030003_v2_011a_history_and_rls_scaffold.sql"
  ]);
});
await check("SQL contains no disease or Clinical Engine implementation", async () => {
  assert.doesNotMatch(migrationText, /STEMI|anaphylaxis|clinical engine/i);
});
await check("SQL contains no database clinical timer or cron", async () => {
  assert.doesNotMatch(migrationText, /pg_cron|create\s+extension\s+cron|cron\.schedule/i);
});
await check("SQL contains no broad destructive cascade", async () => {
  assert.doesNotMatch(migrationText, /on\s+delete\s+cascade/i);
});

const firstDatabase = await createMigratedDatabase();
await check("migrations apply from an empty PostgreSQL database", async () => {
  const result = await firstDatabase.query(
    "select count(*)::int as count from information_schema.tables where table_schema = 'public'"
  );
  assert.equal(result.rows[0].count, 28);
});
await firstDatabase.close();

const database = await createMigratedDatabase();
await check("migrations repeat through clean reset and reapply", async () => {
  const result = await database.query(
    "select count(*)::int as count from information_schema.tables where table_schema = 'public'"
  );
  assert.equal(result.rows[0].count, 28);
});
await check("JU and JUST canonical institution rows are seeded", async () => {
  const result = await database.query(
    "select institution_id, institution_code, institution_name from public.institutions order by institution_id"
  );
  assert.deepEqual(result.rows, [
    {
      institution_id: "ju",
      institution_code: "JU",
      institution_name: "University of Jordan"
    },
    {
      institution_id: "just",
      institution_code: "JUST",
      institution_name: "Jordan University of Science and Technology"
    }
  ]);
});
await check("no internal UJ institution code is seeded", async () => {
  const result = await database.query(
    "select count(*)::int as count from public.institutions where institution_code = 'UJ'"
  );
  assert.equal(result.rows[0].count, 0);
});
await check("RLS is enabled as fail-closed Slice-A scaffolding", async () => {
  const result = await database.query(
    "select count(*)::int as count from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r' and relrowsecurity"
  );
  assert.equal(result.rows[0].count, 28);
});
await check("no final RLS policies are claimed in Slice A", async () => {
  const result = await database.query(
    "select count(*)::int as count from pg_policies where schemaname = 'public'"
  );
  assert.equal(result.rows[0].count, 0);
});

await seedUsersAndMemberships(database);
await check("auth identity, profile, and membership remain separate", async () => {
  const result = await database.query(
    `select m.membership_role, p.display_alias
       from public.institution_memberships m
       join public.profiles p on p.user_id = m.user_id
      where m.membership_id = 'membership.learner.001'`
  );
  assert.deepEqual(result.rows[0], {
    membership_role: "LEARNER",
    display_alias: "Synthetic learner"
  });
});
await expectRejected("membership requires an existing Auth-backed profile", async () => {
  await database.query(
    `insert into public.institution_memberships
       (membership_id, institution_id, user_id, membership_role)
     values ('membership.invalid.001', 'ju',
       '99999999-9999-4999-8999-999999999999', 'LEARNER')`
  );
});

const fixture = await prepareContractFixtures();
await persistCaseGraph(database, fixture);

await check("canonical Case identity/version metadata round-trips", async () => {
  const result = await database.query(
    `select case_version_id, case_package_id, semantic_version,
            case_schema_version, lifecycle_status, review_subject_hash,
            publication_candidate_hash
       from public.case_versions where case_version_id = $1`,
    [fixture.compiledPackage.manifest.case_version_id]
  );
  assert.deepEqual(result.rows[0], {
    case_version_id: fixture.compiledPackage.manifest.case_version_id,
    case_package_id: fixture.compiledPackage.manifest.case_package_id,
    semantic_version: fixture.compiledPackage.manifest.case_version,
    case_schema_version: fixture.compiledPackage.manifest.schema_version,
    lifecycle_status: "APPROVED",
    review_subject_hash: fixture.compiledPackage.validation.reviews[0].reviewed_content_hash,
    publication_candidate_hash: fixture.compiledPackage.package_hash
  });
});
await check("exactly the frozen sixteen authored modules persist", async () => {
  const result = await database.query(
    "select module_name from public.case_modules where case_version_id = $1 order by module_name",
    [fixture.compiledPackage.manifest.case_version_id]
  );
  assert.equal(result.rows.length, 16);
  assert.deepEqual(
    result.rows.map((row) => row.module_name).sort(),
    Object.keys(fixture.compiledPackage.manifest.module_hashes).sort()
  );
});
await expectRejected("a seventeenth authored module is rejected", async () => {
  await database.query(
    `insert into public.case_modules
       (case_version_id, institution_id, module_name, module_schema_version,
        content_jsonb)
     values ($1, 'ju', 'observations', '2.0', '{}'::jsonb)`,
    [fixture.compiledPackage.manifest.case_version_id]
  );
});
await check("module hashes retain exact application-owned digests", async () => {
  const result = await database.query(
    `select content_hash from public.case_modules
      where case_version_id = $1 and module_name = 'rules'`,
    [fixture.compiledPackage.manifest.case_version_id]
  );
  assert.equal(result.rows[0].content_hash, fixture.compiledPackage.manifest.module_hashes.rules);
});
await check("authored Case JSONB retains exact semantic content", async () => {
  const result = await database.query(
    "select authored_case_payload from public.case_versions where case_version_id = $1",
    [fixture.compiledPackage.manifest.case_version_id]
  );
  assert.deepEqual(result.rows[0].authored_case_payload, jsonClone(fixture.approvedSource));
});

await check("ReviewExecutionArtifact persists as REVIEW_ONLY", async () => {
  const result = await database.query(
    `select execution_authority, artifact_kind, source_lifecycle,
            review_execution_hash, review_subject_hash
       from public.review_execution_artifacts where review_execution_hash = $1`,
    [fixture.reviewArtifact.review_execution_hash]
  );
  assert.deepEqual(result.rows[0], {
    execution_authority: "REVIEW_ONLY",
    artifact_kind: "REVIEW_EXECUTION_ARTIFACT",
    source_lifecycle: "UNDER_REVIEW",
    review_execution_hash: fixture.reviewArtifact.review_execution_hash,
    review_subject_hash: fixture.reviewArtifact.review_subject_hash
  });
});
await check("ReviewExecutionArtifact payload round-trips losslessly", async () => {
  const result = await database.query(
    "select artifact_payload from public.review_execution_artifacts where review_execution_hash = $1",
    [fixture.reviewArtifact.review_execution_hash]
  );
  assert.deepEqual(result.rows[0].artifact_payload, jsonClone(fixture.reviewArtifact));
});
await expectRejected("review artifact cannot masquerade as production authority", async () => {
  await database.query(
    `insert into public.review_execution_artifacts
       (review_execution_hash, institution_id, case_package_id,
        case_version_id, case_version, case_schema_version,
        artifact_schema_version, artifact_kind, execution_authority,
        source_lifecycle, review_subject_hash, module_hashes, artifact_payload)
     values ($1, 'ju', $2, $3, $4, '2.0', '1.0',
       'REVIEW_EXECUTION_ARTIFACT', 'PUBLISHED_PRODUCTION', 'UNDER_REVIEW',
       $5, '{}'::jsonb, '{}'::jsonb)`,
    [
      HASH_B,
      fixture.reviewArtifact.source_identity.case_package_id,
      fixture.reviewArtifact.source_identity.case_version_id,
      fixture.reviewArtifact.source_identity.case_version,
      fixture.reviewArtifact.review_subject_hash
    ]
  );
});

await check("published package persists in a distinct production-only table", async () => {
  const result = await database.query(
    `select execution_authority, package_lifecycle, approval_status, package_hash,
            review_subject_hash
       from public.case_packages where case_package_id = $1`,
    [fixture.compiledPackage.manifest.case_package_id]
  );
  assert.deepEqual(result.rows[0], {
    execution_authority: "PUBLISHED_PRODUCTION",
    package_lifecycle: "PUBLISHED",
    approval_status: "APPROVED",
    package_hash: fixture.compiledPackage.package_hash,
    review_subject_hash: fixture.compiledPackage.validation.reviews[0].reviewed_content_hash
  });
});
await check("published package payload round-trips losslessly", async () => {
  const result = await database.query(
    "select package_payload from public.case_packages where case_package_id = $1",
    [fixture.compiledPackage.manifest.case_package_id]
  );
  assert.deepEqual(result.rows[0].package_payload, jsonClone(fixture.compiledPackage));
});
await expectRejected("published package cannot use REVIEW_ONLY authority", async () => {
  await database.query(
    `update public.case_packages set execution_authority = 'REVIEW_ONLY'
      where case_package_id = $1`,
    [fixture.compiledPackage.manifest.case_package_id]
  );
});
await expectRejected("published packages are immutable", async () => {
  await database.query(
    "update public.case_packages set package_payload = '{}'::jsonb where case_package_id = $1",
    [fixture.compiledPackage.manifest.case_package_id]
  );
});
await expectRejected("review artifacts are immutable", async () => {
  await database.query(
    "delete from public.review_execution_artifacts where review_execution_hash = $1",
    [fixture.reviewArtifact.review_execution_hash]
  );
});

await check("Clinical and Technical reviews bind the exact review subject", async () => {
  const result = await database.query(
    `select review_type, reviewed_content_hash from public.case_reviews
      where review_id in ('review.synthetic.clinical', 'review.synthetic.technical')
      order by review_type`
  );
  assert.equal(result.rows.length, 2);
  assert.equal(result.rows.every(
    (row) => row.reviewed_content_hash
      === fixture.compiledPackage.validation.reviews[0].reviewed_content_hash
  ), true);
});
await check("Approval Record retains exact Case version and candidate hash", async () => {
  const result = await database.query(
    `select approved_case_version, approved_package_hash, review_subject_hash
       from public.case_approvals where approval_id = $1`,
    [fixture.approval.approval_id]
  );
  assert.deepEqual(result.rows[0], {
    approved_case_version: fixture.approval.case_version,
    approved_package_hash: fixture.approval.approved_package_hash,
    review_subject_hash: fixture.compiledPackage.validation.reviews[0].reviewed_content_hash
  });
});
await expectRejected("Approval Record cannot bind a different candidate hash", async () => {
  await database.query(
    `insert into public.case_approvals
       (approval_id, institution_id, case_version_id, case_package_id,
        approved_case_version, approved_package_hash, review_subject_hash,
        approval_scope, approval_status, approver_ref_id,
        approver_membership_id, approver_role_code, approved_at,
        approval_payload)
     values ('approval.synthetic.mismatch', 'ju', $1, $2, $3, $4, $5,
       'CASE_PACKAGE_PUBLICATION', 'APPROVED', 'approver.synthetic.002',
       'membership.reviewer.001', 'role.synthetic-publication-approver',
       '2026-09-03T08:00:00Z', '{}'::jsonb)`,
    [
      fixture.compiledPackage.manifest.case_version_id,
      fixture.compiledPackage.manifest.case_package_id,
      fixture.compiledPackage.manifest.case_version,
      HASH_B,
      fixture.compiledPackage.validation.reviews[0].reviewed_content_hash
    ]
  );
});
await expectRejected("stale review hash cannot satisfy exact approval review binding", async () => {
  await database.query(
    `insert into public.case_reviews
       (review_id, review_revision, case_version_id, institution_id,
        review_type, reviewer_ref_id, reviewer_membership_id, review_status,
        reviewed_case_version, reviewed_content_hash, reviewed_at)
     values ('review.synthetic.stale', 1, $1, 'ju', 'CLINICAL',
       'reviewer.synthetic.stale', 'membership.reviewer.001', 'APPROVED',
       $2, $3, '2026-09-03T08:00:00Z')`,
    [fixture.compiledPackage.manifest.case_version_id, fixture.compiledPackage.manifest.case_version, HASH_B]
  );
  await database.query(
    `insert into public.case_approval_review_refs
       (approval_id, review_id, review_revision, case_version_id,
        institution_id, reviewed_content_hash)
     values ($1, 'review.synthetic.stale', 1, $2, 'ju', $3)`,
    [fixture.approval.approval_id, fixture.compiledPackage.manifest.case_version_id, HASH_B]
  );
});

await persistSession(database, fixture.session);
await persistSession(database, fixture.reviewSession);

await check("production Session binds exact published authority", async () => {
  const result = await database.query(
    `select execution_authority, published_package_hash,
            review_execution_hash, review_subject_hash
       from public.simulation_sessions where session_id = 'assessment-session'`
  );
  assert.deepEqual(result.rows[0], {
    execution_authority: "PUBLISHED_PRODUCTION",
    published_package_hash: fixture.compiledPackage.package_hash,
    review_execution_hash: null,
    review_subject_hash: null
  });
});
await check("review Session binds exact REVIEW_ONLY artifact", async () => {
  const result = await database.query(
    `select execution_authority, published_package_hash,
            review_execution_hash, review_subject_hash
       from public.simulation_sessions where session_id = 'review-session'`
  );
  assert.deepEqual(result.rows[0], {
    execution_authority: "REVIEW_ONLY",
    published_package_hash: null,
    review_execution_hash: fixture.reviewArtifact.review_execution_hash,
    review_subject_hash: fixture.reviewArtifact.review_subject_hash
  });
});
await expectRejected("REVIEW_ONLY Session cannot reference production authority", async () => {
  await database.query(
    `insert into public.simulation_sessions
       (session_id, institution_id, learner_user_id, learner_membership_id,
        aggregate_schema_version, session_status, simulation_mode,
        execution_authority, case_package_id, case_version_id, case_version,
        published_package_hash, patient_state_version, clinical_time_seconds,
        clock_status, next_event_sequence, patient_state_payload,
        scheduler_state_payload, clinical_clock_payload, aggregate_payload)
     values ('bad-review-session', 'ju', $1, 'membership.learner.001',
       '1.0', 'ACTIVE', 'ASSESSMENT', 'REVIEW_ONLY', $2, $3, $4, $5,
       0, 0, 'RUNNING', 1, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb)`,
    [
      LEARNER_USER_ID,
      fixture.compiledPackage.manifest.case_package_id,
      fixture.compiledPackage.manifest.case_version_id,
      fixture.compiledPackage.manifest.case_version,
      fixture.compiledPackage.package_hash
    ]
  );
});
await expectRejected("production Session cannot use review artifact authority", async () => {
  await database.query(
    `insert into public.simulation_sessions
       (session_id, institution_id, learner_user_id, learner_membership_id,
        aggregate_schema_version, session_status, simulation_mode,
        execution_authority, case_package_id, case_version_id, case_version,
        review_execution_hash, review_subject_hash, patient_state_version,
        clinical_time_seconds, clock_status, next_event_sequence,
        patient_state_payload, scheduler_state_payload, clinical_clock_payload,
        aggregate_payload)
     values ('bad-production-session', 'ju', $1, 'membership.learner.001',
       '1.0', 'ACTIVE', 'ASSESSMENT', 'PUBLISHED_PRODUCTION', $2, $3, $4,
       $5, $6, 0, 0, 'RUNNING', 1, '{}'::jsonb, '{}'::jsonb,
       '{}'::jsonb, '{}'::jsonb)`,
    [
      LEARNER_USER_ID,
      fixture.reviewArtifact.source_identity.case_package_id,
      fixture.reviewArtifact.source_identity.case_version_id,
      fixture.reviewArtifact.source_identity.case_version,
      fixture.reviewArtifact.review_execution_hash,
      fixture.reviewArtifact.review_subject_hash
    ]
  );
});
await check("Session aggregate round-trips losslessly", async () => {
  const result = await database.query(
    "select aggregate_payload from public.simulation_sessions where session_id = 'assessment-session'"
  );
  assert.deepEqual(result.rows[0].aggregate_payload, jsonClone(fixture.session));
});
await check("Patient State version and Clinical Time persist independently", async () => {
  const result = await database.query(
    `select patient_state_version, clinical_time_seconds,
            next_event_sequence, trusted_real_time_anchor_utc
       from public.simulation_sessions where session_id = 'assessment-session'`
  );
  assert.equal(result.rows[0].patient_state_version, 0);
  assert.equal(Number(result.rows[0].clinical_time_seconds), 30);
  assert.equal(result.rows[0].next_event_sequence, 2);
  assert.equal(result.rows[0].trusted_real_time_anchor_utc.toISOString(), "2026-09-03T08:00:00.000Z");
});
await check("pending Scheduler work persists losslessly", async () => {
  const result = await database.query(
    "select scheduler_state_payload from public.simulation_sessions where session_id = 'assessment-session'"
  );
  assert.deepEqual(result.rows[0].scheduler_state_payload, jsonClone(fixture.session.scheduler_state));
});

const event = fixture.event;
await database.query(
  `insert into public.session_events
     (event_id, session_id, event_sequence, event_schema_version,
      clinical_time_seconds, real_time_utc, actor_type, actor_id,
      event_source, correlation_id, action_request_id, action_id,
      event_type, event_status, state_version_before, state_version_after,
      idempotency_key, envelope_payload)
   values ($1::uuid, $2, $3, $4, $5, $6::timestamptz, $7, $8,
     $9, $10, $11, $12, $13, 'COMMITTED', $14, $15, $16, $17::jsonb)`,
  [
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
    event.action_request_id ?? null,
    event.action_id ?? null,
    event.event_type,
    event.state_version_before,
    event.state_version_after,
    event.idempotency_key,
    event
  ]
);
await check("committed Event envelope round-trips losslessly", async () => {
  const result = await database.query(
    "select envelope_payload from public.session_events where event_id = $1::uuid",
    [event.event_id]
  );
  assert.deepEqual(result.rows[0].envelope_payload, jsonClone(event));
});
await check("event sequence is independent from trusted timestamps", async () => {
  const result = await database.query(
    `select event_sequence, clinical_time_seconds, real_time_utc, committed_at
       from public.session_events where event_id = $1::uuid`,
    [event.event_id]
  );
  assert.equal(result.rows[0].event_sequence, 1);
  assert.equal(Number(result.rows[0].clinical_time_seconds), 30);
  assert.ok(result.rows[0].real_time_utc instanceof Date);
  assert.ok(result.rows[0].committed_at instanceof Date);
});
await expectRejected("duplicate EventId is rejected", async () => {
  const duplicateIdEnvelope = {
    ...event,
    sequence_no: 2,
    clinical_time: 31,
    correlation_id: "duplicate-event-id",
    idempotency_key: "duplicate-event-id"
  };
  await database.query(
    `insert into public.session_events
       (event_id, session_id, event_sequence, event_schema_version,
        clinical_time_seconds, real_time_utc, actor_type, event_source,
        correlation_id, event_type, event_status, idempotency_key,
        envelope_payload)
     values ($1::uuid, 'assessment-session', 2, '1.0', 31, now(),
       'LEARNER', 'UI', 'duplicate-event-id', $2,
       'COMMITTED', 'duplicate-event-id', $3::jsonb)`,
    [event.event_id, event.event_type, duplicateIdEnvelope]
  );
});
await expectRejected("duplicate Session event sequence is rejected", async () => {
  const duplicateSequenceEventId = "00000000-0000-4000-8000-999999999999";
  const duplicateSequenceEnvelope = {
    ...event,
    event_id: duplicateSequenceEventId,
    correlation_id: "duplicate-sequence",
    idempotency_key: "duplicate-sequence"
  };
  await database.query(
    `insert into public.session_events
       (event_id, session_id, event_sequence, event_schema_version,
        clinical_time_seconds, real_time_utc, actor_type, event_source,
        correlation_id, event_type, event_status, idempotency_key,
        envelope_payload)
     values ($1::uuid, 'assessment-session', 1, '1.0', 30, now(),
       'LEARNER', 'UI', 'duplicate-sequence', $2, 'COMMITTED',
       'duplicate-sequence', $3::jsonb)`,
    [duplicateSequenceEventId, event.event_type, duplicateSequenceEnvelope]
  );
});
await expectRejected("committed events are append-only", async () => {
  await database.query(
    "delete from public.session_events where event_id = $1::uuid",
    [event.event_id]
  );
});

const replay = fixture.session.idempotency_records[0];
await database.query(
  `insert into public.session_commands
     (command_id, session_id, idempotency_key, canonical_request_hash,
      expected_patient_state_version, command_status, first_event_sequence,
      last_event_sequence, committed_event_ids, command_event_id,
      resulting_patient_state_version, resulting_clinical_time_seconds,
      committed_result_payload, committed_at)
   values ($1, 'assessment-session', $2, $3, 0, 'COMMITTED', 1, 1,
     $4::jsonb, $5::uuid, $6, $7, $8::jsonb, $9::timestamptz)`,
  [
    replay.command_id,
    replay.idempotency_key,
    replay.command_fingerprint,
    replay.committed_event_ids,
    replay.command_event_id,
    replay.resulting_state_version,
    replay.resulting_clinical_time,
    replay,
    replay.committed_at_utc
  ]
);
await check("idempotency replay substrate retains canonical request identity", async () => {
  const result = await database.query(
    `select canonical_request_hash, first_event_sequence,
            last_event_sequence, committed_result_payload
       from public.session_commands where command_id = $1`,
    [replay.command_id]
  );
  assert.equal(result.rows[0].canonical_request_hash, replay.command_fingerprint);
  assert.equal(result.rows[0].first_event_sequence, 1);
  assert.equal(result.rows[0].last_event_sequence, 1);
  assert.deepEqual(result.rows[0].committed_result_payload, jsonClone(replay));
});
await expectRejected("idempotency key is unique within one Session", async () => {
  await database.query(
    `insert into public.session_commands
       (command_id, session_id, idempotency_key, canonical_request_hash,
        expected_patient_state_version, command_status, first_event_sequence,
        last_event_sequence, committed_event_ids, command_event_id,
        resulting_patient_state_version, resulting_clinical_time_seconds,
        committed_result_payload, committed_at)
     values ('command.persistence.duplicate', 'assessment-session', $1, $2,
       0, 'COMMITTED', 1, 1, $3::jsonb, $4::uuid, 0, 30,
       '{}'::jsonb, $5::timestamptz)`,
    [replay.idempotency_key, HASH_B, [event.event_id], event.event_id, event.real_time_utc]
  );
});
await check("the same idempotency key remains distinct across Sessions", async () => {
  const reviewEventId = "00000000-0000-4000-8000-888888888888";
  const reviewEventEnvelope = {
    ...event,
    event_id: reviewEventId,
    session_id: "review-session",
    clinical_time: 0,
    correlation_id: "review-session-correlation"
  };
  await database.query(
    `insert into public.session_events
       (event_id, session_id, event_sequence, event_schema_version,
        clinical_time_seconds, real_time_utc, actor_type, event_source,
        correlation_id, event_type, event_status, idempotency_key,
        envelope_payload)
     values ($1::uuid, 'review-session', 1, '1.0', 0,
       '2026-09-03T08:00:00Z', 'LEARNER', 'UI',
       'review-session-correlation', 'EXAM_PERFORMED', 'COMMITTED',
       $2, $3::jsonb)`,
    [reviewEventId, replay.idempotency_key, reviewEventEnvelope]
  );
  const reviewReplay = {
    ...replay,
    command_id: "command.persistence.review-001",
    result_event_range: { first_sequence_no: 1, last_sequence_no: 1 },
    committed_event_ids: [reviewEventId],
    command_event_id: reviewEventId,
    resulting_clinical_time: 0
  };
  await database.query(
    `insert into public.session_commands
       (command_id, session_id, idempotency_key, canonical_request_hash,
        expected_patient_state_version, command_status, first_event_sequence,
        last_event_sequence, committed_event_ids, command_event_id,
        resulting_patient_state_version, resulting_clinical_time_seconds,
        committed_result_payload, committed_at)
     values ('command.persistence.review-001', 'review-session', $1, $2,
       0, 'COMMITTED', 1, 1, $3::jsonb, $4::uuid, 0, 0,
       $5::jsonb, '2026-09-03T08:00:00Z')`,
    [replay.idempotency_key, HASH_A, [reviewEventId], reviewEventId, reviewReplay]
  );
  const result = await database.query(
    "select count(*)::int as count from public.session_commands where idempotency_key = $1",
    [replay.idempotency_key]
  );
  assert.equal(result.rows[0].count, 2);
});

await database.query(
  `insert into public.patient_state_checkpoints
     (session_id, state_schema_version, patient_state_version,
      last_event_sequence, clinical_time_seconds, clock_status,
      trusted_real_time_anchor_utc, patient_state_payload,
      scheduler_state_payload, clinical_clock_payload, aggregate_payload,
      checkpoint_hash)
   values ('assessment-session', $1, $2, 1, $3, $4, $5::timestamptz,
     $6::jsonb, $7::jsonb, $8::jsonb, $9::jsonb, $10)`,
  [
    fixture.session.patient_state.state_schema_version,
    fixture.session.patient_state.state_version,
    fixture.session.patient_state.clinical_time,
    fixture.session.clinical_clock.status,
    fixture.session.trusted_real_time_anchor_utc,
    fixture.session.patient_state,
    fixture.session.scheduler_state,
    fixture.session.clinical_clock,
    fixture.session,
    HASH_A
  ]
);
await check("checkpoint preserves Patient State schema/version and Scheduler state", async () => {
  const result = await database.query(
    `select state_schema_version, patient_state_version,
            last_event_sequence, scheduler_state_payload
       from public.patient_state_checkpoints where session_id = 'assessment-session'`
  );
  assert.equal(result.rows[0].state_schema_version, fixture.session.patient_state.state_schema_version);
  assert.equal(result.rows[0].patient_state_version, fixture.session.patient_state.state_version);
  assert.equal(result.rows[0].last_event_sequence, 1);
  assert.deepEqual(result.rows[0].scheduler_state_payload, jsonClone(fixture.session.scheduler_state));
});
await expectRejected("checkpoints are immutable history", async () => {
  await database.query(
    "update public.patient_state_checkpoints set last_event_sequence = 2 where session_id = 'assessment-session'"
  );
});

await persistAssessment(database, fixture.assessment);
await persistAssessment(database, fixture.reviewAssessment);
for (const domain of fixture.assessment.domain_scores) {
  await database.query(
    `insert into public.assessment_domain_scores
       (assessment_id, domain_id, earned_points, maximum_points,
        score_basis_points, weight_basis_points,
        weighted_contribution_basis_points, evidence_payload)
     values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
    [
      fixture.assessment.assessment_id,
      domain.domain_id,
      domain.earned_points,
      domain.maximum_points,
      domain.score_basis_points,
      domain.weight_basis_points,
      domain.weighted_contribution_basis_points,
      { evidence_ref_ids: fixture.assessment.evidence_records
        .filter((record) => fixture.assessment.criterion_results.some(
          (criterion) => criterion.evidence_ref_ids.includes(record.evidence_ref_id)
        ))
        .map((record) => record.evidence_ref_id) }
    ]
  );
}
const firstCriterion = fixture.assessment.criterion_results[0];
await database.query(
  `insert into public.assessment_findings
     (finding_id, assessment_id, finding_category, rubric_item_id,
      finding_status, reveal_policy, evidence_payload)
   values ('finding.persistence.001', $1, 'CORRECT_ACTION', $2,
     'FINAL', 'FINAL_DEBRIEF_ONLY', $3::jsonb)`,
  [
    fixture.assessment.assessment_id,
    firstCriterion.rubric_item_id,
    { evidence_ref_ids: firstCriterion.evidence_ref_ids }
  ]
);
await database.query(
  `insert into public.assessment_debriefs
     (assessment_id, debrief_schema_version, authority,
      evidence_package_payload)
   values ($1, $2, $3, $4::jsonb)`,
  [
    fixture.assessment.assessment_id,
    fixture.debrief.debrief_schema_version,
    fixture.debrief.authority,
    fixture.debrief
  ]
);

await check("production Assessment result round-trips losslessly", async () => {
  const result = await database.query(
    "select assessment_result_payload from public.assessments where assessment_id = $1",
    [fixture.assessment.assessment_id]
  );
  assert.deepEqual(result.rows[0].assessment_result_payload, jsonClone(fixture.assessment));
});
await check("review Assessment remains distinguishable from production", async () => {
  const result = await database.query(
    `select assessment_id, execution_authority, package_hash,
            review_execution_hash, review_subject_hash
       from public.assessments order by assessment_id`
  );
  assert.equal(result.rows.length, 2);
  const reviewRow = result.rows.find(
    (row) => row.assessment_id === fixture.reviewAssessment.assessment_id
  );
  assert.equal(reviewRow.execution_authority, "REVIEW_ONLY");
  assert.equal(reviewRow.package_hash, null);
  assert.equal(reviewRow.review_execution_hash, fixture.reviewArtifact.review_execution_hash);
});
await check("six integer assessment domain rows persist", async () => {
  const result = await database.query(
    "select count(*)::int as count from public.assessment_domain_scores where assessment_id = $1",
    [fixture.assessment.assessment_id]
  );
  assert.equal(result.rows[0].count, 6);
});
await check("deterministic debrief evidence persists without AI prose", async () => {
  const result = await database.query(
    "select authority, evidence_package_payload from public.assessment_debriefs where assessment_id = $1",
    [fixture.assessment.assessment_id]
  );
  assert.equal(result.rows[0].authority, "DETERMINISTIC_ASSESSMENT_EVIDENCE");
  assert.deepEqual(result.rows[0].evidence_package_payload, jsonClone(fixture.debrief));
});
await expectRejected("Assessment result history is immutable", async () => {
  await database.query(
    "update public.assessments set overall_score_basis_points = 0 where assessment_id = $1",
    [fixture.assessment.assessment_id]
  );
});

await check("diagnostic asset provenance and content hash are represented", async () => {
  const result = await database.query(
    `select diagnostic_modality, content_hash, provenance_source_id,
            provenance_source_version_id, rights_status,
            clinical_review_status, storage_object_path
       from public.media_assets where media_asset_id = 'asset.synthetic.diagnostic'`
  );
  assert.deepEqual(result.rows[0], {
    diagnostic_modality: "ECG",
    content_hash: HASH_B,
    provenance_source_id: "source.synthetic.001",
    provenance_source_version_id: "source-version.synthetic.001",
    rights_status: "UNRESOLVED",
    clinical_review_status: "UNRESOLVED",
    storage_object_path: null
  });
});
await check("diagnostic metadata requires no actual media", async () => {
  const result = await database.query(
    "select storage_object_path, asset_metadata from public.media_assets where media_asset_id = 'asset.synthetic.diagnostic'"
  );
  assert.equal(result.rows[0].storage_object_path, null);
  assert.equal(result.rows[0].asset_metadata.contains_media, false);
});
await check("visual fallback metadata is structurally linked", async () => {
  const result = await database.query(
    `select fallback_coverage_status, required_static_fallback_asset_id
       from public.visual_manifests where visual_manifest_id = $1`,
    [fixture.compiledPackage.visual_manifest.visual_manifest_id]
  );
  assert.deepEqual(result.rows[0], {
    fallback_coverage_status: "COMPLETE",
    required_static_fallback_asset_id: "asset.synthetic.fallback"
  });
});
await expectRejected("historical Session data prevents destructive Case deletion", async () => {
  await database.query(
    "delete from public.clinical_cases where case_id = $1",
    [fixture.compiledPackage.manifest.case_id]
  );
});

await database.close();

process.stdout.write(`V2-011A persistence tests: ${passed} passed, 0 failed\n`);
