import { createRoot } from "react-dom/client";

import { ClinicalInterpretationSchema } from "../../../packages/contracts/src/index.ts";
import { App } from "../../../apps/web/src/App.tsx";
import type { StudentUiServices } from "../../../apps/web/src/app/types.ts";
import "../../../apps/web/src/styles.css";
import { SYNTHETIC_SAFE_SESSION } from "../../fixtures/student-ui/safe-session.ts";
import { SYNTHETIC_ENDED_ASSESSMENT_SESSION } from "../../fixtures/student-ui/v2-017.ts";

declare global {
  interface Window {
    __V2_019B1_TEST_STATE__: { interpretations: number; submissions: number };
  }
}

const scenario = new URL(window.location.href).searchParams.get("scenario") ?? "match";
window.__V2_019B1_TEST_STATE__ = { interpretations: 0, submissions: 0 };

const services: StudentUiServices = {
  auth: {
    async resolve() {
      return {
        status: "AUTHENTICATED",
        principal_user_id: "20000000-0000-4000-8000-000000000015",
        display_name: "Interpreter learner"
      };
    }
  },
  sessions: {
    async load() {
      return {
        kind: "AUTHORITATIVE",
        connectivity: "ONLINE",
        projection: scenario === "ended" ? SYNTHETIC_ENDED_ASSESSMENT_SESSION : SYNTHETIC_SAFE_SESSION
      };
    },
    async start() { return { success: false, kind: "INVALID" }; }
  },
  actions: {
    async submit() {
      window.__V2_019B1_TEST_STATE__.submissions += 1;
      return {
        kind: "COMMITTED",
        replayed: false,
        idempotency_key: "idempotency.e2e.interpreter",
        committed_event_ids: ["00000000-0000-4000-8000-000000000195"],
        projection: SYNTHETIC_SAFE_SESSION
      };
    }
  },
  clinical_interpreter: {
    async interpret() {
      window.__V2_019B1_TEST_STATE__.interpretations += 1;
      if (scenario === "unavailable") return { kind: "UNAVAILABLE" };
      if (scenario === "no-match") {
        return {
          kind: "COMPLETED",
          grounded_state_version: SYNTHETIC_SAFE_SESSION.state_version,
          interpretation: ClinicalInterpretationSchema.parse({
            interpretation_schema_version: "1.0",
            authority: "NON_AUTHORITATIVE",
            status: "NO_MATCH",
            no_match_reason: "NO_ACTIONABLE_COMMAND"
          })
        };
      }
      if (scenario === "ambiguous") {
        return {
          kind: "COMPLETED",
          grounded_state_version: SYNTHETIC_SAFE_SESSION.state_version,
          interpretation: ClinicalInterpretationSchema.parse({
            interpretation_schema_version: "1.0",
            authority: "NON_AUTHORITATIVE",
            status: "AMBIGUOUS",
            ambiguity_reason: "MULTIPLE_ACTIONS",
            candidates: [
              { action_id: "examination.synthetic-check", parameters: {}, unresolved_required_parameters: [], confirmation_policy: "NONE" },
              { action_id: "investigation.synthetic-panel", parameters: {}, unresolved_required_parameters: [], confirmation_policy: "NONE" }
            ]
          })
        };
      }
      if (scenario === "missing" || scenario === "medication") {
        return {
          kind: "COMPLETED",
          grounded_state_version: SYNTHETIC_SAFE_SESSION.state_version,
          interpretation: ClinicalInterpretationSchema.parse({
            interpretation_schema_version: "1.0",
            authority: "NON_AUTHORITATIVE",
            status: "MATCH",
            candidate: {
              action_id: "medication.synthetic-study-agent",
              parameters: scenario === "missing"
                ? {}
                : { dose: 10, unit: "unit.synthetic-small", route: "route.synthetic-a" },
              unresolved_required_parameters: scenario === "missing" ? ["dose", "unit", "route"] : [],
              confirmation_policy: "EXPLICIT_ADMINISTRATION"
            }
          })
        };
      }
      return {
        kind: "COMPLETED",
        grounded_state_version: SYNTHETIC_SAFE_SESSION.state_version,
        interpretation: ClinicalInterpretationSchema.parse({
          interpretation_schema_version: "1.0",
          authority: "NON_AUTHORITATIVE",
          status: "MATCH",
          candidate: {
            action_id: "examination.synthetic-check",
            parameters: {},
            unresolved_required_parameters: [],
            confirmation_policy: "NONE"
          }
        })
      };
    }
  },
  timeline: { async load() { return { kind: "UNAVAILABLE" }; } },
  assessment: { async load() { return { kind: "PENDING" }; } },
  patient_conversation: {
    async load(sessionId) {
      return {
        kind: "AVAILABLE",
        transcript: { conversation_schema_version: "1.0", session_id: sessionId as never, turns: [] }
      };
    },
    async submit() { return { kind: "UNAVAILABLE" }; }
  },
  finalization: {
    async end() { return { kind: "UNAVAILABLE", requires_authoritative_sync: true }; }
  }
};

createRoot(document.getElementById("root")!).render(
  <App services={services} initialEntries={["/sessions/session.ui-neutral"]} />
);
