import { createRoot } from "react-dom/client";
import { SafeLearnerTimelineProjectionSchema, SafeSessionProjectionSchema } from "../../../packages/contracts/src/index.ts";
import { App } from "../../../apps/web/src/App.tsx";
import type { StudentUiServices } from "../../../apps/web/src/app/types.ts";
import "../../../apps/web/src/styles.css";
import {
  SYNTHETIC_ASSESSMENT_SESSION,
  SYNTHETIC_SAFE_SESSION,
  SYNTHETIC_STALE_SESSION
} from "../../fixtures/student-ui/safe-session.ts";
import {
  SYNTHETIC_ENDED_ASSESSMENT_SESSION,
  SYNTHETIC_FINAL_ASSESSMENT,
  SYNTHETIC_LEARNER_TIMELINE
} from "../../fixtures/student-ui/v2-017.ts";

declare global {
  interface Window {
    __V2_017_TEST_STATE__: { loads: number; timelineLoads: number; submissions: number; finalizations: number };
  }
}

const scenario = new URL(window.location.href).searchParams.get("scenario") ?? "practice";
window.__V2_017_TEST_STATE__ = { loads: 0, timelineLoads: 0, submissions: 0, finalizations: 0 };

let projection = scenario === "assessment"
  ? SYNTHETIC_ASSESSMENT_SESSION
  : scenario === "final"
    ? SYNTHETIC_ENDED_ASSESSMENT_SESSION
    : SYNTHETIC_SAFE_SESSION;
let timeline = SYNTHETIC_LEARNER_TIMELINE;

const services: StudentUiServices = {
  auth: {
    async resolve() {
      return { status: "AUTHENTICATED", principal_user_id: "20000000-0000-4000-8000-000000000015", display_name: "E2E learner" };
    }
  },
  sessions: {
    async load() {
      window.__V2_017_TEST_STATE__.loads += 1;
      if (scenario === "stale") return { kind: "STALE", connectivity: "OFFLINE_OR_UNREACHABLE", cached: SYNTHETIC_STALE_SESSION };
      return { kind: "AUTHORITATIVE", connectivity: "ONLINE", projection };
    },
    async start() { return { success: false, kind: "INVALID" }; }
  },
  actions: {
    async submit() {
      window.__V2_017_TEST_STATE__.submissions += 1;
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
      timeline = SafeLearnerTimelineProjectionSchema.parse({
        ...timeline,
        event_sequence_through: 8,
        items: [...timeline.items, {
          event_id: "00000000-0000-4000-8000-000000000008",
          sequence_no: 8,
          clinical_time: 130,
          item_type: "ACTION_COMMITTED",
          action_id: "examination.synthetic-check",
          labels: [
            { locale: "ar-JO", text: "تم اعتماد فحص اصطناعي" },
            { locale: "en-US", text: "Synthetic examination committed" }
          ]
        }]
      });
      return {
        kind: "COMMITTED", replayed: false, idempotency_key: "idempotency.v2-017.action",
        committed_event_ids: ["00000000-0000-4000-8000-000000000008"], projection
      };
    }
  },
  timeline: {
    async load() {
      window.__V2_017_TEST_STATE__.timelineLoads += 1;
      return { kind: "AVAILABLE", projection: timeline };
    }
  },
  assessment: {
    async load() {
      return projection.status === "ENDED"
        ? { kind: "AVAILABLE", projection: SYNTHETIC_FINAL_ASSESSMENT }
        : { kind: "PENDING" };
    }
  },
  finalization: {
    async end() {
      window.__V2_017_TEST_STATE__.finalizations += 1;
      projection = SYNTHETIC_ENDED_ASSESSMENT_SESSION;
      return {
        kind: "COMMITTED", replayed: false, idempotency_key: "idempotency.v2-017.end",
        projection, assessment: SYNTHETIC_FINAL_ASSESSMENT
      };
    }
  }
};

createRoot(document.getElementById("root")!).render(
  <App services={services} initialEntries={["/sessions/session.ui-neutral"]} />
);
