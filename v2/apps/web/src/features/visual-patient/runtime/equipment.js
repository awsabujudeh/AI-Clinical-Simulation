import * as THREE from 'three';

/** Shared downstream attachment layer. Device geometry follows the current
 * skeleton, not a donor scene's fixed world coordinates. No action execution. */
export class PatientEquipment {
 constructor(asset,scene,anchors){
  this.anchors=anchors;this.scene=scene;this.hidden=[];
  const name=o=>o.name.replaceAll('_',' ');
  const connected=/^(Blood pressure cuff|BP cuff|Cuff pressure hose|IV (bag|blue connector|cannula|drip chamber|fixation tape|infusion tubing|outlet|roller clamp|short connector|transparent forearm)|Finger oximeter|Pulse oximeter|Oximeter flexible lead|Monitor lead [0-9]|Equip )/i;
  asset.scene.traverse(o=>{if(connected.test(name(o))){o.visible=false;this.hidden.push(o);}});
  this.root=new THREE.Group();this.root.name='Session_Equipment';scene.add(this.root);
  const material=(color)=>new THREE.MeshStandardMaterial({color,roughness:.75});
  this.cuff=new THREE.Mesh(new THREE.CylinderGeometry(1,1,1,24,1,true),material(0x263b50));
  this.cuff.name='Committed_BP_Cuff';this.root.add(this.cuff);
  this.access=new THREE.Group();this.access.name='Committed_IV_Access';this.root.add(this.access);
  this.tape=new THREE.Mesh(new THREE.BoxGeometry(.033,.0015,.044),material(0xe9e2cf));this.access.add(this.tape);
  this.hub=new THREE.Mesh(new THREE.BoxGeometry(.009,.007,.020),material(0x338aa2));this.hub.position.y=.004;this.access.add(this.hub);
  this.tube=new THREE.Mesh(new THREE.BufferGeometry(),material(0xcddfdf));this.tube.name='Committed_IV_Tubing';this.root.add(this.tube);
  this.bag=new THREE.Mesh(new THREE.BoxGeometry(.09,.15,.025),material(0xc5ded9));this.bag.name='Committed_IV_Fluid_Bag';this.root.add(this.bag);
  asset.scene.updateMatrixWorld(true);
  let hanger;asset.scene.traverse(o=>{if(name(o)==='IV double hanger')hanger=o;});
  this.supply=hanger?new THREE.Box3().setFromObject(hanger).getCenter(new THREE.Vector3()).add(new THREE.Vector3(.09,-.12,0)):undefined;
  this.value={};this.update();
 }
 setPresentation(p){this.value=p.equipment??{};}
 update(){
  // Other presentation layers may change visibility, never re-enable donor lines.
  for(const o of this.hidden)o.visible=false;
  const a=this.anchors(this.supply);
  this.cuff.visible=!!a&&this.value.bp_cuff===true;
  this.access.visible=!!a&&this.value.iv_access===true;
  this.tube.visible=this.access.visible&&this.value.iv_tubing===true&&!!this.supply;
  this.bag.visible=this.tube.visible;
  if(this.supply)this.bag.position.copy(this.supply);
  if(!a)return;
  const upper=a.elbow.clone().sub(a.shoulder).normalize();
  this.cuff.position.copy(a.shoulder).lerp(a.elbow,.73);
  this.cuff.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),upper);
  this.cuff.scale.set(a.armRadius,.085,a.armRadius);
  const axis=a.wrist.clone().sub(a.elbow).normalize();
  const normal=new THREE.Vector3(0,1,0).addScaledVector(axis,-axis.y).normalize();
  this.access.position.copy(a.elbow).lerp(a.wrist,.82).addScaledVector(normal,a.forearmRadius);
  const side=new THREE.Vector3().crossVectors(normal,axis).normalize();
  this.access.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(side,normal,axis));
  if(this.tube.visible){
   const end=this.access.position.clone().addScaledVector(normal,.010);
   // Lead stays on the IV side of the bed, then connects at the access hub.
   const outer=new THREE.Vector3(Math.sign(end.x||1)*.60,1.04,end.z);
   const start=this.supply.clone().add(new THREE.Vector3(0,-.075,0));
   const curve=new THREE.CatmullRomCurve3([start,outer,end.clone().addScaledVector(normal,.065),end]);
   this.tube.geometry.dispose();this.tube.geometry=new THREE.TubeGeometry(curve,24,.002,6,false);
  }
 }
 stats(){return {bp_cuff:this.cuff.visible,iv_access:this.access.visible,iv_tubing:this.tube.visible};}
}
