"""Continue v13 without modifying patient geometry: fit lower-leg bed cover.
No torso reconstruction. Prior Dana and STEMI work is read-only.
"""
import bpy, math, hashlib
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
ROOT=Path(r'C:\Projects\AI-Clinical-Simulation')
source=ROOT/'visual-patient-lab/blender/patient_anaphylaxis_dana_v13.blend'
target=ROOT/'visual-patient-lab/blender/patient_anaphylaxis_dana_v14.blend'
assert not target.exists(), 'Preserve prior working files'
before=hashlib.sha256(source.read_bytes()).hexdigest()
bpy.ops.wm.open_mainfile(filepath=str(source),load_ui=False)
bpy.context.scene.frame_set(1);bpy.context.view_layer.update()
dg=bpy.context.evaluated_depsgraph_get();verts=[];faces=[]
for name in ['Dana_Ch22_Pants','Dana_Ch22_Sneakers']:
 o=bpy.data.objects[name].evaluated_get(dg);mesh=o.to_mesh();offset=len(verts)
 verts.extend(o.matrix_world@v.co for v in mesh.vertices)
 faces.extend(tuple(i+offset for i in p.vertices) for p in mesh.polygons);o.to_mesh_clear()
tree=BVHTree.FromPolygons(verts,faces)
old=bpy.data.objects.get('Dana lower-body blanket')
if old:bpy.data.objects.remove(old,do_unlink=True)
vs=[];fs=[];nx=40;ny=70
for j in range(ny+1):
 y=-.85+.58*j/ny
 for i in range(nx+1):
  x=-.46+.92*i/nx
  # Raycast the existing clothed patient only; no donor-body impression.
  hit,_,_,_=tree.ray_cast(Vector((x,y,2.2)),Vector((0,0,-1)),2.0)
  z=max(.78,(hit.z+.025) if hit else .78)
  vs.append(Vector((x,y,z)))
# Cloth spans between legs rather than wrapping each individual leg contour.
for j in range(ny+1):
 center=max(vs[j*(nx+1)+i].z for i in range(8,nx-7))
 for i in range(nx+1):
  v=vs[j*(nx+1)+i];w=max(0,1-(abs(v.x)/.46)**4)
  v.z=max(v.z,.77+(center-.77)*w)
for j in range(ny):
 for i in range(nx):
  a=j*(nx+1)+i;fs.append((a,a+1,a+nx+2,a+nx+1))
data=bpy.data.meshes.new('Dana fitted lower-body cover');data.from_pydata(vs,[],fs);data.update()
cover=bpy.data.objects.new('Dana lower-body blanket',data);bpy.context.scene.collection.objects.link(cover)
mat=bpy.data.materials.new('Shared ED blue linen / Dana fit');mat.use_nodes=True
p=mat.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(.11,.27,.39,1);p.inputs['Roughness'].default_value=.95
cover.data.materials.append(mat)
for p in data.polygons:p.use_smooth=True
sub=cover.modifiers.new('Soft linen','SUBSURF');sub.levels=1
solid=cover.modifiers.new('Opaque cover','SOLIDIFY');solid.thickness=.004
bpy.ops.wm.save_as_mainfile(filepath=str(target))
for name in ['Dana_Ch22_Body','Dana_Exam_Skin','Dana_Ch22_Eyelashes']:
 o=bpy.data.objects[name]
 for key in o.data.shape_keys.key_blocks:key.value=0
for name in ['Dana_Exam_Skin','Dana_Clinical_Exam_Top']:bpy.data.objects[name].hide_render=False
for image in bpy.data.images:
 if image.has_data and max(image.size)>1024:image.scale(min(image.size[0],1024),min(image.size[1],1024))
output=ROOT/'v2/apps/web/public/visual-patient/dana/review-v01/dana-review.glb'
bpy.ops.export_scene.gltf(filepath=str(output),export_format='GLB',export_animations=True,export_animation_mode='ACTIVE_ACTIONS',export_cameras=False,export_lights=False,export_extras=True,export_morph=True)
assert hashlib.sha256(source.read_bytes()).hexdigest()==before
print('DANA_V14_HASH',hashlib.sha256(output.read_bytes()).hexdigest())
