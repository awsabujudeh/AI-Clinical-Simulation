import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  InDoubtRecoveryJournalEntrySchema,
  IdempotencyKeySchema,
  PatientLanguageSchema,
  RecoveryPrincipalIdSchema,
  SafeSessionProjectionSchema,
} from "../../../packages/contracts/src/index.ts";
import {
  InMemoryRecoveryStorageAdapter,
  createRecoveryCoordinator,
  type RecoveryStorageAdapter,
  type RecoveryStorageWriteResult,
  type RecoveryTransport
} from "../../../packages/recovery-core/src/index.ts";
import { App } from "../../../apps/web/src/App.tsx";
import {
  actionSubmissionFromRecovery,
  createRecoveryBackedStudentActionService
} from "../../../apps/web/src/app/services.ts";
import type {
  StudentClinicalActionResult,
  StudentUiServices
} from "../../../apps/web/src/app/types.ts";
import {
  actionsForDomain,
  learnerActionLabel,
  validateLearnerActionParameters
} from "../../../apps/web/src/features/actions/action-model.ts";
import "../../../apps/web/src/styles.css";
import {
  SYNTHETIC_SAFE_SESSION,
  SYNTHETIC_STALE_SESSION
} from "../../fixtures/student-ui/safe-session.ts";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

const PRINCIPAL = RecoveryPrincipalIdSchema.parse(
  "20000000-0000-4000-8000-000000000015"
);
const ACTION_TIME = "2026-09-07T10:00:00Z";
const identity = {
  create() {
    return {
      request_id: "request.ui.action",
      correlation_id: "correlation.ui.action",
      idempotency_key: "idempotency.ui.action",
      command_id: "command.ui.action",
      action_request_id: "action-request.ui.action",
      attempted_at_utc: ACTION_TIME
    };
  }
};

let host: HTMLDivElement;
let root: Root;

function authenticatedServices(input?: {
  load?: StudentUiServices["sessions"]["load"];
  submit?: StudentUiServices["actions"]["submit"];
}): StudentUiServices {
  return {
    auth: {
      async resolve() {
        return {
          status: "AUTHENTICATED",
          principal_user_id: PRINCIPAL,
          display_name: "Student"
        } as const;
      }
    },
    sessions: {
      load: input?.load ?? (async () => ({
        kind: "AUTHORITATIVE",
        connectivity: "ONLINE",
        projection: SYNTHETIC_SAFE_SESSION
      })),
      async start() {
        return { success: false, kind: "INVALID" };
      }
    },
    actions: {
      submit: input?.submit ?? (async () => ({
        kind: "COMMITTED",
        replayed: false,
        idempotency_key: "idempotency.ui.action",
        committed_event_ids: ["00000000-0000-4000-8000-000000000015"],
        projection: SYNTHETIC_SAFE_SESSION
      }))
    },
    timeline: { async load() { return { kind: "UNAVAILABLE" }; } },
    assessment: { async load() { return { kind: "PENDING" }; } },
    finalization: {
      async end() { return { kind: "UNAVAILABLE", requires_authoritative_sync: true }; }
    }
  };
}

async function render(services = authenticatedServices()) {
  await act(async () => {
    root.render(<App services={services} initialEntries={["/sessions/session.ui-neutral"]} />);
  });
  await settle(() => text().includes("Current patient"));
}

async function settle(predicate: () => boolean) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate()) return;
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 5)); });
  }
  throw new Error("V2-016 UI did not settle.");
}

function text() {
  return host.textContent ?? "";
}

function button(name: string) {
  return [...host.querySelectorAll<HTMLButtonElement>("button")]
    .find((candidate) => candidate.textContent?.includes(name));
}

async function click(name: string) {
  const target = button(name);
  expect(target, `button ${name}`).toBeDefined();
  await act(async () => target?.click());
}

