import { createRoot } from "react-dom/client";

import { App } from "../../../apps/web/src/App.tsx";
import type { StudentUiServices } from "../../../apps/web/src/app/types.ts";
import "../../../apps/web/src/styles.css";
import {
  SYNTHETIC_SAFE_SESSION,
  SYNTHETIC_STALE_SESSION
} from "../../fixtures/student-ui/safe-session.ts";
import { SYNTHETIC_ENDED_ASSESSMENT_SESSION } from "../../fixtures/student-ui/v2-017.ts";

declare global {
  interface Window {
    __V2_019A_TEST_STATE__: { loads: number; submissions: number };
  }
}

const scenario = new URL(window.location.href).searchParams.get("scenario") ?? "success";
window.__V2_019A_TEST_STATE__ = { loads: 0, submissions: 0 };

const services: StudentUiServices = {
  auth: {
    async resolve() {
      return {
        status: "AUTHENTICATED",
        principal_user_id: "20000000-0000-4000-8000-000000000015",
        display_name: "Conversation learner"
      };
    }
  },
  sessions: {
    async load() {
      if (scenario === "offline") {
        return { kind: "STALE", connectivity: "OFFLINE_OR_UNREACHABLE", cached: SYNTHETIC_STALE_SESSION };
      }
      return {
        kind: "AUTHORITATIVE",
        connectivity: "ONLINE",
        projection: scenario === "ended" ? SYNTHETIC_ENDED_ASSESSMENT_SESSION : SYNTHETIC_SAFE_SESSION
      };
    },
    async start() { return { success: false, kind: "INVALID" }; }
  },
  actions: {
    async submit() { return { kind: "UNAVAILABLE", requires_authoritative_sync: true }; }
  },
  timeline: { async load() { return { kind: "UNAVAILABLE" }; } },
  assessment: { async load() { return { kind: "PENDING" }; } },
  patient_conversation: {
    async load(sessionId) {
      window.__V2_019A_TEST_STATE__.loads += 1;
      return {
        kind: "AVAILABLE",
        transcript: { conversation_schema_version: "1.0", session_id: sessionId as never, turns: [] }
      };
    },
    async submit(intent) {
      window.__V2_019A_TEST_STATE__.submissions += 1;
      await new Promise((resolve) => setTimeout(resolve, 80));
      if (scenario === "unavailable") return { kind: "UNAVAILABLE" };
      const arabic = intent.locale === "ar-JO";
      return {
        kind: "COMMITTED",
        replayed: false,
        turn: {
          conversation_schema_version: "1.0",
          turn_id: "conversation-turn.e2e.001" as never,
          session_id: intent.session_id as never,
          turn_sequence: 1 as never,
          clinical_time: 125 as never,
          grounded_state_version: 3 as never,
          locale: intent.locale,
          source: "TEXT",
          utterance_id: "utterance.e2e.001",
          learner_utterance: intent.text,
          patient_utterance: arabic ? "أنا بخير ضمن المعلومات المؤلفة للمريض." : "I can answer from the reviewed patient information.",
          answer_mode: "GROUNDED",
          fallback_used: false,
          grounding_fact_ids: ["fact.synthetic.concern" as never],
          grounding_state_refs: [],
          question_event_id: "00000000-0000-4000-8000-000000000191" as never,
          response_event_id: "00000000-0000-4000-8000-000000000192" as never
        }
      };
    }
  },
  finalization: {
    async end() { return { kind: "UNAVAILABLE", requires_authoritative_sync: true }; }
  }
};

createRoot(document.getElementById("root")!).render(
  <App services={services} initialEntries={["/sessions/session.ui-neutral"]} />
);
