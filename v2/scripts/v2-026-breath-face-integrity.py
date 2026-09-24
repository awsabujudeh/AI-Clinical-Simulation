"""Read-only v23/v24 geometry, facial isolation and thoracic morph audit."""
import bpy,json,math
from pathlib import Path
ROOT=Path(r'C:\Projects\AI-Clinical-Simulation')
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'visual-patient-lab/blender/patient_anaphylaxis_dana_v23.blend'),load_ui=False)
names=['Dana_Ch22_Body','Dana_BodyComplete_Exam','Dana_Ch22_Shirt','Dana_Clinical_Bra','Dana_Ch22_Eyelashes','Dana_Ch22_Hair','Dana_Ch22_Pants','Dana_Ch22_Sneakers','Dana mattress fitted sheet','Dana pillow','Dana lower-body blanket']
old={n:[v.co.copy() for v in bpy.data.objects[n].data.vertices] for n in names}
keys={n:{k.name:[v.co.copy() for v in k.data] for k in bpy.data.objects[n].data.shape_keys.key_blocks} for n in names if bpy.data.objects[n].data.shape_keys}
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'visual-patient-lab/blender/patient_anaphylaxis_dana_v24.blend'),load_ui=False)
for n,coords in old.items():assert [tuple(v.co) for v in bpy.data.objects[n].data.vertices]==[tuple(v) for v in coords],n
for n,shapes in keys.items():
 o=bpy.data.objects[n]
 for name,coords in shapes.items():
  gain={'Anxious_Foundation_v01':1.30,'Improved_Calm_v01':1.60}.get(name,1) if n!='Dana_Ch22_Eyelashes' else 1
  for base,before,after in zip(old[n],coords,o.data.shape_keys.key_blocks[name].data):
   assert (after.co-(base+(before-base)*gain)).length<.00003,(n,name)
report={}
for n in ['Dana_BodyComplete_Exam','Dana_Ch22_Shirt','Dana_Clinical_Bra']:
 o=bpy.data.objects[n];shape=o.data.shape_keys.key_blocks['Thoracic_Breath'];peak=0
 for v,k in zip(o.data.vertices,shape.data):
  length=(v.co-k.co).length;peak=max(peak,length);assert math.isfinite(length) and length<.93
  if v.co.y>=143 or v.co.y<=115 or abs(v.co.x)>=16:assert length<.00003
 assert peak>.80;report[n]=peak
assert len([o for o in bpy.context.scene.objects if o.type=='ARMATURE'])==1
print('PASS_BREATH_FACE_INTEGRITY',json.dumps({'basis_all_unchanged':names,'blink_speech_lip_shapes_exact':True,'bounded_expression_gain':True,'thoracic_peak_cm':report,'face_neck_abdomen_seams_excluded':True,'one_rig':True}))
