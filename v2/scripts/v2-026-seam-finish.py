"""Small surface relaxation of the continued v06 examination body only."""
import bpy,math,hashlib
from pathlib import Path
from mathutils import Vector
ROOT=Path(r'C:\Projects\AI-Clinical-Simulation')
SOURCE=ROOT/'visual-patient-lab/blender/patient_anaphylaxis_dana_v06.blend'
TARGET=ROOT/'visual-patient-lab/blender/patient_anaphylaxis_dana_v07.blend'
PUBLIC=ROOT/'v2/apps/web/public/visual-patient/dana/review-v01'
before=hashlib.sha256(SOURCE.read_bytes()).hexdigest()
bpy.ops.wm.open_mainfile(filepath=str(SOURCE),load_ui=False)
obj=bpy.data.objects['Dana_Exam_Skin'];mesh=obj.data
neighbors=[set() for v in mesh.vertices]
for e in mesh.edges:
 a,b=e.vertices;neighbors[a].add(b);neighbors[b].add(a)
def smooth(a,b,x):
 t=max(0,min(1,(x-a)/(b-a)));return t*t*(3-2*t)
weights=[]
for v in mesh.vertices:
 x,y,z=v.co
 neck=smooth(137,140,y)*(1-smooth(146,149,y))*(1-smooth(8,12,abs(x)))
 arm=smooth(23,27,abs(x))*(1-smooth(32,36,abs(x)))*smooth(129,133,y)
 weights.append(max(neck,arm))
original=[v.co.copy() for v in mesh.vertices];positions=[p.copy() for p in original]
for _ in range(5):
 positions=[p.lerp(sum((positions[n] for n in neighbors[i]),Vector())/len(neighbors[i]),weights[i]*.28) if weights[i] and neighbors[i] else p.copy() for i,p in enumerate(positions)]
for i,p in enumerate(positions):
 delta=p-original[i]
 mesh.vertices[i].co=p
 if mesh.shape_keys:
  for key in mesh.shape_keys.key_blocks:key.data[i].co+=delta
# Shared connected topology supplies the normals, not the donor shirt's custom
# split-normal data. Facial morph deltas remain identical.
mesh.normals_split_custom_set([(0,0,0)]*len(mesh.loops))
for polygon in mesh.polygons:polygon.use_smooth=True
obj['repair']='v07: connected exam surface; local neck/shoulder relaxation; original face morph deltas preserved'
bpy.ops.wm.save_as_mainfile(filepath=str(TARGET))
for item in [bpy.data.objects['Dana_Ch22_Body'],obj,bpy.data.objects['Dana_Ch22_Eyelashes']]:
 for key in item.data.shape_keys.key_blocks:key.value=0
obj.hide_render=False;bpy.data.objects['Dana_Clinical_Exam_Top'].hide_render=False
for image in bpy.data.images:
 if image.has_data and max(image.size)>1024:image.scale(min(image.size[0],1024),min(image.size[1],1024))
bpy.ops.export_scene.gltf(filepath=str(PUBLIC/'dana-review.glb'),export_format='GLB',export_animations=True,export_animation_mode='ACTIVE_ACTIONS',export_cameras=False,export_lights=False,export_extras=True,export_morph=True)
assert hashlib.sha256(SOURCE.read_bytes()).hexdigest()==before
print('GLB_HASH',hashlib.sha256((PUBLIC/'dana-review.glb').read_bytes()).hexdigest())
