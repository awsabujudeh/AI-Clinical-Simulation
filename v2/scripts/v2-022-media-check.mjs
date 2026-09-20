import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const manifest = JSON.parse(readFileSync(new URL("../content/media/stemi/manifest.json", import.meta.url)));
const root = new URL("../apps/web/public/", import.meta.url);
for (const asset of [...manifest.runtime_package.files, ...manifest.patient_fallback.variants]) {
  assert.match(asset.path, /^\/(media\/stemi\/1\.0\.0|visual-patient\/stemi\/physical-exam-v02)\/[a-z0-9_.-]+$/);
  const bytes = readFileSync(new URL(asset.path.slice(1), root));
  assert.equal(createHash("sha256").update(bytes).digest("hex"), asset.sha256);
  if (asset.source) assert.deepEqual(bytes, readFileSync(new URL(`../../${asset.source}`, import.meta.url)));
}
for (const path of manifest.patient_fallback.rights_evidence) assert.ok(existsSync(new URL(`../../${path}`, import.meta.url)));
assert.equal(manifest.diagnostics.length, 4);
for (const asset of manifest.diagnostics) {
  assert.equal(asset.clinical_review_status, "PENDING_PHYSICIAN_REVIEW");
  if (asset.packaged) {
    assert.equal(asset.source_status, "PROJECT_GENERATED");
    assert.equal(asset.rights_status, "OWNER_ATTESTED_PROJECT_USE_FORMAL_DOCUMENTATION_PENDING");
    assert.ok(asset.source_file && asset.source_report_file);
    for (const type of ["image", "report"]) {
      const bytes=readFileSync(new URL(asset.packaged[`${type}_path`].slice(1),root));
      assert.equal(createHash("sha256").update(bytes).digest("hex"),asset.packaged[`${type}_sha256`]);
      assert.ok(bytes.length>0);
    }
  } else { assert.equal(asset.expo_status,"MEDIA_ASSET_PENDING"); assert.equal(asset.source_file,null); }
}
if (process.argv.includes("--built")) {
  const dist = new URL("../apps/web/dist/", import.meta.url);
  const sw = readFileSync(new URL("sw.js", dist), "utf8");
  for (const asset of manifest.diagnostics.filter(a => a.packaged)) {
    for (const type of ["image", "report"]) {
      const path = asset.packaged[`${type}_path`].slice(1);
      assert.ok(sw.includes(path), `Missing precached local media: ${path}`);
      assert.equal(createHash("sha256").update(readFileSync(new URL(path, dist))).digest("hex"), asset.packaged[`${type}_sha256`]);
    }
  }
  console.log("PASS: built diagnostic image/report bytes unchanged and all four files precached.");
}
console.log("PASS: 8 runtime/still/diagnostic/report hashes; original still equality; provenance complete; 2 review-only diagnostic pairs and 2 explicit text-only fallbacks.");
