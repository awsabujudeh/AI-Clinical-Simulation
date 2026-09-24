import {beforeAll,it,expect} from 'vitest';
// @ts-expect-error existing portable presentation adapter uses Three JS
import * as THREE from 'three';
// @ts-expect-error existing portable loader
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
// @ts-expect-error asset-specific presentation adapter
import {DanaRig} from '../../../apps/web/src/features/visual-patient/runtime/dana-rig.js';
let rig:any;
beforeAll(async()=>{
 const loader=new GLTFLoader();
 // Geometry/rig tests require no image decoder, provider or network service.
 loader.register(()=>({name:'LOCAL_TEST_TEXTURE',loadTexture:()=>Promise.resolve(new THREE.Texture())}));
 const bytes=await (await fetch(new URL('../../../apps/web/public/visual-patient/dana/review-v01/dana-review.glb',import.meta.url))).arrayBuffer();
 const asset=await loader.parseAsync(bytes,'');
 rig=new DanaRig({asset,camera:new THREE.PerspectiveCamera(),orbit:{target:new THREE.Vector3(),update(){},addEventListener(){}},canvas:{addEventListener(){}},state:{mode:'conversation',body:'itch_body',hand:true,face:'anxious',living:true,breathing:true,blink:true},onRequest(){}});
});
it('upper-arm material boundaries share continuous exported normals, not detached pieces',()=>{
 const seen=new Map<string,any>();let matches=0;
 rig.examSkin.traverse((m:any)=>{if(!m.isMesh)return;const p=m.geometry.attributes.position,n=m.geometry.attributes.normal;
  for(let i=0;i<p.count;i++)if(Math.abs(p.getX(i))>.24&&Math.abs(p.getX(i))<.37){
   const key=[p.getX(i),p.getY(i),p.getZ(i)].map(x=>x.toFixed(5)).join(',');
   const v=new THREE.Vector3().fromBufferAttribute(n,i),previous=seen.get(key);
   if(previous&&previous.mesh!==m.name){expect(previous.v.angleTo(v)).toBeLessThan(.0001);matches++;}
   else seen.set(key,{mesh:m.name,v});
  }
 });expect(matches).toBeGreaterThan(30);
 rig.examSkin.traverse((m:any)=>{if(!m.isMesh||m.material.name!=='Ch22_body')return;
  const p=m.geometry.attributes.position,mask=m.geometry.attributes.danaSeamMask;
 for(let i=0;i<p.count;i++)if(Math.abs(p.getX(i))>.32&&Math.abs(p.getX(i))<.34)expect(mask.getX(i)).toBe(1);
 });
});
it('rubbing uses relaxed finger flexion and pads near the opposite forearm',()=>{
 rig.pose(0,0);const rest=rig.bones.LeftHandMiddle2.quaternion.clone();
 rig.pose(4.3,0);expect(rig.scratch).toBeCloseTo(1);
 expect(rest.angleTo(rig.bones.LeftHandMiddle2.quaternion)).toBeGreaterThanOrEqual(.15);
 expect(rest.angleTo(rig.bones.LeftHandMiddle2.quaternion)).toBeLessThanOrEqual(.46);
 const line=new THREE.Line3(rig.point('RightForeArm'),rig.point('RightHand'));
 const pad=rig.point('LeftHandMiddle3');const surfaceAxis=line.closestPointToPoint(pad,true,new THREE.Vector3());
 expect(pad.distanceTo(surfaceAxis)).toBeGreaterThan(.018);
 expect(pad.distanceTo(surfaceAxis)).toBeLessThan(.065);
 const reach=rig.point('LeftHand').sub(rig.point('LeftForeArm')).normalize();
 const forward=new THREE.Vector3(0,1,0).applyQuaternion(rig.bones.LeftHand.getWorldQuaternion(new THREE.Quaternion()));
 expect(reach.angleTo(forward)).toBeLessThanOrEqual(.651);
});
it('collar blending preserves the navel crease tone instead of flattening the abdomen',()=>{
 let navel=0;
 rig.examSkin.traverse((m:any)=>{if(!m.isMesh||m.material.name!=='Dana_Exam_Skin_Matched')return;
  const p=m.geometry.attributes.position,mask=m.geometry.attributes.danaSeamMask,color=m.geometry.attributes.color;
  expect(color).toBeDefined();
  for(let i=0;i<p.count;i++){
   const y=.92-p.getZ(i);
   if(y>1.13&&y<1.18&&Math.abs(p.getX(i))<.02){
    expect(mask.getX(i)).toBe(0);
    if(color.getX(i)<.57*.90)navel++;
   }
  }
 });expect(navel).toBeGreaterThan(0);
});
it('contact returns to the same relaxed finger pose without accumulating rotation',()=>{
 rig.pose(0,0);const rest=rig.bones.LeftHandMiddle2.quaternion.clone();
 rig.pose(4.3,0);rig.pose(9,0);expect(rig.scratch).toBe(0);
 expect(rig.bones.LeftHandMiddle2.quaternion.toArray()).toEqual(rest.toArray());
 const returned=rig.bones.LeftHand.quaternion.clone();rig.pose(9,0);
 expect(rig.bones.LeftHand.quaternion.toArray()).toEqual(returned.toArray());
});
it('exam disables contact while Cover/Reset and immutable clinical input remain intact',()=>{
 const original=JSON.stringify(rig.state);rig.pose(4.3,0);expect(JSON.stringify(rig.state)).toBe(original);
 rig.state.mode='physical_exam';rig.pose(4.3,1);expect(rig.scratch).toBe(0);
 rig.region='CHEST';rig.cover();expect(rig.bodyMesh.visible).toBe(false);expect(rig.examSkin.visible).toBe(true);
 rig.region='DEFAULT_COVERED';rig.cover();expect(rig.shirt.visible).toBe(true);expect(rig.examSkin.visible).toBe(false);
 rig.state.mode='conversation';
});
it('neck scratch is reachable, bounded, and returns without accumulated finger motion',()=>{
 rig.pose(17.2,0);expect(rig.scratchRegion).toBe('NECK');expect(rig.scratch).toBeCloseTo(1);
 expect(rig.point('LeftHandMiddle3').distanceTo(rig.point('Neck'))).toBeLessThan(.14);
 // The rejected elevated-elbow path met the coarse distance bound while
 // hiding the hand under the collar. Require actual anterior neck clearance.
 expect(rig.point('LeftHandMiddle3').y-rig.point('Neck').y).toBeGreaterThan(.04);
 expect(rig.point('LeftForeArm').y).toBeLessThan(rig.point('LeftHand').y);
 expect(rig.point('LeftForeArm').x).toBeGreaterThan(.30);
 expect(rig.point('LeftHand').y-rig.point('Neck').y).toBeGreaterThan(.075);
 for(const b of Object.values(rig.bones) as any[])expect(b.quaternion.toArray().every(Number.isFinite)).toBe(true);
 rig.pose(22,0);expect(rig.scratchRegion).toBe('REST');
});
it('swelling has no inherited anxiety/eye deformation and composes safely with mouth movement',()=>{
 const mesh=rig.bodyMesh,index=mesh.morphTargetDictionary.Lip_Swelling_Mild;
 const delta=mesh.geometry.morphAttributes.position[index],position=mesh.geometry.attributes.position;
 let changed=0;
 for(let i=0;i<delta.count;i++){
  const length=new THREE.Vector3().fromBufferAttribute(delta,i).length();
  if(length>1e-7){
   changed++;const height=.92-position.getZ(i);
   expect(height).toBeGreaterThan(1.537);expect(height).toBeLessThan(1.581);
   expect(Math.abs(position.getX(i))).toBeLessThan(.032);expect(length).toBeLessThan(.004);
  }
 }
 expect(changed).toBeGreaterThan(0);
 rig.state.speaking=true;rig.pose(2.975,0);
 expect(mesh.morphTargetInfluences[index]).toBe(1);
 expect(mesh.morphTargetInfluences[mesh.morphTargetDictionary.Mouth_Open]).toBeGreaterThan(0);
 rig.state.speaking=false;
});
it('neck pronation is shared by the forearm, not a twisted wrist, and leaves forearm rubbing alone',()=>{
 rig.state.mode='conversation';rig.state.body='itch_body';rig.pose(4.3,0);
 expect(rig.neckForearmRoll).toBe(0);
 rig.pose(17.2,0);expect(Math.abs(rig.neckForearmRoll)).toBeGreaterThan(.1);
 const reach=rig.point('LeftHand').sub(rig.point('LeftForeArm')).normalize();
 const normals=['LeftForeArm','LeftHand'].map(n=>{
  const z=new THREE.Vector3(0,0,1).applyQuaternion(rig.bones[n].getWorldQuaternion(new THREE.Quaternion()));
  return z.addScaledVector(reach,-z.dot(reach)).normalize();
 });
 expect(normals[0].angleTo(normals[1])).toBeLessThan(.6);
 rig.pose(22,0);expect(rig.neckForearmRoll).toBe(0);
});
it('thoracic morph expands skin and both clothing layers together without moving the face or bed',()=>{
 expect(rig.thoracicMeshes.length).toBeGreaterThanOrEqual(3);
 rig.state.body='itch_body';rig.state.breathing=true;rig.pose(30/56,0);
 for(const mesh of rig.thoracicMeshes){
  const i=mesh.morphTargetDictionary.Thoracic_Breath;
  expect(mesh.morphTargetInfluences[i]).toBeCloseTo(1);
  const p=mesh.geometry.attributes.position,d=mesh.geometry.morphAttributes.position[i];let peak=0;
  for(let v=0;v<d.count;v++){
   const length=new THREE.Vector3().fromBufferAttribute(d,v).length();peak=Math.max(peak,length);
   const height=.92-p.getZ(v);
   if(height>1.44||height<1.14||Math.abs(p.getX(v))>.17)expect(length).toBeLessThan(.000001);
  }
  // A multi-material original-skin primitive may contain no chest vertices.
  expect(peak).toBeLessThan(.0094);
 }
 rig.state.body='calm_body';rig.pose(.75,0);
 for(const mesh of rig.thoracicMeshes)expect(mesh.morphTargetInfluences[mesh.morphTargetDictionary.Thoracic_Breath]).toBeCloseTo(.38);
 rig.state.breathing=false;rig.pose(.75,0);expect(rig.thoracic).toBe(0);
 rig.state.body='itch_body';rig.state.breathing=true;
});
it('neck elbow hinge follows the bend plane without losing the accepted hand target',()=>{
 rig.state.mode='conversation';rig.pose(17.2,0);
 const upper=rig.point('LeftForeArm').sub(rig.point('LeftArm')).normalize();
 const lower=rig.point('LeftHand').sub(rig.point('LeftForeArm')).normalize();
 const hinge=new THREE.Vector3().crossVectors(upper,lower).normalize();
 const actual=new THREE.Vector3(1,0,0).applyQuaternion(rig.bones.LeftArm.getWorldQuaternion(new THREE.Quaternion()));
 expect(hinge.dot(actual)).toBeGreaterThan(.995);
 expect(rig.point('LeftHand').distanceTo(new THREE.Vector3(.141004,1.151745,-.469928))).toBeLessThan(.00001);
 rig.pose(4.3,0);const accepted=rig.bones.LeftArm.quaternion.clone();
 rig.alignNeckForearmRoll(0);expect(rig.bones.LeftArm.quaternion.toArray()).toEqual(accepted.toArray());
 rig.pose(22,0);const rest=rig.bones.LeftArm.quaternion.clone();rig.pose(17.2,0);rig.pose(22,0);
 expect(rig.bones.LeftArm.quaternion.toArray()).toEqual(rest.toArray());
});
it('treated calm has a bounded upward mouth-corner cue and still composes with speech/blink',()=>{
 const m=rig.bodyMesh,p=m.geometry.attributes.position;
 const delta=m.geometry.morphAttributes.position[m.morphTargetDictionary.Improved_Calm_v01];let corners=0;
 for(let i=0;i<p.count;i++){
  const height=.92-p.getZ(i),x=Math.abs(p.getX(i));
  if(height>1.555&&height<1.563&&x>.016&&x<.025&&-delta.getZ(i)>.002)corners++;
  expect(new THREE.Vector3().fromBufferAttribute(delta,i).length()).toBeLessThan(.006);
 }
 expect(corners).toBeGreaterThan(2);
 rig.state.face='relieved';rig.state.body='calm_body';rig.state.speaking=true;
 for(let t=0;t<4;t+=.1)rig.pose(t,0);
 rig.pose(2.975,0);expect(rig.faceMix.calm).toBeGreaterThan(.99);
 expect(m.morphTargetInfluences[m.morphTargetDictionary.Blink_Left]).toBeCloseTo(1);
 expect(m.morphTargetInfluences[m.morphTargetDictionary.Mouth_Open]).toBeGreaterThan(.1);
 rig.state.face='anxious';rig.state.body='itch_body';rig.state.speaking=false;
});
