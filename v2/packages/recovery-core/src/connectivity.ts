import {
  ConnectivitySignalSchema,
  ConnectivityStateSchema,
  type ConnectivitySignal,
  type ConnectivityState
} from "../../contracts/src/index.ts";

/**
 * Browser connectivity hints never establish ONLINE authority. Only a
 * successful trusted request or synchronization can do that.
 */
export function reduceConnectivityState(
  currentInput: unknown,
  signalInput: unknown
): ConnectivityState | undefined {
  const current = ConnectivityStateSchema.safeParse(currentInput);
  const signal = ConnectivitySignalSchema.safeParse(signalInput);
  if (!current.success || !signal.success) return undefined;

  const transitions: Record<ConnectivitySignal, ConnectivityState> = {
    NAVIGATOR_REPORTED_ONLINE: current.data === "ONLINE" ? "ONLINE" : "RECOVERING",
    NAVIGATOR_REPORTED_OFFLINE: "OFFLINE_OR_UNREACHABLE",
    REQUEST_SUCCEEDED: "ONLINE",
    REQUEST_FAILED_AMBIGUOUSLY: "OFFLINE_OR_UNREACHABLE",
    RECOVERY_STARTED: "RECOVERING",
    AUTHORITATIVE_SYNC_REQUIRED: "SYNC_REQUIRED",
    AUTHORITATIVE_SYNC_COMPLETED: "ONLINE"
  };
  return transitions[signal.data];
}
