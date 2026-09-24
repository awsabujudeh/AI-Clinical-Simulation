import bpy,bmesh,math,json,hashlib
from pathlib import Path
from mathutils import Vector
ROOT=Path(r'C:\Projects\AI-Clinical-Simulation')
SOURCE=ROOT/'visual-patient-lab/blender/patient_anaphylaxis_dana_v05.blend'
TARGET=ROOT/'visual-patient-lab/blender/patient_anaphylaxis_dana_v06.blend'
PUBLIC=ROOT/'v2/apps/web/public/visual-patient/dana/review-v01'
bpy.ops.wm.open_mainfile(filepath=str(SOURCE),load_ui=False)
skin=bpy.data.objects['Dana_Exam_Skin'];body=bpy.data.objects['Dana_Ch22_Body'];scene=bpy.context.scene
bm=bmesh.new();bm.from_mesh(skin.data)
for co,no in [((27,0,0),(1,0,0)),((-24.7,0,0),(-1,0,0)),((0,108,0),(0,-1,0))]:
 bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=.0001,plane_co=co,plane_no=no,clear_outer=True)
neck_faces=[f for f in bm.faces if all(abs(v.co.x)<11 and v.co.y>135 for v in f.verts)]
neck_edges={e for f in neck_faces for e in f.edges};neck_verts={v for f in neck_faces for v in f.verts}
bmesh.ops.bisect_plane(bm,geom=list(neck_verts)+list(neck_edges)+neck_faces,dist=.0001,plane_co=(0,142,0),plane_no=(0,1,0),clear_outer=True)
# Remove the enclosed inner shirt shell: after cutting collar/sleeve/hem this
# is a separate component. Only the larger external examination surface remains.
remaining=set(bm.verts);components=[]
while remaining:
 seed=remaining.pop();part={seed};todo=[seed]
 while todo:
  for edge in todo.pop().link_edges:
   for v in edge.verts:
    if v in remaining:remaining.remove(v);part.add(v);todo.append(v)
 components.append(part)
print('TORSO_COMPONENTS',[len(c) for c in components])
outer=max(components,key=lambda c:sum(abs(v.co.z-2) for v in c)/len(c))
if len(outer)<100:raise RuntimeError('EXAM_OUTER_SURFACE_NOT_FOUND')
bmesh.ops.delete(bm,geom=[v for v in bm.verts if v not in outer],context='VERTS')
bm.to_mesh(skin.data);bm.free()
# Join into a COPY of Dana's body so eyes/facial morphs, authored UVs and original
# weights stay intact. Only this examination copy is shown during chest reveal.
joined=body.copy();joined.data=body.data.copy();scene.collection.objects.link(joined);joined.name='Dana_Exam_Continuous'
bpy.ops.object.select_all(action='DESELECT');joined.select_set(True);skin.select_set(True);bpy.context.view_layer.objects.active=joined
bpy.ops.object.join();joined.name='Dana_Exam_Skin'
bm=bmesh.new();bm.from_mesh(joined.data)
def loops():
 edges={e for e in bm.edges if e.is_boundary};out=[]
 while edges:
  e=edges.pop();part={*e.verts};todo=list(e.verts)
  while todo:
   for edge in todo.pop().link_edges:
    if edge in edges:edges.remove(edge);part.update(edge.verts);todo.extend(edge.verts)
  out.append(part)
 return out
parts=loops()
def center(part):return sum((v.co for v in part),Vector())/len(part)
print('JOIN_RINGS',[(len(c),tuple(round(v,2) for v in center(c))) for c in parts])
def pick(predicate):
 found=[c for c in parts if predicate(center(c))]
 if len(found)!=1:raise RuntimeError('AMBIGUOUS_SEAM_RING '+str([(len(c),tuple(center(c))) for c in found]))
 return found[0]
def bridge(a,b,axis):
 c=(center(a)+center(b))*.5
 # Zipper unequal loops by their angular parameter. Existing boundary vertices
 # are shared by the bridge, rather than overlapping unattached surface pieces.
 axes=(1,2) if axis==0 else (0,2)
 def angle(v):return math.atan2(v.co[axes[1]]-c[axes[1]],v.co[axes[0]]-c[axes[0]])%(2*math.pi)
 a=sorted(a,key=angle);b=sorted(b,key=angle);aa=[angle(v) for v in a]+[angle(a[0])+2*math.pi];bb=[angle(v) for v in b]+[angle(b[0])+2*math.pi]
 i=j=0
 while i<len(a) or j<len(b):
  if j==len(b) or (i<len(a) and aa[i+1]<=bb[j+1]):verts=(a[i%len(a)],a[(i+1)%len(a)],b[j%len(b)]);i+=1
  else:verts=(a[i%len(a)],b[(j+1)%len(b)],b[j%len(b)]);j+=1
  face=bm.faces.new(verts);face.material_index=1;face.smooth=True
bridge(pick(lambda c:26.9<c.x<27.1),pick(lambda c:28<c.x<32 and c.y>130),0)
bridge(pick(lambda c:-24.8<c.x<-24.6),pick(lambda c:-31<c.x<-26 and c.y>130),0)
bridge(pick(lambda c:141<c.y<143 and abs(c.x)<1),pick(lambda c:143<c.y<148 and abs(c.x)<1),1)
bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
for f in bm.faces:f.smooth=True
bm.to_mesh(joined.data);bm.free();joined.hide_render=True
joined['continuous_exam_body']=True
body['normal_clothing_body']=True
bpy.ops.wm.save_as_mainfile(filepath=str(TARGET))
for obj in [body,joined,bpy.data.objects['Dana_Ch22_Eyelashes']]:
 if obj.data.shape_keys:
  for k in obj.data.shape_keys.key_blocks:k.value=0
joined.hide_render=False;bpy.data.objects['Dana_Clinical_Exam_Top'].hide_render=False
for image in bpy.data.images:
 if image.has_data and max(image.size)>1024:image.scale(min(image.size[0],1024),min(image.size[1],1024))
bpy.ops.export_scene.gltf(filepath=str(PUBLIC/'dana-review.glb'),export_format='GLB',export_animations=True,export_animation_mode='ACTIVE_ACTIONS',export_cameras=False,export_lights=False,export_extras=True,export_morph=True)
print('GLB_HASH',hashlib.sha256((PUBLIC/'dana-review.glb').read_bytes()).hexdigest())
