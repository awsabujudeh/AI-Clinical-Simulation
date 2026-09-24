"""Owner-authorized SAME-Dana body completion, independent v15 candidate.

New clean torso volume, not the rejected shirt-derived surface. Original face,
hands, clothing, rig and prior .blend files are preserved. Clinical truth is not
an input to this authoring script. No external asset or provider is used.
"""
import bpy,bmesh,math,hashlib,json
from pathlib import Path
from mathutils import Vector
from mathutils.kdtree import KDTree
from mathutils.bvhtree import BVHTree
ROOT=Path(r'C:\Projects\AI-Clinical-Simulation')
SOURCE=ROOT/'visual-patient-lab/blender/patient_anaphylaxis_dana_v14.blend'
TARGET=ROOT/'visual-patient-lab/blender/patient_anaphylaxis_dana_v16.blend'
DONOR=ROOT/'visual-patient-lab/blender/patient_stemi_physical_exam_runtime_v02.blend'
assert not TARGET.exists(),'Never overwrite an earlier working file'
hashes={str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in [SOURCE,DONOR,ROOT/'visual-patient-lab/assets/characters/Dana.fbx']}
bpy.ops.wm.open_mainfile(filepath=str(SOURCE),load_ui=False)
body=bpy.data.objects['Dana_Ch22_Body'];shirt=bpy.data.objects['Dana_Ch22_Shirt'];rig=bpy.data.objects['Dana_Mixamo_Rig']
for name in ['Dana_Exam_Skin','Dana_Clinical_Exam_Top']:
 # Rejected candidates remain recoverable in v04-v14, never in the new export.
 bpy.data.objects.remove(bpy.data.objects[name],do_unlink=True)

def smooth(a,b,x):
 t=max(0,min(1,(x-a)/(b-a)));return t*t*(3-2*t)
def mesh_object(name,verts,faces):
 mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
 obj=bpy.data.objects.new(name,mesh);bpy.context.scene.collection.objects.link(obj);return obj
def activate(obj):
 bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj
def ring_volume(profiles,axis=1):
 vs=[];fs=[];n=64
 for center,r1,r2 in profiles:
  for i in range(n):
   theta=i*2*math.pi/n;p=Vector(center);p[(axis+1)%3]+=math.cos(theta)*r1;p[(axis+2)%3]+=math.sin(theta)*r2;vs.append(p)
 for j in range(len(profiles)-1):
  for i in range(n):a=j*n+i;b=j*n+(i+1)%n;fs.append((a,b,b+n,a+n))
 fs.extend([tuple(reversed(range(n))),tuple((len(profiles)-1)*n+i for i in range(n))])
 return vs,fs

# Centimetre-space silhouette measured from the intact owner character. Smooth
# body sections have neither cloth folds nor the old reconstruction's geometry.
profiles=[(101,12.1,4.0,8.1),(106,11.5,4.0,8.0),(112,10.9,3.5,7.5),
 (118,11.3,3.2,8.0),(124,12.4,3.0,9.2),(130,13.8,3.2,10.0),
 (135,14.6,1.7,8.3),(139,15.2,.4,6.5),(143,12.8,.6,5.7),
 (146,7.0,1.4,4.7),(150,4.7,2.1,4.6),(153,4.4,2.5,4.5)]
vs,fs=ring_volume([((0,y,cz),rz,rx) for y,rx,cz,rz in profiles])
volume=mesh_object('Dana clean torso volume',vs,fs)
parts=[volume]
for sign in [-1,1]:
 vs,fs=ring_volume([((sign*x,y,z),ry,rz) for x,y,z,ry,rz in [(11,139.2,-.4,5.8,5.4),(17,140,-.7,5.9,5.1),(23,139.3,-1.1,4.8,4.6),(29,138.6,-1.3,4.1,4.0),(36,138,-1.7,3.8,3.7)]],0)
 parts.append(mesh_object('Dana clean upper arm',vs,fs))
activate(volume)
for obj in parts:obj.select_set(True)
bpy.ops.object.join()
remesh=volume.modifiers.new('Continuous shoulders / torso union','REMESH');remesh.mode='VOXEL';remesh.voxel_size=.48;remesh.use_smooth_shade=True
bpy.ops.object.modifier_apply(modifier=remesh.name)
sm=volume.modifiers.new('Anatomical surface continuity','SMOOTH');sm.factor=.8;sm.iterations=7
bpy.ops.object.modifier_apply(modifier=sm.name)

