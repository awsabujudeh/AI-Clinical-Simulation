// Explicit operator launcher only. Not imported by the production Student entry.
import { createRoot } from "react-dom/client";
import { PreflightPage } from "../apps/web/src/features/operator/PreflightPage.tsx";
createRoot(document.getElementById("root")!).render(<PreflightPage />);
