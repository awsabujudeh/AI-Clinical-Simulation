"""Continue v11: map underlayer strap weights by bone name, not group index."""
import bpy,bmesh,math,hashlib
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
ROOT=Path(r'C:\Projects\AI-Clinical-Simulation')
TARGET=ROOT/'visual-patient-lab/blender/patient_anaphylaxis_dana_v12.blend'
if TARGET.exists():raise RuntimeError('Preserve existing candidate')
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'visual-patient-lab/blender/patient_anaphylaxis_dana_v11.blend'),load_ui=False)
skin=bpy.data.objects['Dana_Exam_Skin'];top=bpy.data.objects['Dana_Clinical_Exam_Top']
bm=bmesh.new();bm.from_mesh(top.data)
remaining=set(bm.verts);parts=[]
while remaining:
 v=remaining.pop();part={v};todo=[v]
 while todo:
  for e in todo.pop().link_edges:
   for n in e.verts:
    if n in remaining:remaining.remove(n);part.add(n);todo.append(n)
 parts.append(part)
remove=[v for p in parts if len(p)==58 for v in p]
assert len(remove)==116,'Only two v11 straps may be replaced'
bmesh.ops.delete(bm,geom=remove,context='VERTS')
sb=bmesh.new();sb.from_mesh(skin.data);sb.normal_update();sb.faces.ensure_lookup_table();tree=BVHTree.FromBMesh(sb)
sd=sb.verts.layers.deform.active;td=bm.verts.layers.deform.verify()
mapping={g.index:top.vertex_groups[g.name].index for g in skin.vertex_groups if g.name in top.vertex_groups}
for sign in [-1,1]:
 strip=[]
 for i in range(37):
  theta=math.pi*i/36;y=130+14*math.sin(theta);z=2+10.5*math.cos(theta);row=[]
  for side in [-1,1]:
   near,normal,face_id,_=tree.find_nearest(Vector((sign*(10.3+side*1.3),y,z)))
   v=bm.verts.new(near+normal*.18);face=sb.faces[face_id]
   nearest=min(face.verts,key=lambda q:(q.co-near).length)
   weights={mapping[g]:w for g,w in nearest[sd].items() if g in mapping};total=sum(weights.values())
   for g,w in weights.items():v[td][g]=w/total
   row.append(v)
  strip.append(row)
 for a,b in zip(strip,strip[1:]):
  f=bm.faces.new((a[0],a[1],b[1],b[0]));f.smooth=True
bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(top.data);bm.free();sb.free()
top.data.materials[0].use_backface_culling=False
skin['micro_finish_version']=12
bpy.ops.wm.save_as_mainfile(filepath=str(TARGET))
for item in [bpy.data.objects['Dana_Ch22_Body'],skin,bpy.data.objects['Dana_Ch22_Eyelashes']]:
 for key in item.data.shape_keys.key_blocks:key.value=0
skin.hide_render=False;top.hide_render=False
for image in bpy.data.images:
 if image.has_data and max(image.size)>1024:image.scale(min(image.size[0],1024),min(image.size[1],1024))
out=ROOT/'v2/apps/web/public/visual-patient/dana/review-v01/dana-review.glb'
bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',export_animations=True,export_animation_mode='ACTIVE_ACTIONS',export_cameras=False,export_lights=False,export_extras=True,export_morph=True)
print('GLB_HASH',hashlib.sha256(out.read_bytes()).hexdigest())
