"""Give the existing shallow navel a continuous, subtle crease tone (v21)."""
import bpy,math,hashlib,json
from pathlib import Path
ROOT=Path(r'C:\Projects\AI-Clinical-Simulation')
source=ROOT/'visual-patient-lab/blender/patient_anaphylaxis_dana_v20.blend'
target=ROOT/'visual-patient-lab/blender/patient_anaphylaxis_dana_v21.blend'
assert not target.exists()
before=hashlib.sha256(source.read_bytes()).hexdigest()
bpy.ops.wm.open_mainfile(filepath=str(source),load_ui=False)
obj=bpy.data.objects['Dana_BodyComplete_Exam']
color=obj.data.color_attributes.new(name='Dana_Navel_Tone',type='FLOAT_COLOR',domain='POINT')
for v,c in zip(obj.data.vertices,color.data):
 x,y,z=v.co
 tone=1-.38*math.exp(-((x/.54)**2+((y-115.5)/.78)**2)*1.4) if z>9 else 1
 c.color=(tone,tone,tone,1)
material=bpy.data.materials['Dana_Exam_Skin_Matched'];nodes=material.node_tree.nodes;links=material.node_tree.links
p=nodes.get('Principled BSDF');base=p.inputs['Base Color'].default_value[:]
attr=nodes.new('ShaderNodeVertexColor');attr.layer_name=color.name
mix=nodes.new('ShaderNodeMixRGB');mix.blend_type='MULTIPLY';mix.inputs[0].default_value=1;mix.inputs[1].default_value=base
links.new(attr.outputs['Color'],mix.inputs[2]);links.new(mix.outputs[0],p.inputs['Base Color'])
obj['navel_shallow_geometry_and_crease_tone']=True
bpy.ops.wm.save_as_mainfile(filepath=str(target))
for name in ['Dana_BodyComplete_Exam','Dana_Clinical_Bra']:bpy.data.objects[name].hide_render=False
for image in bpy.data.images:
 if image.has_data and max(image.size)>1024:image.scale(min(image.size[0],1024),min(image.size[1],1024))
out=ROOT/'v2/apps/web/public/visual-patient/dana/review-v01/dana-review.glb'
bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',export_animations=True,export_animation_mode='ACTIVE_ACTIONS',export_cameras=False,export_lights=False,export_extras=True,export_morph=True)
assert hashlib.sha256(source.read_bytes()).hexdigest()==before
print('POLISH_FINAL_EXPORT',json.dumps({'blend':str(target),'source_preserved_sha256':before,'glb_sha256':hashlib.sha256(out.read_bytes()).hexdigest()}))
