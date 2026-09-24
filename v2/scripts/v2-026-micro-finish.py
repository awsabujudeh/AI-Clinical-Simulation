"""Local v10 continuation: collar topology, arm contour and clinical underlayer.

No source FBX, ordinary body, room, clinical content or prior blend is modified.
"""
import bpy,bmesh,math,hashlib
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
ROOT=Path(r'C:\Projects\AI-Clinical-Simulation')
SOURCE=ROOT/'visual-patient-lab/blender/patient_anaphylaxis_dana_v10.blend'
TARGET=ROOT/'visual-patient-lab/blender/patient_anaphylaxis_dana_v11.blend'
PUBLIC=ROOT/'v2/apps/web/public/visual-patient/dana/review-v01'
if TARGET.exists():raise RuntimeError('Preserve existing candidate; choose a new version')
bpy.ops.wm.open_mainfile(filepath=str(SOURCE),load_ui=False)
obj=bpy.data.objects['Dana_Exam_Skin'];bm=bmesh.new();bm.from_mesh(obj.data)
shape_layers=list(bm.verts.layers.shape.values());deform=bm.verts.layers.deform.active
def smooth(a,b,x):
 t=max(0,min(1,(x-a)/(b-a)));return t*t*(3-2*t)
def move(v,p):
 delta=p-v.co
 for layer in shape_layers:v[layer]+=delta
 v.co=p
# The previous polar-sorted collar bridge left 22 non-manifold edges and seven
# folded faces. Excise only that small collar band, retaining both real boundary
# edge walks. Do not attempt to smooth overlapping/folded triangles into skin.
bmesh.ops.delete(bm,geom=[v for v in bm.verts if (v.co.x/17.5)**2+((v.co.y-141.5)/8.5)**2<1],context='VERTS')
bmesh.ops.delete(bm,geom=[e for e in bm.edges if not e.link_faces],context='EDGES')
bmesh.ops.delete(bm,geom=[v for v in bm.verts if not v.link_edges],context='VERTS')
def boundary_loops():
 edges={e for e in bm.edges if e.is_boundary};out=[]
 while edges:
  edge=edges.pop();start=edge.verts[0];current=edge.verts[1];loop=[start,current]
  while current!=start:
   candidates=[e for e in current.link_edges if e in edges]
   if not candidates:raise RuntimeError('Non-simple boundary')
   edge=candidates[0];edges.remove(edge);current=edge.other_vert(current)
   if current!=start:loop.append(current)
  out.append(loop)
 return out
def center(loop):return sum((v.co for v in loop),Vector())/len(loop)
loops=boundary_loops()
lower=next(l for l in loops if 135<center(l).y<142 and abs(center(l).x)<1)
upper=next(l for l in loops if 149<center(l).y<151 and abs(center(l).x)<1)
def orient(loop):
 # Keep actual edge order; reverse whole loop only to match winding.
 area=sum(a.co.x*b.co.z-b.co.x*a.co.z for a,b in zip(loop,loop[1:]+loop[:1]))
 if area<0:loop=list(reversed(loop))
 first=max(range(len(loop)),key=lambda i:loop[i].co.x)
 return loop[first:]+loop[:first]
lower,upper=orient(lower),orient(upper)
parameters={}
for loop in [lower,upper]:
 lengths=[(b.co-a.co).length for a,b in zip(loop,loop[1:]+loop[:1])];total=sum(lengths);d=0
 for v,length in zip(loop,lengths):parameters[v]=d/total;d+=length
def sample(loop,f):
 lengths=[(b.co-a.co).length for a,b in zip(loop,loop[1:]+loop[:1])];total=sum(lengths);d=f*total
 for i,length in enumerate(lengths):
  if d<=length:
   a,b=loop[i],loop[(i+1)%len(loop)];t=d/length
   weights={g:a[deform].get(g,0)*(1-t)+b[deform].get(g,0)*t for g in set(a[deform].keys())|set(b[deform].keys())}
   return a.co.lerp(b.co,t),weights
  d-=length
 return loop[0].co.copy(),dict(loop[0][deform].items())
def bridge(a,b):
 # Arc-parameter zipper always preserves the supplied boundary edges.
 i=j=0
 while i<len(a) or j<len(b):
  next_a=parameters[a[i+1]] if i+1<len(a) else 1
  next_b=parameters[b[j+1]] if j+1<len(b) else 1
  if j==len(b) or (i<len(a) and next_a<=next_b):
   verts=(a[i%len(a)],a[(i+1)%len(a)],b[j%len(b)]);i+=1
  else:verts=(a[i%len(a)],b[(j+1)%len(b)],b[j%len(b)]);j+=1
  face=bm.faces.new(verts);face.material_index=1;face.smooth=True
previous=lower
for ring_index in range(1,9):
 t=ring_index/9;ring=[]
 for i in range(72):
  a,wa=sample(lower,i/72);b,wb=sample(upper,i/72)
  # Bell-shaped root transitions into the retained neck; no collar tube/ridge.
  horizontal=1-(1-t)**2; p=a.lerp(b,horizontal);p.y=a.y*(1-t)+b.y*t
  v=bm.verts.new(p)
  parameters[v]=i/72
  for layer in shape_layers:v[layer]=p
  for g in set(wa)|set(wb):v[deform][g]=wa.get(g,0)*(1-t)+wb.get(g,0)*t
  ring.append(v)
 bridge(previous,ring);previous=ring
