import { TutorDebriefSchema } from "@ai-clinical-simulation/contracts";
import type { StudentTutorService } from "../../app/types";

/** Uses the same authenticated transport as the student application. */
export function createStudentTutorService(post: (path: string, body: unknown) => Promise<unknown>): StudentTutorService {
  return { async generate(sessionId, locale) {
    try {
      const response = await post(`/v1/sessions/${encodeURIComponent(sessionId)}/debriefs`, { locale });
      const data = response && typeof response === "object" && "data" in response ? response.data : undefined;
      const parsed = TutorDebriefSchema.safeParse(data);
      if (parsed.success && parsed.data.packet.assessment.session_id === sessionId && String(parsed.data.packet.locale) === String(locale))
        return { kind: "AVAILABLE", debrief: parsed.data };
    } catch { /* existing score UI remains independent */ }
    return { kind: "UNAVAILABLE" };
  } };
}
