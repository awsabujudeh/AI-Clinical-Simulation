"""Read-only mesh/landmark inspection; writes only disposable review evidence."""
import bpy, json
from pathlib import Path
from mathutils import Vector
ROOT=Path(r'C:\Projects\AI-Clinical-Simulation')
OUT=ROOT/'v2/test-results/v2-026'
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'visual-patient-lab/blender/patient_anaphylaxis_dana_v02.blend'),load_ui=False)
body=bpy.data.objects['Dana_Ch22_Body']
rig=bpy.data.objects['Dana_Mixamo_Rig']
head=next(b for b in rig.pose.bones if b.name.endswith(':Head'))
print('BODY_MATRIX',list(map(list,body.matrix_world)))
print('BODY_BOUNDS',[(min(v.co[i] for v in body.data.vertices),max(v.co[i] for v in body.data.vertices)) for i in range(3)])
print('HEAD',list(head.head),list(head.tail))
for o in (body,bpy.data.objects['Dana_Ch22_Eyelashes']):
 print('MESH',o.name,'MATERIALS',[m.name for m in o.data.materials])
 print('BOUNDS',[(min(v.co[i] for v in o.data.vertices),max(v.co[i] for v in o.data.vertices)) for i in range(3)])
 (OUT/(o.name+'-vertices.json')).write_text(json.dumps([{'i':v.index,'co':list(v.co),'groups':[(o.vertex_groups[g.group].name,g.weight) for g in v.groups]} for v in o.data.vertices]))
target=rig.matrix_world@head.head
target += Vector((0,.075,.075))
cam=bpy.context.scene.camera
cam.location=target+Vector((0,-.43,.66))
cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
cam.data.type='ORTHO';cam.data.ortho_scale=.32
scene=bpy.context.scene;scene.render.resolution_x=1000;scene.render.resolution_y=1000
scene.render.filepath=str(OUT/'dana-face-basis.png')
bpy.ops.render.render(write_still=True)
