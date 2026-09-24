import { readFile, realpath } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve, sep } from 'node:path';
import stemi from '../content/media/stemi/manifest.json' with { type: 'json' };
import dana from '../content/media/dana/manifest.json' with { type: 'json' };
import { visualReadiness } from '../runtime/preflight-model.ts';

const publicRoot = fileURLToPath(new URL('../apps/web/public/', import.meta.url));
export async function readPublicAsset(path) {
  if (!/^\/(?:visual-patient|media)\/[A-Za-z0-9/_.-]+$/.test(path) || path.includes('..')) throw Error('ASSET_PATH_INVALID');
  const target = await realpath(resolve(publicRoot, `.${path}`));
  if (!target.startsWith((await realpath(publicRoot)) + sep)) throw Error('ASSET_PATH_INVALID');
  return readFile(target);
}
export function parseGlb(bytes) {
  if (bytes.length < 20 || bytes.readUInt32LE(0) !== 0x46546c67 || bytes.readUInt32LE(4) !== 2
    || bytes.readUInt32LE(8) !== bytes.length || bytes.readUInt32LE(16) !== 0x4e4f534a) throw Error('GLB_INVALID');
  const data = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString('utf8'));
  // Packaged clinical visuals must not quietly resolve external resources.
  if ([...(data.buffers ?? []), ...(data.images ?? [])].some(r => r.uri && !r.uri.startsWith('data:'))) throw Error('EXTERNAL_ASSET_REFERENCE');
  return data;
}
export async function inspectAssets(read = readPublicAsset) {
  const rows = [], scenes = [];
  const pinned = async (path, hash) => {
    const bytes = await read(path);
    if (createHash('sha256').update(bytes).digest('hex') !== hash) throw Error('ASSET_HASH_MISMATCH');
    return bytes;
  };
  for (const name of ['stemi', 'dana']) {
    let primary = false, fallback = false, diagnostic = 'VISUAL_ASSET_MISSING';
    try {
      let gltf;
      if (name === 'stemi') {
        const [glb, config] = await Promise.all(stemi.runtime_package.files.map(f => pinned(f.path, f.sha256)));
        gltf = parseGlb(glb); const manifest = JSON.parse(config);
        const clips = new Set(gltf.animations.map(a => a.name));
        const morphs = new Set(gltf.meshes.flatMap(m => m.extras?.targetNames ?? []));
        if (![...Object.values(manifest.positions), ...Object.values(manifest.animations)].every(n => clips.has(n))
          || !Object.values(manifest.facial_states).every(n => morphs.has(n)) || !manifest.physical_exam) throw Error('VISUAL_CONTRACT_INVALID');
      } else {
        gltf = parseGlb(await pinned(dana.root + dana.file, dana.sha256));
        const nodes = gltf.nodes.map(n => n.name), shapes = new Set(gltf.meshes.flatMap(m => m.extras?.targetNames ?? []));
        if (nodes.filter(n => n === 'Dana_Mixamo_Rig').length !== 1
          || !['Dana_BodyComplete_Exam', 'Dana_Clinical_Bra', 'Dana_Ch22_Shirt'].every(n => nodes.includes(n))
          || !['Blink_Left', 'Blink_Right', 'Mouth_Open', 'Thoracic_Breath', 'Anxious_Foundation_v01', 'Improved_Calm_v01'].every(n => shapes.has(n))
          || nodes.includes('Patient_AdultMale_Body')) throw Error('VISUAL_CONTRACT_INVALID');
        const bra = gltf.nodes.find(n => n.name === 'Dana_Clinical_Bra');
        if (!gltf.meshes[bra.mesh].primitives.every(p => (gltf.materials[p.material].alphaMode ?? 'OPAQUE') === 'OPAQUE')) throw Error('EXAM_COVERAGE_INVALID');
      }
      scenes.push(gltf); primary = true;
    } catch (error) { diagnostic = ['ASSET_HASH_MISMATCH', 'VISUAL_CONTRACT_INVALID', 'GLB_INVALID', 'EXAM_COVERAGE_INVALID', 'EXTERNAL_ASSET_REFERENCE'].includes(error.message) ? error.message : 'VISUAL_ASSET_MISSING'; }
    try {
      const fallbacks = name === 'stemi' ? stemi.patient_fallback.variants : [dana.patient_fallback];
      for (const f of fallbacks) { const b = await pinned(f.path, f.sha256); if (b.subarray(1, 4).toString() !== 'PNG') throw Error(); }
      fallback = true;
    } catch { /* missing fallback cannot be reported verified */ }
    rows.push({ id: `${name}_visual`, status: visualReadiness(primary, fallback),
      code: primary && fallback ? 'VISUAL_AND_FALLBACK_VERIFIED' : primary ? 'STATIC_FALLBACK_MISSING' : fallback ? diagnostic : 'PRIMARY_AND_FALLBACK_UNAVAILABLE',
      detail: `Primary 3D: ${primary ? 'hash/structure verified' : 'unavailable'}; static fallback: ${fallback ? 'hash verified' : 'unavailable'}. Local assets; no provider dependency. Static image is not a live examination.` });
  }
  const environment = scenes.length > 0 && scenes.every(g => ['Bed deck structural frame', 'Headwall utility fascia'].every(n => g.nodes.some(node => node.name === n))
    && [/pillow/i, /blanket/i].every(pattern => g.nodes.some(n => pattern.test(n.name))));
  let framework = false;
  try {
    const runtimeRoot = new URL('../apps/web/src/features/visual-patient/runtime/', import.meta.url);
    const markers = [['runtime.js', 'createPatientRuntime'], ['camera-navigation.js', 'ExaminationCameraNavigation'],
      ['exam.js', 'DEFAULT_COVERED'], ['equipment.js', 'PatientEquipment'], ['dana-rig.js', 'DanaRig']];
    framework = (await Promise.all(markers.map(async ([file, marker]) => (await readFile(new URL(file, runtimeRoot), 'utf8')).includes(marker)))).every(Boolean);
  } catch { /* safe local diagnostic */ }
  rows.push({ id: 'shared_ed', status: environment && framework && scenes.length === 2 ? 'READY' : 'DEGRADED',
    code: environment && framework ? 'SHARED_ED_CONTRACT_READY' : 'SHARED_ED_UNAVAILABLE',
    detail: 'Local room/bed/pillow/blanket and shared camera, equipment, exam Cover/Reset, patient adapters checked. Static fallback preserves simulation if 3D fails; no animation changes.' });
  try {
    for (const d of stemi.diagnostics.filter(d => d.packaged)) {
      await pinned(d.packaged.image_path, d.packaged.image_sha256);
      await pinned(d.packaged.report_path, d.packaged.report_sha256);
    }
    rows.push({ id: 'diagnostics', status: 'READY', code: 'LOCAL_DIAGNOSTIC_ASSETS_VERIFIED',
      detail: 'STEMI ECG/CXR image/report hashes verified locally. Right ECG/echo and Dana investigations retain authored text/media-pending fallback. Medical/rights approval is still pending.' });
  } catch { rows.push({ id: 'diagnostics', status: 'DEGRADED', code: 'DIAGNOSTIC_MEDIA_UNAVAILABLE', detail: 'A packaged image/report is missing or corrupt. Authored deterministic text remains; do not present the failed image as verified.' }); }
  return rows;
}

export async function inspectCache() {
  try {
    const dist = new URL('../apps/web/dist/', import.meta.url);
    const [html, sw] = await Promise.all(['index.html', 'sw.js'].map(p => readFile(new URL(p, dist), 'utf8')));
    if (!html.includes('manifest.webmanifest') || !sw.includes('index.html')) throw Error();
    return { id: 'cache', status: 'DEGRADED', code: 'LOCAL_SERVER_REQUIRED_OFFLINE_NOT_CERTIFIED',
      detail: 'Built PWA shell exists; shell/static images have precache support. Review hosts do not use a service worker. GLBs and authoritative Sessions are not an offline execution bundle; no device warm-up receipt exists. Keep localhost running. Full network-disconnected simulation is NOT certified.' };
  } catch { return { id: 'cache', status: 'DEGRADED', code: 'BUILD_CACHE_UNVERIFIED', detail: 'No valid built PWA shell found. Run npm run build. Local review remains server-dependent; no offline-ready claim or browser cache receipt.' }; }
}
