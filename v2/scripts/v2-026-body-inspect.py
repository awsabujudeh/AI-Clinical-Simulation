"""Read-only anatomy/material inspection for the owner-authorized exam body."""
import bpy,bmesh,json
from mathutils import Vector
from pathlib import Path
ROOT=Path(r'C:\Projects\AI-Clinical-Simulation')
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'visual-patient-lab/blender/patient_anaphylaxis_dana_v14.blend'),load_ui=False)
for name in ['Dana_Ch22_Body','Dana_Ch22_Shirt','Dana_Ch22_Pants']:
 o=bpy.data.objects[name]
 print('OBJECT',name,'matrix',list(map(list,o.matrix_world)))
 for y in range(100,151,4):
  p=[v.co for v in o.data.vertices if y<=v.co.y<y+4 and abs(v.co.x)<20]
  if p:print('BAND',y,[(round(min(v[i] for v in p),2),round(max(v[i] for v in p),2)) for i in [0,2]])
 if name=='Dana_Ch22_Body':
  bm=bmesh.new();bm.from_mesh(o.data);edges={e for e in bm.edges if e.is_boundary}
  while edges:
   e=edges.pop();part=set(e.verts);todo=list(part)
   while todo:
    for n in todo.pop().link_edges:
     if n in edges:edges.remove(n);part.update(n.verts);todo.extend(n.verts)
   print('BOUNDARY',len(part),[(round(min(v.co[i] for v in part),3),round(max(v.co[i] for v in part),3)) for i in range(3)])
  bm.free()
 print('MATERIALS',[(m.name,[(n.name,n.image.name if n.type=='TEX_IMAGE' and n.image else '') for n in m.node_tree.nodes]) for m in o.data.materials])
for o in bpy.context.scene.objects:
 if o.type=='MESH' and any(s in o.name.lower() for s in ['bed','sheet','mattress','pillow','blanket']):print('BED',o.name,[m.name for m in o.data.materials])
for b in bpy.data.objects['Dana_Mixamo_Rig'].data.bones:
 if b.name.split(':')[-1] in ['Neck','Head','Spine','Spine1','Spine2','LeftShoulder','LeftArm','LeftForeArm','LeftHand']:print('RESTBONE',b.name,tuple(b.head_local),tuple(b.tail_local))
# Source material/configuration is inspected, never saved.
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'visual-patient-lab/blender/patient_stemi_physical_exam_runtime_v02.blend'),load_ui=False)
for o in bpy.context.scene.objects:
 if o.type=='MESH' and any(s in o.name.lower() for s in ['bed','sheet','mattress','pillow','blanket']):
  print('STEMI_BED',o.name,[m.name for m in o.data.materials])
  for m in o.data.materials:
   if m.use_nodes:
    p=next((n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None)
    if p:print('STEMI_MATERIAL',m.name,tuple(p.inputs['Base Color'].default_value),p.inputs['Roughness'].default_value)
