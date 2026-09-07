import { SessionIdSchema } from "@ai-clinical-simulation/contracts";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

import { useLocalization } from "../../app/localization";
import { presentSessionLoad } from "../../app/session-presentation";
import type { AuthSnapshot, StudentUiServices } from "../../app/types";
import { AppFrame } from "../../components/AppFrame";
import { ErrorState, LoadingState } from "../../components/ui";
import { SimulationWorkspace } from "./SimulationWorkspace";

export function SessionPage({
  services,
  auth
}: {
  services: StudentUiServices;
  auth: Extract<AuthSnapshot, { status: "AUTHENTICATED" }>;
}) {
  const { t } = useLocalization();
  const params = useParams();
  const parsedSessionId = SessionIdSchema.safeParse(params.sessionId);
  const session = useQuery({
    queryKey: ["safe-session", parsedSessionId.success ? parsedSessionId.data : "invalid"],
    queryFn: () => services.sessions.load(parsedSessionId.success ? parsedSessionId.data : "invalid"),
    enabled: parsedSessionId.success,
    retry: false,
    refetchOnWindowFocus: false
  });
  const back = <Link className="button button--secondary" to="/app">{t("backHome")}</Link>;
  if (!parsedSessionId.success) {
    return (
      <AppFrame auth={auth}>
        <ErrorState title={t("invalidSessionTitle")} body={t("invalidSessionBody")} action={back} />
      </AppFrame>
    );
  }
  if (session.isPending) {
    return (
      <AppFrame auth={auth}>
        <LoadingState title={t("loadingSession")} body={t("loadingNoPatient")} />
      </AppFrame>
    );
  }
  if (session.isError) {
    return (
      <AppFrame auth={auth}>
        <ErrorState title={t("unavailableTitle")} body={t("unavailableBody")} action={back} />
      </AppFrame>
    );
  }
  if (session.data.kind === "UNAUTHORIZED") {
    return (
      <AppFrame auth={auth}>
        <ErrorState title={t("unauthorizedTitle")} body={t("unauthorizedBody")} action={back} />
      </AppFrame>
    );
  }
  if (session.data.kind === "NOT_FOUND") {
    return (
      <AppFrame auth={auth}>
        <ErrorState title={t("notFoundTitle")} body={t("notFoundBody")} action={back} />
      </AppFrame>
    );
  }
  if (session.data.kind === "API_UNAVAILABLE") {
    return (
      <AppFrame auth={auth}>
        <ErrorState title={t("unavailableTitle")} body={t("unavailableBody")} action={back} />
      </AppFrame>
    );
  }
  const state = presentSessionLoad(session.data);
  if (state === undefined) {
    return (
      <AppFrame auth={auth}>
        <ErrorState title={t("unavailableTitle")} body={t("unavailableBody")} action={back} />
      </AppFrame>
    );
  }
  return (
    <SimulationWorkspace
      services={services}
      auth={auth}
      state={state}
      onAuthoritativeRefresh={() => session.refetch()}
    />
  );
}
