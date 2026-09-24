"""Dana-only minimal facial authoring. v02 and all STEMI sources are read-only.

Coordinates are the inspected Ch22 FBX centimetre space (Y up, +Z face).
Connected eye globes are deliberately excluded from every deformation.
Review renders, not clinical approval, are produced beside the integrity report.
"""
import bpy, math, json, hashlib
from pathlib import Path
from mathutils import Vector
ROOT=Path(r'C:\Projects\AI-Clinical-Simulation')
SOURCE=ROOT/'visual-patient-lab/blender/patient_anaphylaxis_dana_v02.blend'
TARGET=ROOT/'visual-patient-lab/blender/patient_anaphylaxis_dana_v03.blend'
OUT=ROOT/'v2/test-results/v2-026'
PUBLIC=ROOT/'v2/apps/web/public/visual-patient/dana/review-v01'
source_hash=hashlib.sha256(SOURCE.read_bytes()).hexdigest()
bpy.ops.wm.open_mainfile(filepath=str(SOURCE),load_ui=False)
body=bpy.data.objects['Dana_Ch22_Body'];lashes=bpy.data.objects['Dana_Ch22_Eyelashes']
rig=bpy.data.objects['Dana_Mixamo_Rig'];scene=bpy.context.scene
# Find the skin component by connectivity instead of moving eye globes/teeth.
neighbors=[[] for _ in body.data.vertices]
for e in body.data.edges:
 a,b=e.vertices;neighbors[a].append(b);neighbors[b].append(a)
remaining=set(range(len(neighbors)));components=[]
while remaining:
 seed=remaining.pop();group={seed};stack=[seed]
 while stack:
  for n in neighbors[stack.pop()]:
   if n in remaining:remaining.remove(n);group.add(n);stack.append(n)
 components.append(group)
skin=max(components,key=len)
print('COMPONENTS',[(len(c),[tuple(round(n,2) for n in body.data.vertices[min(c)].co)]) for c in components])
def smooth(a,b,x):
 t=max(0,min(1,(x-a)/(b-a)));return t*t*(3-2*t)
def g(x,y,cx,cy,sx,sy):return math.exp(-((x-cx)/sx)**2-((y-cy)/sy)**2)
names=['Blink_Left','Blink_Right','Mouth_Open','Anxious_Foundation_v01','Improved_Calm_v01']
for obj in (body,lashes):
 obj.shape_key_add(name='Basis')
 for name in names:
  key=obj.shape_key_add(name=name)
  for v,p in zip(obj.data.vertices,key.data):
   if obj==body and v.index not in skin:continue
   x,y,z=v.co;front=smooth(11.8,13.35,z)
   if y<149 or not front:continue
   ax=abs(x)
   if name.startswith('Blink'):
    side=1 if name=='Blink_Left' else -1
    if x*side<=0:continue
    span=smooth(1.45,2.25,ax)*(1-smooth(4.15,5.2,ax))
    band=smooth(160.95,161.55,y)*(1-smooth(162.6,163.45,y))
    weight=span*band*front
    # The thin lash strip follows the lids rather than staying across the eye.
    p.co.y+=(161.96-y)*weight
    p.co.z+=.12*weight
   elif obj==body and name=='Mouth_Open':
    width=math.exp(-(x/3.6)**4)
    lower=(1-smooth(155.78,155.96,y))*smooth(150.2,153.0,y)*(1-smooth(156.0,157.1,y))
    p.co.y-=.72*width*lower*front
    p.co.z-=.12*width*lower*front
    p.co.y+=.08*g(x,y,0,156.3,2, .65)*front
   elif obj==body and name=='Anxious_Foundation_v01':
    inner=g(ax,y,1.65,164.35,1.0,1.05)*front
    outer=g(ax,y,4.1,164.1,1.1,.8)*front
    corner=g(ax,y,2.1,155.95,.8,.9)*front
    p.co.y+=.28*inner-.08*outer-.17*corner
    p.co.x-=math.copysign(.11*inner,x)
   elif obj==body and name=='Improved_Calm_v01':
    # Quiet relaxation, not a smile. Anxious tension is blended away separately.
    p.co.y-=.07*g(ax,y,2.5,164.3,1.7,1.0)*front
    p.co.z-=.045*g(x,y,0,156,2.4,1.0)*front
  key.value=0
body['facial_authoring']='Dana minimal v01; owner visual review pending; eye globes unchanged'
def expression(values):
 for obj in (body,lashes):
  for k in obj.data.shape_keys.key_blocks:
   if k.name!='Basis':k.value=values.get(k.name,0)
 bpy.context.view_layer.update()
report={'source_sha256':source_hash,'output':str(TARGET),'owner_visual_review':'PENDING','shapes':{}}
for obj in (body,lashes):
 for k in obj.data.shape_keys.key_blocks:
  if k.name=='Basis':continue
  distances=[(p.co-v.co).length for p,v in zip(k.data,obj.data.vertices)]
  assert all(math.isfinite(d) and d<1.8 for d in distances)
  if obj==body:assert all(distances[i]<1e-6 for i in range(len(distances)) if i not in skin)
  report['shapes'][obj.name+'/'+k.name]={'vertices':sum(d>1e-6 for d in distances),'max_delta_cm':max(distances)}
expression({'Anxious_Foundation_v01':1})
# The original full-body camera remains the scene default and fallback source.
overview=scene.camera
bpy.ops.wm.save_as_mainfile(filepath=str(TARGET))
scene.render.resolution_x=1100;scene.render.resolution_y=800
scene.render.filepath=str(PUBLIC/'dana-static-anxious.png');bpy.ops.render.render(write_still=True)
head=next(b for b in rig.pose.bones if b.name.endswith(':Head'))
target=rig.matrix_world@head.head+Vector((0,.075,.075))
data=bpy.data.cameras.new('Dana_Facial_Review');cam=bpy.data.objects.new('Dana_Facial_Review',data);scene.collection.objects.link(cam)
cam.location=target+Vector((0,-.43,.66));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
data.type='ORTHO';data.ortho_scale=.32;scene.camera=cam
scene.render.resolution_x=800;scene.render.resolution_y=800
for label,values in [('anxious',{'Anxious_Foundation_v01':1}),('blink',{'Anxious_Foundation_v01':1,'Blink_Left':1,'Blink_Right':1}),('speaking',{'Anxious_Foundation_v01':1,'Mouth_Open':.8}),('improved',{'Improved_Calm_v01':1})]:
 expression(values);scene.render.filepath=str(OUT/('dana-face-'+label+'.png'));bpy.ops.render.render(write_still=True)
scene.camera=overview
expression({})
for i in bpy.data.images:
 if i.has_data and max(i.size)>1024:i.scale(min(i.size[0],1024),min(i.size[1],1024))
bpy.data.objects['Dana_Clinical_Exam_Top'].hide_render=False
bpy.ops.export_scene.gltf(filepath=str(PUBLIC/'dana-review.glb'),export_format='GLB',export_animations=True,export_animation_mode='ACTIVE_ACTIONS',export_cameras=False,export_lights=False,export_extras=True,export_morph=True)
assert hashlib.sha256(SOURCE.read_bytes()).hexdigest()==source_hash
report['glb_sha256']=hashlib.sha256((PUBLIC/'dana-review.glb').read_bytes()).hexdigest()
report['fallback_sha256']=hashlib.sha256((PUBLIC/'dana-static-anxious.png').read_bytes()).hexdigest()
(OUT/'dana-facial-integrity.json').write_text(json.dumps(report,indent=2))
print('DANA_FACIAL_REVIEW_ARTIFACTS',json.dumps(report))
