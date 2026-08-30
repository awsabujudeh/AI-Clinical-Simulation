import {
  PORTABILITY_SMOKE_FIXTURE,
  createPortabilitySmokeResult
} from "@ai-clinical-simulation/portability-smoke";

const portabilityOutput = JSON.stringify(
  createPortabilitySmokeResult(PORTABILITY_SMOKE_FIXTURE)
);

export function App() {
  return (
    <main data-portability-output={portabilityOutput}>
      <h1>AI Clinical Simulation Platform V2</h1>
      <p>Workspace Initialized</p>
    </main>
  );
}
