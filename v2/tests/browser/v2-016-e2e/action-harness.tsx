import { createRoot } from "react-dom/client";
import { SafeSessionProjectionSchema } from "../../../packages/contracts/src/index.ts";
import { App } from "../../../apps/web/src/App.tsx";
import type { StudentUiServices } from "../../../apps/web/src/app/types.ts";
import "../../../apps/web/src/styles.css";
import {
  SYNTHETIC_SAFE_SESSION,
  SYNTHETIC_STALE_SESSION
} from "../../fixtures/student-ui/safe-session.ts";

declare global {
  interface Window {
    __V2_016_TEST_STATE__: {
      submissions: number;
      loads: number;
      lastParameters?: unknown;
    };
  }
}

const scenario = new URL(window.location.href).searchParams.get("scenario") ?? "success";
window.__V2_016_TEST_STATE__ = { submissions: 0, loads: 0 };
let projection = SYNTHETIC_SAFE_SESSION;

const services: StudentUiServices = {
  auth: {
    async resolve() {
      return {
        status: "AUTHENTICATED",
        principal_user_id: "20000000-0000-4000-8000-000000000015",
        display_name: "E2E learner"
      };
    }
  },
  sessions: {
    async load() {
      window.__V2_016_TEST_STATE__.loads += 1;
      if (scenario === "offline") {
        return {
          kind: "STALE",
          connectivity: "OFFLINE_OR_UNREACHABLE",
          cached: SYNTHETIC_STALE_SESSION
        };
      }
      return { kind: "AUTHORITATIVE", connectivity: "ONLINE", projection };
    },
    async start() {
      return { success: false, kind: "INVALID" };
    }
  },
  actions: {
    async submit(intent) {
      window.__V2_016_TEST_STATE__.submissions += 1;
      window.__V2_016_TEST_STATE__.lastParameters = intent.parameters;
      await new Promise((resolve) => setTimeout(resolve, 120));
      if (scenario === "stale") {
        return {
          kind: "STALE",
          idempotency_key: "idempotency.e2e.action",
          http_status: 409,
          requires_authoritative_sync: true
        };
      }
      projection = SafeSessionProjectionSchema.parse({
        ...projection,
        state_version: projection.state_version + 1,
        clinical_time: projection.clinical_time + 5,
        event_sequence_through: projection.event_sequence_through + 1,
        observations: {
          ...projection.observations,
          state_version: projection.state_version + 1,
          clinical_time: projection.clinical_time + 5,
          heart_rate_bpm: 80
        }
      });
      return {
        kind: "COMMITTED",
        replayed: false,
        idempotency_key: "idempotency.e2e.action",
        committed_event_ids: ["00000000-0000-4000-8000-000000000016"],
        projection
      };
    }
  }
};

createRoot(document.getElementById("root")!).render(
  <App services={services} initialEntries={["/sessions/session.ui-neutral"]} />
);
