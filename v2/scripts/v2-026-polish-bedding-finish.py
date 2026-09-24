"""Finish v19 bedding: remove donor transform animation from fitted copies.
The patient base-pose animation, all motion and prior files are preserved.
"""
import bpy,math,hashlib,json
from pathlib import Path
from mathutils import Matrix
ROOT=Path(r'C:\Projects\AI-Clinical-Simulation')
source=ROOT/'visual-patient-lab/blender/patient_anaphylaxis_dana_v19.blend'
target=ROOT/'visual-patient-lab/blender/patient_anaphylaxis_dana_v20.blend'
assert not target.exists()
before=hashlib.sha256(source.read_bytes()).hexdigest()
bpy.ops.wm.open_mainfile(filepath=str(source),load_ui=False)
for name in ['Bed articulating backrest panel','Bed backrest reinforcing rib left','Bed backrest reinforcing rib right']:
 o=bpy.data.objects[name];old=o.matrix_world.copy();o.animation_data_clear()
 o.matrix_world=Matrix.Translation((0,.19,.718))@Matrix.Rotation(math.radians(-7),4,'X')@Matrix.Translation((0,-.15,-.814))@old
for name in ['Dana pillow','Dana pillow perimeter piping']:
 o=bpy.data.objects[name];o.animation_data_clear();o.matrix_world=Matrix.Identity(4)
 o['material_source']='Approved STEMI Cotton / fitted Dana-only pillow'
bpy.context.scene.frame_set(1);bpy.context.view_layer.update()
for name in ['Dana pillow','Dana pillow perimeter piping']:assert bpy.data.objects[name].matrix_world==Matrix.Identity(4)
bpy.ops.wm.save_as_mainfile(filepath=str(target))
for name in ['Dana_BodyComplete_Exam','Dana_Clinical_Bra']:bpy.data.objects[name].hide_render=False
for image in bpy.data.images:
 if image.has_data and max(image.size)>1024:image.scale(min(image.size[0],1024),min(image.size[1],1024))
out=ROOT/'v2/apps/web/public/visual-patient/dana/review-v01/dana-review.glb'
bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',export_animations=True,export_animation_mode='ACTIVE_ACTIONS',export_cameras=False,export_lights=False,export_extras=True,export_morph=True)
assert hashlib.sha256(source.read_bytes()).hexdigest()==before
print('POLISH_BEDDING_EXPORT',json.dumps({'blend':str(target),'source_preserved_sha256':before,'glb_sha256':hashlib.sha256(out.read_bytes()).hexdigest()}))
