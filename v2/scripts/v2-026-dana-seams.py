"""Continue owner-review v04 in v05; source assets are never saved over."""
import bpy,math,hashlib,json
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree
ROOT=Path(r'C:\Projects\AI-Clinical-Simulation')
SOURCE=ROOT/'visual-patient-lab/blender/patient_anaphylaxis_dana_v04.blend'
TARGET=ROOT/'visual-patient-lab/blender/patient_anaphylaxis_dana_v05.blend'
PUBLIC=ROOT/'v2/apps/web/public/visual-patient/dana/review-v01'
source_hash=hashlib.sha256(SOURCE.read_bytes()).hexdigest()
bpy.ops.wm.open_mainfile(filepath=str(SOURCE),load_ui=False)
body=bpy.data.objects['Dana_Ch22_Body'];skin=bpy.data.objects['Dana_Exam_Skin'];scene=bpy.context.scene
points=[v.co.copy() for v in body.data.vertices]
bvh=BVHTree.FromPolygons(points,[list(p.vertices) for p in body.data.polygons])
kd=KDTree(len(points))
for i,p in enumerate(points):kd.insert(p,i)
kd.balance()
def smooth(a,b,x):
 t=max(0,min(1,(x-a)/(b-a)));return t*t*(3-2*t)
group=skin.vertex_groups.new(name='Dana_seam_normal_blend')
for v in skin.data.vertices:
 x,y,z=v.co
 arm=smooth(22,28.5,abs(x));neck=smooth(137,144,y)*(1-smooth(9,13,abs(x)))
 w=max(arm,neck)
 if not w:continue
 hit,normal,face,distance=bvh.find_nearest(v.co)
 if hit is None:continue
 # End inside the original skin by 0.25 mm, eliminating a visible cuff lip.
 v.co=v.co.lerp(hit-normal*.025,w)
 group.add([v.index],w,'REPLACE')
 _,nearest,_=kd.find(hit)
 source_weights={body.vertex_groups[g.group].name:g.weight for g in body.data.vertices[nearest].groups}
 old={skin.vertex_groups[g.group].name:g.weight for g in v.groups if skin.vertex_groups[g.group].name!='Dana_seam_normal_blend'}
 for name in set(old)|set(source_weights):
  vg=skin.vertex_groups.get(name) or skin.vertex_groups.new(name=name)
  weight=old.get(name,0)*(1-w)+source_weights.get(name,0)*w
  if weight>0:vg.add([v.index],weight,'REPLACE')
  else:vg.remove([v.index])
# Transfer source normals at the seam after matching local coordinates/weights.
normal=skin.modifiers.new('Dana seam shading continuity','DATA_TRANSFER');normal.object=body
normal.use_loop_data=True;normal.data_types_loops={'CUSTOM_NORMAL'};normal.loop_mapping='POLYINTERP_NEAREST';normal.vertex_group=group.name
# Apply before skinning; no head/face topology or shape key is changed.
bpy.context.view_layer.objects.active=skin
bpy.ops.object.modifier_move_up(modifier=normal.name)
bpy.ops.object.modifier_apply(modifier=normal.name)
skin['repair']='v05: original skin boundary matching; shared bone weights and normals'
# Keep the current ED room. Decorative monitor data must not compete with the
# authoritative UI monitor; blank only the inherited demonstration screen.
screen=bpy.data.objects.get('Monitor demonstration screen')
if screen:
 m=bpy.data.materials.new('Dana inactive equipment screen');m.diffuse_color=(.008,.015,.018,1);m.use_nodes=True
 m.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=m.diffuse_color
 screen.data.materials.clear();screen.data.materials.append(m)
scene.frame_set(1)
bpy.ops.wm.save_as_mainfile(filepath=str(TARGET))
scene.render.resolution_x=1100;scene.render.resolution_y=800;scene.render.filepath=str(PUBLIC/'dana-static-anxious.png')
bpy.ops.render.render(write_still=True)
for obj in [body,bpy.data.objects['Dana_Ch22_Eyelashes']]:
 for k in obj.data.shape_keys.key_blocks:k.value=0
skin.hide_render=False;bpy.data.objects['Dana_Clinical_Exam_Top'].hide_render=False
for image in bpy.data.images:
 if image.has_data and max(image.size)>1024:image.scale(min(image.size[0],1024),min(image.size[1],1024))
bpy.ops.export_scene.gltf(filepath=str(PUBLIC/'dana-review.glb'),export_format='GLB',export_animations=True,export_animation_mode='ACTIVE_ACTIONS',export_cameras=False,export_lights=False,export_extras=True,export_morph=True)
assert hashlib.sha256(SOURCE.read_bytes()).hexdigest()==source_hash
print('SEAM_REPAIR_HASHES',json.dumps({p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in [PUBLIC/'dana-review.glb',PUBLIC/'dana-static-anxious.png']}))
