import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  BrowserRouter,
  MemoryRouter,
  Navigate,
  Route,
  Routes,
  useLocation
} from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { ThemeProvider } from "./app/theme";
import "./design-system.css";
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
import { FacultyPage } from "./features/faculty/FacultyPage";
import type { FacultyDemoService } from "./features/faculty/faculty-service";

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

function RoutePresentation() {
  const { pathname } = useLocation();
  const previous = useRef(pathname);
  useEffect(() => {
    if (previous.current === pathname) return;
    previous.current = pathname;
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    document.getElementById("main-content")?.focus({ preventScroll: true });
  }, [pathname]);
  return null;
}

export function StudentRoutes({ services, faculty }: { services: StudentUiServices; faculty?: FacultyDemoService }) {
  return (
    <div data-portability-output={portabilityOutput}>
      <RoutePresentation />
      <Routes>
        <Route path="/" element={<PublicLanding />} />
        <Route path="/login" element={<LoginPage services={services} />} />
        <Route path="/expo" element={<ExpoLanding facultyAvailable={faculty !== undefined} />} />
        <Route path="/faculty" element={<FacultyPage service={faculty} />} />
        <Route path="/faculty/new" element={<FacultyPage service={faculty} />} />
        <Route path="/faculty/cases/:caseId" element={<FacultyPage service={faculty} />} />
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
        <Route path="/sessions/:sessionId/debrief" element={<AuthBoundary services={services}>{auth=><SessionPage services={services} auth={auth} debrief/>}</AuthBoundary>}/>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </div>
  );
}

export function App({
  services = createUnconfiguredStudentUiServices(),
  initialEntries,
  faculty
}: {
  services?: StudentUiServices;
  initialEntries?: string[];
  faculty?: FacultyDemoService;
}) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
      mutations: { retry: false }
    }
  }));
  const content = (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider><LocalizationProvider>
        <StudentRoutes services={services} faculty={faculty} />
      </LocalizationProvider></ThemeProvider>
    </QueryClientProvider>
  );
  return initialEntries === undefined
    ? <BrowserRouter>{content}</BrowserRouter>
    : <MemoryRouter initialEntries={initialEntries}>{content}</MemoryRouter>;
}
