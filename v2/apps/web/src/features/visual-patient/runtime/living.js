import * as THREE from 'three';
const clamp=THREE.MathUtils.clamp,rad=THREE.MathUtils.degToRad;
const smooth=x=>{x=clamp(x,0,1);return x*x*x*(10+x*(-15+6*x));};
const identity=()=>new THREE.Quaternion();
export class LivingBehavior {
 constructor(context){
  Object.assign(this,context);this.enabled=true;this.auto=true;this.seed=20260920;
  this.head={};this.headMotion=null;this.nod=null;this.adjust=null;this.handU=1;this.handMotion=null;
  this.gaze=0;this.gazeMotion=null;this.events=[];this.queue=[];this.demo=null;
  this.nextAt=this.now()+4.3;this.handCooldown=0;this.returnAt=null;this.lastType='';
  for(const n of this.manifest.living_behavior.head_bones)this.head[n]=identity();
 }
 random(){this.seed=(Math.imul(1664525,this.seed)+1013904223)>>>0;return this.seed/4294967296;}
 range(a,b){return a+(b-a)*this.random();}
 allowed(){return this.state.hand&&this.state.body==='pain_body';}
 record(name,source){this.events.push({at:this.now(),name,source,position:this.state.position,speaking:this.state.speaking});if(this.events.length>150)this.events.shift();}
 clipQ(name,t){return Object.fromEntries(this.clips[name].tracks.filter(tr=>tr.path==='rotation').map(tr=>[tr.node.name,new THREE.Quaternion().fromArray(tr.interpolant.evaluate(clamp(t,0,this.clips[name].duration)))]));}
 headAt(t){if(!this.headMotion)return this.head;const m=this.headMotion,u=smooth((t-m.start)/m.duration);return Object.fromEntries(Object.keys(this.head).map(n=>[n,m.from[n].clone().slerp(m.to[n],u)]));}
 handAt(t){if(!this.handMotion)return this.handU;const m=this.handMotion,u=clamp((t-m.start)/m.duration,0,1);return THREE.MathUtils.lerp(m.from,m.to,m.interrupted?smooth(u):u);}
 gazeAt(t){if(!this.gazeMotion)return this.gaze;const m=this.gazeMotion;return THREE.MathUtils.lerp(m.from,m.to,smooth((t-m.start)/m.duration));}
 request(type,{source='manual'}={}){
  const t=this.now();if(!this.enabled)return false;
  if(this.state.speaking&&['left','right'].includes(type))return false;
  if(['adjust','toChest'].includes(type)&&!this.allowed())return false;
  if(type==='toRest'&&this.state.speaking&&source!=='manual'&&source!=='state')return false;
  if(source==='manual'){this.demo=null;this.queue=[];this.returnAt=null;this.nextAt=t+this.range(8,12);}
  if(['left','right','return'].includes(type)){
   const name={left:'Head_Look_LeftSmall_v01',right:'Head_Look_RightSmall_v01',return:'Head_Return_Default_v01'}[type];
   const raw=type==='return'?Object.fromEntries(Object.keys(this.head).map(n=>[n,identity()])):this.clipQ(name,this.clips[name].duration);
   this.headMotion={from:this.headAt(t),to:raw,start:t,duration:this.clips[name].duration};
   this.gazeMotion={from:this.gazeAt(t),to:type==='left'?1:type==='right'?-1:0,start:t,duration:type==='return'?.6:.34};
   this.record(name,source);return true;
  }
  if(type==='nod'){if(this.nod)return false;this.nod={start:t,scale:this.state.speaking?.48:1};this.record('Head_Nod_Subtle_v01',source);return true;}
  if(type==='adjust'){if(this.handAt(t)<.999||this.handMotion||this.adjust)return false;this.adjust={start:t};this.record('Pain_ChestContact_Adjust_v01',source);return true;}
  if(type==='toRest'||type==='toChest'){
   const from=this.handAt(t),to=type==='toRest'?0:1;if(Math.abs(from-to)<.0001)return false;
   this.adjust=null;this.handMotion={from,to,start:t,duration:Math.max(.8,2.2*Math.abs(to-from)),interrupted:from>0.001&&from<.999};
   this.record(type==='toRest'?'Pain_HandChest_ToRest_v01':'Pain_HandRest_ToChest_v01',source);return true;
  }
  return false;
 }
 stateChanged(previous){
  if(!this.allowed()){this.request('toRest',{source:'state'});this.returnAt=null;}
  else if(!previous.hand||previous.body!=='pain_body'){this.request('toChest',{source:'state'});}
  if(this.state.speaking&&!previous.speaking){this.request('return',{source:'state'});if(this.allowed())this.request('toChest',{source:'state'});}
 }
 startDemo(kind){
  this.demo={kind,start:this.now(),duration:kind==='silent'?30:15};this.queue=[];
  this.request('return',{source:'demo preparation'});if(this.allowed())this.request('toChest',{source:'demo preparation'});
  const base=kind==='silent'?[[2.2,'left'],[5.2,'return'],[8.1,'nod'],[11.7,'adjust'],[16.4,'toRest'],[24.1,'toChest']]:[[3.8,'nod'],[10.6,'nod']];
  this.queue=base.map(([t,type])=>({at:this.demo.start+t+this.range(-.28,.32),type}));
  this.record('Demo_'+kind,'review');
 }
 tick(t){
  if(this.headMotion&&t>=this.headMotion.start+this.headMotion.duration){this.head=this.headAt(t);this.headMotion=null;}
  if(this.gazeMotion&&t>=this.gazeMotion.start+this.gazeMotion.duration){this.gaze=this.gazeAt(t);this.gazeMotion=null;}
  if(this.handMotion&&t>=this.handMotion.start+this.handMotion.duration){this.handU=this.handMotion.to;this.handMotion=null;}
  if(this.nod&&t-this.nod.start>=this.clips.Head_Nod_Subtle_v01.duration)this.nod=null;
  if(this.adjust&&t-this.adjust.start>=this.clips.Pain_ChestContact_Adjust_v01.duration)this.adjust=null;
  if(this.demo){
   while(this.queue.length&&this.queue[0].at<=t)this.request(this.queue.shift().type,{source:'demo'});
   if(t>=this.demo.start+this.demo.duration){this.demo=null;this.queue=[];this.nextAt=t+this.range(6,11);}
   return;
  }
  if(!this.auto||!this.enabled)return;
  if(this.returnAt&&t>=this.returnAt.at){this.request(this.returnAt.type,{source:'scheduled'});this.returnAt=null;this.nextAt=t+this.range(5,10);return;}
  if(t<this.nextAt||this.headMotion||this.nod||this.handMotion||this.adjust||this.returnAt)return;
  let type;
  if(this.state.speaking)type='nod';
  else if(this.handAt(t)<.01&&this.allowed())type='toChest';
  else{
   const options=['left','right','nod'];if(this.allowed()){options.push('adjust');if(t>this.handCooldown)options.push('toRest');}
   const choices=options.filter(x=>x!==this.lastType);type=choices[Math.floor(this.random()*choices.length)];
  }
  if(this.request(type,{source:'scheduled'})){
   this.lastType=type;
   if(type==='left'||type==='right')this.returnAt={at:t+this.range(2.8,4.6),type:'return'};
   if(type==='toRest'){this.returnAt={at:t+this.range(7,11),type:'toChest'};this.handCooldown=t+this.range(38,58);}
  }
  this.nextAt=t+this.range(this.state.speaking?7:5.2,this.state.speaking?13:10.5);
 }
 applyHand(t,w){
  const u=this.handAt(t);if(u>.999999){if(this.adjust)this.applyClip('Pain_ChestContact_Adjust_v01',t-this.adjust.start,'delta',false);return;}
  const duration=2.2,local=this.clipQ('Pain_HandRest_ToChest_v01',u*duration),sup=this.clipQ('Pain_HandRest_ToChest_Supine_v01',u*duration);
  const end=this.clipQ('Pain_HandRest_ToChest_v01',duration),supEnd=this.clipQ('Pain_HandRest_ToChest_Supine_v01',duration),transport=this.clipQ(this.manifest.contact.position_transport,w);
  for(const name of Object.keys(local)){
   const node=this.scene.getObjectByName(name),p=local[name].slerp(sup[name],w),e=end[name].slerp(supEnd[name],w);
   if(transport[name])p.multiply(identity().slerp(e.invert().multiply(transport[name]),smooth(u)));
   node.quaternion.copy(p);
  }
 }
 applyGaze(t){
  if(!this.state.blink)return;
  this.scene.updateMatrixWorld(true);
  const meta=this.manifest.living_behavior.eye_gaze_foundation,head=this.nodes.head;
  const center=head.localToWorld(new THREE.Vector3().fromArray(meta.head_local_eye_center));
  const defaultDirection=this.nodes.GazeTarget_Default.getWorldPosition(new THREE.Vector3()).sub(center).normalize();
  const gaze=this.gazeAt(t),side=this.nodes[gaze>=0?'GazeTarget_Left':'GazeTarget_Right'].getWorldPosition(new THREE.Vector3()).sub(center).normalize();
  const direction=defaultDirection.clone().lerp(side,Math.abs(gaze)).normalize();
  // Preserve V02's calibrated binocular baseline. The SAME world-space delta
  // rotates both eyes. It is derived in the moving head frame, not the room.
  const delta=new THREE.Quaternion().setFromUnitVectors(defaultDirection,direction);
  for(const side of ['L','R']){
   const bone=this.nodes['eye.'+side],world=bone.getWorldQuaternion(identity());
   bone.quaternion.copy(bone.parent.getWorldQuaternion(identity()).invert().multiply(delta.clone().multiply(world))).normalize();
  }
  this.gazeOffsetDegrees=THREE.MathUtils.radToDeg(defaultDirection.angleTo(direction));
 }

 apply(t,w){
  if(!this.enabled)return;
  this.tick(t);this.applyHand(t,w);
  const head=this.headAt(t);for(const n of Object.keys(head))this.nodes[n].quaternion.multiply(head[n]);
  if(this.nod){for(const tr of this.clips.Head_Nod_Subtle_v01.tracks){const v=tr.interpolant.evaluate(t-this.nod.start);tr.node.quaternion.multiply(identity().slerp(new THREE.Quaternion().fromArray(v),this.nod.scale));}}
  this.applyGaze(t);
 }
 stats(){return{enabled:this.enabled,auto:this.auto,handAmount:this.handAt(this.now()),handTransition:this.handMotion?this.handMotion.to?'toChest':'toRest':null,gaze:this.gazeAt(this.now()),sharedGazeOffsetDegrees:this.gazeOffsetDegrees,addedVergenceDegrees:0,demo:this.demo,events:this.events};}
}
