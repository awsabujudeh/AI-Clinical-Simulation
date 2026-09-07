import { useQuery } from "@tanstack/react-query";
import { useEffect, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { useLocalization } from "../../app/localization";
import type { AuthSnapshot, StudentUiServices } from "../../app/types";
import { AppFrame } from "../../components/AppFrame";
import { Button, ErrorState, LoadingState } from "../../components/ui";

export function AuthBoundary({
  services,
  children
}: {
  services: StudentUiServices;
  children(auth: Extract<AuthSnapshot, { status: "AUTHENTICATED" }>): ReactNode;
}) {
  const { t } = useLocalization();
  const location = useLocation();
  const auth = useQuery({
    queryKey: ["student-auth"],
    queryFn: () => services.auth.resolve(),
    retry: false,
    staleTime: 30_000
  });
  if (auth.isPending) {
    return (
      <AppFrame>
        <LoadingState title={t("authLoading")} body={t("loadingNoPatient")} />
      </AppFrame>
    );
  }
  if (auth.isError) {
    return (
      <AppFrame>
        <ErrorState title={t("unavailableTitle")} body={t("unavailableBody")} />
      </AppFrame>
    );
  }
  if (auth.data.status !== "AUTHENTICATED") {
    const expired = auth.data.status === "EXPIRED";
    return (
      <AppFrame auth={auth.data}>
        <section className="auth-card" aria-labelledby="auth-required-title">
          <p className="eyebrow">{expired ? t("authExpired") : t("loginTitle")}</p>
          <h1 id="auth-required-title">{t("loginTitle")}</h1>
          <p>{expired ? t("authExpired") : t("loginBody")}</p>
          <Link
            className="button button--primary"
            to="/login"
            state={{ returnTo: location.pathname }}
          >
            {t("loginAction")}
          </Link>
        </section>
      </AppFrame>
    );
  }
  return <>{children(auth.data)}</>;
}

export function LoginPage({ services }: { services: StudentUiServices }) {
  const { t } = useLocalization();
  const navigate = useNavigate();
  const location = useLocation();
  const auth = useQuery({
    queryKey: ["student-auth"],
    queryFn: () => services.auth.resolve(),
    retry: false
  });
  const returnTo = typeof location.state === "object"
    && location.state !== null
    && "returnTo" in location.state
    && typeof location.state.returnTo === "string"
    ? location.state.returnTo
    : "/app";
  useEffect(() => {
    if (auth.data?.status === "AUTHENTICATED") navigate(returnTo, { replace: true });
  }, [auth.data?.status, navigate, returnTo]);
  async function beginSignIn() {
    await services.auth.beginSignIn?.();
    await auth.refetch();
  }
  return (
    <AppFrame>
      <section className="auth-card" aria-labelledby="login-title">
        <span className="auth-card__symbol" aria-hidden="true">→</span>
        <h1 id="login-title">{t("loginTitle")}</h1>
        <p>{t("loginBody")}</p>
        <Button
          type="button"
          onClick={() => void beginSignIn()}
          disabled={services.auth.beginSignIn === undefined || auth.isFetching}
        >
          {t("loginAction")}
        </Button>
        {services.auth.beginSignIn === undefined ? (
          <p className="support-copy" role="note">{t("loginUnavailable")}</p>
        ) : null}
      </section>
    </AppFrame>
  );
}