bridge(previous,upper)
# Continuous local arm cross-section. Unlike the old 90% projection, this
# removes the residual cuff step instead of retaining a fraction of its ridge.
for v in bm.verts:
 x,y,z=v.co;ax=abs(x)
 weight=smooth(21,27,ax)*(1-smooth(34,42,ax))*smooth(127,132,y)
 if weight:
  cy=138;cz=-1.5;ry=4.12-.045*max(0,ax-31);rz=4.03-.04*max(0,ax-31)
  angle=math.atan2((z-cz)/rz,(y-cy)/ry)
  move(v,v.co.lerp(Vector((x,cy+ry*math.cos(angle),cz+rz*math.sin(angle))),weight))
# Relax only the new patch and its first boundary ring; all facial key deltas
# and the rest of the patient remain untouched.
for _ in range(12):
 updates=[]
 for v in bm.verts:
  x,y,z=v.co
  if abs(x)<20 and 131<y<152:
   weight=smooth(130,135,y)*(1-smooth(148,152,y))*(1-smooth(15,20,abs(x)))
   neighbors=[e.other_vert(v).co for e in v.link_edges]
   if neighbors:updates.append((v,v.co.lerp(sum(neighbors,Vector())/len(neighbors),weight*.2)))
 for v,p in updates:move(v,p)
bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
for e in bm.edges:e.smooth=True
for f in bm.faces:f.smooth=True
bad=[e for e in bm.edges if not e.is_manifold and all(abs(v.co.x)<16 and 130<v.co.y<151 for v in e.verts)]
print('BAD_LOCAL_EDGES',[(tuple((e.verts[0].co+e.verts[1].co)*.5),len(e.link_faces)) for e in bad])
assert not bad,'Collar must be a closed two-face manifold'
folds=[e for e in bm.edges if e.is_manifold and e.calc_face_angle()>1.4 and all(abs(v.co.x)<15 and 135<v.co.y<150 for v in e.verts)]
print('FOLDED_LOCAL_EDGES',[(tuple((e.verts[0].co+e.verts[1].co)*.5),e.calc_face_angle()) for e in folds])
assert not folds,'Folded collar faces remain'
bm.to_mesh(obj.data);bm.free();obj.data.normals_split_custom_set([(0,0,0)]*len(obj.data.loops))
obj['micro_finish_version']=11;obj['collar_manifold']=True
# Preserve existing opaque coverage; shape its top edge gently and add narrow
# body-following clinical straps. This is a mesh underlayer, not shirt recolor.
top=bpy.data.objects['Dana_Clinical_Exam_Top'];tb=bmesh.new();tb.from_mesh(top.data)
for v in tb.verts:
 if v.co.y>122:
  weight=smooth(122,130,v.co.y);ax=abs(v.co.x)
  v.co.y+=weight*(-1.25+2.2*smooth(3,12,ax))
skinbm=bmesh.new();skinbm.from_mesh(obj.data);skinbm.normal_update();tree=BVHTree.FromBMesh(skinbm)
layer=tb.verts.layers.deform.verify()
for sign in [-1,1]:
 strip=[]
 for i in range(29):
  theta=math.pi*i/28
  y=130+14*math.sin(theta);z=2+10.5*math.cos(theta)
  row=[]
  for side in [-1,1]:
   p=Vector((sign*(10.3+side*1.3),y,z));near,normal,face_id,_=tree.find_nearest(p)
   assert near is not None
   v=tb.verts.new(near+normal*.14)
   skinbm.faces.ensure_lookup_table();face=skinbm.faces[face_id]
   nearest=min(face.verts,key=lambda q:(q.co-near).length)
   for g,w in nearest[skinbm.verts.layers.deform.active].items():v[layer][g]=w
   row.append(v)
  strip.append(row)
 for a,b in zip(strip,strip[1:]):
  f=tb.faces.new((a[0],a[1],b[1],b[0]));f.smooth=True
bmesh.ops.recalc_face_normals(tb,faces=list(tb.faces));tb.to_mesh(top.data);tb.free();skinbm.free()
top['clinical_underlayer']='opaque body-following longline clinical top with shoulder straps'
obj['repair']='v11 from v10: edge-walk manifold collar, continuous upper-arm contour, clinical underlayer'
bpy.ops.wm.save_as_mainfile(filepath=str(TARGET))
for item in [bpy.data.objects['Dana_Ch22_Body'],obj,bpy.data.objects['Dana_Ch22_Eyelashes']]:
 for key in item.data.shape_keys.key_blocks:key.value=0
obj.hide_render=False;top.hide_render=False
for image in bpy.data.images:
 if image.has_data and max(image.size)>1024:image.scale(min(image.size[0],1024),min(image.size[1],1024))
bpy.ops.export_scene.gltf(filepath=str(PUBLIC/'dana-review.glb'),export_format='GLB',export_animations=True,export_animation_mode='ACTIVE_ACTIONS',export_cameras=False,export_lights=False,export_extras=True,export_morph=True)
print('MICRO_GEOMETRY_PASS','collar nonmanifold',len(bad),'folded edges',len(folds))
print('GLB_HASH',hashlib.sha256((PUBLIC/'dana-review.glb').read_bytes()).hexdigest())
