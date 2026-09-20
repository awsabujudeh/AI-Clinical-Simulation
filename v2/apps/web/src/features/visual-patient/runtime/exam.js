import * as THREE from 'three';
export class PhysicalExamController {
 constructor(context){
  Object.assign(this,context);this.meta=this.manifest.physical_exam;this.region='DEFAULT_COVERED';this.tool=null;this.debug=false;this.lastRequest=null;this.requests=[];this.markerAnchor=null;this.markerUntil=0;this.previousPosition='semi_fowler';this.targets=[];this.raycaster=new THREE.Raycaster();this.pointer=new THREE.Vector2();
  this.body=this.nodes.Patient_AdultMale_Body;this.bodyMesh=null;this.body.traverse(o=>{if(o.isSkinnedMesh)this.bodyMesh=o;});
  const allowed=this.living.allowed.bind(this.living);this.living.allowed=()=>this.state.mode==='conversation'&&allowed();
  this.group=new THREE.Group();this.group.name='Visual_Exam_Interaction_Proxies';this.scene.add(this.group);
  const geometry=new THREE.SphereGeometry(1,12,8);
  for(const [id,a] of Object.entries(this.meta.anchors)){
   if(!this.nodes[id]||!this.nodes[a.surface_mesh])throw Error('Missing actual exam object '+id);
   const material=new THREE.MeshBasicMaterial({color:a.region_id==='EYES'?0xf5c76c:0x23bcb1,transparent:true,opacity:0,depthWrite:false,depthTest:false});
   const mesh=new THREE.Mesh(geometry,material);mesh.name='Visual_Target_'+id;mesh.scale.setScalar(a.radius_m);mesh.userData.anchorId=id;mesh.renderOrder=15;this.group.add(mesh);this.targets.push(mesh);
  }
  this.marker=new THREE.Mesh(new THREE.TorusGeometry(.012,.0018,6,24),new THREE.MeshBasicMaterial({color:0xffdc7e,depthTest:false,transparent:true,opacity:.95}));this.marker.renderOrder=20;this.marker.visible=false;this.scene.add(this.marker);
  this.downHandler=e=>this.down=[e.clientX,e.clientY];
  this.upHandler=e=>{if(this.down&&Math.hypot(e.clientX-this.down[0],e.clientY-this.down[1])<6)this.click(e);this.down=null;};
  this.moveHandler=e=>this.hover(e);
  this.canvas.addEventListener('pointerdown',this.downHandler);this.canvas.addEventListener('pointerup',this.upHandler);this.canvas.addEventListener('pointermove',this.moveHandler);
 }
 enter(){
  if(this.state.mode==='physical_exam')return;
  this.previousPosition=this.state.position;this.state.mode='physical_exam';this.region='DEFAULT_COVERED';this.tool='inspection';this.living.request('toRest',{source:'state'});this.setPosition('supine');this.markerAnchor=null;this.setCamera('Exam_Overview');
 }
 exit(){
  if(this.state.mode!=='physical_exam')return;
  this.region='DEFAULT_COVERED';this.tool=null;this.markerAnchor=null;this.debug=false;this.state.mode='conversation';
  this.setPosition(this.previousPosition);if(this.living.allowed())this.living.request('toChest',{source:'state'});this.setCamera('Camera_Student_Primary');
 }
 selectRegion(region){
  if(this.state.mode!=='physical_exam'||!Object.hasOwn(this.meta.regions,region))return false;
  this.region=region;this.markerAnchor=null;if(this.tool==='penlight')this.tool='inspection';this.setCamera(({DEFAULT_COVERED:'Exam_Overview',CHEST:'Exam_Chest_Review',ABDOMEN:'Exam_Abdomen_Review',LEFT_ARM:'Exam_LeftArm_Review',RIGHT_ARM:'Exam_RightArm_Review',LOWER_LEGS:'Exam_LowerLegs_Review'})[region]);return true;
 }
 setTool(tool){
  if(this.state.mode!=='physical_exam'||!Object.hasOwn(this.meta.tools,tool))return false;
  this.tool=tool;this.markerAnchor=null;
  if(tool==='penlight'){this.region='DEFAULT_COVERED';this.setCamera('Face_Gaze_Review');}
  return true;
 }
 eligible(a){
  if(this.state.mode!=='physical_exam'||!this.tool||this.positionMix()<.999)return false;
  if(!a.tools.includes(this.tool))return false;
  if(this.tool==='penlight')return a.region_id===this.meta.eye_region;
  const ids=this.meta.regions[this.region].region_ids;
  return ids.includes(a.region_id)&&(this.tool!=='inspection'||a.kind==='interaction_region');
 }
 point(id){
  const a=this.meta.anchors[id],v=new THREE.Vector3();this.bodyMesh.getVertexPosition(a.surface_vertex,v);return this.bodyMesh.localToWorld(v);
 }
 apply(t){
  const reveal=this.meta.regions[this.region].reveal;
  for(const [name,presets] of Object.entries(this.meta.managed_garments))this.nodes[name].visible=presets.includes(reveal);
  for(const [name,sets] of Object.entries(this.meta.linen_morphs)){
   const keys=new Set(Object.values(sets).flatMap(x=>Object.keys(x)));for(const k of keys)this.morph(k,sets[reveal]?.[k]||0,this.nodes[name]);
  }
  const breath=this.bodyMesh.morphTargetInfluences[this.bodyMesh.morphTargetDictionary.Breathing_ThoracicExpansion]||0;
  for(const name of this.meta.folded_objects)this.nodes[name].traverse(o=>{if(o.morphTargetDictionary?.Breathing_ThoracicExpansion!==undefined)o.morphTargetInfluences[o.morphTargetDictionary.Breathing_ThoracicExpansion]=breath;});
  this.scene.updateMatrixWorld(true);this.bodyMesh.skeleton.update();
  for(const mesh of this.targets){const a=this.meta.anchors[mesh.userData.anchorId];mesh.position.copy(this.point(mesh.userData.anchorId));mesh.material.opacity=this.debug&&this.state.mode==='physical_exam'?(this.eligible(a)?.65:.18):0;}
  this.marker.visible=!!this.markerAnchor&&t<this.markerUntil&&this.state.mode==='physical_exam';
  if(this.marker.visible){this.marker.position.copy(this.point(this.markerAnchor));this.marker.quaternion.copy(this.camera.quaternion);}
 }
 hit(e){
  const rect=this.canvas.getBoundingClientRect();this.pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);this.raycaster.setFromCamera(this.pointer,this.camera);
  const candidates=this.targets.filter(o=>this.eligible(this.meta.anchors[o.userData.anchorId]));return this.raycaster.intersectObjects(candidates,false)[0]?.object.userData.anchorId||null;
 }
 hover(e){this.canvas.style.cursor=this.state.mode==='physical_exam'?(this.hit(e)?'crosshair':'default'):'grab';}

 click(e){
  const id=this.hit(e);if(!id)return false;const a=this.meta.anchors[id];
  const event={type:'visual_exam_request',exam_mode:this.meta.tools[this.tool].exam_mode,tool:this.tool,region_id:a.region_id,anchor_id:id,patient_position:this.state.position};
  this.lastRequest=event;this.requests.push(event);this.markerAnchor=id;this.markerUntil=this.now()+3;this.onRequest(structuredClone(event));return true;
 }
 dispose(){this.canvas.removeEventListener('pointerdown',this.downHandler);this.canvas.removeEventListener('pointerup',this.upHandler);this.canvas.removeEventListener('pointermove',this.moveHandler);}

 stats(){return{mode:this.state.mode,region:this.region,tool:this.tool,lastRequest:this.lastRequest,requestCount:this.requests.length,debug:this.debug,visibleGarments:Object.keys(this.meta.managed_garments).filter(n=>this.nodes[n].visible)};}
}
