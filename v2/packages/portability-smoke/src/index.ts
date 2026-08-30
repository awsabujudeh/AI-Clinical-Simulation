export interface PortabilitySmokeInput {
  readonly label: string;
  readonly values: readonly number[];
}

export interface PortabilitySmokeResult {
  readonly label: string;
  readonly count: number;
  readonly values: number[];
  readonly total: number;
}

export const PORTABILITY_SMOKE_FIXTURE: PortabilitySmokeInput = {
  label: "v2-workspace",
  values: [2, 4, 6]
};

export function createPortabilitySmokeResult(
  input: PortabilitySmokeInput
): PortabilitySmokeResult {
  return {
    label: input.label,
    count: input.values.length,
    values: [...input.values],
    total: input.values.reduce((sum, value) => sum + value, 0)
  };
}
