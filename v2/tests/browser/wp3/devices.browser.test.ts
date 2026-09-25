import {it,expect} from 'vitest';
// @ts-expect-error existing presentation-only Three adapter
import * as THREE from 'three';
// @ts-expect-error shared JS presentation layer
import {PatientEquipment} from '../../../apps/web/src/features/visual-patient/runtime/equipment.js';
// @ts-expect-error shared JS presentation layer
import {ExamContact} from '../../../apps/web/src/features/visual-patient/runtime/exam-contact.js';
import {wp1Fixture} from '../../fixtures/wp1.ts';
it('pulse-ox clip follows distal finger, disappears without a valid anchor and never changes input',()=>{
 const scene=new THREE.Scene(),asset={scene:new THREE.Group()},a={shoulder:new THREE.Vector3(.2,1,0),elbow:new THREE.Vector3(.2,1,.2),wrist:new THREE.Vector3(.2,1,.4),fingerBase:new THREE.Vector3(.2,1,.45),finger:new THREE.Vector3(.2,1,.47),armRadius:.04,forearmRadius:.025};
 const layer=new PatientEquipment(asset,scene,()=>a);expect(layer.ox.visible).toBe(false);
 const p={equipment:{pulse_ox:'APPLIED'}},before=JSON.stringify(p);layer.setPresentation(p);layer.update();
 expect(layer.ox.visible).toBe(true);expect(layer.ox.position.distanceTo(a.finger)).toBeCloseTo(.005);
 a.finger.x+=.01;layer.update();expect(layer.ox.position.distanceTo(a.finger)).toBeCloseTo(.005);
 expect(layer.ox.quaternion.toArray().every(Number.isFinite)).toBe(true);expect(JSON.stringify(p)).toBe(before);
 layer.anchors=()=>({...a,finger:undefined});layer.update();expect(layer.ox.visible).toBe(false);
});
it('stethoscope contact follows the surface triangle rather than floating at a world coordinate',()=>{
 const canvas=document.createElement('canvas'),camera=new THREE.PerspectiveCamera(),scene=new THREE.Scene();camera.position.z=2;
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,1,0,0,0,1,0],3));
 const surface=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial());scene.add(surface);let enabled=true;
 const contact=new ExamContact(canvas,camera,scene,()=>surface,()=>enabled);
 contact.contact={surface,ids:[0,1,2],weights:new THREE.Vector3(.5,.25,.25)};contact.until=performance.now()+10000;contact.update();
 expect(contact.mesh.visible).toBe(true);expect(contact.mesh.position.toArray()).toEqual([.25,.25,.0025]);
 surface.position.y=.1;surface.updateMatrixWorld(true);contact.update();expect(contact.mesh.position.y).toBeCloseTo(.35);
 enabled=false;contact.update();expect(contact.mesh.visible).toBe(false);contact.dispose();
});
it('Dana committed IV medicine requires access and activates tubing without invented benefit',async()=>{
 const f=await wp1Fixture('dana','wp2-approved');expect((await f.action('concept.expo.ufh')).response.status).toBe(422);
 await f.action('concept.expo.iv');expect((await f.action('concept.expo.ufh')).response.status).toBe(200);
 expect((await f.state()).visual_patient?.equipment?.iv_tubing).toBe(true);
});
it('examination evidence does not break deterministic Expo finalization or six-domain assessment',async()=>{
 const f=await wp1Fixture('dana','wp2-approved');await f.action('examination.expo.general');const s=await f.state();
 const end=await f.response('/end',{expected_state_version:s.state_version,reason:'LEARNER_COMPLETED'});expect(end.status).toBe(200);
 const r=await f.response('/debriefs',{locale:'en-US'});expect(r.status).toBe(200);const body=await r.json();expect(body.data.packet.assessment.domain_scores).toHaveLength(6);
});
