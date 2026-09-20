import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {LivingBehavior} from './living.js';
import {PhysicalExamController} from './exam.js';
import {ExaminationCameraNavigation} from './camera-navigation.js';
/** Port of approved Physical Exam V02. Animation math remains presentation-only. */
export function createPatientRuntime(canvas, view, callbacks) {
let disposed=false, frame=0, loadPromise; const abort=new AbortController();
const ui=()=>{};
const scene=new THREE.Scene();scene.background=new THREE.Color('#bdc9c8');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance',preserveDrawingBuffer:true});
renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.AgXToneMapping;renderer.toneMappingExposure=1.05;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const camera=new THREE.PerspectiveCamera(40,1,.01,100),orbit=new OrbitControls(camera,canvas);orbit.enableDamping=true;orbit.minDistance=.1;orbit.maxDistance=7;
const env=new RoomEnvironment(),pmrem=new THREE.PMREMGenerator(renderer),environment=pmrem.fromScene(env,.04);scene.environment=environment.texture;scene.environmentIntensity=.3;env.dispose();pmrem.dispose();
scene.add(new THREE.HemisphereLight(0xf4f7ff,0xa3abb0,.45));
const key=new THREE.DirectionalLight(0xfff9f3,2.3);key.position.set(-2.3,4.8,.4);key.target.position.set(0,.7,0);key.castShadow=true;key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-2.6,right:2.6,top:2.8,bottom:-2.8,near:.1,far:12});key.shadow.normalBias=.0015;key.shadow.bias=-.00015;scene.add(key,key.target);
const fill=new THREE.DirectionalLight(0xe4eeff,.8);fill.position.set(1.5,2.8,-.5);scene.add(fill);
const state={mode:'conversation',position:'semi_fowler',face:'pain',body:'pain_body',breathing:true,speaking:false,blink:true,hand:true};
let manifest,asset,clips={},nodes={},morphMeshes=[],elapsed=0,ready=false,last=performance.now(),loadMs=0;
let living,exam,navigation;
let positionFrom=0,positionTo=0,positionStarted=-10,contactStarted=0,contactActive=true,entryCount=1;
const smooth=x=>{x=THREE.MathUtils.clamp(x,0,1);return x*x*x*(10+x*(-15+6*x));};
function positionMix(t=elapsed){return THREE.MathUtils.lerp(positionFrom,positionTo,smooth((t-positionStarted)/2.5));}
function setPosition(p){const target=p==='supine'?1:0;if(target!==positionTo){positionFrom=positionMix();positionTo=target;positionStarted=elapsed;}state.position=p;ui();}
function syncContact(){const wanted=state.hand&&state.body==='pain_body';if(wanted&&!contactActive){contactStarted=elapsed;entryCount++;}contactActive=wanted;}
function setSpeaking(v){const old={...state};state.speaking=v;living?.stateChanged(old);ui();}
const q=new THREE.Quaternion(),painUniform={value:1},positionV=new THREE.Vector3(),directionV=new THREE.Vector3();
function resize(){renderer.setSize(view.clientWidth,view.clientHeight,false);camera.aspect=view.clientWidth/view.clientHeight;camera.updateProjectionMatrix();}
const observer=new ResizeObserver(resize);observer.observe(view);
function applyView(name='Camera_Student_Primary'){navigation?.go(name,!ready);}
function setPresentation(p){
 const old={...state}; if(state.mode==='conversation')setPosition(p.position);else if(exam)exam.previousPosition=p.position;
 for(const k of ['face','body','breathing','blink','hand'])state[k]=p[k];
 syncContact(); if(living)living.enabled=p.living; living?.stateChanged(old);
}
function morph(name,value,mesh=null){for(const m of mesh?[mesh]:morphMeshes){const i=m.morphTargetDictionary[name];if(i!==undefined)m.morphTargetInfluences[i]=value;}}
function applyClip(name,t,mode,loop=true){const clip=clips[name];if(!clip)return;const time=loop&&clip.duration>0?t%clip.duration:THREE.MathUtils.clamp(t,0,clip.duration);
 for(const tr of clip.tracks){const v=tr.interpolant.evaluate(time),o=tr.node;
  if(tr.path==='rotation'){q.fromArray(v);if(mode==='delta'||(mode==='mixed'))o.quaternion.multiply(q).normalize();else o.quaternion.copy(q);}
  else if(tr.path==='translation')o.position.fromArray(v);
  else if(tr.path==='scale')o.scale.fromArray(v);
  else if(tr.path==='weights'){for(const m of tr.meshes){if(mode==='base')m.morphTargetInfluences.splice(0,v.length,...v);else for(const i of tr.mask)m.morphTargetInfluences[i]=v[i];}}
 }
}
function applyPosition(w){
 applyClip(manifest.positions.semi_fowler,0,'base');
 if(!w)return;
 for(const tr of clips[manifest.positions.supine].tracks){const v=tr.interpolant.evaluate(0),o=tr.node;
  if(tr.path==='rotation')o.quaternion.slerp(q.fromArray(v),w);
  else if(tr.path==='translation')o.position.lerp(new THREE.Vector3().fromArray(v),w);
  else if(tr.path==='scale')o.scale.lerp(new THREE.Vector3().fromArray(v),w);
  else if(tr.path==='weights')for(const m of tr.meshes)for(let i=0;i<v.length;i++)m.morphTargetInfluences[i]=THREE.MathUtils.lerp(m.morphTargetInfluences[i],v[i],w);
 }
}
function applyContact(w,t){
 if(t>=manifest.contact.entry_seconds){applyClip(manifest.contact.position_transport,w,'replace',false);return;}
 applyClip(manifest.contact.entry,t,'replace',false);
 if(w)for(const tr of clips[manifest.contact.entry_supine].tracks)tr.node.quaternion.slerp(q.fromArray(tr.interpolant.evaluate(Math.max(0,t))),w);
}
function pose(t){
 for(const m of morphMeshes)m.morphTargetInfluences.fill(0);
 const w=positionMix(t),contactTime=Math.max(0,t-contactStarted);
 applyPosition(w);
 if(state.body!=='none')applyClip(manifest.animations[state.body],state.body==='pain_body'?Math.max(0,contactTime-manifest.contact.entry_seconds):t,'delta');
 if(state.speaking)applyClip(manifest.animations.speaking,t,'mixed');
 else if(state.blink)applyClip(manifest.animations.gaze,t,'delta');
 if(state.hand&&state.body==='pain_body')applyContact(w,contactTime);
 if(state.breathing)applyClip(manifest.animations.breathing,t,'channels');
 if(state.blink)applyClip(manifest.animations.blink,t,'channels');
 if(state.face!=='neutral')morph(manifest.facial_states[state.face],1);
 const body=morphMeshes.find(m=>m.morphTargetDictionary.Clinical_Pain_Strong_v01!==undefined&&m.morphTargetDictionary.Speaking_Round!==undefined);
 const value=n=>body?.morphTargetInfluences[body.morphTargetDictionary[n]]||0;
 // Portable equivalents of the master's expression/blink and accessory drivers.
 for(const [face,stem] of [['pain','Clinical_Pain_LidCompression'],['anxious','Clinical_Anxious_AlertLid'],['relieved','Clinical_Relieved_CalmLid']])for(const side of ['Left','Right'])morph(`${stem}_${side}`,state.face===face?1-value(`Blink_${side}`):0);
 morph('Speaking_ArticulationRound_v01',value('Speaking_Round'));morph('Speaking_ArticulationSpread_v01',value('Speaking_Spread'));
 for(const name of ['Jaw_Open','Mouth_Open','Lip_Compress','Blink_Left','Blink_Right'])morph(name,value(name));
 painUniform.value=state.face==='pain'?1:0;living?.apply(t,w);scene.updateMatrixWorld(true);exam?.apply(t);
}
function installCreases(mesh){
 const attr=mesh.geometry.getAttribute('_clinicalpain_restposition');if(!attr)return;
 const mat=mesh.material;mat.onBeforeCompile=shader=>{
  shader.uniforms.clinicalPain=painUniform;
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute vec3 _clinicalpain_restposition; varying vec3 vClinicalBind;').replace('#include <begin_vertex>','#include <begin_vertex>\nvClinicalBind=_clinicalpain_restposition;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
uniform float clinicalPain; varying vec3 vClinicalBind;
float cg(float x,float c,float w){float a=(x-c)/w;return exp(-a*a);}
float ch(vec3 p){float x=abs(p.x),z=p.z;float g=cg(x,.0058+.12*(z-1.698),.0014)*cg(z,1.695,.008);float b=cg(x,0.,.014)*cg(z,1.688,.0012);float n=cg(x,.0175+.36*(1.636-z),.0013)*cg(z,1.621,.016);return (-g-.22*b-.48*n)*cg(p.y,-.151,.028);}
vec3 clinicalNormal(vec3 p,vec3 n,float h){vec3 sx=dFdx(p),sy=dFdy(p);vec3 r1=cross(sy,n),r2=cross(n,sx);float d=dot(sx,r1);vec3 g=sign(d)*(dFdx(h)*r1+dFdy(h)*r2);return normalize(abs(d)*n-g);}
`).replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>\nnormal=clinicalNormal(-vViewPosition,normal,ch(vClinicalBind)*.00055*.55*clinicalPain);');
 };mat.customProgramCacheKey=()=> 'approved-clinical-pain-creases-v01';
}
async function load(){const start=performance.now();const root='/visual-patient/stemi/physical-exam-v02/';
 const checked=async(name,hash)=>{
  const response=await fetch(root+name,{signal:abort.signal});if(!response.ok)throw Error('ASSET_UNAVAILABLE');
  const bytes=await response.arrayBuffer();
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
  if(digest!==hash)throw Error('ASSET_INTEGRITY');return bytes;
 };
 const [json,glb]=await Promise.all([
  checked('visual_patient_stemi_physical_exam_runtime_v01.json','5eab5851925ed57367d274e79ee818ce393460a5604671255fc751ca1cbb366c'),
  checked('visual_patient_stemi_physical_exam_runtime_v01.glb','00563647261c8da8dd030f366aec6bdfdd2550bf667159eab9cf7c922beed4a1')
 ]);
 if(disposed)return; manifest=JSON.parse(new TextDecoder().decode(json));
 asset=await new GLTFLoader().parseAsync(glb,root);scene.add(asset.scene);if(disposed)return;
 const doc=asset.parser.json;await Promise.all(doc.nodes.map(async(n,i)=>nodes[n.name]=await asset.parser.getDependency('node',i)));
 asset.scene.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;if(o.morphTargetInfluences)morphMeshes.push(o);if(o.geometry.getAttribute('_clinicalpain_restposition'))installCreases(o);}});
 for(const a of doc.animations){const meta=manifest.clips[a.name],tracks=[];for(const ch of a.channels){const sampler=a.samplers[ch.sampler];const [ti,va]=await Promise.all([asset.parser.getDependency('accessor',sampler.input),asset.parser.getDependency('accessor',sampler.output)]);const o=await asset.parser.getDependency('node',ch.target.node);const size=va.array.length/ti.array.length,path=ch.target.path;const interpolant=path==='rotation'?new THREE.QuaternionLinearInterpolant(ti.array,va.array,size):new THREE.LinearInterpolant(ti.array,va.array,size);const meshes=[];if(path==='weights')o.traverse(m=>{if(m.morphTargetInfluences)meshes.push(m);});const names=meta.weight_channels[doc.nodes[ch.target.node].name]||[];const mask=meshes.length?names.map(n=>meshes[0].morphTargetDictionary[n]).filter(i=>i!==undefined):[];tracks.push({node:o,path,interpolant,meshes,mask});}clips[a.name]={duration:meta.duration_seconds,tracks};}
 living=new LivingBehavior({manifest,clips,nodes,state,scene,applyClip,now:()=>elapsed});
 exam=new PhysicalExamController({manifest,nodes,state,scene,living,morph,canvas,camera,setPosition,positionMix,setCamera:applyView,onRequest:callbacks.onExamRequest,now:()=>elapsed});
 navigation=new ExaminationCameraNavigation({camera,orbit,nodes,exam,positionMix});
 pose(0);resize();applyView();await renderer.compileAsync(scene,camera);
 if(disposed)return;renderer.render(scene,camera);loadMs=performance.now()-start;ready=true;callbacks.onReady();
}
function stats(){return {ready,loadMs,elapsed,positionMix:positionMix(),entryCount,
 modelUUID:asset?.scene.uuid,modelLoads:asset?1:0,
 breathing:exam?.bodyMesh?.morphTargetInfluences[exam.bodyMesh.morphTargetDictionary.Breathing_ThoracicExpansion]??0,
 camera:navigation?.stats(),exam:exam?.stats(),state:{...state}};}
function animate(now){
 if(disposed)return;frame=requestAnimationFrame(animate);const dt=Math.min((now-last)/1000,.25);last=now;
 if(!ready)return;elapsed+=dt;pose(elapsed);navigation.update(now);renderer.render(scene,camera);
}
function release(){
 const materials=new Set(),geometries=new Set(),textures=new Set();
 scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[])materials.add(m);});
 for(const m of materials){for(const v of Object.values(m))if(v?.isTexture)textures.add(v);m.dispose();}
 for(const g of geometries)g.dispose();for(const t of textures){t.source?.data?.close?.();t.dispose();}
 environment.dispose();renderer.dispose();renderer.forceContextLoss();
}
const contextLost=e=>{e.preventDefault();if(!disposed){ready=false;callbacks.onError();}};
canvas.addEventListener('webglcontextlost',contextLost);
frame=requestAnimationFrame(animate);
loadPromise=load().catch(()=>{if(!disposed)callbacks.onError();});
return {
 setPresentation,setSpeaking,
 enterExam:()=>{if(ready)exam.enter();},exitExam:()=>{if(ready)exam.exit();},
 reveal:region=>ready&&exam.selectRegion(region),tool:tool=>ready&&exam.setTool(tool),
 focus:()=>applyView(state.mode==='physical_exam'?navigation.regionView(exam.region):'Camera_Student_Primary'),
 stats,
 dispose(){if(disposed)return;disposed=true;abort.abort();cancelAnimationFrame(frame);observer.disconnect();exam?.dispose();orbit.dispose();
canvas.removeEventListener('webglcontextlost',contextLost);void loadPromise.finally(release);}
};
}
