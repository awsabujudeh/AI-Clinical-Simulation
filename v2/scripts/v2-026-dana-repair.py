"""Owner-review repair, independent v04. Never overwrite prior Dana/STEMI files."""
import bpy,math,json,hashlib
from pathlib import Path
from mathutils import Vector
ROOT=Path(r'C:\Projects\AI-Clinical-Simulation')
SRC=ROOT/'visual-patient-lab/blender/patient_anaphylaxis_dana_v03.blend'
TARGET=ROOT/'visual-patient-lab/blender/patient_anaphylaxis_dana_v04.blend'
PUBLIC=ROOT/'v2/apps/web/public/visual-patient/dana/review-v01'
OUT=ROOT/'v2/test-results/v2-026-repair';OUT.mkdir(parents=True,exist_ok=True)
before=hashlib.sha256(SRC.read_bytes()).hexdigest()
bpy.ops.wm.open_mainfile(filepath=str(SRC),load_ui=False)
scene=bpy.context.scene;rig=bpy.data.objects['Dana_Mixamo_Rig']
# The donor's shaped blanket/waist roll/pillow are NOT a second patient, but
# create a false occupied-bed silhouette. Replace bedding in the Dana copy only.
for o in list(bpy.data.objects):
 if any(c.name=='BEDDING' for c in o.users_collection):bpy.data.objects.remove(o,do_unlink=True)
rig.location.y+=.13;rig.location.z-=.085
def mat(name,color):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
 p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=.8
 return m
linen=mat('Dana clean medical linen',(.72,.79,.79))
def mesh(name,verts,faces,material):
 data=bpy.data.meshes.new(name);data.from_pydata(verts,[],faces);data.update()
 o=bpy.data.objects.new(name,data);scene.collection.objects.link(o);o.data.materials.append(material)
 for p in data.polygons:p.use_smooth=True
 return o
# Clean hinged mattress: world-space hinge shared explicitly with runtime.
verts=[];faces=[];nx=12;ny=48
for j in range(ny+1):
 y=-1.04+j*2.02/ny
 for i in range(nx+1):
  x=-.455+i*.91/nx;z=.738+max(0,y-.19)*math.tan(math.radians(35))
  verts.append((x,y,z))
for j in range(ny):
 for i in range(nx):a=j*(nx+1)+i;faces.append((a,a+1,a+nx+2,a+nx+1))
o=mesh('Dana mattress fitted sheet',verts,faces,linen)
s=o.modifiers.new('Mattress thickness','SOLIDIFY');s.thickness=.095
bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=s.name)
bpy.ops.mesh.primitive_uv_sphere_add(segments=32,ring_count=16,location=(0,.69,1.105))
p=bpy.context.object;p.name='Dana pillow';p.scale=(.29,.20,.065);p.rotation_euler.x=math.radians(35);p.data.materials.append(linen)
# Reuse only existing equipment collections, never donor patient/rig/anchors.
with bpy.data.libraries.load(str(ROOT/'visual-patient-lab/blender/patient_anaphylaxis_dana_v01.blend'),link=False) as (src,dst):
 dst.collections=[n for n in ['EQUIPMENT','EQUIPMENT_PORTS','MONITORING'] if n in src.collections]
for c in dst.collections:
 if c:scene.collection.children.link(c)
for o in list(bpy.data.objects):
 if o.name in ['Monitor lead 0','Monitor lead 1','Monitor lead 2','Oximeter flexible lead']:
  bpy.data.objects.remove(o,do_unlink=True)
# Mixamo removes the body under clothing. Supply a modest, skinned examination
# torso surface instead of pretending a recolored full shirt reveals skin.
# Head, limbs, identity and their original weighting remain untouched.
old=bpy.data.objects['Dana_Clinical_Exam_Top'];bpy.data.objects.remove(old,do_unlink=True)
skin=mat('Dana examination skin',(.57,.365,.285));cloth=mat('Dana opaque examination coverage',(.045,.17,.19))
rings=[(104,13,7.2,1.7),(112,13.8,7.6,1.8),(120,15.0,8.1,2),(128,16.0,8.8,2.2),(133,16.4,8.7,2.1),(137,15.8,7.4,1.7),(141,12.2,6.1,1.4),(145,5.9,5.1,1.1)]
v=[];f=[];N=48
for y,rx,rz,cz in rings:
 for i in range(N):a=2*math.pi*i/N;v.append((rx*math.sin(a),y,cz+rz*math.cos(a)))
for j in range(len(rings)-1):
 for i in range(N):a=j*N+i;b=j*N+(i+1)%N;f.append((a,b,b+N,a+N))
