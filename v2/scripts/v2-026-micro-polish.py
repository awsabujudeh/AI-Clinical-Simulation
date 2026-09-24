"""Four owner-requested visual refinements, v18 -> independent v19.

No clinical/source identity, morph expression, arm targeting or room-layout edit.
"""
import bpy,math,hashlib,json
from pathlib import Path
from mathutils import Vector,Matrix
ROOT=Path(r'C:\Projects\AI-Clinical-Simulation')
source=ROOT/'visual-patient-lab/blender/patient_anaphylaxis_dana_v18.blend'
donor=ROOT/'visual-patient-lab/blender/patient_stemi_physical_exam_runtime_v02.blend'
target=ROOT/'visual-patient-lab/blender/patient_anaphylaxis_dana_v19.blend'
assert not target.exists(),'Preserve every earlier Dana authoring candidate'
preserved={str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in [source,donor]}
bpy.ops.wm.open_mainfile(filepath=str(source),load_ui=False)

def smooth(a,b,x):
 t=max(0,min(1,(x-a)/(b-a)));return t*t*(3-2*t)
def chest_delta(p):
 x,y,z=p
 # Broad shallow paired volumes under the unchanged opaque band, with a
 # slight centre relaxation. Compact support excludes neck/shoulder joins.
 if not (121<y<138 and abs(x)<13 and z>5):return 0
 gate=smooth(121,124,y)*(1-smooth(134,138,y))*(1-smooth(10,13,abs(x)))*smooth(5,9,z)
 paired=math.exp(-((x-6.0)/3.7)**2)+math.exp(-((x+6.0)/3.7)**2)
 return gate*math.exp(-((y-129.0)/3.9)**2)*(1.45*paired-.65*math.exp(-(x/2.5)**2))
def navel_delta(p):
 x,y,z=p
 if not (112<y<119 and abs(x)<3 and z>9):return 0
 r=(x/.55)**2+((y-115.5)/.78)**2
 return -.31*math.exp(-r*1.3)+.035*math.exp(-((math.sqrt(r)-1.4)/.35)**2)

report={}
for name in ['Dana_BodyComplete_Exam','Dana_Clinical_Bra']:
 o=bpy.data.objects[name];coords=[v.co.copy() for v in o.data.vertices]
 delta=[chest_delta(p)+(navel_delta(p) if name.endswith('Exam') else 0) for p in coords]
 keys=o.data.shape_keys
 saved={k.name:[v.co.copy() for v in k.data] for k in keys.key_blocks} if keys else {}
 for i,v in enumerate(o.data.vertices):v.co.z=coords[i].z+delta[i]
 if keys:
  for k in keys.key_blocks:
   for i,v in enumerate(k.data):v.co=saved[k.name][i]+Vector((0,0,delta[i]))
 for p in o.data.polygons:p.use_smooth=True
 o['micro_polish_version']=19
 report[name]={'changed_vertices':sum(abs(d)>1e-7 for d in delta),'z_delta_cm':[min(delta),max(delta)]}

# The gray region was the donor 42-degree metal backrest protruding THROUGH
# Dana's already accepted 35-degree white fitted mattress. Align its supports
# underneath that mattress, rather than painting metal to conceal overlap.
for name in ['Bed articulating backrest panel','Bed backrest reinforcing rib left','Bed backrest reinforcing rib right']:
 o=bpy.data.objects[name]
 o.matrix_world=Matrix.Translation((0,.19,.718))@Matrix.Rotation(math.radians(-7),4,'X')@Matrix.Translation((0,-.15,-.814))@o.matrix_world
 o['dana_mattress_support_alignment']=35

# Reuse the approved pillow's rectangular cushion/compressed centre and piping.
# Only a fitted local copy enters Dana; donor and all previous files stay intact.
old=bpy.data.objects['Dana pillow'];bpy.data.objects.remove(old,do_unlink=True)
with bpy.data.libraries.load(str(donor),link=False) as (src,dst):
 dst.objects=['Pillow compressed beneath head','Pillow perimeter piping']
pillow,pipe=dst.objects
rot=Matrix.Rotation(math.radians(-7),3,'X')
points=[rot@(pillow.matrix_world@v.co) for v in pillow.data.vertices]
center=Vector([(min(p[i] for p in points)+max(p[i] for p in points))/2 for i in range(3)])
for o,name in [(pillow,'Dana pillow'),(pipe,'Dana pillow perimeter piping')]:
 bpy.context.scene.collection.objects.link(o)
 matrix=o.matrix_world.copy();o.data=o.data.copy()
 for v in o.data.vertices:v.co=(rot@(matrix@v.co)-center)*.84+Vector((0,.69,1.105))
 o.matrix_world=Matrix.Identity(4);o.name=name
 # Keep precisely the current shared white linen material and existing UVs.
 if name=='Dana pillow':o.data.materials.clear();o.data.materials.append(bpy.data.materials['Cotton'])
 o['shared_linen_uv']=True;o['source_pillow']='STEMI approved scene / fitted Dana-only copy'

for name in ['Dana_Ch22_Body','Dana_BodyComplete_Exam','Dana_Ch22_Eyelashes']:
 for key in bpy.data.objects[name].data.shape_keys.key_blocks:key.value=0
bpy.ops.wm.save_as_mainfile(filepath=str(target))
for name in ['Dana_BodyComplete_Exam','Dana_Clinical_Bra']:bpy.data.objects[name].hide_render=False
for image in bpy.data.images:
 if image.has_data and max(image.size)>1024:image.scale(min(image.size[0],1024),min(image.size[1],1024))
out=ROOT/'v2/apps/web/public/visual-patient/dana/review-v01/dana-review.glb'
bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',export_animations=True,export_animation_mode='ACTIVE_ACTIONS',export_cameras=False,export_lights=False,export_extras=True,export_morph=True)
for path,digest in preserved.items():assert hashlib.sha256(Path(path).read_bytes()).hexdigest()==digest
print('MICRO_POLISH_EXPORT',json.dumps({'source_preserved':preserved,'geometry':report,'blend':str(target),'glb_sha256':hashlib.sha256(out.read_bytes()).hexdigest()}))
