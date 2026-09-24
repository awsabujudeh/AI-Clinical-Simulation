"""Continue v09: regularize residual clothing-derived cuff/collar contours."""
import bpy,math,hashlib
from pathlib import Path
from mathutils import Vector
ROOT=Path(r'C:\Projects\AI-Clinical-Simulation')
SOURCE=ROOT/'visual-patient-lab/blender/patient_anaphylaxis_dana_v09.blend'
TARGET=ROOT/'visual-patient-lab/blender/patient_anaphylaxis_dana_v10.blend'
PUBLIC=ROOT/'v2/apps/web/public/visual-patient/dana/review-v01'
bpy.ops.wm.open_mainfile(filepath=str(SOURCE),load_ui=False)
obj=bpy.data.objects['Dana_Exam_Skin'];mesh=obj.data;keys=mesh.shape_keys.key_blocks
def smooth(a,b,x):
 t=max(0,min(1,(x-a)/(b-a)));return t*t*(3-2*t)
original=[v.co.copy() for v in keys[0].data]
deltas=[[key.data[i].co-original[i] for i in range(len(original))] for key in keys]
for i,p in enumerate(original):
 x,y,z=p;out=p.copy()
 neck=smooth(135,139,y)*(1-smooth(146,151,y))*(1-smooth(8,12,abs(x)))
 if neck:
  t=max(0,min(1,(y-137)/10));rx=10.5*(1-t)+5.3*t;rz=5.9*(1-t)+4.5*t;cz=.2+1.1*t
  angle=math.atan2((z-cz)/rz,x/rx)
  target=Vector((rx*math.cos(angle),y,cz+rz*math.sin(angle)))
  out=out.lerp(target,neck*.9)
 arm=smooth(23,28,abs(x))*(1-smooth(33,38,abs(x)))*smooth(128,133,y)
 if arm:
  angle=math.atan2((z+1.5)/4.1,(y-138)/4.15)
  target=Vector((x,138+4.15*math.cos(angle),-1.5+4.1*math.sin(angle)))
  out=out.lerp(target,arm*.9)
 mesh.vertices[i].co=out
 for j,key in enumerate(keys):key.data[i].co=out+deltas[j][i]
mesh.normals_split_custom_set([(0,0,0)]*len(mesh.loops))
obj['repair']='v10: connected exam-only skin, regularized cuff/collar contour, facial deltas retained'
bpy.ops.wm.save_as_mainfile(filepath=str(TARGET))
for item in [bpy.data.objects['Dana_Ch22_Body'],obj,bpy.data.objects['Dana_Ch22_Eyelashes']]:
 for key in item.data.shape_keys.key_blocks:key.value=0
obj.hide_render=False;bpy.data.objects['Dana_Clinical_Exam_Top'].hide_render=False
for image in bpy.data.images:
 if image.has_data and max(image.size)>1024:image.scale(min(image.size[0],1024),min(image.size[1],1024))
bpy.ops.export_scene.gltf(filepath=str(PUBLIC/'dana-review.glb'),export_format='GLB',export_animations=True,export_animation_mode='ACTIVE_ACTIONS',export_cameras=False,export_lights=False,export_extras=True,export_morph=True)
print('GLB_HASH',hashlib.sha256((PUBLIC/'dana-review.glb').read_bytes()).hexdigest())
