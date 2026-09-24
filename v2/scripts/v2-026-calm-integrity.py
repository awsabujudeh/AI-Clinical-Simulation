"""Read-only v24/v25 exact preservation and bounded calm-cue audit."""
import bpy,json
from pathlib import Path
ROOT=Path(r'C:\Projects\AI-Clinical-Simulation/visual-patient-lab/blender')
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'patient_anaphylaxis_dana_v24.blend'),load_ui=False)
old={}
for o in bpy.context.scene.objects:
 if o.type=='MESH':old[o.name]={'vertices':[tuple(v.co) for v in o.data.vertices],
  'weights':[[(g.group,g.weight) for g in v.groups] for v in o.data.vertices],
  'keys':{k.name:[tuple(v.co) for v in k.data] for k in o.data.shape_keys.key_blocks} if o.data.shape_keys else {}}
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'patient_anaphylaxis_dana_v25.blend'),load_ui=False)
changed={}
for name,data in old.items():
 o=bpy.data.objects[name]
 assert data['vertices']==[tuple(v.co) for v in o.data.vertices],name
 assert data['weights']==[[(g.group,g.weight) for g in v.groups] for v in o.data.vertices],name
 for key,before in data['keys'].items():
  now=o.data.shape_keys.key_blocks[key]
  if key!='Improved_Calm_v01' or name not in ['Dana_Ch22_Body','Dana_BodyComplete_Exam']:
   assert before==[tuple(v.co) for v in now.data],(name,key)
  else:
   count=0
   for v,b,a in zip(o.data.vertices,before,now.data):
    if tuple(a.co)!=b:
     count+=1;assert 152<v.co.y<161;assert abs(v.co.x)<10
    assert (a.co-v.co).length<.6
   assert count>100;changed[name]=count
assert len([o for o in bpy.context.scene.objects if o.type=='ARMATURE'])==1
print('PASS_CALM_INTEGRITY',json.dumps({'mesh_count':len(old),'basis_and_weights_exact':True,'all_other_keys_exact':True,'calm_only_changed':changed,'one_rig':True}))
