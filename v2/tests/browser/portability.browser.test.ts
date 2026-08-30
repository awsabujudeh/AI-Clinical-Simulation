import { expect, test } from "vitest";

import {
  PORTABILITY_SMOKE_FIXTURE,
  createPortabilitySmokeResult
} from "../../packages/portability-smoke/src/index.ts";

const expected =
  '{"label":"v2-workspace","count":3,"values":[2,4,6],"total":12}';

test("shared source produces the browser portability output", () => {
  const serialized = JSON.stringify(
    createPortabilitySmokeResult(PORTABILITY_SMOKE_FIXTURE)
  );

  console.info(`BROWSER_PORTABILITY_OUTPUT=${serialized}`);
  expect(serialized).toBe(expected);
});
