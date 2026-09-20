import type { SafeSessionProjection, VisualExamRequest } from "@ai-clinical-simulation/contracts";
export type VisualExamSelection = Readonly<{
  request: VisualExamRequest;
  session_id: SafeSessionProjection["session_id"];
  pinned_case: SafeSessionProjection["pinned_case"];
  state_version: SafeSessionProjection["state_version"];
}>;
/** Context accompanies intent only; this does not form an executable ActionRequest. */
export function bindVisualExamRequest(request: VisualExamRequest, session: SafeSessionProjection): VisualExamSelection {
  return { request: { ...request }, session_id: session.session_id,
    pinned_case: { ...session.pinned_case }, state_version: session.state_version };
}
export function currentVisualExamSelection(intent: VisualExamSelection, session: SafeSessionProjection): boolean {
  return intent.session_id === session.session_id && intent.state_version === session.state_version
    && intent.pinned_case.case_package_id === session.pinned_case.case_package_id
    && intent.pinned_case.case_version_id === session.pinned_case.case_version_id
    && intent.pinned_case.case_version === session.pinned_case.case_version
    && intent.pinned_case.execution_authority === session.pinned_case.execution_authority;
}
