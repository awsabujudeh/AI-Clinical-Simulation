import { expect, it } from "vitest";
import {
  presentSessionLoad,
  preserveSessionProgress,
} from "../../../apps/web/src/app/session-presentation.ts";
import type { SessionLoadResult } from "../../../apps/web/src/app/types.ts";
import { SYNTHETIC_SAFE_SESSION } from "../../fixtures/student-ui/safe-session.ts";

const snapshot = (time: number): SessionLoadResult => ({
  kind: "AUTHORITATIVE",
  connectivity: "ONLINE",
  projection: {
    ...SYNTHETIC_SAFE_SESSION,
    clinical_time: time as never,
    observations: {
      ...SYNTHETIC_SAFE_SESSION.observations,
      clinical_time: time as never,
      acquired: [],
    },
  },
});
it("a delayed response cannot rewind the displayed server clock or enable mutation", () => {
  const result = preserveSessionProgress(snapshot(150), snapshot(140));
  expect(presentSessionLoad(result)?.projection.clinical_time).toBe(150);
  expect(presentSessionLoad(result)?.kind).toBe("SYNC_REQUIRED");
  expect(preserveSessionProgress(result, snapshot(151))).toEqual(snapshot(151));
});
it("offline delivery stays frozen at last received server time; no local extrapolation", () => {
  const s = snapshot(120);
  if (s.kind !== "AUTHORITATIVE") throw Error();
  const old: SessionLoadResult = {
    kind: "STALE",
    connectivity: "OFFLINE_OR_UNREACHABLE",
    cached: {
      recovery_schema_version: "1.0",
      principal_user_id: "20000000-0000-4000-8000-000000000015" as never,
      session_id: s.projection.session_id,
      freshness: "STALE_LAST_KNOWN",
      mutation_authority: "NONE",
      captured_at_utc: "2026-09-25T00:00:00Z" as never,
      projection: s.projection,
    },
  };
  const result = preserveSessionProgress(snapshot(150), old);
  expect(presentSessionLoad(result)?.projection.clinical_time).toBe(150);
  expect(presentSessionLoad(result)?.mutation_authority).toBe("NONE");
});
it("an older snapshot never masks lost authorization or bleeds into another Session", () => {
  expect(
    preserveSessionProgress(snapshot(150), {
      kind: "UNAUTHORIZED",
      http_status: 403,
    }),
  ).toEqual({ kind: "UNAUTHORIZED", http_status: 403 });
  const other = snapshot(0);
  if (other.kind !== "AUTHORITATIVE") throw Error();
  const incoming: SessionLoadResult = {
    ...other,
    projection: {
      ...other.projection,
      session_id: "session.other" as never,
      observations: {
        ...other.projection.observations,
        session_id: "session.other" as never,
      },
    },
  };
  expect(preserveSessionProgress(snapshot(150), incoming)).toEqual(incoming);
});