async function setInput(name: string, value: string) {
  const field = host.querySelector<HTMLInputElement | HTMLSelectElement>(`[name="${name}"]`);
  expect(field, `field ${name}`).not.toBeNull();
  await act(async () => {
    const prototype = field instanceof HTMLSelectElement
      ? HTMLSelectElement.prototype
      : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(field, value);
    field?.dispatchEvent(new Event("input", { bubbles: true }));
    field?.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  document.documentElement.lang = "en-US";
  document.documentElement.dir = "ltr";
});

describe("V2-016 generic action presentation and validation", () => {
  it("discovers only safe Case-owned action metadata and filters neutrally", () => {
    const actions = SYNTHETIC_SAFE_SESSION.learner_action_catalogue.actions;
    const enUS = PatientLanguageSchema.parse("en-US");
    const arJO = PatientLanguageSchema.parse("ar-JO");
    const medications = actionsForDomain(actions, "MEDICATION", enUS, "study");
    expect(medications.map((action) => action.action_id)).toEqual([
      "medication.synthetic-study-agent"
    ]);
    expect(learnerActionLabel(medications[0]!, arJO)).toContain("اصطناعي");
    expect(learnerActionLabel({ ...medications[0]!, labels: [] }, arJO))
      .toBe("medication.synthetic-study-agent");
  });

  it("validates medication dose, unit, route, missing, extra, and malformed values", () => {
    const medication = SYNTHETIC_SAFE_SESSION.learner_action_catalogue.actions.find(
      (action) => action.action_type === "MEDICATION"
    )!;
    expect(validateLearnerActionParameters(medication, {
      dose: 10,
      unit: "unit.synthetic-small",
      route: "route.synthetic-a"
    })).toMatchObject({ success: true });
    expect(validateLearnerActionParameters(medication, {
      dose: -1,
      unit: "unit.unknown",
      route: "route.unknown",
      patient_state: {}
    })).toMatchObject({
      success: false,
      issues: [
        { code: "UNKNOWN_FIELD", parameter_code: "patient_state" },
        { code: "OUT_OF_RANGE", parameter_code: "dose" },
        { code: "UNSUPPORTED_CODE", parameter_code: "unit" },
        { code: "UNSUPPORTED_CODE", parameter_code: "route" }
      ]
    });
    expect(validateLearnerActionParameters(medication, {
      dose: "not-a-number",
      unit: "",
      route: ""
    })).toMatchObject({ success: false });
  });

  it("bounds diagnosis text without correcting learner intent", () => {
    const diagnosis = SYNTHETIC_SAFE_SESSION.learner_action_catalogue.actions.find(
      (action) => action.action_type === "DIAGNOSIS"
    )!;
    const learnerText = "  learner phrasing stays exact  ";
    const valid = validateLearnerActionParameters(diagnosis, { diagnosis_text: learnerText });
    expect(valid.success && valid.parameters.diagnosis_text).toBe(learnerText);
    expect(validateLearnerActionParameters(diagnosis, {
      diagnosis_text: "x".repeat(4_001)
    })).toMatchObject({ success: false, issues: [{ code: "TEXT_TOO_LONG" }] });
  });

  it("renders interactive domains while leaving free-text Patient AI unavailable", async () => {
    await render();
    expect(text()).toContain("Structured history actions are not available");
    expect(text()).toContain("Free-text patient conversation is not available");
    expect(host.querySelector('textarea[name="patient-question"]')).toBeNull();
    await click("Examination");
    expect(text()).toContain("Perform synthetic examination");
    await click("Investigations");
    expect(text()).toContain("Order synthetic investigation");
    await click("Procedures");
    expect(text()).toContain("Perform synthetic support procedure");
    await click("Diagnosis / Disposition");
    expect(text()).toContain("Enter learner diagnosis");
    expect(text()).toContain("Choose disposition");
  });

  it("shows accessible form validation and confirmation before a structured medication proposal", async () => {
    const submit = vi.fn(authenticatedServices().actions.submit);
    await render(authenticatedServices({ submit }));
    await click("Medications");
    await click("Propose synthetic study medication");
    await click("Propose action");
    expect(submit).not.toHaveBeenCalled();
    expect(host.querySelectorAll('.interaction-shell [role="alert"]')).toHaveLength(3);
    await setInput("dose", "10");
    await setInput("unit", "unit.synthetic-small");
    await setInput("route", "route.synthetic-a");
    await click("Propose action");
    expect(host.querySelector('[role="dialog"][aria-modal="true"]')).not.toBeNull();
    expect(submit).not.toHaveBeenCalled();
    await click("Confirm and send");
    await settle(() => text().includes("Action committed"));
    expect(submit).toHaveBeenCalledOnce();
    expect(submit.mock.calls[0]?.[0]).toMatchObject({
      session_id: "session.ui-neutral",
      expected_state_version: 3,
      parameters: {
        dose: 10,
        unit: "unit.synthetic-small",
        route: "route.synthetic-a"
      }
    });
  });

  it("coalesces double submission and shows no optimistic medical state", async () => {
    let finish!: (result: StudentClinicalActionResult) => void;
    const pending = new Promise<StudentClinicalActionResult>((resolve) => { finish = resolve; });
    const submit = vi.fn(() => pending);
    let loads = 0;
    const refreshed = SafeSessionProjectionSchema.parse({
      ...SYNTHETIC_SAFE_SESSION,
      state_version: 4,
      clinical_time: 130,
      event_sequence_through: 8,
      observations: {
        ...SYNTHETIC_SAFE_SESSION.observations,
        state_version: 4,
        clinical_time: 130,
        heart_rate_bpm: 80
      }
    });
    await render(authenticatedServices({
      load: async () => ({
        kind: "AUTHORITATIVE",
        connectivity: "ONLINE",
        projection: loads++ === 0 ? SYNTHETIC_SAFE_SESSION : refreshed
      }),
      submit
    }));
    await click("Examination");
    await click("Perform synthetic examination");
    const form = host.querySelector(".action-form");
    await act(async () => {
      form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    expect(submit).toHaveBeenCalledOnce();
    expect(text()).toContain("Submitting intent");
    expect(text()).toContain("72");
    expect(text()).toContain("02:05");
    expect(text()).not.toContain("80");
    await act(async () => finish({
      kind: "COMMITTED",
      replayed: false,
      idempotency_key: "idempotency.ui.action",
      committed_event_ids: ["00000000-0000-4000-8000-000000000015"],
      projection: refreshed
    }));
    await settle(() => text().includes("80"));
    expect(text()).toContain("02:10");
    expect(loads).toBe(2);
  });

  it("blocks offline mutation and handles stale state without automatic re-execution", async () => {
    const submit = vi.fn();
    await render(authenticatedServices({
      load: async () => ({
        kind: "STALE",
        connectivity: "OFFLINE_OR_UNREACHABLE",
        cached: SYNTHETIC_STALE_SESSION
      }),
      submit
    }));
    await click("Examination");
    const action = button("Perform synthetic examination");
    expect(action?.disabled).toBe(true);
    expect(submit).not.toHaveBeenCalled();

    await act(async () => root.unmount());
    root = createRoot(host);
    const staleSubmit = vi.fn(async () => ({
      kind: "STALE",
      requires_authoritative_sync: true,
      http_status: 409
    } as const));
    let loads = 0;
    await render(authenticatedServices({
      load: async () => {
        loads += 1;
        return { kind: "AUTHORITATIVE", connectivity: "ONLINE", projection: SYNTHETIC_SAFE_SESSION };
      },
      submit: staleSubmit
    }));
    await click("Examination");
    await click("Perform synthetic examination");
    await click("Propose action");
    await settle(() => text().includes("not automatically repeated"));
    expect(staleSubmit).toHaveBeenCalledOnce();
    expect(loads).toBe(2);
  });

  it("renders authored Arabic action labels in RTL and preserves Assessment non-disclosure", async () => {
    await render();
    await click("العربية");
    expect(document.documentElement.lang).toBe("ar-JO");
    expect(document.documentElement.dir).toBe("rtl");
    await click("الفحص");
    expect(text()).toContain("إجراء فحص اصطناعي");
    expect(text()).not.toMatch(/score|rubric|correct action|expected action/iu);
  });
});

describe("V2-016 recovery-backed clinical action service", () => {
  const action = SYNTHETIC_SAFE_SESSION.learner_action_catalogue.actions[0]!;

  function actionIntent() {
    return {
      principal_user_id: PRINCIPAL,
      session_id: SYNTHETIC_SAFE_SESSION.session_id,
      expected_state_version: SYNTHETIC_SAFE_SESSION.state_version,
      action,
      parameters: {},
      connectivity_state: "ONLINE" as const
    };
  }

  it("persists the exact journal before transport and returns committed authoritative data", async () => {
    const storage = new InMemoryRecoveryStorageAdapter();
    let journalPresentAtSend = false;
    let sentBody: unknown;
    const transport: RecoveryTransport = {
      async send(request) {
        const entryId = `recovery:${PRINCIPAL}:PROPOSE_ACTION:idempotency.ui.action`;
        journalPresentAtSend = await storage.readJournalEntry(entryId as never) !== null;
        sentBody = request.body === undefined ? undefined : JSON.parse(request.body);
        return {
          kind: "HTTP_RESPONSE",
          status: 200,
          body: {
            api_schema_version: "1.0",
            request_id: "request.ui.action",
            data: {
              execution_status: "EXECUTED",
              replayed: false,
              committed_event_ids: ["00000000-0000-4000-8000-000000000015"],
              session: SYNTHETIC_SAFE_SESSION
            }
          }
        };
      }
    };
    const coordinator = createRecoveryCoordinator({
      storage,
      transport,
      delay: { async wait() {} }
    });
    const service = createRecoveryBackedStudentActionService({ coordinator, identity_factory: identity });
    const result = await service.submit(actionIntent());
    expect(journalPresentAtSend).toBe(true);
    expect(result).toMatchObject({ kind: "COMMITTED", replayed: false });
    expect(sentBody).toEqual({
      command_id: "command.ui.action",
      action_request_id: "action-request.ui.action",
      action_id: action.action_id,
      expected_state_version: 3,
      parameters: {},
      source: "UI"
    });
    expect(JSON.stringify(sentBody)).not.toMatch(/patient_state|vitals|clinical_time|score|package_hash/iu);
  });

  it("does not send when known offline", async () => {
    let sends = 0;
    const coordinator = createRecoveryCoordinator({
      storage: new InMemoryRecoveryStorageAdapter(),
      transport: { async send() { sends += 1; return { kind: "NOT_SENT", failure: "KNOWN_OFFLINE" }; } },
      delay: { async wait() {} }
    });
    const service = createRecoveryBackedStudentActionService({ coordinator, identity_factory: identity });
    const result = await service.submit({ ...actionIntent(), connectivity_state: "OFFLINE_OR_UNREACHABLE" });
    expect(result).toMatchObject({ kind: "NOT_SENT", requires_authoritative_sync: true });
    expect(sends).toBe(0);
  });

  it("prevents transport when journal persistence fails", async () => {
    const base = new InMemoryRecoveryStorageAdapter();
    let sends = 0;
    const storage: RecoveryStorageAdapter = {
      readJournalEntry: (entryId) => base.readJournalEntry(entryId),
      listJournalEntries: (input) => base.listJournalEntries(input),
      async writeJournalEntry(): Promise<RecoveryStorageWriteResult> {
        return { success: false, code: "STORAGE_FAILURE" };
      },
      deleteJournalEntry: (entryId) => base.deleteJournalEntry(entryId),
      readLastKnownProjection: (input) => base.readLastKnownProjection(input),
      writeLastKnownProjection: (projection) => base.writeLastKnownProjection(projection),
      deletePrincipalRecoveryData: (principal) => base.deletePrincipalRecoveryData(principal)
    };
    const coordinator = createRecoveryCoordinator({
      storage,
      transport: { async send() { sends += 1; return { kind: "NOT_SENT", failure: "KNOWN_OFFLINE" }; } },
      delay: { async wait() {} }
    });
    const service = createRecoveryBackedStudentActionService({ coordinator, identity_factory: identity });
    expect(await service.submit(actionIntent())).toMatchObject({ kind: "NOT_SENT" });
    expect(sends).toBe(0);
  });

  it("preserves IN_DOUBT exact request identity for deterministic reconciliation", async () => {
    const storage = new InMemoryRecoveryStorageAdapter();
    let responseLost = true;
    const transport: RecoveryTransport = {
      async send() {
        if (responseLost) {
          responseLost = false;
          return { kind: "AMBIGUOUS_TRANSPORT_FAILURE", failure: "BEFORE_RESPONSE_CERTAINTY" };
        }
        return {
          kind: "HTTP_RESPONSE",
          status: 200,
          body: {
            api_schema_version: "1.0",
            request_id: "request.ui.action",
            data: {
              execution_status: "EXECUTED",
              replayed: true,
              committed_event_ids: ["00000000-0000-4000-8000-000000000015"],
              session: SYNTHETIC_SAFE_SESSION
            }
          }
        };
      }
    };
    const coordinator = createRecoveryCoordinator({ storage, transport, delay: { async wait() {} } });
    const service = createRecoveryBackedStudentActionService({ coordinator, identity_factory: identity });
    const uncertain = await service.submit(actionIntent());
    expect(uncertain).toMatchObject({ kind: "IN_DOUBT", idempotency_key: "idempotency.ui.action" });
    const entries = await storage.listJournalEntries({ principal_user_id: PRINCIPAL });
    const request = InDoubtRecoveryJournalEntrySchema.parse(entries[0]);
    const reconciled = await coordinator.reconcileInDoubt({
      principal_user_id: PRINCIPAL,
      journal_entry_id: request.journal_entry_id,
      attempted_at_utc: "2026-09-07T10:00:01Z",
      authentication_state: "VERIFIED"
    });
    expect(reconciled.success && reconciled.outcome.status).toBe("CONFIRMED_SUCCESS");
    expect(request.request.idempotency_key).toBe("idempotency.ui.action");
  });

  it("maps stale, idempotency conflict, rejection, and safe transport errors without raw detail", () => {
    const base = {
      success: false as const,
      issue: { code: "HTTP_REQUEST_REJECTED" as const, message_key: "safe.message", retryable: false }
    };
    const outcomes = [
      ["STALE_NOT_EXECUTED", "STALE"],
      ["IDEMPOTENCY_CONFLICT", "IDEMPOTENCY_CONFLICT"],
      ["CONFIRMED_REJECTION", "REJECTED"],
      ["AUTHENTICATION_REQUIRED", "UNAUTHENTICATED"],
      ["AUTHORIZATION_DENIED", "UNAUTHORIZED"]
    ] as const;
    for (const [status, expected] of outcomes) {
      expect(actionSubmissionFromRecovery({
        ...base,
        outcome: {
          recovery_schema_version: "1.0",
          operation: "PROPOSE_ACTION",
          idempotency_key: IdempotencyKeySchema.parse("idempotency.ui.action"),
          status,
          requires_authoritative_sync: status === "STALE_NOT_EXECUTED"
        }
      }, "idempotency.ui.action")).toMatchObject({ kind: expected });
    }
  });

  it("rejects malformed identities and injected action metadata before transport", async () => {
    let sends = 0;
    const coordinator = createRecoveryCoordinator({
      storage: new InMemoryRecoveryStorageAdapter(),
      transport: { async send() { sends += 1; return { kind: "NOT_SENT", failure: "KNOWN_OFFLINE" }; } },
      delay: { async wait() {} }
    });
    const badService = createRecoveryBackedStudentActionService({
      coordinator,
      identity_factory: { create: () => ({ ...identity.create(), idempotency_key: "bad key" }) }
    });
    expect(await badService.submit(actionIntent())).toMatchObject({ kind: "INVALID" });
    expect(await badService.submit({
      ...actionIntent(),
      action: { ...action, effects: [] } as never
    })).toMatchObject({ kind: "INVALID" });
    expect(sends).toBe(0);
  });
});
