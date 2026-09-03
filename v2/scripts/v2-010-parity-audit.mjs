import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "../..");
const inventoryPath = resolve(
  repositoryRoot,
  "planning_input/v2-008/STEMI_V1_STRUCTURED_INVENTORY.md"
);
const matrixPath = resolve(
  repositoryRoot,
  "planning_input/v2-010/STEMI_V1_V2_FUNCTIONAL_PARITY_MATRIX.md"
);

const inventory = readFileSync(inventoryPath, "utf8");
const matrix = readFileSync(matrixPath, "utf8");

const inventoryIds = [...inventory.matchAll(/^\| ([A-Z]+-\d{3}) \|/gm)].map(
  (match) => match[1]
);
const expectedCounts = new Map([
  ["PRESERVED", 47],
  ["INTENTIONALLY_REPLACED", 65],
  ["INTENTIONALLY_REMOVED", 134],
  ["SUPERSEDED_BY_V2", 85],
  ["PARITY_READY_DELIVERY_PENDING", 15],
  ["FUNCTIONAL_GAP", 0]
]);

function fail(message) {
  throw new Error(`V2-010 parity accounting failed: ${message}`);
}

if (inventoryIds.length !== 346 || new Set(inventoryIds).size !== 346) {
  fail(`source inventory must contain 346 unique IDs; found ${inventoryIds.length} rows and ${new Set(inventoryIds).size} unique IDs`);
}

const ledger = new Map();
for (const match of matrix.matchAll(
  /^(PRESERVED|INTENTIONALLY_REPLACED|INTENTIONALLY_REMOVED|SUPERSEDED_BY_V2|PARITY_READY_DELIVERY_PENDING|FUNCTIONAL_GAP)\|(.*)$/gm
)) {
  const classification = match[1];
  const ids = match[2].trim() === "" ? [] : match[2].trim().split(/\s+/);
  if (ledger.has(classification)) fail(`duplicate ledger row for ${classification}`);
  ledger.set(classification, ids);
}

for (const [classification, expectedCount] of expectedCounts) {
  const ids = ledger.get(classification);
  if (ids === undefined) fail(`missing ledger row for ${classification}`);
  if (ids.length !== expectedCount) {
    fail(`${classification} expected ${expectedCount} IDs but found ${ids.length}`);
  }
}

const classifiedIds = [...ledger.values()].flat();
const classifiedSet = new Set(classifiedIds);
if (classifiedIds.length !== 346 || classifiedSet.size !== 346) {
  fail(`ledger must contain 346 unique dispositions; found ${classifiedIds.length} entries and ${classifiedSet.size} unique IDs`);
}

const inventorySet = new Set(inventoryIds);
const missing = inventoryIds.filter((id) => !classifiedSet.has(id));
const unknown = classifiedIds.filter((id) => !inventorySet.has(id));
if (missing.length > 0) fail(`unclassified inventory IDs: ${missing.join(", ")}`);
if (unknown.length > 0) fail(`ledger contains unknown IDs: ${unknown.join(", ")}`);

console.log("V2-010 parity accounting: PASS");
console.log("Inventory dispositions: 346/346");
for (const [classification] of expectedCounts) {
  console.log(`${classification}: ${ledger.get(classification).length}`);
}
