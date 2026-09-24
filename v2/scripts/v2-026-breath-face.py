"""Independent v24: bounded thoracic excursion and modest expression readability.
v23, source identity/geometry, coverage, bedding and all STEMI files preserved.
"""
import bpy,math,hashlib,json
from pathlib import Path
from mathutils import Vector
ROOT=Path(r'C:\Projects\AI-Clinical-Simulation')
source=ROOT/'visual-patient-lab/blender/patient_anaphylaxis_dana_v23.blend'
target=ROOT/'visual-patient-lab/blender/patient_anaphylaxis_dana_v24.blend'
assert not target.exists()
before=hashlib.sha256(source.read_bytes()).hexdigest()
bpy.ops.wm.open_mainfile(filepath=str(source),load_ui=False)
def smooth(a,b,x):
 t=max(0,min(1,(x-a)/(b-a)));return t*t*(3-2*t)
report={}
for name in ['Dana_BodyComplete_Exam','Dana_Ch22_Shirt','Dana_Clinical_Bra']:
 o=bpy.data.objects[name]
 if not o.data.shape_keys:o.shape_key_add(name='Basis')
 for key in o.data.shape_keys.key_blocks:key.value=0
 key=o.shape_key_add(name='Thoracic_Breath',from_mix=False)
 deltas=[]
 for v,k in zip(o.data.vertices,key.data):
  x,y,z=v.co;k.co=v.co.copy()
  band=smooth(115,122,y)*(1-smooth(135,143,y))
  front=smooth(0,8,z);side=1-smooth(9,16,abs(x))
  k.co.z+=.90*band*side*front
  k.co.x+=math.copysign(.20*band*smooth(3,9,abs(x))*(1-smooth(12,16,abs(x)))*smooth(-2,5,z),x)
  deltas.append((k.co-v.co).length)
 assert max(deltas)<.93
 o['thoracic_excursion']='up to 9 mm anterior / 2 mm lateral; same field on skin and coverage; rendering only'
 report[name]={'max_delta_cm':max(deltas),'changed_vertices':sum(d>1e-6 for d in deltas)}
for name in ['Dana_Ch22_Body','Dana_BodyComplete_Exam']:
 o=bpy.data.objects[name]
 for key_name,gain in [('Anxious_Foundation_v01',1.30),('Improved_Calm_v01',1.60)]:
  key=o.data.shape_keys.key_blocks[key_name]
  for v,k in zip(o.data.vertices,key.data):k.co=v.co+(k.co-v.co)*gain
  assert max((k.co-v.co).length for v,k in zip(o.data.vertices,key.data))<.6
for name in ['Dana_Ch22_Body','Dana_BodyComplete_Exam','Dana_Ch22_Eyelashes','Dana_Ch22_Shirt','Dana_Clinical_Bra']:
 for key in bpy.data.objects[name].data.shape_keys.key_blocks:key.value=0
bpy.ops.wm.save_as_mainfile(filepath=str(target))
for name in ['Dana_BodyComplete_Exam','Dana_Clinical_Bra']:bpy.data.objects[name].hide_render=False
for image in bpy.data.images:
 if image.has_data and max(image.size)>1024:image.scale(min(image.size[0],1024),min(image.size[1],1024))
out=ROOT/'v2/apps/web/public/visual-patient/dana/review-v01/dana-review.glb'
bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',export_animations=True,export_animation_mode='ACTIVE_ACTIONS',export_cameras=False,export_lights=False,export_extras=True,export_morph=True,export_vertex_color='MATERIAL',export_all_vertex_colors=False)
assert hashlib.sha256(source.read_bytes()).hexdigest()==before
print('BREATH_FACE_EXPORT',json.dumps({'blend':str(target),'source_preserved_sha256':before,'thoracic':report,'glb_sha256':hashlib.sha256(out.read_bytes()).hexdigest()}))
