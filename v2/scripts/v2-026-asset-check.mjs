import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const manifest=JSON.parse(await readFile(new URL('../content/media/dana/manifest.json',import.meta.url),'utf8'));
const bytes=await readFile(new URL(`../apps/web/public${manifest.root}${manifest.file}`,import.meta.url));
assert.equal(createHash('sha256').update(bytes).digest('hex'),manifest.sha256);
assert.equal(bytes.readUInt32LE(0),0x46546c67);
const gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
for(const name of ['Dana_Mixamo_Rig','Dana_Ch22_Body','Dana_Ch22_Shirt','Dana_Clinical_Bra','Dana_BodyComplete_Exam','Dana mattress fitted sheet'])assert(gltf.nodes.some(n=>n.name===name),name);
assert(!gltf.nodes.some(n=>['Dana_Exam_Skin','Dana_Clinical_Exam_Top'].includes(n.name)),'rejected reconstruction is absent');
assert.equal(gltf.nodes.filter(n=>n.name==='Dana_Mixamo_Rig').length,1);
assert(gltf.nodes.some(n=>n.name==='Dana lower-body blanket'));
assert(!gltf.nodes.some(n=>/Blue blanket draped|White sheet waist turnback|Pillow compressed beneath/.test(n.name)));
const shirtNode=gltf.nodes.find(n=>n.name==='Dana_Ch22_Shirt'),topNode=gltf.nodes.find(n=>n.name==='Dana_Clinical_Bra');
assert.notEqual(shirtNode.mesh,topNode.mesh,'exam coverage must not be the full shirt');
const vertices=n=>gltf.meshes[n.mesh].primitives.reduce((sum,p)=>sum+gltf.accessors[p.attributes.POSITION].count,0);
assert(vertices(topNode)<vertices(shirtNode),'cropped examination coverage exposes upper chest');
const examNode=gltf.nodes.find(n=>n.name==='Dana_BodyComplete_Exam');
assert.equal(examNode.extras.clean_volume_not_shirt_derived,true);
assert.equal(examNode.extras.same_dana_identity,true);
assert.equal(examNode.extras.body_complete_version,16);
assert.equal(topNode.extras.breast_only_coverage,true);
assert.equal(topNode.extras.abdomen_visible,true);
assert.equal(examNode.skin,gltf.nodes.find(n=>n.name==='Dana_Ch22_Body').skin,'one shared Dana skeleton');
assert(gltf.meshes[examNode.mesh].extras.targetNames.includes('Blink_Left'));
for(const n of [examNode,shirtNode,topNode])assert(gltf.meshes[n.mesh].extras.targetNames.includes('Thoracic_Breath'),'shared bounded thoracic movement');
for(const p of gltf.meshes[topNode.mesh].primitives){
 const material=gltf.materials[p.material];
 assert.equal(material.alphaMode??'OPAQUE','OPAQUE','modest coverage cannot become transparent');
 assert.equal(material.pbrMetallicRoughness.baseColorFactor?.[3]??1,1);
}
for(const a of gltf.accessors)for(const value of [...(a.min??[]),...(a.max??[])])assert(Number.isFinite(value));
for(const mesh of gltf.meshes)for(const p of mesh.primitives)if(p.attributes.WEIGHTS_0!==undefined){
 const a=gltf.accessors[p.attributes.WEIGHTS_0],v=gltf.bufferViews[a.bufferView];assert.equal(a.componentType,5126);
 const start=20+bytes.readUInt32LE(12)+8+(v.byteOffset??0)+(a.byteOffset??0),stride=v.byteStride??16;
 for(let i=0;i<a.count;i++){
  const weights=Array.from({length:4},(_,j)=>bytes.readFloatLE(start+i*stride+j*4));
  assert(weights.every(w=>Number.isFinite(w)&&w>=0&&w<=1));
  assert(Math.abs(weights.reduce((s,w)=>s+w,0)-1)<.00001,'runtime weights normalized');
 }
}
assert(!gltf.nodes.some(n=>/Patient_AdultMale|STEMI.*Body/.test(n.name)));
assert.equal(gltf.animations.length,1);assert.equal(gltf.animations[0].name,'Animation');
assert(gltf.skins.length>0);assert(gltf.images.length>0);
const body=gltf.meshes[gltf.nodes.find(n=>n.name==='Dana_Ch22_Body').mesh];
assert(body,'Dana morph mesh');
for(const key of ['Blink_Left','Blink_Right','Mouth_Open','Anxious_Foundation_v01','Improved_Calm_v01','Lip_Swelling_Mild'])assert(body.extras.targetNames.includes(key),key);
assert(body.primitives.every(p=>p.targets.length===6));
const sharedBytes=await readFile(new URL('../apps/web/public/visual-patient/stemi/physical-exam-v02/visual_patient_stemi_physical_exam_runtime_v01.glb',import.meta.url));
const shared=JSON.parse(sharedBytes.subarray(20,20+sharedBytes.readUInt32LE(12)));
function imageHash(data,document,textureIndex){
 const image=document.images[document.textures[textureIndex].source],view=document.bufferViews[image.bufferView];
 const binStart=20+data.readUInt32LE(12)+8;
 return createHash('sha256').update(data.subarray(binStart+(view.byteOffset??0),binStart+(view.byteOffset??0)+view.byteLength)).digest('hex');
}
for(const [name,material] of [['Dana mattress fitted sheet','Cotton'],['Dana pillow','Cotton'],['Dana lower-body blanket','Blanket']]){
 const node=gltf.nodes.find(n=>n.name===name);assert(node.extras.material_source.includes(material));
 const m=gltf.materials[gltf.meshes[node.mesh].primitives[0].material];
 const original=shared.materials.find(m=>m.name===material);
 assert.deepEqual(m.pbrMetallicRoughness.baseColorFactor,original.pbrMetallicRoughness.baseColorFactor);
 assert.equal(m.pbrMetallicRoughness.roughnessFactor,original.pbrMetallicRoughness.roughnessFactor);
 assert.equal(m.normalTexture.texCoord??0,0,'valid shared linen UV channel');
 assert.equal(imageHash(bytes,gltf,m.normalTexture.index),imageHash(sharedBytes,shared,original.normalTexture.index),'identical shared normal texture');
 if(m.pbrMetallicRoughness.baseColorTexture)assert.equal(imageHash(bytes,gltf,m.pbrMetallicRoughness.baseColorTexture.index),imageHash(sharedBytes,shared,original.pbrMetallicRoughness.baseColorTexture.index),'identical shared linen texture');
}
const fallback=await readFile(new URL(`../apps/web/public${manifest.patient_fallback.path}`,import.meta.url));
assert.equal(createHash('sha256').update(fallback).digest('hex'),manifest.patient_fallback.sha256);
assert.equal(fallback.subarray(1,4).toString(),'PNG');
assert.equal(manifest.clinical_review,'PENDING_PHYSICIAN_REVIEW');
assert.equal(manifest.rights_status,'RIGHTS_REVIEW_REQUIRED');
console.log('PASS: pinned Dana GLB hash, meshes, skeleton, textures, base pose, male exclusion and truthful review status.');
