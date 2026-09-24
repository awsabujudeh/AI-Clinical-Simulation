"""Build a separate Dana scene; never save the imported STEMI foundation.

Owner FBX + existing room/bed only. Outputs are new V2-026 review artifacts.
"""
import bpy, math, json, hashlib
from pathlib import Path
from mathutils import Vector, Quaternion, Matrix
ROOT = Path(r"C:\Projects\AI-Clinical-Simulation")
SOURCE = ROOT / "visual-patient-lab/blender/patient_anaphylaxis_dana_v01.blend"
TARGET = ROOT / "visual-patient-lab/blender/patient_anaphylaxis_dana_v02.blend"
OUT = ROOT / "v2/test-results/v2-026"
OUT.mkdir(parents=True, exist_ok=True)
PUBLIC = ROOT / 'v2/apps/web/public/visual-patient/dana/review-v01'
PUBLIC.mkdir(parents=True, exist_ok=True)
source_hash = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
bpy.ops.wm.open_mainfile(filepath=str(SOURCE), load_ui=False)
# Keep only explicitly environmental objects, not male anatomy, rigs or drivers.
keep = {'BED', 'BEDDING', 'ROOM', 'CAMERAS', 'LIGHTING'}
for obj in list(bpy.data.objects):
    if not any(c.name in keep for c in obj.users_collection):
        bpy.data.objects.remove(obj, do_unlink=True)
before = set(bpy.data.objects)
bpy.ops.import_scene.fbx(filepath=str(ROOT / 'visual-patient-lab/assets/characters/Dana.fbx'))
imported = [o for o in bpy.data.objects if o not in before]
rig = next(o for o in imported if o.type == 'ARMATURE')
rig.name = 'Dana_Mixamo_Rig'
for o in imported:
    if o.animation_data: o.animation_data_clear()
    if o.type == 'MESH':
        o.name = 'Dana_' + o.name
        for p in o.data.polygons: p.use_smooth = True
# Asset coordinates are FBX centimetres with the importer scale on the rig.
# Rotate the intact skinned character to face the existing student camera.
rig.rotation_mode = 'XYZ'
rig.rotation_euler = (0, 0, 0)
rig.location = (0, -1.05, .94)
bpy.context.view_layer.update()
def bone(s): return next(b for b in rig.pose.bones if b.name.endswith(':'+s))
def rotate(s, axis, angle):
    b=bone(s); b.rotation_mode='QUATERNION'; b.rotation_quaternion=Quaternion(Vector(axis),math.radians(angle))
# Supine foundation first. Upper torso elevation and scratch are overlays, not
# full-body locomotion. Keep legs and everyday clothing intact.
rotate('Spine',(1,0,0),35)
bpy.context.view_layer.update()
def aim(name, direction):
    b=bone(name); desired=rig.matrix_world.to_3x3().inverted()@Vector(direction)
    q=(b.tail-b.head).rotation_difference(desired)
    b.matrix=Matrix.Translation(b.head)@q.to_matrix().to_4x4()@b.matrix.to_3x3().to_4x4()
    bpy.context.view_layer.update()
aim('LeftArm',(.15,-1,-.18)); aim('LeftForeArm',(-.15,-1,.05))
aim('RightArm',(-.15,-1,-.18)); aim('RightForeArm',(.15,-1,.05))
# The FBX material imports are glossy Phong; use the existing diffuse textures
# with a conservative cloth/skin roughness, not replacement skin or clothing.
for o in imported:
    if o.type!='MESH': continue
    for mat in o.data.materials:
        if mat and mat.use_nodes:
            for n in mat.node_tree.nodes:
                if n.type=='BSDF_PRINCIPLED':
                    n.inputs['Roughness'].default_value=.72
                    for link in list(mat.node_tree.links):
                        if link.to_socket==n.inputs['Roughness']: mat.node_tree.links.remove(link)
# Respectful exam top: retain coverage at all times. An independent copy of the
# owner's shirt is an exam underlayer, never a nude-body reveal.
shirt=next(o for o in imported if o.name=='Dana_Ch22_Shirt')
under=shirt.copy(); under.data=shirt.data.copy(); under.name='Dana_Clinical_Exam_Top'
bpy.context.scene.collection.objects.link(under)
mat=bpy.data.materials.new('Dana_Clinical_Exam_Top_Material'); mat.diffuse_color=(.09,.25,.29,1); mat.use_nodes=True
mat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(.09,.25,.29,1)
mat.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.8
under.data.materials.clear(); under.data.materials.append(mat); under.hide_render=True
# glTF exports armature rest transforms unless the pose is carried by a clip.
# Pin this reviewed base pose explicitly; runtime samples it once before overlays.
for b in rig.pose.bones:
    b.rotation_mode='QUATERNION'
    for frame in (1,2):
        b.keyframe_insert(data_path='location',frame=frame)
        b.keyframe_insert(data_path='rotation_quaternion',frame=frame)
        b.keyframe_insert(data_path='scale',frame=frame)
if rig.animation_data and rig.animation_data.action: rig.animation_data.action.name='Dana_Base_SemiFowler'
bpy.context.view_layer.update()
# Independent camera framing; original cameras are retained as reference only.
camera_data=bpy.data.cameras.new('Dana_Review_Camera')
camera=bpy.data.objects.new('Dana_Review_Camera',camera_data); bpy.context.scene.collection.objects.link(camera)
camera.location=(-2.25,-2.6,2.8)
direction=Vector((0,0,1.15))-camera.location
camera.rotation_euler=direction.to_track_quat('-Z','Y').to_euler(); camera_data.lens=48
scene=bpy.context.scene; scene.camera=camera
scene.render.engine='BLENDER_EEVEE'; scene.render.resolution_x=1100; scene.render.resolution_y=800; scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'; scene.render.filepath=str(OUT/'dana-scene-review.png')
scene.world.color=(.25,.25,.25)
bpy.ops.wm.save_as_mainfile(filepath=str(TARGET))
bpy.ops.render.render(write_still=True)
# Package the exact local character/environment; no new external assets. Reduce
# only duplicated texture datablocks in this export scene, not the owner FBX.
for i in bpy.data.images:
    if i.has_data and max(i.size)>1024: i.scale(min(i.size[0],1024),min(i.size[1],1024))
under.hide_render=False
bpy.ops.export_scene.gltf(filepath=str(PUBLIC/'dana-review.glb'),export_format='GLB',export_animations=True,export_animation_mode='ACTIVE_ACTIONS',export_cameras=False,export_lights=False,export_extras=True)
report={'source_hash_before':source_hash,'source_hash_after':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),'output':str(TARGET),
 'rig':rig.name,'bones':{b.name:{'head':list(rig.matrix_world@b.head),'tail':list(rig.matrix_world@b.tail)} for b in rig.pose.bones},
 'meshes':[o.name for o in imported if o.type=='MESH'],'clinical_review':'PENDING','visual_review':'PENDING'}
(OUT/'dana-scene-build.json').write_text(json.dumps(report,indent=2),encoding='utf8')
print('DANA_SEPARATE_SCENE_SAVED',str(TARGET))
