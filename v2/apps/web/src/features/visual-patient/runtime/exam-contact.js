import * as THREE from 'three';
/** A local examination-site chestpiece. Follows the hit triangle's live skinned
 * vertices; never supplies findings, audio, or a clinical action. */
export class ExamContact {
 constructor(canvas,camera,scene,target,enabled){
  Object.assign(this,{canvas,camera,scene,target,enabled});
  this.mesh=new THREE.Mesh(new THREE.CylinderGeometry(.014,.014,.004,24),new THREE.MeshStandardMaterial({color:0x789da8,metalness:.45,roughness:.45}));
  this.mesh.name='Examination_Stethoscope_Contact';this.mesh.visible=false;scene.add(this.mesh);
  this.down=e=>{this.start=[e.clientX,e.clientY];};
  this.up=e=>{
   if(!this.enabled()||!this.start||Math.hypot(e.clientX-this.start[0],e.clientY-this.start[1])>6)return;
   const target=this.target();if(!target)return;
   const r=canvas.getBoundingClientRect(),ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2(2*(e.clientX-r.left)/r.width-1,1-2*(e.clientY-r.top)/r.height),camera);
   const hit=ray.intersectObject(target,true)[0];if(!hit?.face)return;
   // Never draw a skin contact through opaque clothing or bedding.
   const visible=o=>{for(let n=o;n;n=n.parent)if(!n.visible)return false;return true;};
   const front=ray.intersectObject(this.scene,true).find(h=>h.object!==this.mesh&&h.object.isMesh&&visible(h.object)&&h.object.material?.opacity!==0);
   if(front&&front.object!==hit.object&&front.distance<hit.distance-.001)return;
   const surface=hit.object;
   const ids=[hit.face.a,hit.face.b,hit.face.c],vs=ids.map(i=>surface.getVertexPosition(i,new THREE.Vector3()));
   const local=surface.worldToLocal(hit.point.clone()),weights=new THREE.Triangle(...vs).getBarycoord(local,new THREE.Vector3());
   this.contact={surface,ids,weights};this.until=performance.now()+8000;this.update();
  };
  canvas.addEventListener('pointerdown',this.down);canvas.addEventListener('pointerup',this.up);
 }
 update(){
  this.mesh.visible=!!this.contact&&this.enabled()&&performance.now()<this.until;
  if(!this.mesh.visible)return;
  const {surface,ids,weights}=this.contact;
  surface.skeleton?.update();const v=ids.map(i=>surface.localToWorld(surface.getVertexPosition(i,new THREE.Vector3())));
  const normal=new THREE.Triangle(...v).getNormal(new THREE.Vector3());
  if(normal.dot(this.camera.position.clone().sub(v[0]))<0)normal.negate();
  this.mesh.position.copy(v[0]).multiplyScalar(weights.x).addScaledVector(v[1],weights.y).addScaledVector(v[2],weights.z).addScaledVector(normal,.0025);
  this.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),normal);
 }
 dispose(){this.canvas.removeEventListener('pointerdown',this.down);this.canvas.removeEventListener('pointerup',this.up);}
}
