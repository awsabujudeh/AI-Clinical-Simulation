"""Use a directly supported glTF vertex-color material for the exam skin."""
import bpy,hashlib,json
from pathlib import Path
ROOT=Path(r'C:\Projects\AI-Clinical-Simulation')
source=ROOT/'visual-patient-lab/blender/patient_anaphylaxis_dana_v22.blend'
target=ROOT/'visual-patient-lab/blender/patient_anaphylaxis_dana_v23.blend'
assert not target.exists()
before=hashlib.sha256(source.read_bytes()).hexdigest()
bpy.ops.wm.open_mainfile(filepath=str(source),load_ui=False)
o=bpy.data.objects['Dana_BodyComplete_Exam'];colors=o.data.color_attributes['Dana_Navel_Tone']
for c in colors.data:
 tone=c.color[0];c.color=(.57*tone,.365*tone,.285*tone,1)
m=bpy.data.materials['Dana_Exam_Skin_Matched'];p=m.node_tree.nodes.get('Principled BSDF')
attr=m.node_tree.nodes.new('ShaderNodeVertexColor');attr.layer_name=colors.name
m.node_tree.links.new(attr.outputs['Color'],p.inputs['Base Color'])
bpy.ops.wm.save_as_mainfile(filepath=str(target))
for name in ['Dana_BodyComplete_Exam','Dana_Clinical_Bra']:bpy.data.objects[name].hide_render=False
for image in bpy.data.images:
 if image.has_data and max(image.size)>1024:image.scale(min(image.size[0],1024),min(image.size[1],1024))
out=ROOT/'v2/apps/web/public/visual-patient/dana/review-v01/dana-review.glb'
bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',export_animations=True,export_animation_mode='ACTIVE_ACTIONS',export_cameras=False,export_lights=False,export_extras=True,export_morph=True,export_vertex_color='MATERIAL',export_all_vertex_colors=False)
assert hashlib.sha256(source.read_bytes()).hexdigest()==before
print('POLISH_NAVEL_MATERIAL_EXPORT',json.dumps({'blend':str(target),'source_preserved_sha256':before,'glb_sha256':hashlib.sha256(out.read_bytes()).hexdigest()}))
