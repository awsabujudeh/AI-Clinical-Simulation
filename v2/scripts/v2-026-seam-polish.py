"""Continue v07: remove donor cuff/collar folds from the exam copy only."""
import bpy,hashlib
from pathlib import Path
from mathutils import Vector
ROOT=Path(r'C:\Projects\AI-Clinical-Simulation')
SOURCE=ROOT/'visual-patient-lab/blender/patient_anaphylaxis_dana_v07.blend'
TARGET=ROOT/'visual-patient-lab/blender/patient_anaphylaxis_dana_v08.blend'
PUBLIC=ROOT/'v2/apps/web/public/visual-patient/dana/review-v01'
bpy.ops.wm.open_mainfile(filepath=str(SOURCE),load_ui=False)
obj=bpy.data.objects['Dana_Exam_Skin'];mesh=obj.data
neighbors=[set() for v in mesh.vertices]
for e in mesh.edges:
 a,b=e.vertices;neighbors[a].add(b);neighbors[b].add(a)
def smooth(a,b,x):
 t=max(0,min(1,(x-a)/(b-a)));return t*t*(3-2*t)
weights=[]
keys=mesh.shape_keys.key_blocks
original=[p.co.copy() for p in keys[0].data]
deltas=[[key.data[i].co-original[i] for i in range(len(original))] for key in keys]
for p in original:
 x,y,z=p
 neck=smooth(133,139,y)*(1-smooth(147,151,y))*(1-smooth(10,17,abs(x)))
 arm=smooth(21,26,abs(x))*(1-smooth(33,39,abs(x)))*smooth(126,132,y)
 weights.append(max(neck,arm))
positions=[p.copy() for p in original]
for _ in range(28):
 positions=[p.lerp(sum((positions[n] for n in neighbors[i]),Vector())/len(neighbors[i]),weights[i]*.38) if weights[i] and neighbors[i] else p.copy() for i,p in enumerate(positions)]
for i,p in enumerate(positions):
 mesh.vertices[i].co=p
 for j,key in enumerate(keys):key.data[i].co=p+deltas[j][i]
mesh.normals_split_custom_set([(0,0,0)]*len(mesh.loops))
obj['repair']='v08 continued v07: relaxed donor cuff/collar folds; retained original facial deltas'
bpy.ops.wm.save_as_mainfile(filepath=str(TARGET))
for item in [bpy.data.objects['Dana_Ch22_Body'],obj,bpy.data.objects['Dana_Ch22_Eyelashes']]:
 for key in item.data.shape_keys.key_blocks:key.value=0
obj.hide_render=False;bpy.data.objects['Dana_Clinical_Exam_Top'].hide_render=False
for image in bpy.data.images:
 if image.has_data and max(image.size)>1024:image.scale(min(image.size[0],1024),min(image.size[1],1024))
bpy.ops.export_scene.gltf(filepath=str(PUBLIC/'dana-review.glb'),export_format='GLB',export_animations=True,export_animation_mode='ACTIVE_ACTIONS',export_cameras=False,export_lights=False,export_extras=True,export_morph=True)
print('GLB_HASH',hashlib.sha256((PUBLIC/'dana-review.glb').read_bytes()).hexdigest())
