import type { HashAdapter } from "../../contracts/src/index.ts";

import { canonicalSerialize } from "./canonical.ts";
import {
  CASE_MODULE_NAMES,
  DraftCasePackageSchema,
  HashDigestSchema,
  REVIEW_SUBJECT_MODULE_NAMES,
  type CaseModuleName,
  type DraftCasePackage,
  type HashDigest
} from "./schemas.ts";

export async function hashCanonicalJson(
  value: unknown,
  hashAdapter: HashAdapter
): Promise<HashDigest> {
  const canonical = canonicalSerialize(value);
  return HashDigestSchema.parse(await hashAdapter.sha256(canonical));
}

function moduleContent(casePackage: DraftCasePackage, moduleName: CaseModuleName): unknown {
  return casePackage[moduleName];
}

export async function computeReviewSubjectHash(
  input: unknown,
  hashAdapter: HashAdapter
): Promise<HashDigest> {
  const casePackage = DraftCasePackageSchema.parse(input);
  const modules: Record<string, unknown> = {};

  for (const moduleName of REVIEW_SUBJECT_MODULE_NAMES) {
    modules[moduleName] = moduleContent(casePackage, moduleName);
  }

  return hashCanonicalJson({
    case_id: casePackage.manifest.case_id,
    case_version: casePackage.manifest.case_version,
    schema_version: casePackage.manifest.schema_version,
    modules
  }, hashAdapter);
}

export async function computeModuleHashes(
  input: unknown,
  hashAdapter: HashAdapter
): Promise<Record<CaseModuleName, HashDigest>> {
  const casePackage = DraftCasePackageSchema.parse(input);
  const entries = await Promise.all(CASE_MODULE_NAMES.map(async (moduleName) => [
    moduleName,
    await hashCanonicalJson(moduleContent(casePackage, moduleName), hashAdapter)
  ] as const));

  return Object.fromEntries(entries) as Record<CaseModuleName, HashDigest>;
}
