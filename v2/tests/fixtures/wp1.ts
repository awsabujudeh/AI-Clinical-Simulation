import { createObservationReview } from "../../runtime/wp1-review-composition.ts";
import { apiHeaders } from "./api/secure-api.ts";
import { SafeSessionProjectionSchema } from "../../packages/contracts/src/index.ts";
let serial = 0;
export async function wp1Fixture(patient: "khalid" | "dana" = "dana") {
  let seconds = 0, n = 0;
  const r = await createObservationReview(
    patient,
    `test-${++serial}`,
    () => new Date(Date.UTC(2026, 8, 25, 0, 0, seconds)).toISOString(),
  );
  const path = `/v1/sessions/${r.sessionId}`;
  async function response(
    suffix: string,
    body?: unknown,
    token = "faculty",
    key?: string,
  ) {
    return r.h.app.request(path + suffix, {
      method: body === undefined ? "GET" : "POST",
      headers: apiHeaders({
        token,
        idempotency: key ?? `idempotency.wp1.call-${++n}`,
      }),
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  }
  async function state() {
    const res = await response("/state");
    const b = await res.json();
    if (res.status !== 200) throw Error(JSON.stringify(b));
    return SafeSessionProjectionSchema.parse(b.data);
  }
  async function action(id: string, extra: Record<string, unknown> = {}) {
    const current = await state();
    const i = ++n;
    const body = {
      action_id: id,
      action_request_id: `action-request.wp1.${i}`,
      command_id: `command.wp1.${i}`,
      source: "UI",
      parameters: {},
      expected_state_version: current.state_version,
      ...extra,
    };
    const key = `idempotency.wp1.action-${i}`;
    const res = await response("/actions/propose", body, "faculty", key);
    return {
      response: res,
      body: await res.json(),
      retry: () => response("/actions/propose", body, "faculty", key),
    };
  }
  return {
    ...r,
    path,
    response,
    state,
    action,
    elapsed: (s: number) => {
      seconds = s;
    },
    raw: () => r.h.store.sessions.get(r.sessionId)!,
  };
}

export async function wp1PortableSnapshot() {
  const f = await wp1Fixture();
  await f.action("examination.observe.bp");
  f.elapsed(5);
  const s = await f.state(), a = s.observations.acquired[0]!;
  return JSON.stringify({
    time: s.clinical_time,
    measurement: a.measurement,
    sampled_at: a.sampled_at,
    acquired_at: a.acquired_at,
    sequence: a.source_sequence,
    cuff: s.visual_patient?.equipment?.bp_cuff,
    events: f.raw().committed_events.length,
  });
}
export const WP1_PORTABLE_EXPECTED =
  '{"time":35,"measurement":{"channel":"BP","systolic":82,"diastolic":48,"unit":"mmHg"},"sampled_at":30,"acquired_at":30,"sequence":1,"cuff":true,"events":1}';
