import type { HashAdapter } from "../../contracts/src/index.ts";

import { buildPublicationCandidateArtifact } from "./candidate.ts";
import {
  CaseValidationIssueSchema,
  createValidationReport,
  type CaseValidationReport
} from "./report.ts";
import type {
  CompiledCasePackage,
  PublicationCandidate
} from "./schemas.ts";
import {
  validateForPublication,
  validateForPublicationCandidate
} from "./validation.ts";

export type PublicationCandidateResult =
  | {
      success: false;
      report: CaseValidationReport;
    }
  | {
      success: true;
      report: CaseValidationReport;
      candidate: PublicationCandidate;
    };

export type CaseCompilationResult =
  | {
      success: false;
      report: CaseValidationReport;
    }
  | {
      success: true;
      report: CaseValidationReport;
      package: CompiledCasePackage;
    };

export async function preparePublicationCandidate(
  input: unknown,
  hashAdapter: HashAdapter
): Promise<PublicationCandidateResult> {
  const report = await validateForPublicationCandidate(input, hashAdapter);

  if (!report.valid) {
    return { success: false, report };
  }

  try {
    return {
      success: true,
      report,
      candidate: await buildPublicationCandidateArtifact(input, hashAdapter)
    };
  } catch {
    return {
      success: false,
      report: createValidationReport("CANDIDATE", [
        ...report.issues,
        CaseValidationIssueSchema.parse({
          code: "HASH_ADAPTER_FAILURE",
          severity: "ERROR",
          path: "$",
          related_ids: [],
          message: "The supplied hash adapter could not prepare valid publication hashes."
        })
      ])
    };
  }
}

export async function compileCasePackage(
  input: unknown,
  approvalInput: unknown,
  hashAdapter: HashAdapter
): Promise<CaseCompilationResult> {
  const report = await validateForPublication(input, approvalInput, hashAdapter);

  if (!report.publishable) {
    return { success: false, report };
  }

  try {
    const candidate = await buildPublicationCandidateArtifact(input, hashAdapter);

    return {
      success: true,
      report,
      package: candidate.package
    };
  } catch {
    return {
      success: false,
      report: createValidationReport("PUBLICATION", [
        ...report.issues,
        CaseValidationIssueSchema.parse({
          code: "HASH_ADAPTER_FAILURE",
          severity: "ERROR",
          path: "$",
          related_ids: [],
          message: "The supplied hash adapter could not compile valid publication hashes."
        })
      ])
    };
  }
}
