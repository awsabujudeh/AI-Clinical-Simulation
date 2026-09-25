import { z } from "zod";
import {
  type LearnerObservations,
  LearnerObservationsSchema,
  type ObservationChannel,
  type ObservationProjection,
  type ObservationValue,
  ObservationValueSchema,
} from "../../../contracts/src/index.ts";
import { projectObservations } from "../../../clinical-engine/src/index.ts";
import type { InMemorySessionAggregate } from "../session/in-memory-session.ts";
import type { PinnedSessionActionDefinition } from "../context/pinned-session-case.ts";

export function observationValue(
  truth: ObservationProjection,
  channel: ObservationChannel,
): ObservationValue {
  switch (channel) {
    case "HR":
      return ObservationValueSchema.parse({
        channel,
        value: truth.heart_rate_bpm,
        unit: "bpm",
      });
    case "BP":
      return ObservationValueSchema.parse({
        channel,
        systolic: truth.systolic_bp_mm_hg,
        diastolic: truth.diastolic_bp_mm_hg,
        unit: "mmHg",
      });
    case "RR":
      return ObservationValueSchema.parse({
        channel,
        value: truth.respiratory_rate_per_minute,
        unit: "/min",
      });
    case "SPO2":
      return ObservationValueSchema.parse({
        channel,
        value: truth.spo2_percent,
        unit: "%",
      });
    case "TEMPERATURE":
      return ObservationValueSchema.parse({
        channel,
        value: truth.temperature_celsius,
        unit: "C",
      });
    case "RHYTHM":
      return ObservationValueSchema.parse({
        channel,
        value: truth.rhythm.cardiac_rhythm,
        unit: "code",
      });
    case "CONSCIOUSNESS":
      return ObservationValueSchema.parse({
        channel,
        value: truth.consciousness_display_code,
        unit: "code",
      });
  }
}
export function captureActionObservations(
  truth: ObservationProjection,
  action: PinnedSessionActionDefinition,
) {
  const policy = action.observation_acquisition;
  return policy
    ? [...policy.channels, ...(policy.sample_channels ?? [])].map((c) =>
      observationValue(truth, c)
    )
    : [];
}

/** Read model of authoritative event receipts. Old packages default to no knowledge.
 * Sample values persist inside the atomic committed command, not a mutable UI store.
 * Only explicitly activated monitor channels consult current engine physiology. */
export function projectAcquiredObservations(
  session: InMemorySessionAggregate,
): LearnerObservations {
  const known = new Map<
    ObservationChannel,
    LearnerObservations["acquired"][number]
  >();
  for (
    const measurement
      of session.pinned_case.clinical_policy.observation_projection
        .pre_observed ?? []
  ) {
    known.set(measurement.channel, {
      measurement,
      status: "PRE_OBSERVED",
      acquired_at: 0 as never,
      sampled_at: 0 as never,
    });
  }
  const truth = projectObservations(
    session.patient_state,
    session.pinned_case.clinical_policy.observation_projection,
  );
  if (!truth.success) throw Error("OBSERVATION_PROJECTION_FAILED");
  for (const e of session.committed_events) {
    if (
      e.status !== "COMMITTED" || e.session_id !== session.session_id ||
      e.actor_type !== "LEARNER" ||
      e.clinical_time > session.patient_state.clinical_time
    ) continue;
    const action = session.pinned_case.action_catalogue.find((a) =>
      a.action_id === e.action_id && a.execution_event_type === e.event_type
    );
    const p = e.payload;
    if (
      !action?.observation_acquisition || !p || typeof p !== "object" ||
      Array.isArray(p) || p.execution_status !== "EXECUTED" ||
      p.catalogue_membership !== "VERIFIED"
    ) continue;
    const samples = z.array(ObservationValueSchema).parse(
      p.observation_samples,
    );
    const policy = action.observation_acquisition;
    const channels = [...policy.channels, ...(policy.sample_channels ?? [])];
    if (
      samples.length !== channels.length ||
      samples.some((s, i) => s.channel !== channels[i])
    ) throw Error("INVALID_OBSERVATION_RECEIPT");
    for (const measurement of samples) {
      const monitoring = policy.mode === "CONTINUOUS" &&
        policy.channels.includes(measurement.channel);
      // Re-measuring a monitored channel does not silently detach its monitor.
      if (
        !monitoring && known.get(measurement.channel)?.status === "MONITORING"
      ) continue;
      known.set(measurement.channel, {
        measurement,
        status: monitoring ? "MONITORING" : "MEASURED",
        acquired_at: e.clinical_time,
        sampled_at: e.clinical_time,
        source_action: action.action_id,
        source_event: e.event_id,
        source_sequence: e.sequence_no,
      });
    }
  }
  return LearnerObservationsSchema.parse({
    observation_schema_version: "2.0",
    session_id: session.session_id,
    clinical_time: session.patient_state.clinical_time,
    acquired: [...known.values()].sort((a, b) =>
      a.measurement.channel < b.measurement.channel ? -1 : 1
    ).map((a) =>
      a.status === "MONITORING"
        ? {
          ...a,
          measurement: observationValue(
            truth.observations,
            a.measurement.channel,
          ),
          sampled_at: session.patient_state.clinical_time,
        }
        : a
    ),
  });
}
