import * as THREE from 'three';
import { danaMotion } from './dana-motion.js';

/** Asset-specific pose adapter. Clinical truth still arrives as a presentation.
 * Reuses the common renderer, loader, lifecycle, camera and playback boundary.
 * No timers/providers/clinical effects are owned by this adapter.
 */
export class DanaRig {
 constructor({asset,camera,orbit,canvas,state,onRequest}) {
  Object.assign(this,{asset,camera,orbit,canvas,state,onRequest});
  // Blender ACTIVE_ACTIONS merges the sole authored base clip as "Animation".
  const baseClip=asset.animations.length===1?asset.animations.find(c=>c.name==='Animation'):undefined;
  if(!baseClip)throw Error('DANA_BASE_POSE_MISSING');
  this.mixer=new THREE.AnimationMixer(asset.scene);this.mixer.clipAction(baseClip).play();this.mixer.setTime(0);
  this.bones={};this.meshes=[];this.region='DEFAULT_COVERED';this.toolName='inspection';this.requestCount=0;
  asset.scene.traverse(o=>{if(o.isBone)this.bones[o.name.replace(/^mixamorig\d*:?/,'')]=o;if(o.isMesh)this.meshes.push(o);});
  this.base=new Map(Object.values(this.bones).map(b=>[b,b.quaternion.clone()]));
  this.shirt=this.meshes.find(m=>m.name==='Dana_Ch22_Shirt');this.top=this.meshes.find(m=>m.name==='Dana_Clinical_Bra');
  this.examSkin=asset.scene.getObjectByName('Dana_BodyComplete_Exam');
  if(!this.bones.Head||!this.shirt||!this.top)throw Error('DANA_RIG_INCOMPLETE');
  this.faceMeshes=this.meshes.filter(m=>m.morphTargetDictionary?.Blink_Left!==undefined);
  this.thoracicMeshes=this.meshes.filter(m=>m.morphTargetDictionary?.Thoracic_Breath!==undefined);
  const body=this.meshes.find(m=>m.name==='Dana_Ch22_Body');
  this.bodyMesh=body;
  if(!['Blink_Left','Blink_Right','Mouth_Open','Anxious_Foundation_v01','Improved_Calm_v01','Lip_Swelling_Mild'].every(k=>body?.morphTargetDictionary?.[k]!==undefined))throw Error('DANA_FACE_INCOMPLETE');
  this.faceMix={anxious:1,calm:0};
  this.top.visible=false;if(this.examSkin)this.examSkin.visible=false;this.rash={value:1};this.seam={value:0};this.installRash();
  asset.scene.updateMatrixWorld(true);
  this.bedding=[];
  asset.scene.traverse(o=>{if(o.isMesh&&!o.isSkinnedMesh&&/backrest|mattress|pillow|sheet/i.test(o.name)){
   o.geometry=o.geometry.clone();this.bedding.push({mesh:o,base:o.geometry.getAttribute('position').array.slice(),inverse:o.matrixWorld.clone().invert()});
  }});this.lastBedWeight=-1;
  this.cancelFocus=()=>{this.destination=null;this.focusFrames=0;};
  orbit.addEventListener('start',this.cancelFocus);
  this.down=e=>this.pointer=[e.clientX,e.clientY];
  this.up=e=>{if(state.mode!=='physical_exam'||this.region==='DEFAULT_COVERED'||!this.pointer||Math.hypot(e.clientX-this.pointer[0],e.clientY-this.pointer[1])>6)return;
   const rect=canvas.getBoundingClientRect(),ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,1-(e.clientY-rect.top)/rect.height*2),camera);
   const hits=ray.intersectObjects(this.meshes.filter(m=>this.visiblePatientMesh(m)),false);
   if(!hits.length)return;
   const anchor={FACE:'Head',NECK:'Neck',CHEST:'Spine2',LEFT_ARM:'LeftForeArm',RIGHT_ARM:'RightForeArm'}[this.region];
   if(!anchor||hits[0].point.distanceTo(this.point(anchor))>({FACE:.23,NECK:.15,CHEST:.3,LEFT_ARM:.25,RIGHT_ARM:.25}[this.region]))return;
   this.requestCount++;onRequest({type:'visual_exam_request',tool:this.toolName,exam_mode:this.toolName==='stethoscope'?'AUSCULTATION':'INSPECTION',region_id:this.region,anchor_id:'Dana_'+this.region,patient_position:'supine'});
  };
  canvas.addEventListener('pointerdown',this.down);canvas.addEventListener('pointerup',this.up);
  orbit.minDistance=.5;orbit.maxDistance=2.8;orbit.maxPolarAngle=Math.PI*.42;
  this.focus(true);
 }
 visiblePatientMesh(m){
  if(!m.isSkinnedMesh)return false;
  let patient=m.name.startsWith('Dana_');
  for(let parent=m;parent;parent=parent.parent){if(!parent.visible)return false;if(parent===this.examSkin)patient=true;}
  return patient;
 }
 installRash(){
  // glTF multi-material primitives inherit mesh-data names, not the parent
  // object name. Include the continuous examination body's descendants.
  const examMeshes=new Set();this.examSkin?.traverse(o=>{if(o.isSkinnedMesh)examMeshes.add(o);});
  const targets=this.meshes.filter(m=>m.isSkinnedMesh&&(m===this.bodyMesh||examMeshes.has(m)));
  for(const m of targets){
  if(!['Ch22_body','Dana_Exam_Skin_Matched'].includes(m.material.name))continue;
  const index=m.geometry.getAttribute('skinIndex'),weights=m.geometry.getAttribute('skinWeight'),mask=new Float32Array(index.count),seamMask=new Float32Array(index.count),pos=m.geometry.getAttribute('position');
  // This pinned export's bind is lying along -Z, with its feet at Z=.92.
  // Fade only the authored cuff/collar
  // shadow at an examination join; ordinary clothed presentation is unchanged.
  for(let i=0;i<index.count;i++){
   const x=Math.abs(pos.getX(i)),y=.92-pos.getZ(i);
   // The right original-body boundary begins at |X|=.261 m, earlier than
   // the left (.282 m). Both must be fully continuous at the actual join.
   const arm=THREE.MathUtils.smoothstep(x,.27,.32)*(1-THREE.MathUtils.smoothstep(x,.34,.42));
   // v11's manifold collar reaches the undamaged neck above the old folded
   // edge. Carry the same material through that join before fading to face UVs.
   // Collar blending belongs at the neck, not the whole centre of the torso:
   // an unbounded lower mask erased the authored abdominal navel crease tone.
   const neck=THREE.MathUtils.smoothstep(y,1.44,1.47)*(1-THREE.MathUtils.smoothstep(y,1.50,1.545))*(1-THREE.MathUtils.smoothstep(x,.07,.11));
   seamMask[i]=Math.max(arm,neck);
  }
  for(let i=0;i<index.count;i++)for(let j=0;j<4;j++)if(/(Arm|Neck|Spine2)/.test(m.skeleton.bones[index.getComponent(i,j)]?.name??''))mask[i]+=weights.getComponent(i,j);
  m.geometry.setAttribute('danaRashMask',new THREE.BufferAttribute(mask,1));
  m.geometry.setAttribute('danaSeamMask',new THREE.BufferAttribute(seamMask,1));
  m.material=m.material.clone();
  // The source wardrobe bake includes a specular cuff/collar texture. It is
  // inappropriate on the reconstructed examination body (ordinary skin stays
  // unchanged). Keep the authored diffuse face detail and normal-map detail.
  if(examMeshes.has(m))m.material.specularIntensityMap=null;
  m.material.onBeforeCompile=s=>{
   s.uniforms.danaRash=this.rash;s.uniforms.danaSeam=this.seam;
   s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nattribute float danaRashMask;attribute float danaSeamMask;varying float vDanaSeam; varying float vDanaMask; varying vec3 vDanaPos;').replace('#include <begin_vertex>','#include <begin_vertex>\nvDanaSeam=danaSeamMask;vDanaMask=danaRashMask;vDanaPos=position;');
   s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nuniform float danaRash;uniform float danaSeam;varying float vDanaSeam;varying float vDanaMask;varying vec3 vDanaPos;').replace('#include <color_fragment>',`#include <color_fragment>
    diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.57,.365,.285),vDanaSeam*danaSeam);
    vec3 p=vDanaPos*46.0;vec3 baseCell=floor(p);float nearest=2.0;
    for(int ix=-1;ix<=1;ix++)for(int iy=-1;iy<=1;iy++)for(int iz=-1;iz<=1;iz++){
     vec3 cell=baseCell+vec3(float(ix),float(iy),float(iz));
     vec3 jitter=fract(sin(vec3(dot(cell,vec3(127.1,311.7,74.7)),dot(cell,vec3(269.5,183.3,246.1)),dot(cell,vec3(113.5,271.9,124.6))))*43758.5453);
     if(jitter.x>.54)nearest=min(nearest,length((p-cell-jitter)*vec3(1.0,1.15,.85)));
    }
    float wheal=1.0-smoothstep(.18,.43,nearest);
    diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(1.10,.53,.57),wheal*vDanaMask*.80*danaRash);`);
   s.fragmentShader=s.fragmentShader.replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>\nnormal=normalize(mix(normal,nonPerturbedNormal,vDanaSeam*danaSeam));');
   s.fragmentShader=s.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor,.8,vDanaSeam*danaSeam);').replace('#include <metalnessmap_fragment>','#include <metalnessmap_fragment>\nmetalnessFactor=mix(metalnessFactor,0.0,vDanaSeam*danaSeam);');
  };m.material.customProgramCacheKey=()=> 'dana-body-complete-v15';
  }
 }
 point(b){return this.bones[b].getWorldPosition(new THREE.Vector3());}
 rotate(b,axis,angle){this.bones[b]?.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(axis,angle));}
 aim(b,target,weight){
  const o=this.bones[b],child=o.children.find(c=>c.isBone);if(!child)return;
  const start=o.getWorldPosition(new THREE.Vector3()),end=child.getWorldPosition(new THREE.Vector3());
  const q=new THREE.Quaternion().setFromUnitVectors(end.sub(start).normalize(),target.clone().sub(start).normalize());
  const world=o.getWorldQuaternion(new THREE.Quaternion()).premultiply(q),parent=o.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
  o.quaternion.slerp(parent.multiply(world),weight);this.asset.scene.updateMatrixWorld(true);
 }
 alignNeckForearmRoll(weight){
  this.neckForearmRoll=0;if(!weight)return;
  // Align the upper-arm hinge with the actual bend plane before pronating the
  // forearm. Keep its world pose: this only repairs the twist across the elbow,
  // not the accepted hand target, elbow pole, forearm rub or gesture schedule.
  const upperBone=this.bones.LeftArm,forearmBone=this.bones.LeftForeArm;
  const savedForearm=forearmBone.getWorldQuaternion(new THREE.Quaternion());
  const upperAxis=this.point('LeftForeArm').sub(this.point('LeftArm')).normalize();
  const lowerAxis=this.point('LeftHand').sub(this.point('LeftForeArm')).normalize();
  const hinge=new THREE.Vector3().crossVectors(upperAxis,lowerAxis).normalize();
  const upperWorld=upperBone.getWorldQuaternion(new THREE.Quaternion());
  const upperHinge=new THREE.Vector3(1,0,0).applyQuaternion(upperWorld);
  upperHinge.addScaledVector(upperAxis,-upperHinge.dot(upperAxis)).normalize();
  const hingeTurn=Math.atan2(upperAxis.dot(new THREE.Vector3().crossVectors(upperHinge,hinge)),upperHinge.dot(hinge));
  upperWorld.premultiply(new THREE.Quaternion().setFromAxisAngle(upperAxis,hingeTurn*weight));
  upperBone.quaternion.copy(upperBone.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(upperWorld));
  this.asset.scene.updateMatrixWorld(true);
  forearmBone.quaternion.copy(upperBone.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(savedForearm));
  this.asset.scene.updateMatrixWorld(true);
  // Distribute pronation along the forearm instead of concentrating the full
  // palm turn at the wrist. Only the neck overlay uses this; forearm rub is fixed.
  const bone=this.bones.LeftForeArm,world=bone.getWorldQuaternion(new THREE.Quaternion());
  const axis=this.point('LeftHand').sub(this.point('LeftForeArm')).normalize();
  const current=new THREE.Vector3(0,0,1).applyQuaternion(world);
  current.addScaledVector(axis,-current.dot(axis)).normalize();
  const desired=this.rubFrame.normal.clone().negate();desired.addScaledVector(axis,-desired.dot(axis)).normalize();
  const angle=Math.atan2(axis.dot(new THREE.Vector3().crossVectors(current,desired)),current.dot(desired));
  this.neckForearmRoll=angle*.85*weight;
  world.premultiply(new THREE.Quaternion().setFromAxisAngle(axis,this.neckForearmRoll));
  bone.quaternion.copy(bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(world));
  this.asset.scene.updateMatrixWorld(true);
 }
 articulateHands(weight,stroke=0){
  const x=new THREE.Vector3(1,0,0);
  // Mixamo's local +Z is the palmar side of both hands. Small +X flexion
  // relaxes the fingers; the existing episode envelope provides a smooth
  // contact/release rather than switching a separate hand animation on/off.
  for(const side of ['Left','Right'])for(const finger of ['Index','Middle','Ring','Pinky']){
   const contact=side==='Left'?weight:weight*.25;
   for(const [joint,rest,extra] of [[1,.07,.10],[2,.12,.15],[3,.07,.08]])
    this.rotate(side+'Hand'+finger+joint,x,rest+extra*contact+(side==='Left'&&joint===2?.30*stroke:0));
  }
  this.rotate('LeftHandThumb2',x,.08+weight*.07);
  this.rotate('RightHandThumb2',x,.08);
  if(weight>0){
   const hand=this.bones.LeftHand;
   const reach=this.point('LeftHand').sub(this.point('LeftForeArm')).normalize();
   const forward=this.rubFrame.forward.clone();
   // Limit flexion relative to the forearm, while permitting natural pronation
   // around it. A total quaternion-angle cap incorrectly prevented the palm
   // from turning towards the receiving skin.
   const directionAngle=reach.angleTo(forward);
   if(directionAngle>.65)forward.copy(reach).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(reach,this.rubFrame.forward).slerp(new THREE.Quaternion(),1-.65/directionAngle));
   const palm=this.rubFrame.normal.clone().negate();
   palm.addScaledVector(forward,-palm.dot(forward)).normalize();
   const across=new THREE.Vector3().crossVectors(forward,palm).normalize();
   palm.crossVectors(across,forward).normalize();
   const desired=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(across,forward,palm));
   const local=hand.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(desired);
   hand.quaternion.slerp(local,weight);
  }
  this.asset.scene.updateMatrixWorld(true);
 }
 pose(t,w){
  if(Math.abs(w-this.lastBedWeight)>.0001){
   const p=new THREE.Vector3(),pivot=new THREE.Vector3(0,.738,-.19),axis=new THREE.Vector3(1,0,0);
   for(const {mesh,base,inverse} of this.bedding){const attr=mesh.geometry.getAttribute('position');
    for(let i=0;i<attr.count;i++){p.fromArray(base,i*3).applyMatrix4(mesh.matrixWorld);const weight=THREE.MathUtils.smoothstep(-p.z,.18,.22);p.sub(pivot).applyAxisAngle(axis,-w*weight*35*Math.PI/180).add(pivot).applyMatrix4(inverse);attr.setXYZ(i,p.x,p.y,p.z);}attr.needsUpdate=true;mesh.geometry.computeVertexNormals();
   }this.lastBedWeight=w;
  }
  for(const [b,q] of this.base)b.quaternion.copy(q);
  const motion=danaMotion(t,this.state);const x=new THREE.Vector3(1,0,0),z=new THREE.Vector3(0,0,1);
  // The exported backrest is semi-Fowler. Exam supine pose is adapted with the
  // existing base-plus-overlay principle; no whole-model reload.
  this.rotate('Spine',x,-w*35*Math.PI/180);
  this.breathing=motion.breathing;
  this.rotate('Spine2',x,this.breathing);
  this.rotate('Head',z,this.state.living===false?0:Math.sin(t*.51)*.014);
  this.asset.scene.updateMatrixWorld(true);
  // Transport resting arms with the reclining base instead of leaving the
  // semi-Fowler shoulder angles hovering above a now-flat torso.
  if(w>0)for(const [side,sign] of [['Left',1],['Right',-1]]){
   const shoulder=this.point(side+'Arm');
   this.aim(side+'Arm',shoulder.clone().add(new THREE.Vector3(sign*.13,-.035,.23)),w);
   this.aim(side+'ForeArm',shoulder.clone().add(new THREE.Vector3(sign*.14,-.055,.47)),w);
  }
  // Intermittent upper-body rub: pauses between episodes; no chest-pain guarding.
  this.scratch=motion.scratch;
  this.scratchContact=motion.contact;
  this.scratchRegion=motion.neck>0?'NECK':motion.forearm>0?'FOREARM':'REST';
  this.asset.scene.updateMatrixWorld(true);
  if(this.scratch){
   // Present the receiving forearm above the abdomen before crossing the other
   // hand; the elbow remains lateral and the path clears the shirt surface.
   this.aim('RightArm',this.point('RightArm').add(new THREE.Vector3(-.09,-.035,.25)),motion.forearm);
   const receiver=this.point('RightForeArm');
   this.aim('RightForeArm',receiver.clone().add(new THREE.Vector3(.11,.16,.12)),motion.forearm);
   // Two-bone reach with a stable elbow pole; surface clearance keeps the palm
   // above the opposite forearm. Bounded strokes, not whole-body locomotion.
   const shoulder=this.point('LeftArm'),elbow=this.point('LeftForeArm'),hand=this.point('LeftHand');
   // Target the forearm shaft, not the wrist/other hand. The wrist is held
   // slightly above the skin while the fingers make short rubbing strokes.
   const forearmAxis=this.point('RightHand').sub(this.point('RightForeArm')).normalize();
   const neckAxis=this.point('Head').sub(this.point('Neck')).normalize();
   const normal=motion.neck?new THREE.Vector3(0,.85,.53).normalize():new THREE.Vector3(0,1,0).addScaledVector(forearmAxis,-forearmAxis.y).normalize();
   const contact=motion.neck?this.point('Neck').addScaledVector(neckAxis,.042+motion.wristStroke*.006).add(new THREE.Vector3(.029,.038,.023)):this.point('RightForeArm').lerp(this.point('RightHand'),.46).addScaledVector(forearmAxis,motion.wristStroke*.009);
   // Across the lateral neck, not fingertips-up with a wrist buried below the
   // collar. The forearm stays anterior to the shirt and elbow stays outboard.
   const forward=motion.neck?new THREE.Vector3(-1,0,0):contact.clone().sub(shoulder);forward.addScaledVector(normal,-forward.dot(normal)).normalize();
   this.rubFrame={forward,normal};
   // Place the finger pads on the forearm, rather than placing the wrist there
   // and leaving the whole hand protruding beyond it.
   const target=contact.addScaledVector(normal,motion.neck?.028:.046).addScaledVector(forward,-.112);
   const upper=shoulder.distanceTo(elbow),lower=elbow.distanceTo(hand),axis=target.clone().sub(shoulder);
   const distance=Math.min(axis.length(),upper+lower-.003);axis.normalize();
   const along=(upper*upper-lower*lower+distance*distance)/(2*distance);
   // A lateral elbow pole keeps the whole forearm anterior to the shirt,
   // instead of reaching upward with the wrist hidden under the collar.
   const poleHint=motion.neck?new THREE.Vector3(1,0,0):new THREE.Vector3(.7,.8,.25);
   const pole=poleHint.clone().addScaledVector(axis,-poleHint.dot(axis)).normalize();
   const bend=shoulder.clone().addScaledVector(axis,along).addScaledVector(pole,Math.sqrt(Math.max(0,upper*upper-along*along)));
   this.aim('LeftArm',bend,this.scratch);this.aim('LeftForeArm',target,this.scratch);
  }
  this.alignNeckForearmRoll(motion.neck);
  this.articulateHands(this.scratch,motion.fingerStroke);
  this.thoracic=motion.thoracic;
  for(const m of this.thoracicMeshes)m.morphTargetInfluences[m.morphTargetDictionary.Thoracic_Breath]=this.thoracic;
  const dt=this.lastTime===undefined?1:Math.min(.1,Math.max(0,t-this.lastTime));this.lastTime=t;
  const blend=1-Math.exp(-dt*4);
  this.faceMix.anxious+=(motion.anxious-this.faceMix.anxious)*blend;this.faceMix.calm+=(motion.calm-this.faceMix.calm)*blend;
  this.articulation=motion.mouth;this.blink=motion.blink;
  this.swelling=motion.swelling;
  const values={Blink_Left:motion.blink,Blink_Right:motion.blink,Mouth_Open:motion.mouth,Anxious_Foundation_v01:this.faceMix.anxious,Improved_Calm_v01:this.faceMix.calm,Lip_Swelling_Mild:this.swelling};
  for(const m of this.faceMeshes)for(const [key,value] of Object.entries(values)){const i=m.morphTargetDictionary[key];if(i!==undefined)m.morphTargetInfluences[i]=value;}
  this.rash.value+=(motion.rash-this.rash.value)*blend;
  this.asset.scene.updateMatrixWorld(true);
 }
 focus(immediate=false){
  const bone={FACE:'Head',NECK:'Neck',CHEST:'Spine2',LEFT_ARM:'LeftForeArm',RIGHT_ARM:'RightForeArm'}[this.region];
  const target=bone?this.point(bone):new THREE.Vector3(0,1.1,0);
  if(this.region.endsWith('_ARM'))target.lerp(this.point(this.region==='LEFT_ARM'?'LeftHand':'RightHand'),.5);
  if(this.region==='FACE')target.add(new THREE.Vector3(0,.06,-.075));
  const offset=this.region==='FACE'?new THREE.Vector3(0,.5,.24):this.region==='NECK'?new THREE.Vector3(-.18,.5,.32):this.region.endsWith('_ARM')?new THREE.Vector3(this.region==='LEFT_ARM'?.3:-.3,.65,.20):bone?new THREE.Vector3(-.22,.95,.58):new THREE.Vector3(-1.3,1.15,1.55);
  this.destination={target,position:target.clone().add(offset)};this.focusFrames=150;
  if(immediate){this.camera.position.copy(this.destination.position);this.orbit.target.copy(target);this.orbit.update();this.cancelFocus();}
 }
 update(){if(this.destination){if(this.focusFrames>0){const remaining=this.focusFrames-1;this.focus();this.focusFrames=remaining;}this.camera.position.lerp(this.destination.position,.08);this.orbit.target.lerp(this.destination.target,.08);if(this.focusFrames===0)this.destination=null;}this.orbit.update();
  this.camera.position.clamp(new THREE.Vector3(-1.4,1.18,-1.12),new THREE.Vector3(1.4,2.6,1.95));}
 enter(){this.previousPosition=this.state.position;this.state.mode='physical_exam';this.state.position='supine';this.region='DEFAULT_COVERED';this.focus();}
 exit(){this.state.mode='conversation';this.state.position=this.previousPosition??'semi_fowler';this.region='DEFAULT_COVERED';this.cover();this.focus();}
 cover(){
  const exam=this.region==='CHEST';
  this.shirt.visible=!exam;this.top.visible=exam;if(this.examSkin)this.examSkin.visible=exam;
  if(this.bodyMesh)this.bodyMesh.visible=!exam;if(this.seam)this.seam.value=exam?1:0;
 }
 selectRegion(r){if(!['DEFAULT_COVERED','FACE','NECK','CHEST','LEFT_ARM','RIGHT_ARM'].includes(r))return false;this.region=r;this.cover();this.focus();return true;}
 setTool(t){if(!['inspection','stethoscope','penlight'].includes(t))return false;this.toolName=t;return true;}
 stats(){return{region:this.region,tool:this.toolName,requestCount:this.requestCount,visibleGarments:[this.shirt,this.top].filter(m=>m.visible).map(m=>m.name),scratch:this.scratch,scratchContact:this.scratchContact,scratchRegion:this.scratchRegion,neckForearmRoll:this.neckForearmRoll,thoracic:this.thoracic,articulation:this.articulation,blink:this.blink,face:{...this.faceMix},swelling:this.swelling,rash:this.rash.value};}
 dispose(){this.orbit.removeEventListener('start',this.cancelFocus);this.canvas.removeEventListener('pointerdown',this.down);this.canvas.removeEventListener('pointerup',this.up);}
}