body=bpy.data.objects['Dana_Ch22_Body']
def skinned(name,vs,fs,material):
 o=mesh(name,vs,fs,material);o.parent=body.parent;o.matrix_parent_inverse=body.matrix_parent_inverse.copy();o.matrix_basis=body.matrix_basis.copy()
 groups={s:o.vertex_groups.new(name=next(b.name for b in rig.data.bones if b.name.endswith(':'+s))) for s in ['Hips','Spine','Spine1','Spine2','Neck']}
 anchors=[('Hips',104),('Spine',115),('Spine1',126),('Spine2',138),('Neck',148)]
 for vert in o.data.vertices:
  y=vert.co.y
  for (a,lo),(b,hi) in zip(anchors,anchors[1:]):
   if lo<=y<=hi:
    w=(y-lo)/(hi-lo);groups[a].add([vert.index],1-w,'REPLACE');groups[b].add([vert.index],w,'REPLACE');break
 mod=o.modifiers.new('Dana shared armature','ARMATURE');mod.object=rig
 sub=o.modifiers.new('Smooth examination surface','SUBSURF');sub.levels=2
 return o
torso=skinned('Dana_Exam_Skin',v,f,skin)
# Reuse the character's own fitted, weighted shoulder topology to bridge the
# source's missing under-shirt body. Remove cloth folds by local smoothing.
# It remains a separate examination-only skin mesh, not a shirt color toggle.
bpy.data.objects.remove(torso,do_unlink=True)
shirt=bpy.data.objects['Dana_Ch22_Shirt']
torso=shirt.copy();torso.data=shirt.data.copy();torso.name='Dana_Exam_Skin';scene.collection.objects.link(torso)
torso.data.materials.clear();torso.data.materials.append(skin)
adj=[set() for _ in torso.data.vertices]
for edge in torso.data.edges:
 a,b=edge.vertices;adj[a].add(b);adj[b].add(a)
for iteration in range(10):
 coords=[x.co.copy() for x in torso.data.vertices]
 for vertex in torso.data.vertices:
  ns=adj[vertex.index]
  if ns:vertex.co=coords[vertex.index].lerp(sum((coords[n] for n in ns),Vector())/len(ns),.38)
for vertex in torso.data.vertices:
 vertex.co.x*=.98;vertex.co.z=2+(vertex.co.z-2)*.98
# Opaque chest band covers breasts; broad straps preserve modesty while upper
# chest, infraclavicular skin and lateral respiratory sites remain inspectable.
coverage=[]
for face in f:
 center=sum((Vector(v[i]) for i in face),Vector())/4
 if center.y<128 or (abs(center.x)>7 and abs(center.x)<11 and center.y<142):coverage.append(face)
top=skinned('Dana_Clinical_Exam_Top',[(x*1.016,y,z*1.025) for x,y,z in v],coverage,cloth)
bpy.data.objects.remove(top,do_unlink=True)
top=torso.copy();top.data=torso.data.copy();top.name='Dana_Clinical_Exam_Top';scene.collection.objects.link(top)
top.data.materials.clear();top.data.materials.append(cloth)
import bmesh
bm=bmesh.new();bm.from_mesh(top.data)
bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=.0001,plane_co=(0,130,0),plane_no=(0,1,0),clear_outer=True)
bm.to_mesh(top.data);bm.free()
for vertex in top.data.vertices:
 vertex.co.x*=1.035;vertex.co.z=2+(vertex.co.z-2)*1.055
torso.hide_render=True;top.hide_render=True
# Relaxed abducted elbows keep hands clear of the torso in the base pose.
from mathutils import Matrix
def aim(name,d):
 b=next(b for b in rig.pose.bones if b.name.endswith(':'+name));desired=rig.matrix_world.to_3x3().inverted()@Vector(d)
 q=(b.tail-b.head).rotation_difference(desired);b.matrix=Matrix.Translation(b.head)@q.to_matrix().to_4x4()@b.matrix.to_3x3().to_4x4();bpy.context.view_layer.update()
for side,sign in [('Left',1),('Right',-1)]:
 aim(side+'Arm',(sign*.26,-1,-.48));aim(side+'ForeArm',(-sign*.05,-1,-.08))
for b in rig.pose.bones:
 for frame in (1,2):
  b.keyframe_insert(data_path='location',frame=frame);b.keyframe_insert(data_path='rotation_quaternion',frame=frame)
scene.frame_set(1);bpy.context.view_layer.update()
scene.camera.location=(-2.35,-2.65,2.65);target=Vector((0,.15,1.05));scene.camera.rotation_euler=(target-scene.camera.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.wm.save_as_mainfile(filepath=str(TARGET))
scene.render.resolution_x=1100;scene.render.resolution_y=800;scene.render.filepath=str(PUBLIC/'dana-static-anxious.png')
bpy.ops.render.render(write_still=True)
for obj in [body,bpy.data.objects['Dana_Ch22_Eyelashes']]:
 for k in obj.data.shape_keys.key_blocks:k.value=0
torso.hide_render=False;top.hide_render=False
for image in bpy.data.images:
 if image.has_data and max(image.size)>1024:image.scale(min(image.size[0],1024),min(image.size[1],1024))
bpy.ops.export_scene.gltf(filepath=str(PUBLIC/'dana-review.glb'),export_format='GLB',export_animations=True,export_animation_mode='ACTIVE_ACTIONS',export_cameras=False,export_lights=False,export_extras=True,export_morph=True)
assert hashlib.sha256(SRC.read_bytes()).hexdigest()==before
print('REPAIR_HASHES',json.dumps({p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in [PUBLIC/'dana-review.glb',PUBLIC/'dana-static-anxious.png']}))
