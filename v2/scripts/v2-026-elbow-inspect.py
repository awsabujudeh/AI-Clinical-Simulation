"""Read-only Dana v24 elbow bind/weight inspection."""
import bpy,json
from pathlib import Path
bpy.ops.wm.open_mainfile(filepath=str(Path(r'C:\Projects\AI-Clinical-Simulation/visual-patient-lab/blender/patient_anaphylaxis_dana_v24.blend')),load_ui=False)
rig=bpy.data.objects['Dana_Mixamo_Rig'];o=bpy.data.objects['Dana_Ch22_Body']
transform=o.matrix_world.inverted()@rig.matrix_world
for name in ['LeftArm','LeftForeArm','LeftHand']:
 b=next(b for b in rig.data.bones if b.name.endswith(':'+name))
 print('BONE',name,tuple(transform@b.head_local),tuple(transform@b.tail_local))
elbow=transform@next(b for b in rig.data.bones if b.name.endswith(':LeftForeArm')).head_local
groups={g.index:g.name for g in o.vertex_groups}
rows=[]
for v in o.data.vertices:
 if (v.co-elbow).length<7:
  rows.append({'co':tuple(round(a,3) for a in v.co),'weights':{groups[g.group]:round(g.weight,3) for g in v.groups if g.weight>.01}})
print('ELBOW',json.dumps(rows[::max(1,len(rows)//35)]));print('ELBOW_VERTICES',len(rows))