# Clip volume and COPY of source at clean geometric planes. Actual edge-order
# bridging below (not angular vertex sorting) makes manifold neck/arm joins.
bm=bmesh.new();bm.from_mesh(volume.data)
for co,no in [((33,0,0),(1,0,0)),((-33,0,0),(-1,0,0)),((0,147,0),(0,1,0))]:
 bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=.0001,plane_co=co,plane_no=no,clear_outer=True)
bm.to_mesh(volume.data);bm.free()
volume.matrix_world=body.matrix_world.copy();volume.parent=body.parent;volume.matrix_parent_inverse=body.matrix_parent_inverse.copy();volume.matrix_world=body.matrix_world.copy()
# Reuse wardrobe's existing deformation weights by bone NAME only; geometry is
# newly modeled. Transfer keeps the existing base position and breathing rig.
tree=KDTree(len(shirt.data.vertices))
for v in shirt.data.vertices:tree.insert(v.co,v.index)
tree.balance()
for g in body.vertex_groups:volume.vertex_groups.new(name=g.name)
for g in shirt.vertex_groups:
 if g.name not in volume.vertex_groups:volume.vertex_groups.new(name=g.name)
for v in volume.data.vertices:
 _,idx,_=tree.find(v.co);weights={shirt.vertex_groups[g.group].name:g.weight for g in shirt.data.vertices[idx].groups}
 for name,w in weights.items():volume.vertex_groups[name].add([v.index],w,'REPLACE')
arm=volume.modifiers.new('Dana original Mixamo skin','ARMATURE');arm.object=rig
skinmat=bpy.data.materials.new('Dana_Exam_Skin_Matched');skinmat.use_nodes=True
p=skinmat.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(.57,.365,.285,1);p.inputs['Roughness'].default_value=.8
volume.data.materials.append(skinmat)
copy=body.copy();copy.data=body.data.copy();bpy.context.scene.collection.objects.link(copy);copy.name='Dana_BodyComplete_Exam'
bm=bmesh.new();bm.from_mesh(copy.data)
# Disconnected head / arms / feet are deliberately selected locally, keeping
# the face, hands, eyes and their existing shape-key deltas exactly unchanged.
for co,no,pred in [((33,0,0),(-1,0,0),lambda v:v.co.x>20 and v.co.y>125),((-33,0,0),(1,0,0),lambda v:v.co.x<-20 and v.co.y>125),((0,147,0),(0,-1,0),lambda v:abs(v.co.x)<12 and v.co.y>135)]:
 verts={v for v in bm.verts if pred(v)};edges={e for v in verts for e in v.link_edges};faces={f for v in verts for f in v.link_faces}
 bmesh.ops.bisect_plane(bm,geom=list(verts|edges|faces),dist=.0001,plane_co=co,plane_no=no,clear_outer=True)
bm.to_mesh(copy.data);bm.free()
# Separate the two boundaries by a small clean transition strip.
for v in volume.data.vertices:
 if abs(abs(v.co.x)-33)<.001:v.co.x*=32/33
 if abs(v.co.y-147)<.001:v.co.y=146
activate(copy);volume.select_set(True);bpy.ops.object.join()
bm=bmesh.new();bm.from_mesh(copy.data)
def boundaries():
 edges={e for e in bm.edges if e.is_boundary};out=[]
 while edges:
  e=next(iter(edges));start=e.verts[0];cur=start;prev=None;loop=[]
  while True:
   loop.append(cur);candidates=[x for x in cur.link_edges if x in edges]
   if not candidates:break
   edge=candidates[0];edges.remove(edge);cur=edge.other_vert(cur)
   if cur==start:break
  out.append(loop)
 return out
loops=boundaries()
def center(loop):return sum((v.co for v in loop),Vector())/len(loop)
print('CLEAN_JOIN_LOOPS',[(len(l),tuple(round(x,2) for x in center(l))) for l in loops])
def get(axis,value):
 found=[l for l in loops if len(l)>10 and max(abs(v.co[axis]-value) for v in l)<.005]
 assert len(found)==1,(axis,value,len(found));return found[0]
