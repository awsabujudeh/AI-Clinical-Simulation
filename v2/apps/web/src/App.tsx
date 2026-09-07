import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  BrowserRouter,
  MemoryRouter,
  Navigate,
  Route,
  Routes
} from "react-router-dom";
import { useState } from "react";
import {
  PORTABILITY_SMOKE_FIXTURE,
  createPortabilitySmokeResult
} from "@ai-clinical-simulation/portability-smoke";

import { LocalizationProvider, useLocalization } from "./app/localization";
import { createUnconfiguredStudentUiServices } from "./app/services";
import type { StudentUiServices } from "./app/types";
import { AppFrame } from "./components/AppFrame";
import { ErrorState } from "./components/ui";
import { AuthBoundary, LoginPage } from "./features/auth/AuthBoundary";
import { ExpoLanding } from "./features/public/ExpoLanding";
import { PublicLanding } from "./features/public/PublicLanding";
import { SessionEntryPage } from "./features/simulation/SessionEntryPage";
import { SessionPage } from "./features/simulation/SessionPage";

const portabilityOutput = JSON.stringify(
  createPortabilitySmokeResult(PORTABILITY_SMOKE_FIXTURE)
);

function NotFoundPage() {
  const { t } = useLocalization();
  return (
    <AppFrame>
      <ErrorState title={t("notFoundTitle")} body={t("notFoundBody")} />
    </AppFrame>
  );
}

export function StudentRoutes({ services }: { services: StudentUiServices }) {
  return (
    <div data-portability-output={portabilityOutput}>
      <Routes>
        <Route path="/" element={<PublicLanding />} />
        <Route path="/login" element={<LoginPage services={services} />} />
        <Route path="/expo" element={<ExpoLanding />} />
        <Route
          path="/app"
          element={(
            <AuthBoundary services={services}>
              {(auth) => <SessionEntryPage services={services} auth={auth} />}
            </AuthBoundary>
          )}
        />
        <Route
          path="/sessions/:sessionId"
          element={(
            <AuthBoundary services={services}>
              {(auth) => <SessionPage services={services} auth={auth} />}
            </AuthBoundary>
          )}
        />
        <Route path="/sessions" element={<Navigate to="/app" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </div>
  );
}

export function App({
  services = createUnconfiguredStudentUiServices(),
  initialEntries
}: {
  services?: StudentUiServices;
  initialEntries?: string[];
}) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
      mutations: { retry: false }
    }
  }));
  const content = (
    <QueryClientProvider client={queryClient}>
      <LocalizationProvider>
        <StudentRoutes services={services} />
      </LocalizationProvider>
    </QueryClientProvider>
  );
  return initialEntries === undefined
    ? <BrowserRouter>{content}</BrowserRouter>
    : <MemoryRouter initialEntries={initialEntries}>{content}</MemoryRouter>;
}
