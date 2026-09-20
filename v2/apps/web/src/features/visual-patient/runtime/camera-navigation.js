import * as THREE from 'three';
const V=(x,y,z)=>new THREE.Vector3(x,y,z);
const ease=t=>t*t*t*(10+t*(-15+6*t));

// Runtime-only framing. Native cameras, anatomy, anchors and animation data stay untouched.
export class ExaminationCameraNavigation {
 constructor({camera,orbit,nodes,exam,positionMix}){
  Object.assign(this,{camera,orbit,nodes,exam,positionMix});this.transition=null;this.view='Camera_Student_Primary';
  // Room walls: x +/-2.16, headwall z -1.50, wall height 2.70 m.
  // Inset viewing volume also keeps the camera above the bed and inside the open foot end.
  this.cameraBox=new THREE.Box3(V(-1.35,1.18,-1.12),V(1.35,2.60,1.95));
  this.targetBox=new THREE.Box3(V(-.48,.77,-.82),V(.48,1.60,1.15));
  // Clearance envelopes around the existing monitor and IV mast, not new scene objects.
  this.obstacles=[new THREE.Box3(V(.54,1.05,-.91),V(1.19,1.65,-.30)),new THREE.Box3(V(-.94,1.05,-.75),V(-.66,2.39,-.40))];
  orbit.minDistance=.40;orbit.maxDistance=2.65;orbit.minPolarAngle=.025;orbit.maxPolarAngle=THREE.MathUtils.degToRad(65);
  orbit.panSpeed=.65;orbit.rotateSpeed=.65;orbit.zoomSpeed=.8;
  orbit.addEventListener('start',()=>{this.transition=null;});
  orbit.addEventListener('change',()=>{if(!this.adjusting)this.constrain();});
 }
 point(id){return this.exam.point(id);}
 bone(id){return this.nodes[id].getWorldPosition(new THREE.Vector3());}
 mean(points){return points.reduce((a,p)=>a.add(p),new THREE.Vector3()).multiplyScalar(1/points.length);}
 regionView(region){return({DEFAULT_COVERED:'Exam_Overview',CHEST:'Exam_Chest_Review',ABDOMEN:'Exam_Abdomen_Review',LEFT_ARM:'Exam_LeftArm_Review',RIGHT_ARM:'Exam_RightArm_Review',LOWER_LEGS:'Exam_LowerLegs_Review'})[region];}
 resolve(name){
  let target,position,fov=40;
  if(name==='Exam_Overview'||name==='Camera_Overhead_Top'){
   target=this.mean([this.point('Region_FACE'),this.bone('foot.L'),this.bone('foot.R')]);target.y=.87;target.z=.11;
   // Reuse the overhead direction below the room ceiling, widening the lens to retain the body overview.
   const dir=this.nodes.Camera_Overhead_Top.getWorldDirection(new THREE.Vector3()).negate();
   // Slight footward tilt avoids OrbitControls' top-pole dead spot for the normal exam overview.
   if(name==='Exam_Overview')dir.z+=.24;dir.normalize();
   position=target.clone().addScaledVector(dir,1.69);fov=72;
  }else if(name==='Exam_Chest_Review'||name==='Exam_Abdomen_Review'){
   target=this.point(name==='Exam_Chest_Review'?'Exam_Chest_Center':'Region_ABDOMEN');
   const dir=this.nodes.Camera_Chest_Close.getWorldDirection(new THREE.Vector3()).negate();
   position=target.clone().addScaledVector(dir,name==='Exam_Chest_Review'?1.00:.86);fov=43;
  }else if(name==='Exam_LeftArm_Review'||name==='Exam_RightArm_Review'){
   const left=name==='Exam_LeftArm_Review',side=left?'L':'R';
   target=this.mean([this.bone('upperarm01.'+side),this.point(left?'Region_LEFT_HAND':'Region_RIGHT_HAND')]);
   // Existing arm-camera elevation, mirrored to the selected anatomical side.
   const dir=this.nodes.Camera_Arm_Close.getWorldDirection(new THREE.Vector3()).negate();dir.x=Math.abs(dir.x)*(left?1:-1);
   position=target.clone().addScaledVector(dir,1.22);fov=45;
  }else if(name==='Exam_LowerLegs_Review'){
   target=this.mean([this.point('Region_LEFT_LEG'),this.point('Region_RIGHT_LEG'),this.bone('foot.L'),this.bone('foot.R')]);target.z+=.07;
   position=target.clone().add(V(-.16,1.08,.34));fov=48;
  }else if(name==='Face_Gaze_Review'){
   const headQ=this.nodes.head.getWorldQuaternion(new THREE.Quaternion()),up=V(0,1,0).applyQuaternion(headQ),forward=V(1,0,0).applyQuaternion(headQ);
   target=this.mean([this.bone('eye.L'),this.bone('eye.R')]).addScaledVector(up,-.025);
   position=target.clone().addScaledVector(forward,.57);fov=28;
  }else if(name.startsWith('Contact_')){
   const palm=this.bone('metacarpal2.L');target=name==='Contact_Hand'?palm:this.mean([palm,this.bone('lowerarm01.L'),this.bone('upperarm01.L')]);
   position=target.clone().addScaledVector(this.nodes.Camera_Student_Primary.getWorldPosition(new THREE.Vector3()).sub(target).normalize(),name==='Contact_Hand'?.5:.9);fov=name==='Contact_Hand'?32:40;
  }else{
   const c=this.nodes[name];if(!c?.isCamera)return null;
   position=c.getWorldPosition(new THREE.Vector3());fov=c.fov;
   const dir=c.getWorldDirection(new THREE.Vector3());
   // Project onto the actual anatomy so a saved camera cannot put the orbit pivot past/under the patient.
   const anatomy=this.point(name.includes('Face')?'Region_FACE':name.includes('Arm')?'Region_RIGHT_ARM':'Region_CHEST');
   const distance=THREE.MathUtils.clamp(anatomy.clone().sub(position).dot(dir),.4,2.65);
   target=position.clone().addScaledVector(dir,distance);
  }
  return{target,position,fov};
 }
 go(name,immediate=false){
  const next=this.resolve(name);if(!next)return;
  this.view=name;
  // Drain old damping once, preventing residual drag/zoom from contaminating the new focus.
  this.adjusting=true;const damp=this.orbit.enableDamping;this.orbit.enableDamping=false;this.orbit.update();this.orbit.enableDamping=damp;this.adjusting=false;
  this.transition={start:performance.now(),duration:650,from:{position:this.camera.position.clone(),target:this.orbit.target.clone(),fov:this.camera.fov},to:next};
  if(immediate){this.write(next);this.transition=null;}
 }
 write(p){this.camera.position.copy(p.position);this.orbit.target.copy(p.target);this.camera.fov=p.fov;this.camera.up.set(0,1,0);this.constrain();this.camera.updateProjectionMatrix();}
 constrain(){
  this.adjusting=true;
  const {camera,orbit}=this,old=orbit.target.clone();orbit.target.clamp(this.targetBox.min,this.targetBox.max);
  // A low patient-relative focus slab prevents panning into empty air above the legs/Supine torso.
  const targetCeiling=1.10+.50*(1-this.positionMix())*THREE.MathUtils.clamp((.20-orbit.target.z)/.65,0,1);
  orbit.target.y=Math.min(orbit.target.y,targetCeiling);camera.position.add(orbit.target.clone().sub(old));
  const delta=camera.position.clone().sub(orbit.target),s=new THREE.Spherical().setFromVector3(delta);
  s.radius=THREE.MathUtils.clamp(s.radius,orbit.minDistance,orbit.maxDistance);s.phi=THREE.MathUtils.clamp(s.phi,orbit.minPolarAngle,orbit.maxPolarAngle);
  camera.position.copy(orbit.target).add(delta.setFromSpherical(s));camera.position.clamp(this.cameraBox.min,this.cameraBox.max);
  // Keep away from the supported head/backrest envelope in either approved position.
  if(Math.abs(camera.position.x)<.57&&camera.position.z<-.28)camera.position.y=Math.max(camera.position.y,1.16+(1-this.positionMix())*.48);
  if(camera.position.z<-.82)camera.position.y=Math.max(camera.position.y,1.58);
  for(const b of this.obstacles)if(b.containsPoint(camera.position)){
   const p=camera.position,choices=[['x',b.min.x-.001],['x',b.max.x+.001],['y',b.max.y+.001],['z',b.min.z-.001],['z',b.max.z+.001]];
   choices.sort((a,c)=>Math.abs(p[a[0]]-a[1])-Math.abs(p[c[0]]-c[1]));p[choices[0][0]]=choices[0][1];
  }
  camera.lookAt(orbit.target);this.adjusting=false;
 }
 update(now){
  if(this.transition){const a=this.transition,u=Math.min(1,(now-a.start)/a.duration),t=ease(u);this.write({position:a.from.position.clone().lerp(a.to.position,t),target:a.from.target.clone().lerp(a.to.target,t),fov:THREE.MathUtils.lerp(a.from.fov,a.to.fov,t)});if(u===1)this.transition=null;}
  this.orbit.update();this.constrain();
 }
 stats(){return{view:this.view,transitioning:!!this.transition,position:this.camera.position.toArray(),target:this.orbit.target.toArray(),distance:this.camera.position.distanceTo(this.orbit.target),insideRoom:this.cameraBox.containsPoint(this.camera.position),insideTarget:this.targetBox.containsPoint(this.orbit.target),insideObstacle:this.obstacles.some(b=>b.containsPoint(this.camera.position)),fov:this.camera.fov};}
}
