"""Normalize the navel's single glTF color channel without changing geometry."""
import bpy,hashlib,json
from pathlib import Path
ROOT=Path(r'C:\Projects\AI-Clinical-Simulation')
source=ROOT/'visual-patient-lab/blender/patient_anaphylaxis_dana_v21.blend'
target=ROOT/'visual-patient-lab/blender/patient_anaphylaxis_dana_v22.blend'
assert not target.exists()
before=hashlib.sha256(source.read_bytes()).hexdigest()
bpy.ops.wm.open_mainfile(filepath=str(source),load_ui=False)
m=bpy.data.materials['Dana_Exam_Skin_Matched'];p=m.node_tree.nodes.get('Principled BSDF')
for link in list(p.inputs['Base Color'].links):m.node_tree.links.remove(link)
p.inputs['Base Color'].default_value=(.57,.365,.285,1)
for node in list(m.node_tree.nodes):
 if node.type in ['VERTEX_COLOR','MIX_RGB']:m.node_tree.nodes.remove(node)
# glTF multiplies COLOR_0 by the base factor natively. The previous export
# produced a white material-workflow COLOR_0 plus unused COLOR_1; selecting
# the active authored channel explicitly avoids that unsupported duplication.
bpy.ops.wm.save_as_mainfile(filepath=str(target))
for name in ['Dana_BodyComplete_Exam','Dana_Clinical_Bra']:bpy.data.objects[name].hide_render=False
for image in bpy.data.images:
 if image.has_data and max(image.size)>1024:image.scale(min(image.size[0],1024),min(image.size[1],1024))
out=ROOT/'v2/apps/web/public/visual-patient/dana/review-v01/dana-review.glb'
bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',export_animations=True,export_animation_mode='ACTIVE_ACTIONS',export_cameras=False,export_lights=False,export_extras=True,export_morph=True,export_vertex_color='ACTIVE',export_all_vertex_colors=False)
assert hashlib.sha256(source.read_bytes()).hexdigest()==before
print('POLISH_COLOR_EXPORT',json.dumps({'blend':str(target),'source_preserved_sha256':before,'glb_sha256':hashlib.sha256(out.read_bytes()).hexdigest()}))
