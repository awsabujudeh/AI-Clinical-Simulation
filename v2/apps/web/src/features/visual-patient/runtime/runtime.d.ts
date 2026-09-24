import type { VisualPatientPresentation, VisualExamRequest } from "@ai-clinical-simulation/contracts";
export type ExamRegion = "DEFAULT_COVERED" | "CHEST" | "ABDOMEN" | "LEFT_ARM" | "RIGHT_ARM" | "LOWER_LEGS" | "FACE" | "NECK";
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
    equipment?: {bp_cuff:boolean;iv_access:boolean;iv_tubing:boolean};
    exam?: { region: string; tool: string; requestCount: number; visibleGarments: string[];
      scratch?: number; scratchContact?: number; scratchRegion?: string; articulation?: number; blink?: number; rash?: number; swelling?: number; face?: {anxious:number;calm:number} };
  };
}
export function createPatientRuntime(canvas: HTMLCanvasElement, view: HTMLElement, callbacks: {
  onReady(): void; onError(): void; onExamRequest(request: VisualExamRequest): void;
}, assetId?: VisualPatientPresentation["asset_id"]): PatientRuntime;
