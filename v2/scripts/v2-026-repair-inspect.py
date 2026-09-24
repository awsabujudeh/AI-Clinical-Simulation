import bpy,json
from mathutils import Vector
bpy.ops.wm.open_mainfile(filepath=r'C:\Projects\AI-Clinical-Simulation\visual-patient-lab\blender\patient_anaphylaxis_dana_v03.blend',load_ui=False)
for o in bpy.context.scene.objects:
 if o.type=='MESH':
  e=o.evaluated_get(bpy.context.evaluated_depsgraph_get()); pts=[e.matrix_world@Vector(p) for p in e.bound_box]
  print('OBJECT',o.name,'bounds',[[round(f(p[i] for p in pts),3) for i in range(3)] for f in [min,max]],'groups', [c.name for c in o.users_collection])
body=bpy.data.objects['Dana_Ch22_Body']
print('BODY_LOCAL',[[min(v.co[i] for v in body.data.vertices),max(v.co[i] for v in body.data.vertices)] for i in range(3)])
rig=bpy.data.objects['Dana_Mixamo_Rig']
for b in rig.pose.bones:
 if any(b.name.endswith(':'+s) for s in ['Hips','Spine','Spine2','Head','LeftArm','LeftForeArm','LeftHand','RightArm','RightForeArm','RightHand','LeftUpLeg','LeftLeg','LeftFoot']):print('BONE',b.name,list(rig.matrix_world@b.head),list(rig.matrix_world@b.tail))
for y in range(95,151,5):
 pts=[v.co for v in body.data.vertices if y<=v.co.y<y+5 and abs(v.co.x)<17]
 print('TORSO_BAND',y,len(pts),[(min(p[i] for p in pts),max(p[i] for p in pts)) for i in [0,2]] if pts else [])
with bpy.data.libraries.load(r'C:\Projects\AI-Clinical-Simulation\visual-patient-lab\blender\patient_anaphylaxis_dana_v01.blend') as (src,dst):
 print('SOURCE_COLLECTIONS',src.collections)
