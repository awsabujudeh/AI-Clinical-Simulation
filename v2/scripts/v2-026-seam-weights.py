"""Continue v08: equalize skin-weight gradients across the connected joins."""
import bpy,hashlib
from pathlib import Path
ROOT=Path(r'C:\Projects\AI-Clinical-Simulation')
SOURCE=ROOT/'visual-patient-lab/blender/patient_anaphylaxis_dana_v08.blend'
TARGET=ROOT/'visual-patient-lab/blender/patient_anaphylaxis_dana_v09.blend'
PUBLIC=ROOT/'v2/apps/web/public/visual-patient/dana/review-v01'
bpy.ops.wm.open_mainfile(filepath=str(SOURCE),load_ui=False)
obj=bpy.data.objects['Dana_Exam_Skin'];mesh=obj.data
neighbors=[set() for v in mesh.vertices]
for edge in mesh.edges:
 a,b=edge.vertices;neighbors[a].add(b);neighbors[b].add(a)
def smooth(a,b,x):
 t=max(0,min(1,(x-a)/(b-a)));return t*t*(3-2*t)
regions=[];weights=[]
for v in mesh.vertices:
 x,y,z=v.co
 regions.append(max(smooth(133,138,y)*(1-smooth(148,153,y))*(1-smooth(10,18,abs(x))),smooth(21,26,abs(x))*(1-smooth(33,40,abs(x)))*smooth(126,132,y)))
 weights.append({g.group:g.weight for g in v.groups if obj.vertex_groups[g.group].name.startswith('mixamorig')})
for _ in range(22):
 result=[]
 for i,old in enumerate(weights):
  if not regions[i] or not neighbors[i]:result.append(old);continue
  avg={};blend=regions[i]*.45
  for neighbor in neighbors[i]:
   for k,w in weights[neighbor].items():avg[k]=avg.get(k,0)+w/len(neighbors[i])
  result.append({k:old.get(k,0)*(1-blend)+avg.get(k,0)*blend for k in set(old)|set(avg)})
 weights=result
for i,row in enumerate(weights):
 if not regions[i]:continue
 row=dict(sorted(row.items(),key=lambda kv:-kv[1])[:4]);total=sum(row.values())
 for group in obj.vertex_groups:
  if group.name.startswith('mixamorig'):group.remove([i])
 for k,w in row.items():obj.vertex_groups[k].add([i],w/total,'REPLACE')
obj['repair']='v09: continuous join geometry plus smoothed four-bone skin-weight gradients'
bpy.ops.wm.save_as_mainfile(filepath=str(TARGET))
for item in [bpy.data.objects['Dana_Ch22_Body'],obj,bpy.data.objects['Dana_Ch22_Eyelashes']]:
 for key in item.data.shape_keys.key_blocks:key.value=0
obj.hide_render=False;bpy.data.objects['Dana_Clinical_Exam_Top'].hide_render=False
for image in bpy.data.images:
 if image.has_data and max(image.size)>1024:image.scale(min(image.size[0],1024),min(image.size[1],1024))
bpy.ops.export_scene.gltf(filepath=str(PUBLIC/'dana-review.glb'),export_format='GLB',export_animations=True,export_animation_mode='ACTIVE_ACTIONS',export_cameras=False,export_lights=False,export_extras=True,export_morph=True)
print('GLB_HASH',hashlib.sha256((PUBLIC/'dana-review.glb').read_bytes()).hexdigest())