def bridge(a,b):
 # Follow connectivity, rotate/reverse the second contour to the minimum total
 # correspondence cost, then merge arc-length schedules into a triangle strip.
 def params(loop):
  d=[0]
  for i in range(len(loop)):d.append(d[-1]+(loop[(i+1)%len(loop)].co-loop[i].co).length)
  return [x/d[-1] for x in d]
 best=None
 for seq in [b,list(reversed(b))]:
  for k in range(len(seq)):
   candidate=seq[k:]+seq[:k]
   score=sum((a[i].co-candidate[round(i*len(candidate)/len(a))%len(candidate)].co).length_squared for i in range(len(a)))
   if best is None or score<best[0]:best=(score,candidate)
 b=best[1];aa=params(a);bb=params(b);i=j=0
 while i<len(a) or j<len(b):
  if j==len(b) or (i<len(a) and aa[i+1]<=bb[j+1]):vs=(a[i%len(a)],a[(i+1)%len(a)],b[j%len(b)]);i+=1
  else:vs=(a[i%len(a)],b[(j+1)%len(b)],b[j%len(b)]);j+=1
  f=bm.faces.new(vs);f.material_index=1
bridge(get(0,33),get(0,32));bridge(get(0,-33),get(0,-32));bridge(get(1,147),get(1,146))
# Relax only the new joins and their skin-weight gradients. Head/face and distal
# arms/hands remain exact. Shape-key offsets are preserved by identical deltas.
shape_layers=list(bm.verts.layers.shape.values());deform=bm.verts.layers.deform.active
def join_weight(v):
 x,y,z=v.co
 return max((1-smooth(1,4,abs(abs(x)-32.5)))*smooth(128,132,y),
  (1-smooth(1,3,abs(y-146.5)))*(1-smooth(5,8,abs(x))))
for iteration in range(10):
 changes=[]
 for v in bm.verts:
  w=join_weight(v)
  if not w:continue
  neighbors=[e.other_vert(v) for e in v.link_edges]
  avg=sum((n.co for n in neighbors),Vector())/len(neighbors)
  ww={}
  for n in neighbors:
   for group,value in n[deform].items():ww[group]=ww.get(group,0)+value/len(neighbors)
  keys=set(ww)|set(v[deform].keys());weights={g:v[deform].get(g,0)*(1-.4*w)+ww.get(g,0)*.4*w for g in keys}
  changes.append((v,(avg-v.co)*(.30*w),weights))
 for v,delta,weights in changes:
  v.co+=delta
  for layer in shape_layers:v[layer]+=delta
  v[deform].clear()
  weights=dict(sorted(weights.items(),key=lambda x:-x[1])[:4]);total=sum(weights.values())
  for group,value in weights.items():v[deform][group]=value/total
bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
for f in bm.faces:f.smooth=True
bm.to_mesh(copy.data);bm.free()
copy.data.normals_split_custom_set([(0,0,0)]*len(copy.data.loops))
copy['body_complete_version']=16;copy['clean_volume_not_shirt_derived']=True;copy['same_dana_identity']=True
copy['review_status']='READY_FOR_VISUAL_QA';copy.hide_render=True

# Minimal independent swelling key is additive to the existing mouth/blink.
for obj in [body,copy,bpy.data.objects['Dana_Ch22_Eyelashes']]:
 key=obj.shape_key_add(name='Lip_Swelling_Mild',from_mix=False)
 for v,dst in zip(obj.data.vertices,key.data):
  x,y,z=v.co
  if obj.name.endswith('Eyelashes') or not (153.7<y<158.1 and abs(x)<3.2 and z>13.1):continue
  mask=math.exp(-(x/2.4)**4-((y-156.0)/1.0)**4)*smooth(13.1,14,z)
  dst.co.z+=.28*mask;dst.co.y+=(y-156)*.24*mask;dst.co.x+=x*.055*mask
 key.value=0

# Breast-only opaque underlayer, conformed to the NEW clean surface. Abdomen
# remains available. No underlying breast detail is authored or revealed.
sb=bmesh.new();sb.from_mesh(copy.data);sb.normal_update();sb.faces.ensure_lookup_table();tree=BVHTree.FromBMesh(sb)
torso_faces=[f for f in sb.faces if all(abs(v.co.x)<16 and 120<v.co.y<138 for v in f.verts)]
torso_tree=BVHTree.FromPolygons([v.co for v in sb.verts],[[v.index for v in f.verts] for f in torso_faces])
verts=[];faces=[];weights=[];sd=sb.verts.layers.deform.active
def topvertex(point,direction):
 hit,n,face,distance=torso_tree.ray_cast(Vector(point),Vector(direction),100)
 assert hit is not None,('Coverage fit',point)
 nearest=min(torso_faces[face].verts,key=lambda v:(v.co-hit).length_squared)
 verts.append(hit+n*.22);weights.append(dict(nearest[sd]));return len(verts)-1
