import type { HashAdapter } from "../../contracts/src/index.ts";

import { computeModuleHashes, hashCanonicalJson } from "./hashing.ts";
import {
  CompiledCasePackageSchema,
  DraftCasePackageSchema,
  PublicationCandidateSchema,
  type DraftCasePackage,
  type PublicationCandidate
} from "./schemas.ts";

// Candidate preparation projects authoring lifecycle metadata onto the exact
// immutable artifact that would be persisted after approval. It never mutates
// the source value and does not claim that persistence has already occurred.
function publicationArtifactSource(input: unknown): DraftCasePackage {
  const source = DraftCasePackageSchema.parse(input);

  return DraftCasePackageSchema.parse({
    ...source,
    manifest: {
      ...source.manifest,
      status: "PUBLISHED"
    },
    validation: {
      ...source.validation,
      review_status: "APPROVED",
      approval_status: "APPROVED"
    }
  });
}

export async function buildPublicationCandidateArtifact(
  input: unknown,
  hashAdapter: HashAdapter
): Promise<PublicationCandidate> {
  const artifactSource = publicationArtifactSource(input);
  const moduleHashes = await computeModuleHashes(artifactSource, hashAdapter);
  const compiledWithoutPackageHash = {
    ...artifactSource,
    manifest: {
      ...artifactSource.manifest,
      hash_algorithm: "SHA-256" as const,
      module_hashes: moduleHashes
    }
  };
  const candidatePackageHash = await hashCanonicalJson(
    compiledWithoutPackageHash,
    hashAdapter
  );
  const compiledPackage = CompiledCasePackageSchema.parse({
    ...compiledWithoutPackageHash,
    package_hash: candidatePackageHash
  });

  return PublicationCandidateSchema.parse({
    candidate_package_hash: candidatePackageHash,
    package: compiledPackage
  });
}
