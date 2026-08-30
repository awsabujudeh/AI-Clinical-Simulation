import {
  PORTABILITY_SMOKE_FIXTURE,
  createPortabilitySmokeResult
} from "../../packages/portability-smoke/src/index.ts";
import {
  CONTRACT_PORTABILITY_EXPECTED,
  createContractPortabilitySnapshot
} from "../fixtures/contracts-fixture.ts";

const expected =
  '{"label":"v2-workspace","count":3,"values":[2,4,6],"total":12}';

Deno.test("shared source produces the Deno portability output", () => {
  const serialized = JSON.stringify(
    createPortabilitySmokeResult(PORTABILITY_SMOKE_FIXTURE)
  );

  console.info(`DENO_PORTABILITY_OUTPUT=${serialized}`);

  if (serialized !== expected) {
    throw new Error(`Unexpected portability output: ${serialized}`);
  }
});

Deno.test("shared contract source produces the Deno contract output", () => {
  const serialized = JSON.stringify(createContractPortabilitySnapshot());

  console.info(`DENO_CONTRACT_OUTPUT=${serialized}`);

  if (serialized !== CONTRACT_PORTABILITY_EXPECTED) {
    throw new Error(`Unexpected contract portability output: ${serialized}`);
  }
});
