import { describe, expect, it } from "vitest";

import {
  InMemorySessionAggregateSchema,
  createPinnedSessionCaseContext,
  processExternalLearnerCommand
} from "../../../packages/session-engine/src/index.ts";
import {
  TEST_SESSION_COMMAND_DEPENDENCIES,
  createCompiledSyntheticCommandSession,
  createSyntheticExternalCommand
} from "../../fixtures/session-engine/synthetic-command.ts";

describe("package-derived pinned Session Case context", () => {
  it("derives only Session-required Case data from the exact compiled package", async () => {
    const fixture = await createCompiledSyntheticCommandSession();
    const pinned = createPinnedSessionCaseContext(fixture.package);

    expect(pinned.success).toBe(true);
    if (!pinned.success) return;
    expect(pinned.context).toMatchObject({
      case_package_id: fixture.package.manifest.case_package_id,
      case_version_id: fixture.package.manifest.case_version_id,
      case_version: fixture.package.manifest.case_version,
      package_hash: fixture.package.package_hash
    });
    expect(pinned.context.action_catalogue.map((action) => action.action_id)).toEqual([
      "examination.synthetic-check"
    ]);
    expect(pinned.context.clinical_policy.package_hash).toBe(fixture.package.package_hash);
    expect(pinned.context).not.toHaveProperty("manifest");
    expect(pinned.context).not.toHaveProperty("validation");
  });

  it("runs the complete compiled-package ownership chain without action/policy sidecars", async () => {
    const fixture = await createCompiledSyntheticCommandSession();
    const command = createSyntheticExternalCommand(fixture.session, {
      expectedStateVersion: 0,
      requestedClinicalTime: 999
    });
    const result = await processExternalLearnerCommand(
      fixture.session,
      command,
      TEST_SESSION_COMMAND_DEPENDENCIES
    );

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.status).toBe("COMMITTED");
    expect(result.authoritative_session.patient_state.hemodynamic_state).toBe(
      "hemodynamics.alternate"
    );
    expect(result.committed_events.map((event) => event.event_type)).toEqual([
      "EXAM_PERFORMED"
    ]);
    expect(result.committed_events[0]?.clinical_time).toBe(0);
  });

  it("rejects aggregate-level raw action or Clinical policy sidecars", async () => {
    const fixture = await createCompiledSyntheticCommandSession();
    expect(InMemorySessionAggregateSchema.safeParse({
      ...fixture.session,
      action_catalogue: [],
      clinical_policy: fixture.session.pinned_case.clinical_policy
    }).success).toBe(false);
  });
});
