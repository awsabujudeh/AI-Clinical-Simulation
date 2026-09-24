"""Continue v16: give reused shared linen materials valid surface UVs."""
import bpy,hashlib,json
from pathlib import Path
ROOT=Path(r'C:\Projects\AI-Clinical-Simulation')
source=ROOT/'visual-patient-lab/blender/patient_anaphylaxis_dana_v16.blend'
target=ROOT/'visual-patient-lab/blender/patient_anaphylaxis_dana_v17.blend'
assert not target.exists()
before=hashlib.sha256(source.read_bytes()).hexdigest()
bpy.ops.wm.open_mainfile(filepath=str(source),load_ui=False)
for name in ['Dana mattress fitted sheet','Dana pillow','Dana lower-body blanket']:
 obj=bpy.data.objects[name]
 uv=obj.data.uv_layers.active or obj.data.uv_layers.new(name='UVMap')
 for loop in obj.data.loops:
  p=obj.matrix_world@obj.data.vertices[loop.vertex_index].co
  uv.data[loop.index].uv=(p.x/.5,p.y/.5)
 obj['shared_linen_uv']=True
bpy.ops.wm.save_as_mainfile(filepath=str(target))
for name in ['Dana_Ch22_Body','Dana_BodyComplete_Exam','Dana_Ch22_Eyelashes']:
 for key in bpy.data.objects[name].data.shape_keys.key_blocks:key.value=0
for name in ['Dana_BodyComplete_Exam','Dana_Clinical_Bra']:bpy.data.objects[name].hide_render=False
for image in bpy.data.images:
 if image.has_data and max(image.size)>1024:image.scale(min(image.size[0],1024),min(image.size[1],1024))
out=ROOT/'v2/apps/web/public/visual-patient/dana/review-v01/dana-review.glb'
bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',export_animations=True,export_animation_mode='ACTIVE_ACTIONS',export_cameras=False,export_lights=False,export_extras=True,export_morph=True)
assert hashlib.sha256(source.read_bytes()).hexdigest()==before
print('FINAL_EXPORT',json.dumps({'source_sha256':before,'blend':str(target),'glb_sha256':hashlib.sha256(out.read_bytes()).hexdigest()}))