n=80;rows=12
for j in range(rows+1):
 for i in range(n):
  a=2*math.pi*i/n;x=math.sin(a);z=math.cos(a)
  high=133.6-.8*abs(x);low=124.5
  y=low+(high-low)*j/rows
  topvertex((x*35,y,z*35+3),(-x,0,-z))
for j in range(rows):
 for i in range(n):a=j*n+i;b=j*n+(i+1)%n;faces.append((a,b,b+n,a+n))
# Wide neutral shoulder straps, following the torso rather than floating.
for sign in [-1,1]:
 strip=[]
 for i in range(41):
  angle=math.pi*i/40;row=[]
  for side in [-1,1]:
   target=Vector((sign*(9.0+side*1.35),132+13*math.sin(angle),2+10*math.cos(angle)))
   hit,n,face,d=tree.find_nearest(target);near=min(sb.faces[face].verts,key=lambda v:(v.co-hit).length_squared)
   row.append(len(verts));verts.append(hit+n*.24);weights.append(dict(near[sd]))
  strip.append(row)
 for a,b in zip(strip,strip[1:]):faces.append((a[0],a[1],b[1],b[0]))
sb.free();top=mesh_object('Dana_Clinical_Bra',verts,faces)
top.parent=body.parent;top.matrix_parent_inverse=body.matrix_parent_inverse.copy();top.matrix_world=body.matrix_world.copy()
for g in copy.vertex_groups:top.vertex_groups.new(name=g.name)
for i,ww in enumerate(weights):
 total=sum(ww.values())
 for group,weight in ww.items():top.vertex_groups[group].add([i],weight/total,'REPLACE')
arm=top.modifiers.new('Same Dana skin','ARMATURE');arm.object=rig
solid=top.modifiers.new('Opaque clinical fabric','SOLIDIFY');solid.thickness=.12
mat=bpy.data.materials.new('Dana neutral clinical breast coverage');mat.use_nodes=True
p=mat.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(.07,.14,.16,1);p.inputs['Roughness'].default_value=.85
top.data.materials.append(mat)
for f in top.data.polygons:f.use_smooth=True
top['breast_only_coverage']=True;top['abdomen_visible']=True;top.hide_render=True

# Exact material datablocks from the approved baseline, not new chosen colors.
with bpy.data.libraries.load(str(DONOR),link=False) as (src,dst):dst.materials=['Cotton','Blanket']
cotton,blanket=dst.materials
for name in ['Dana mattress fitted sheet','Dana pillow']:
 o=bpy.data.objects[name];o.data.materials.clear();o.data.materials.append(cotton);o['material_source']='STEMI physical-exam v02 / Cotton'
o=bpy.data.objects['Dana lower-body blanket'];o.data.materials.clear();o.data.materials.append(blanket);o['material_source']='STEMI physical-exam v02 / Blanket'
# All other bed/room items were carried from that foundation unchanged.
for obj in [body,copy,bpy.data.objects['Dana_Ch22_Eyelashes']]:
 for key in obj.data.shape_keys.key_blocks:key.value=0
bpy.ops.wm.save_as_mainfile(filepath=str(TARGET))
copy.hide_render=False;top.hide_render=False
for image in bpy.data.images:
 if image.has_data and max(image.size)>1024:image.scale(min(image.size[0],1024),min(image.size[1],1024))
out=ROOT/'v2/apps/web/public/visual-patient/dana/review-v01/dana-review.glb'
bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',export_animations=True,export_animation_mode='ACTIVE_ACTIONS',export_cameras=False,export_lights=False,export_extras=True,export_morph=True)
for path,sha in hashes.items():assert hashlib.sha256(Path(path).read_bytes()).hexdigest()==sha
report={'source_hashes_preserved':hashes,'new_blend':str(TARGET),'glb_sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'body_vertices':len(copy.data.vertices),'coverage_vertices':len(top.data.vertices),'owner_approval':'PENDING'}
folder=ROOT/'v2/test-results/v2-026-body-complete';folder.mkdir(parents=True,exist_ok=True)
(folder/'asset-build.json').write_text(json.dumps(report,indent=2))
print('BODY_COMPLETE_CANDIDATE',json.dumps(report))
