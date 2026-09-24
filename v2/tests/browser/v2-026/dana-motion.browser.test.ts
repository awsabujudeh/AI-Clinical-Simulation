import {it,expect} from 'vitest';
import {danaMotion} from '../../../apps/web/src/features/visual-patient/runtime/dana-motion.js';
import {resolvePatientStaticFallback} from '../../../apps/web/src/features/visual-patient/static-fallback.ts';
import manifest from '../../../content/media/dana/manifest.json';
const state={body:'itch_body',face:'anxious',mode:'conversation',speaking:false,breathing:true,blink:true,hand:true,living:true};
it('blink pauses vary, with full bilateral close and no dependence on speaking or scratching',()=>{
 for(const t of [2.975,7.775,11.375,17.575,21.675])expect(danaMotion(t,state).blink).toBeCloseTo(1);
 for(const t of [0,3.2,6,8.2,19])expect(danaMotion(t,state).blink).toBe(0);
 expect(danaMotion(2.975,{...state,speaking:true}).blink).toBeCloseTo(1);
 expect(danaMotion(2.975,{...state,blink:false}).blink).toBe(0);
});
it('mouth is playback-driven only and ends immediately without changing clinical/presentation input',()=>{
 const before=JSON.stringify(state);
 expect(danaMotion(5,state).mouth).toBe(0);
 expect(danaMotion(5,{...state,speaking:true}).mouth).toBeGreaterThan(.1);
 expect(danaMotion(5,{...state,speaking:true}).breathing).toBe(danaMotion(5,state).breathing);
 expect(danaMotion(5,{...state,speaking:true}).anxious).toBe(1);
 expect(danaMotion(6,state).mouth).toBe(0);expect(JSON.stringify(state)).toBe(before);
});
it('scratch has bounded episodes/rest and stops for calm state or targeted examination',()=>{
 for(const t of [0,9,11,22,38])expect(danaMotion(t,state).scratch).toBe(0);
 expect(danaMotion(4.3,state).scratch).toBeCloseTo(1);
 expect(danaMotion(4.3,{...state,body:'calm_body'}).scratch).toBe(0);
 expect(danaMotion(4.3,{...state,mode:'physical_exam'}).scratch).toBe(0);
 for(let t=0;t<70;t+=.1){const m=danaMotion(t,state);expect(m.scratch).toBeGreaterThanOrEqual(0);expect(m.scratch).toBeLessThanOrEqual(1);}
});
it('improvement composes calmer face, reduced rash, RR20 without stronger deformation',()=>{
 const calm={...state,body:'calm_body',face:'relieved'};
 expect(danaMotion(.5,calm)).toMatchObject({anxious:0,calm:1,rash:.06,scratch:0,neck:0,forearm:0});
 expect(danaMotion(.5,state).breathing).toBeCloseTo(Math.sin(.5*28*Math.PI/30)*.016);
 expect(danaMotion(.5,calm).breathing).toBeCloseTo(Math.sin(.5*20*Math.PI/30)*.010);
 expect(danaMotion(3,calm)).toEqual(danaMotion(3,calm));
});
it('forearm and neck episodes alternate with moving fingers and non-overlapping pauses',()=>{
 expect(danaMotion(4.3,state)).toMatchObject({forearm:1,neck:0});
 expect(danaMotion(17.2,state).neck).toBeCloseTo(1);
 expect(danaMotion(17.2,state).forearm).toBe(0);
 expect(danaMotion(4.3,state).fingerStroke).not.toBe(danaMotion(4.4,state).fingerStroke);
 for(let t=0;t<70;t+=.1){const m=danaMotion(t,state);expect(m.neck*m.forearm).toBe(0);}
});
it('readable breathing stays below one degree at RR28 and becomes shallower at RR20',()=>{
 const calm={...state,body:'calm_body',face:'relieved'};
 expect(danaMotion(30/56,state).breathing).toBeCloseTo(.016);
 expect(danaMotion(30/56+60/28,state).breathing).toBeCloseTo(.016);
 expect(danaMotion(.75,calm).breathing).toBeCloseTo(.010);
 expect(danaMotion(3.75,calm).breathing).toBeCloseTo(.010);
 for(let t=0;t<82;t+=.037){
  expect(Math.abs(danaMotion(t,state).breathing)).toBeLessThan(Math.PI/180);
  expect(danaMotion(t,{...state,breathing:false}).breathing).toBe(0);
  // Breathing amplitude changes cannot alter the approved hand schedule.
  const {breathing,thoracic,...on}=danaMotion(t,state),{breathing:off,thoracic:offChest,...without}=danaMotion(t,{...state,breathing:false});
  expect(on).toEqual(without);
 }
});
it('ribcage excursion shares RR28/RR20, remains bounded and reduces after treatment',()=>{
 const calm={...state,body:'calm_body',face:'relieved'};
 expect(danaMotion(30/56,state).thoracic).toBeCloseTo(1);
 expect(danaMotion(90/56,state).thoracic).toBeCloseTo(0);
 expect(danaMotion(.75,calm).thoracic).toBeCloseTo(.38);
 expect(danaMotion(2.25,calm).thoracic).toBeCloseTo(0);
 expect(danaMotion(30/56,{...state,breathing:false}).thoracic).toBe(0);
 expect(danaMotion(30/56,{...state,speaking:true}).thoracic).toBe(1);
 for(let t=0;t<50;t+=.05){expect(danaMotion(t,state).thoracic).toBeGreaterThanOrEqual(0);expect(danaMotion(t,state).thoracic).toBeLessThanOrEqual(1);}
});
it('each gesture holds skin contact for four strokes instead of repeatedly tapping',()=>{
 for(const [start,duration] of [[3.5,3.6],[16.2,3.2],[30.1,3.9]] as const){
  for(let i=1;i<80;i++)expect(danaMotion(start+duration*i/80,state)).toMatchObject({scratch:1,contact:1});
  for(let cycle=0;cycle<4;cycle++){
   expect(danaMotion(start+duration*(cycle+.25)/4,state).wristStroke).toBeCloseTo(1);
   expect(danaMotion(start+duration*(cycle+.75)/4,state).wristStroke).toBeCloseTo(-1);
  }
 }
});
it('mild swelling composes with speech/blink and reduces only with authoritative improvement',()=>{
 const speaking=danaMotion(2.975,{...state,speaking:true});
 expect(speaking.swelling).toBe(1);expect(speaking.blink).toBeCloseTo(1);expect(speaking.mouth).toBeGreaterThan(0);
 expect(danaMotion(2.975,{...state,body:'calm_body',face:'relieved',speaking:true}).swelling).toBe(.05);
});
it('Dana fallback is failure-only, Dana-owned and never changes a clinical state',()=>{
 const p={presentation_schema_version:'1.0',asset_id:'dana.review-v01',position:'semi_fowler',...state};
 const {mode,speaking,...presentation}=p;
 for(const status of ['READY','LOADING','IDLE'])expect(resolvePatientStaticFallback(presentation,status)).toBeUndefined();
 const before=JSON.stringify(presentation);
 expect(resolvePatientStaticFallback(presentation,'FAILED')?.path).toBe(manifest.patient_fallback.path);
 expect(resolvePatientStaticFallback({...presentation,body:'calm_body',face:'relieved'},'FAILED')?.path).toBe(manifest.patient_fallback.path);
 expect(manifest.patient_fallback.path).not.toContain('stemi');expect(JSON.stringify(presentation)).toBe(before);
 expect(resolvePatientStaticFallback({...presentation,asset_id:'unknown'},'FAILED')).toBeUndefined();
});
