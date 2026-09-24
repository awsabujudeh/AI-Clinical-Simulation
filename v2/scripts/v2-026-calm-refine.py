"""Dana-only v25: gentle treatment relief, preserving all accepted geometry/keys."""
import bpy,math,hashlib,json
from pathlib import Path
ROOT=Path(r'C:\Projects\AI-Clinical-Simulation')
source=ROOT/'visual-patient-lab/blender/patient_anaphylaxis_dana_v24.blend'
target=ROOT/'visual-patient-lab/blender/patient_anaphylaxis_dana_v25.blend'
assert not target.exists()
before=hashlib.sha256(source.read_bytes()).hexdigest()
bpy.ops.wm.open_mainfile(filepath=str(source),load_ui=False)
def smooth(a,b,x):
 t=max(0,min(1,(x-a)/(b-a)));return t*t*(3-2*t)
def g(x,y,cx,cy,sx,sy):return math.exp(-((x-cx)/sx)**2-((y-cy)/sy)**2)
report={}
for name in ['Dana_Ch22_Body','Dana_BodyComplete_Exam']:
 o=bpy.data.objects[name];key=o.data.shape_keys.key_blocks['Improved_Calm_v01']
 # Restrict to the large connected skin component; teeth and eyes do not move.
 neighbors=[[] for _ in o.data.vertices]
 for e in o.data.edges:
  a,b=e.vertices;neighbors[a].append(b);neighbors[b].append(a)
 remaining=set(range(len(neighbors)));components=[]
 while remaining:
  seed=remaining.pop();group={seed};stack=[seed]
  while stack:
   for n in neighbors[stack.pop()]:
    if n in remaining:remaining.remove(n);group.add(n);stack.append(n)
  components.append(group)
 skin=max(components,key=len);changed=0
 for v,p in zip(o.data.vertices,key.data):
  x,y,z=v.co
  if v.index not in skin or not 152<y<161:continue
  front=smooth(11.8,13.35,z)
  corner=g(abs(x),y,2.15,155.95,.95,.90)*front
  cheek=g(abs(x),y,3.10,157.1,1.30,1.35)*front
  p.co.y+=.34*corner+.08*cheek
  p.co.x+=math.copysign(.12*corner,x)
  changed+=corner>1e-6
 assert max((p.co-v.co).length for v,p in zip(o.data.vertices,key.data))<.6
 report[name]=changed
for o in bpy.context.scene.objects:
 if o.type=='MESH' and o.data.shape_keys:
  for k in o.data.shape_keys.key_blocks:k.value=0
bpy.ops.wm.save_as_mainfile(filepath=str(target))
for name in ['Dana_BodyComplete_Exam','Dana_Clinical_Bra']:bpy.data.objects[name].hide_render=False
for image in bpy.data.images:
 if image.has_data and max(image.size)>1024:image.scale(min(image.size[0],1024),min(image.size[1],1024))
out=ROOT/'v2/apps/web/public/visual-patient/dana/review-v01/dana-review.glb'
bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',export_animations=True,export_animation_mode='ACTIVE_ACTIONS',export_cameras=False,export_lights=False,export_extras=True,export_morph=True,export_vertex_color='MATERIAL',export_all_vertex_colors=False)
assert hashlib.sha256(source.read_bytes()).hexdigest()==before
print('CALM_EXPORT',json.dumps({'source_preserved':before,'blend':str(target),'gentle_corner_vertices':report,'glb_sha256':hashlib.sha256(out.read_bytes()).hexdigest()}))
