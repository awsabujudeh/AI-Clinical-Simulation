"""Read-only current bedding/source geometry inspection; never saves a blend."""
import bpy,json
from pathlib import Path
from mathutils import Vector
ROOT=Path(r'C:\Projects\AI-Clinical-Simulation')
for filename in ['patient_anaphylaxis_dana_v20.blend']:
 bpy.ops.wm.open_mainfile(filepath=str(ROOT/'visual-patient-lab/blender'/filename),load_ui=False)
 print('SOURCE',filename)
 for o in bpy.context.scene.objects:
  if o.type!='MESH' or not any(s in o.name.lower() for s in ['backrest','sheet','pillow','mattress']):continue
  deps=bpy.context.evaluated_depsgraph_get();ev=o.evaluated_get(deps);mesh=ev.to_mesh()
  points=[o.matrix_world@v.co for v in mesh.vertices]
  print('BED',json.dumps({'name':o.name,'parent':o.parent.name if o.parent else None,'bounds':[[round(min(p[i] for p in points),4),round(max(p[i] for p in points),4)] for i in range(3)],'vertices':len(points),'materials':[m.name for m in o.data.materials],'matrix':list(map(list,o.matrix_world)),'modifiers':[m.type for m in o.modifiers]}))
  ev.to_mesh_clear()
  print('TRANSFORM_BINDINGS',o.name,'animation',bool(o.animation_data),'constraints',[(c.name,c.type) for c in o.constraints])
 o=bpy.data.objects['Dana_Ch22_Body'];deps=bpy.context.evaluated_depsgraph_get();mesh=o.evaluated_get(deps).to_mesh()
 points=[o.matrix_world@v.co for v,original in zip(mesh.vertices,o.data.vertices) if original.co.y>151]
 print('HEAD_BOUNDS',[[min(p[i] for p in points),max(p[i] for p in points)] for i in range(3)])
 for name in ['Dana_Ch22_Pants','Dana_BodyComplete_Exam','Dana_Clinical_Bra']:
  o=bpy.data.objects[name]
  for y in range(110,134,2):
   points=[v.co for v in o.data.vertices if y<v.co.y<y+2 and abs(v.co.x)<1.5 and v.co.z>4]
   if points:print('FRONT_BAND',name,y,[[round(min(p[i] for p in points),3),round(max(p[i] for p in points),3)] for i in range(3)])
