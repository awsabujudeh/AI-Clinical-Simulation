import {it,expect} from 'vitest';
// @ts-expect-error existing presentation-only Three runtime is JavaScript
import * as THREE from 'three';
// Asset-specific JS adapter is deliberately separate from clinical contracts.
// @ts-expect-error presentation module has no separate declaration
import {DanaRig} from '../../../apps/web/src/features/visual-patient/runtime/dana-rig.js';
function cameraRig(){
 const rig=Object.create(DanaRig.prototype);
 rig.region='DEFAULT_COVERED';rig.camera=new THREE.PerspectiveCamera();
 rig.orbit={target:new THREE.Vector3(),update:()=>{}};
 rig.cancelFocus=()=>{rig.destination=null;rig.focusFrames=0;};
 return rig;
}
it('Dana autofocus terminates and cannot pull a manually moved camera back',()=>{
 const rig=cameraRig();rig.focus();for(let i=0;i<151;i++)rig.update();
 expect(rig.destination).toBeNull();
 rig.camera.position.set(.8,1.8,1.2);const manual=rig.camera.position.clone();
 for(let i=0;i<200;i++)rig.update();expect(rig.camera.position.equals(manual)).toBe(true);
 rig.focus();rig.cancelFocus();rig.update();expect(rig.camera.position.equals(manual)).toBe(true);
});
it('reset starts one bounded autofocus and safe bounds remain enforced',()=>{
 const rig=cameraRig();rig.focus(true);expect(rig.destination).toBeNull();
 rig.camera.position.set(20,-20,20);rig.update();
 expect(rig.camera.position.toArray()).toEqual([1.4,1.18,1.95]);
 rig.focus();expect(rig.destination).not.toBeNull();
});
it('body-complete chest variant and opaque coverage replace clothing without a second visible body',()=>{
 const rig=Object.create(DanaRig.prototype);
 rig.shirt={visible:true};rig.top={visible:false};rig.examSkin={visible:false};rig.bodyMesh={visible:true};rig.seam={value:0};
 rig.region='CHEST';rig.cover();expect([rig.shirt.visible,rig.top.visible,rig.examSkin.visible]).toEqual([false,true,true]);
 expect(rig.bodyMesh.visible).toBe(false);expect(rig.seam.value).toBe(1);
 rig.region='DEFAULT_COVERED';rig.cover();expect([rig.shirt.visible,rig.top.visible,rig.examSkin.visible]).toEqual([true,false,false]);
 expect(rig.bodyMesh.visible).toBe(true);expect(rig.seam.value).toBe(0);
});
it('exam raycasts include unnamed glTF primitives but never hidden body copies',()=>{
 const rig=Object.create(DanaRig.prototype);rig.examSkin=new THREE.Group();
 const primitive=new THREE.SkinnedMesh();primitive.name='Mesh006_0';rig.examSkin.add(primitive);
 expect(rig.visiblePatientMesh(primitive)).toBe(true);
 rig.examSkin.visible=false;expect(rig.visiblePatientMesh(primitive)).toBe(false);
 const original=new THREE.SkinnedMesh();original.name='Dana_Ch22_Body';original.visible=false;
 expect(rig.visiblePatientMesh(original)).toBe(false);
 const furniture=new THREE.Mesh();furniture.name='Dana mattress';expect(rig.visiblePatientMesh(furniture)).toBe(false);
});
it('seam and rash treatment follows exported examination descendants, preserving ordinary skin',()=>{
 const rig=Object.create(DanaRig.prototype);rig.examSkin=new THREE.Group();rig.rash={value:1};rig.seam={value:1};
 const mesh=new THREE.SkinnedMesh(new THREE.BufferGeometry(),new THREE.MeshStandardMaterial());
 mesh.name='Mesh006_0';mesh.material.name='Ch22_body';
 mesh.geometry.setAttribute('position',new THREE.Float32BufferAttribute([.33,.9,-.46],3));
 mesh.geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute([0,0,0,0],4));
 mesh.geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute([1,0,0,0],4));
 const bone=new THREE.Bone();bone.name='RightArm';mesh.skeleton=new THREE.Skeleton([bone]);
 rig.examSkin.add(mesh);rig.meshes=[mesh];rig.installRash();
 expect(mesh.geometry.getAttribute('danaSeamMask').getX(0)).toBe(1);
 expect(mesh.geometry.getAttribute('danaRashMask').getX(0)).toBe(1);
 const shader={uniforms:{},vertexShader:'#include <common>\n#include <begin_vertex>',fragmentShader:'#include <common>\n#include <color_fragment>\n#include <normal_fragment_maps>\n#include <roughnessmap_fragment>\n#include <metalnessmap_fragment>'};
 mesh.material.onBeforeCompile(shader);
 expect(shader.fragmentShader).toContain('metalnessFactor=mix');
 expect(shader.fragmentShader).toContain('nonPerturbedNormal');
 expect(shader.uniforms).toHaveProperty('danaSeam',rig.seam);
});
