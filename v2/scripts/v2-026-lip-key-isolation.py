"""Continue v17: isolate swelling from any Blender editor expression mix."""
import bpy,math,hashlib,json
from pathlib import Path
ROOT=Path(r'C:\Projects\AI-Clinical-Simulation')
source=ROOT/'visual-patient-lab/blender/patient_anaphylaxis_dana_v17.blend'
target=ROOT/'visual-patient-lab/blender/patient_anaphylaxis_dana_v18.blend'
assert not target.exists()
before=hashlib.sha256(source.read_bytes()).hexdigest()
bpy.ops.wm.open_mainfile(filepath=str(source),load_ui=False)
def smooth(a,b,x):
 t=max(0,min(1,(x-a)/(b-a)));return t*t*(3-2*t)
for name in ['Dana_Ch22_Body','Dana_BodyComplete_Exam','Dana_Ch22_Eyelashes']:
 obj=bpy.data.objects[name];key=obj.data.shape_keys.key_blocks['Lip_Swelling_Mild']
 for v,dst in zip(obj.data.vertices,key.data):
  dst.co=v.co.copy();x,y,z=v.co
  if name.endswith('Eyelashes') or not (153.7<y<158.1 and abs(x)<3.2 and z>13.1):continue
  mask=math.exp(-(x/2.4)**4-((y-156)/1.0)**4)*smooth(13.1,14,z)
  dst.co.z+=.28*mask;dst.co.y+=(y-156)*.24*mask;dst.co.x+=x*.055*mask
 for key in obj.data.shape_keys.key_blocks:key.value=0
bpy.ops.wm.save_as_mainfile(filepath=str(target))
for name in ['Dana_BodyComplete_Exam','Dana_Clinical_Bra']:bpy.data.objects[name].hide_render=False
for image in bpy.data.images:
 if image.has_data and max(image.size)>1024:image.scale(min(image.size[0],1024),min(image.size[1],1024))
out=ROOT/'v2/apps/web/public/visual-patient/dana/review-v01/dana-review.glb'
bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',export_animations=True,export_animation_mode='ACTIVE_ACTIONS',export_cameras=False,export_lights=False,export_extras=True,export_morph=True)
assert hashlib.sha256(source.read_bytes()).hexdigest()==before
print('FINAL_EXPORT',json.dumps({'source_sha256':before,'blend':str(target),'glb_sha256':hashlib.sha256(out.read_bytes()).hexdigest()}))
