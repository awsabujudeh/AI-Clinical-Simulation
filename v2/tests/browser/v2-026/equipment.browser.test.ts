import {it,expect} from 'vitest';
import {createDanaReviewSession} from '../../../runtime/v2-026-review-composition.ts';
import {DANA_ACTIONS as A} from '../../../content/cases/anaphylaxis/dana-case.ts';
import {projectVisualPatient} from '../../../packages/api-core/src/service/visual-patient-projection.ts';
import {VisualPatientPresentationSchema} from '../../../packages/contracts/src/index.ts';
// @ts-expect-error shared Three presentation adapter
import * as THREE from 'three';
// @ts-expect-error presentation-only JS
import {PatientEquipment} from '../../../apps/web/src/features/visual-patient/runtime/equipment.js';
it('devices start absent and appear only after committed execution; infusion requires prior IV access',async()=>{
 const a=await createDanaReviewSession();const project=()=>projectVisualPatient(a.h.store.sessions.get(a.sessionId)!)!.equipment;
 expect(project()).toEqual({bp_cuff:false,iv_access:false,iv_tubing:false});
 expect((await a.action(A.fluids)).status).not.toBe(200);expect(project()?.iv_tubing).toBe(false);
 await a.action(A.monitor);expect(project()).toEqual({bp_cuff:true,iv_access:false,iv_tubing:false});
 await a.action(A.iv);expect(project()).toEqual({bp_cuff:true,iv_access:true,iv_tubing:false});
 await a.action(A.fluids);expect(project()).toEqual({bp_cuff:true,iv_access:true,iv_tubing:true});
});
it('unexecuted or foreign timeline entries never attach devices',async()=>{
 const a=await createDanaReviewSession();await a.action(A.monitor);
 const s=structuredClone(a.h.store.sessions.get(a.sessionId)!);
 const e=s.committed_events.find(e=>e.action_id===A.monitor)!;
 e.payload={execution_status:'INTENT',catalogue_membership:'VERIFIED'};
 expect(projectVisualPatient(s)?.equipment?.bp_cuff).toBe(false);
 e.payload={execution_status:'EXECUTED',catalogue_membership:'VERIFIED'};e.session_id='session.foreign' as never;
 expect(projectVisualPatient(s)?.equipment?.bp_cuff).toBe(false);
});
it('shared rendering hides donor attachments and follows skeleton anchors without writes to clinical inputs',()=>{
 const scene=new THREE.Scene(),asset={scene:new THREE.Group()};scene.add(asset.scene);
 for(const name of ['Blood pressure cuff visual prop','IV_infusion_tubing','Equip_IV_Left','IV stand outer column']){const o=new THREE.Mesh();o.name=name;asset.scene.add(o);}
 const hanger=new THREE.Mesh(new THREE.BoxGeometry(.3,.02,.02));hanger.name='IV double hanger';hanger.position.set(.7,1.9,0);asset.scene.add(hanger);
 const shoulder=new THREE.Vector3(.2,1.1,0),elbow=new THREE.Vector3(.3,.9,.25),wrist=new THREE.Vector3(.3,.85,.5);
 const layer=new PatientEquipment(asset,scene,()=>({shoulder,elbow,wrist,armRadius:.04,forearmRadius:.025}));
 expect(layer.stats()).toEqual({bp_cuff:false,iv_access:false,iv_tubing:false});
 expect(asset.scene.getObjectByName('IV stand outer column').visible).toBe(true);
 const p={equipment:{bp_cuff:true,iv_access:true,iv_tubing:true}},before=JSON.stringify(p);
 layer.setPresentation(p);layer.update();expect(layer.stats()).toEqual(p.equipment);
 const old=layer.access.position.clone();wrist.x+=.08;layer.update();expect(layer.access.position.equals(old)).toBe(false);
 expect(JSON.stringify(p)).toBe(before);expect(layer.tube.geometry.attributes.position.array.every(Number.isFinite)).toBe(true);
 expect(asset.scene.getObjectByName('Equip_IV_Left').visible).toBe(false);
 expect(asset.scene.getObjectByName('IV_infusion_tubing').visible).toBe(false);
 layer.setPresentation({equipment:{iv_tubing:true}});layer.update();expect(layer.tube.visible).toBe(false);
});
it('strict presentation rejects tubing without access',async()=>{
 const a=await createDanaReviewSession(),p=projectVisualPatient(a.h.store.sessions.get(a.sessionId)!);
 expect(VisualPatientPresentationSchema.safeParse({...p,equipment:{bp_cuff:false,iv_access:false,iv_tubing:true}}).success).toBe(false);
});
