import { createRoot } from "react-dom/client";
import { App } from "../../../apps/web/src/App.tsx";
import { createFacultyDemoService } from "../../../apps/web/src/features/faculty/faculty-service.ts";
import "../../../apps/web/src/styles.css";
createRoot(document.getElementById("root")!).render(<App faculty={createFacultyDemoService()} />);
