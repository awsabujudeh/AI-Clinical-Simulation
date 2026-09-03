-- V2-011A: local persistence foundation for Case, governance, and asset metadata.
-- Clinical decisions and application-owned canonical hashes are deliberately not
-- recomputed in SQL.

create domain public.contract_identifier as text
  check (char_length(value) between 1 and 160)
  check (value ~ '^[A-Za-z0-9][A-Za-z0-9._~:-]*$');

create domain public.namespaced_identifier as text
  check (char_length(value) between 3 and 160)
  check (value ~ '^[a-z0-9]+(?:-[a-z0-9]+)*(?:\.[a-z0-9]+(?:-[a-z0-9]+)*)+$');

create domain public.institution_identifier as text
  check (char_length(value) between 2 and 64)
  check (value ~ '^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$');

create domain public.schema_version as text
  check (value ~ '^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$');

create domain public.semantic_version as text
  check (value ~ '^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$');

create domain public.sha256_hex as text
  check (value ~ '^[a-f0-9]{64}$');

create table public.institutions (
  institution_id public.institution_identifier primary key,
  institution_code text not null unique
    check (char_length(institution_code) between 2 and 16)
    check (institution_code ~ '^[A-Z][A-Z0-9]*$'),
  institution_name text not null unique
    check (char_length(btrim(institution_name)) between 3 and 200),
  institution_status text not null default 'ACTIVE'
    check (institution_status in ('ACTIVE', 'INACTIVE')),
  created_at timestamptz not null default now()
);

insert into public.institutions (
  institution_id,
  institution_code,
  institution_name
) values
  ('ju', 'JU', 'University of Jordan'),
  ('just', 'JUST', 'Jordan University of Science and Technology');

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete restrict,
  profile_schema_version public.schema_version not null default '1.0',
  display_alias text check (
    display_alias is null
    or char_length(btrim(display_alias)) between 1 and 120
  ),
  preferred_locale text check (
    preferred_locale is null
    or preferred_locale in ('ar-JO', 'en-US')
  ),
  created_at timestamptz not null default now()
);

create table public.institution_memberships (
  membership_id public.contract_identifier primary key,
  institution_id public.institution_identifier not null
    references public.institutions(institution_id) on delete restrict,
  user_id uuid not null references public.profiles(user_id) on delete restrict,
  membership_role text not null
    check (membership_role in ('LEARNER', 'FACULTY', 'REVIEWER')),
  membership_status text not null default 'ACTIVE'
    check (membership_status in ('ACTIVE', 'INACTIVE')),
  created_at timestamptz not null default now(),
  unique (membership_id, institution_id),
  unique (membership_id, institution_id, user_id),
  unique (institution_id, user_id, membership_role)
);

create table public.clinical_cases (
  case_id public.namespaced_identifier primary key
    check (case_id like 'case.%'),
  institution_id public.institution_identifier not null,
  case_slug text not null check (
    char_length(case_slug) between 1 and 120
    and case_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  ),
  title text not null check (char_length(btrim(title)) between 1 and 240),
  topic_code public.contract_identifier not null,
  owner_membership_id public.contract_identifier not null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (case_id, institution_id),
  unique (institution_id, case_slug),
  foreign key (owner_membership_id, institution_id)
    references public.institution_memberships(membership_id, institution_id)
    on delete restrict
);

