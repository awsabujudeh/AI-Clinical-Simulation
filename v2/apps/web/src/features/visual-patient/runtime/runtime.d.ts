import type { VisualPatientPresentation, VisualExamRequest } from "@ai-clinical-simulation/contracts";
export type ExamRegion = "DEFAULT_COVERED" | "CHEST" | "ABDOMEN" | "LEFT_ARM" | "RIGHT_ARM" | "LOWER_LEGS";
export interface PatientRuntime {
  setPresentation(value: VisualPatientPresentation): void;
  setSpeaking(speaking: boolean): void;
  enterExam(): void;
  exitExam(): void;
  reveal(region: ExamRegion): boolean;
  tool(tool: VisualExamRequest["tool"]): boolean;
  focus(): void;
  dispose(): void;
  stats(): {
    ready: boolean; elapsed: number; positionMix: number; entryCount: number;
    modelUUID?: string; modelLoads: number; breathing: number;
    state: { mode: string; position: string; face: string; speaking: boolean; body: string };
    camera?: { insideRoom: boolean; insideObstacle: boolean; view: string; transitioning: boolean };
    exam?: { region: string; tool: string; requestCount: number; visibleGarments: string[] };
  };
}
export function createPatientRuntime(canvas: HTMLCanvasElement, view: HTMLElement, callbacks: {
  onReady(): void; onError(): void; onExamRequest(request: VisualExamRequest): void;
}): PatientRuntime;