create table public.case_versions (
  case_version_id public.namespaced_identifier primary key
    check (case_version_id like 'case-version.%'),
  case_id public.namespaced_identifier not null,
  institution_id public.institution_identifier not null,
  case_package_id public.namespaced_identifier not null unique
    check (case_package_id like 'case-package.%'),
  semantic_version public.semantic_version not null,
  case_schema_version public.schema_version not null,
  lifecycle_status text not null
    check (lifecycle_status in ('DRAFT', 'UNDER_REVIEW', 'APPROVED', 'PUBLISHED')),
  draft_revision bigint not null default 0 check (draft_revision >= 0),
  review_subject_hash public.sha256_hex,
  publication_candidate_hash public.sha256_hex,
  authored_case_payload jsonb not null
    check (jsonb_typeof(authored_case_payload) = 'object'),
  created_by_membership_id public.contract_identifier not null,
  created_at timestamptz not null default now(),
  unique (case_id, semantic_version),
  unique (case_version_id, institution_id),
  unique (
    case_version_id,
    case_package_id,
    semantic_version,
    institution_id
  ),
  unique (
    case_version_id,
    case_package_id,
    semantic_version,
    institution_id,
    publication_candidate_hash
  ),
  unique (
    case_version_id,
    case_package_id,
    semantic_version,
    institution_id,
    publication_candidate_hash,
    review_subject_hash
  ),
  check (authored_case_payload #>> '{manifest,case_id}' = case_id),
  check (authored_case_payload #>> '{manifest,case_version_id}' = case_version_id),
  check (authored_case_payload #>> '{manifest,case_package_id}' = case_package_id),
  check (authored_case_payload #>> '{manifest,case_version}' = semantic_version),
  check (authored_case_payload #>> '{manifest,schema_version}' = case_schema_version),
  check (authored_case_payload #>> '{manifest,status}' = lifecycle_status),
  foreign key (case_id, institution_id)
    references public.clinical_cases(case_id, institution_id) on delete restrict,
  foreign key (created_by_membership_id, institution_id)
    references public.institution_memberships(membership_id, institution_id)
    on delete restrict
);

create table public.case_modules (
  case_version_id public.namespaced_identifier not null,
  institution_id public.institution_identifier not null,
  module_name text not null check (module_name in (
    'manifest',
    'classification',
    'localization',
    'patient_profile',
    'presentation',
    'initial_state',
    'clinical_facts',
    'action_catalogue',
    'rules',
    'timeline_policy',
    'assessment_rubric',
    'dialogue_policy',
    'visual_manifest',
    'curriculum_mappings',
    'validation',
    'instructor_notes'
  )),
  module_schema_version public.schema_version not null,
  draft_revision bigint not null default 0 check (draft_revision >= 0),
  content_hash public.sha256_hex,
  content_jsonb jsonb not null check (jsonb_typeof(content_jsonb) = 'object'),
  created_at timestamptz not null default now(),
  primary key (case_version_id, module_name),
  foreign key (case_version_id, institution_id)
    references public.case_versions(case_version_id, institution_id)
    on delete restrict
);

create table public.clinical_sources (
  source_id public.namespaced_identifier primary key
    check (source_id like 'source.%'),
  source_scope text not null check (source_scope in ('GLOBAL', 'INSTITUTION')),
  owner_institution_id public.institution_identifier
    references public.institutions(institution_id) on delete restrict,
  source_title text not null check (char_length(btrim(source_title)) between 1 and 500),
  jurisdiction_code public.contract_identifier,
  source_metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(source_metadata) = 'object'),
  created_at timestamptz not null default now(),
  check (
    (source_scope = 'GLOBAL' and owner_institution_id is null)
    or (source_scope = 'INSTITUTION' and owner_institution_id is not null)
  )
);

create table public.clinical_source_versions (
  source_version_id public.namespaced_identifier primary key
    check (source_version_id like 'source-version.%'),
  source_id public.namespaced_identifier not null
    references public.clinical_sources(source_id) on delete restrict,
  semantic_version public.semantic_version not null,
  content_hash public.sha256_hex,
  rights_status text not null
    check (rights_status in ('APPROVED', 'UNRESOLVED')),
  locator text,
  version_metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(version_metadata) = 'object'),
  created_at timestamptz not null default now(),
  unique (source_version_id, source_id),
  unique (source_id, semantic_version)
);

create table public.case_source_links (
  case_source_link_id bigint generated always as identity primary key,
  case_version_id public.namespaced_identifier not null,
  institution_id public.institution_identifier not null,
  source_id public.namespaced_identifier not null,
  source_version_id public.namespaced_identifier not null,
  target_module text not null,
  target_identifier public.contract_identifier,
  source_locator text,
  source_status text not null
    check (source_status in ('APPROVED', 'UNRESOLVED', 'PLACEHOLDER')),
  required_for_publication boolean not null,
  created_at timestamptz not null default now(),
  unique (
    case_version_id,
    source_version_id,
    target_module,
    target_identifier
  ),
  foreign key (case_version_id, institution_id)
    references public.case_versions(case_version_id, institution_id)
    on delete restrict,
  foreign key (source_version_id, source_id)
    references public.clinical_source_versions(source_version_id, source_id)
    on delete restrict,
  foreign key (case_version_id, target_module)
    references public.case_modules(case_version_id, module_name)
    on delete restrict
);

create table public.curriculum_sources (
  curriculum_source_id public.namespaced_identifier primary key
    check (curriculum_source_id like 'source.%'),
  institution_id public.institution_identifier not null
    references public.institutions(institution_id) on delete restrict,
  source_title text not null check (char_length(btrim(source_title)) between 1 and 500),
  rights_status text not null
    check (rights_status in ('APPROVED', 'UNRESOLVED')),
  source_metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(source_metadata) = 'object'),
  created_at timestamptz not null default now(),
  unique (curriculum_source_id, institution_id)
);

create table public.curriculum_source_versions (
  curriculum_source_version_id public.namespaced_identifier primary key
    check (curriculum_source_version_id like 'source-version.%'),
  curriculum_source_id public.namespaced_identifier not null,
  institution_id public.institution_identifier not null,
  semantic_version public.semantic_version not null,
  content_hash public.sha256_hex,
  version_status text not null
    check (version_status in ('APPROVED', 'UNRESOLVED', 'PLACEHOLDER')),
  locator text,
  version_metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(version_metadata) = 'object'),
  created_at timestamptz not null default now(),
  unique (curriculum_source_version_id, institution_id),
  unique (curriculum_source_id, semantic_version),
  foreign key (curriculum_source_id, institution_id)
    references public.curriculum_sources(curriculum_source_id, institution_id)
    on delete restrict
);

create table public.learning_objectives (
  objective_id public.namespaced_identifier primary key
    check (objective_id like 'objective.%'),
  institution_id public.institution_identifier not null,
  curriculum_source_version_id public.namespaced_identifier not null,
  objective_code public.contract_identifier not null,
  objective_text text,
  objective_status text not null
    check (objective_status in ('APPROVED', 'UNKNOWN', 'PLACEHOLDER')),
  objective_metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(objective_metadata) = 'object'),
  created_at timestamptz not null default now(),
  unique (objective_id, institution_id),
  foreign key (curriculum_source_version_id, institution_id)
    references public.curriculum_source_versions(
      curriculum_source_version_id,
      institution_id
    ) on delete restrict
);

create table public.curriculum_mappings (
  mapping_id public.namespaced_identifier primary key
    check (mapping_id like 'mapping.%'),
  case_version_id public.namespaced_identifier not null,
  case_owner_institution_id public.institution_identifier not null,
  curriculum_institution_id public.institution_identifier not null,
  objective_id public.namespaced_identifier not null,
  competency_code public.contract_identifier not null,
  mapping_status text not null
    check (mapping_status in ('APPROVED', 'UNKNOWN', 'PLACEHOLDER')),
  reviewer_membership_id public.contract_identifier,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (case_version_id, case_owner_institution_id)
    references public.case_versions(case_version_id, institution_id)
    on delete restrict,
  foreign key (objective_id, curriculum_institution_id)
    references public.learning_objectives(objective_id, institution_id)
    on delete restrict,
  foreign key (reviewer_membership_id, curriculum_institution_id)
    references public.institution_memberships(membership_id, institution_id)
    on delete restrict
);

create table public.case_reviews (
  case_review_record_id bigint generated always as identity primary key,
  review_id public.namespaced_identifier not null
    check (review_id like 'review.%'),
  review_revision bigint not null default 1 check (review_revision > 0),
  case_version_id public.namespaced_identifier not null,
  institution_id public.institution_identifier not null,
  review_type text not null
    check (review_type in ('CLINICAL', 'CURRICULUM_UX', 'VISUAL', 'TECHNICAL')),
  reviewer_ref_id public.namespaced_identifier not null
    check (reviewer_ref_id like 'reviewer.%'),
  reviewer_membership_id public.contract_identifier not null,
  review_status text not null
    check (review_status in ('DRAFT', 'UNDER_REVIEW', 'APPROVED', 'REJECTED')),
  reviewed_case_version public.semantic_version not null,
  reviewed_content_hash public.sha256_hex,
  review_notes jsonb not null default '{}'::jsonb
    check (jsonb_typeof(review_notes) = 'object'),
  reviewed_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  check (review_status <> 'APPROVED' or reviewed_content_hash is not null),
  unique (review_id, review_revision),
  unique (
    review_id,
    review_revision,
    institution_id,
    case_version_id
  ),
  unique (
    review_id,
    review_revision,
    institution_id,
    case_version_id,
    reviewed_content_hash
  ),
  foreign key (case_version_id, institution_id)
    references public.case_versions(case_version_id, institution_id)
    on delete restrict,
  foreign key (reviewer_membership_id, institution_id)
    references public.institution_memberships(membership_id, institution_id)
    on delete restrict
);

create table public.case_approvals (
  approval_id public.namespaced_identifier primary key
    check (approval_id like 'approval.%'),
  institution_id public.institution_identifier not null,
  case_version_id public.namespaced_identifier not null,
  case_package_id public.namespaced_identifier not null,
  approved_case_version public.semantic_version not null,
  approved_package_hash public.sha256_hex not null,
  review_subject_hash public.sha256_hex not null,
  approval_scope text not null
    check (approval_scope = 'CASE_PACKAGE_PUBLICATION'),
  approval_status text not null
    check (approval_status in ('DRAFT', 'UNDER_REVIEW', 'APPROVED', 'REJECTED')),
  approver_ref_id public.namespaced_identifier not null
    check (approver_ref_id like 'approver.%'),
  approver_membership_id public.contract_identifier not null,
  approver_role_code public.contract_identifier not null,
  approved_at timestamptz not null,
  approval_payload jsonb not null check (jsonb_typeof(approval_payload) = 'object'),
  recorded_at timestamptz not null default now(),
  unique (approval_id, institution_id, case_version_id),
  unique (
    approval_id,
    institution_id,
    case_version_id,
    review_subject_hash
  ),
  unique (
    approval_id,
    case_version_id,
    case_package_id,
    approved_case_version,
    institution_id,
    approved_package_hash,
    approval_status
  ),
  foreign key (
    case_version_id,
    case_package_id,
    approved_case_version,
    institution_id,
    approved_package_hash,
    review_subject_hash
  ) references public.case_versions(
    case_version_id,
    case_package_id,
    semantic_version,
    institution_id,
    publication_candidate_hash,
    review_subject_hash
  ) on delete restrict,
  foreign key (approver_membership_id, institution_id)
    references public.institution_memberships(membership_id, institution_id)
    on delete restrict
);

create table public.case_approval_review_refs (
  approval_id public.namespaced_identifier not null,
  review_id public.namespaced_identifier not null,
  review_revision bigint not null check (review_revision > 0),
  case_version_id public.namespaced_identifier not null,
  institution_id public.institution_identifier not null,
  reviewed_content_hash public.sha256_hex not null,
  primary key (approval_id, review_id, review_revision),
  foreign key (approval_id, institution_id, case_version_id)
    references public.case_approvals(
      approval_id,
      institution_id,
      case_version_id
    ) on delete restrict,
  foreign key (
    approval_id,
    institution_id,
    case_version_id,
    reviewed_content_hash
  ) references public.case_approvals(
    approval_id,
    institution_id,
    case_version_id,
    review_subject_hash
  ) on delete restrict,
  foreign key (
    review_id,
    review_revision,
    institution_id,
    case_version_id,
    reviewed_content_hash
  ) references public.case_reviews(
    review_id,
    review_revision,
    institution_id,
    case_version_id,
    reviewed_content_hash
  ) on delete restrict
);

create table public.review_execution_artifacts (
  review_execution_hash public.sha256_hex primary key,
  institution_id public.institution_identifier not null,
  case_package_id public.namespaced_identifier not null,
  case_version_id public.namespaced_identifier not null,
  case_version public.semantic_version not null,
  case_schema_version public.schema_version not null,
  artifact_schema_version public.schema_version not null,
  artifact_kind text not null check (artifact_kind = 'REVIEW_EXECUTION_ARTIFACT'),
  execution_authority text not null check (execution_authority = 'REVIEW_ONLY'),
  source_lifecycle text not null check (source_lifecycle = 'UNDER_REVIEW'),
  review_subject_hash public.sha256_hex not null,
  module_hashes jsonb not null check (jsonb_typeof(module_hashes) = 'object'),
  artifact_payload jsonb not null check (jsonb_typeof(artifact_payload) = 'object'),
  created_at timestamptz not null default now(),
  unique (
    review_execution_hash,
    case_package_id,
    case_version_id,
    case_version,
    review_subject_hash,
    institution_id
  ),
  check (artifact_payload ->> 'artifact_kind' = artifact_kind),
  check (artifact_payload ->> 'execution_authority' = execution_authority),
  check (artifact_payload ->> 'review_execution_hash' = review_execution_hash),
  check (artifact_payload ->> 'review_subject_hash' = review_subject_hash),
  check (artifact_payload #>> '{source_identity,case_package_id}' = case_package_id),
  check (artifact_payload #>> '{source_identity,case_version_id}' = case_version_id),
  check (artifact_payload #>> '{source_identity,case_version}' = case_version),
  foreign key (
    case_version_id,
    case_package_id,
    case_version,
    institution_id
  ) references public.case_versions(
    case_version_id,
    case_package_id,
    semantic_version,
    institution_id
  ) on delete restrict
);

create table public.case_packages (
  case_package_id public.namespaced_identifier primary key
    check (case_package_id like 'case-package.%'),
  institution_id public.institution_identifier not null,
  case_version_id public.namespaced_identifier not null,
  case_version public.semantic_version not null,
  package_schema_version public.schema_version not null,
  package_hash public.sha256_hex not null unique,
  review_subject_hash public.sha256_hex not null,
  approval_id public.namespaced_identifier not null,
  approval_status text not null check (approval_status = 'APPROVED'),
  execution_authority text not null
    check (execution_authority = 'PUBLISHED_PRODUCTION'),
  package_lifecycle text not null check (package_lifecycle = 'PUBLISHED'),
  module_hashes jsonb not null check (jsonb_typeof(module_hashes) = 'object'),
  package_payload jsonb not null check (jsonb_typeof(package_payload) = 'object'),
  published_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (
    case_package_id,
    case_version_id,
    case_version,
    institution_id,
    package_hash
  ),
  check (package_payload ->> 'package_hash' = package_hash),
  check (package_payload #>> '{manifest,case_package_id}' = case_package_id),
  check (package_payload #>> '{manifest,case_version_id}' = case_version_id),
  check (package_payload #>> '{manifest,case_version}' = case_version),
  check (package_payload #>> '{manifest,schema_version}' = package_schema_version),
  check (package_payload #>> '{manifest,status}' = package_lifecycle),
  foreign key (
    case_version_id,
    case_package_id,
    case_version,
    institution_id
  ) references public.case_versions(
    case_version_id,
    case_package_id,
    semantic_version,
    institution_id
  ) on delete restrict,
  foreign key (
    approval_id,
    case_version_id,
    case_package_id,
    case_version,
    institution_id,
    package_hash,
    approval_status
  ) references public.case_approvals(
    approval_id,
    case_version_id,
    case_package_id,
    approved_case_version,
    institution_id,
    approved_package_hash,
    approval_status
  ) on delete restrict,
  foreign key (
    approval_id,
    institution_id,
    case_version_id,
    review_subject_hash
  ) references public.case_approvals(
    approval_id,
    institution_id,
    case_version_id,
    review_subject_hash
  ) on delete restrict
);

create table public.media_assets (
  media_asset_id public.namespaced_identifier primary key
    check (media_asset_id like 'asset.%'),
  asset_scope text not null check (asset_scope in ('GLOBAL', 'INSTITUTION')),
  owner_institution_id public.institution_identifier
    references public.institutions(institution_id) on delete restrict,
  asset_version public.semantic_version not null,
  media_kind text not null
    check (media_kind in ('STATIC_IMAGE', 'VIDEO', 'AUDIO', 'OVERLAY')),
  diagnostic_modality text check (
    diagnostic_modality is null
    or diagnostic_modality in ('ECG', 'IMAGING', 'ULTRASOUND')
  ),
  content_hash public.sha256_hex,
  provenance_source_id public.namespaced_identifier,
  provenance_source_version_id public.namespaced_identifier,
  rights_status text not null
    check (rights_status in ('APPROVED', 'UNRESOLVED')),
  rights_reference_code public.contract_identifier,
  clinical_review_status text not null
    check (clinical_review_status in ('APPROVED', 'UNRESOLVED')),
  clinical_review_id public.namespaced_identifier,
  clinical_review_revision bigint,
  storage_object_path text,
  fallback_media_asset_id public.namespaced_identifier,
  asset_metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(asset_metadata) = 'object'),
  created_at timestamptz not null default now(),
  check (
    (asset_scope = 'GLOBAL' and owner_institution_id is null)
    or (asset_scope = 'INSTITUTION' and owner_institution_id is not null)
  ),
  check (
    (provenance_source_id is null and provenance_source_version_id is null)
    or (provenance_source_id is not null and provenance_source_version_id is not null)
  ),
  check (
    (clinical_review_id is null and clinical_review_revision is null)
    or (clinical_review_id is not null and clinical_review_revision is not null)
  ),
  foreign key (provenance_source_version_id, provenance_source_id)
    references public.clinical_source_versions(source_version_id, source_id)
    on delete restrict,
  foreign key (clinical_review_id, clinical_review_revision)
    references public.case_reviews(review_id, review_revision) on delete restrict,
  foreign key (fallback_media_asset_id)
    references public.media_assets(media_asset_id) on delete restrict
);

create table public.visual_manifests (
  visual_manifest_id public.namespaced_identifier primary key
    check (visual_manifest_id like 'visual.%'),
  institution_id public.institution_identifier not null,
  case_version_id public.namespaced_identifier not null,
  visual_manifest_version public.semantic_version not null,
  manifest_schema_version public.schema_version not null,
  manifest_hash public.sha256_hex,
  fallback_coverage_status text not null
    check (fallback_coverage_status in ('COMPLETE', 'INCOMPLETE', 'UNRESOLVED')),
  required_static_fallback_asset_id public.namespaced_identifier,
  manifest_payload jsonb not null check (jsonb_typeof(manifest_payload) = 'object'),
  created_at timestamptz not null default now(),
  unique (case_version_id, visual_manifest_version),
  foreign key (case_version_id, institution_id)
    references public.case_versions(case_version_id, institution_id)
    on delete restrict,
  foreign key (required_static_fallback_asset_id)
    references public.media_assets(media_asset_id) on delete restrict
);
