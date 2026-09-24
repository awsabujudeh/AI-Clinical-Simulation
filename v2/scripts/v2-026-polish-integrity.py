"""Focused read-only v18 -> v23 micro-polish preservation/geometry checks."""
import bpy,bmesh,math,json
from pathlib import Path
from mathutils import Vector
ROOT=Path(r'C:\Projects\AI-Clinical-Simulation')
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'visual-patient-lab/blender/patient_anaphylaxis_dana_v18.blend'),load_ui=False)
original_names=['Dana_Ch22_Body','Dana_Ch22_Shirt','Dana_Ch22_Pants','Dana_Ch22_Hair','Dana_Ch22_Eyelashes','Dana_Ch22_Sneakers','Dana lower-body blanket','Dana mattress fitted sheet']
original={n:[tuple(v.co) for v in bpy.data.objects[n].data.vertices] for n in original_names}
exam=bpy.data.objects['Dana_BodyComplete_Exam']
old=[v.co.copy() for v in exam.data.vertices]
morph={k.name:[v.co-base for v,base in zip(k.data,old)] for k in exam.data.shape_keys.key_blocks}
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'visual-patient-lab/blender/patient_anaphylaxis_dana_v23.blend'),load_ui=False)
for n,points in original.items():assert [tuple(v.co) for v in bpy.data.objects[n].data.vertices]==points,n
exam=bpy.data.objects['Dana_BodyComplete_Exam'];points=[v.co for v in exam.data.vertices]
assert len(old)==len(points)
for before,after in zip(old,points):
 assert before.x==after.x and before.y==after.y
 assert (before-after).length<1.5
 if before.y>=138 or abs(before.x)>=13 or before.y<=112:assert before==after,'Preserve joins and identity'
for k in exam.data.shape_keys.key_blocks:
 for i,(v,base) in enumerate(zip(k.data,points)):assert ((v.co-base)-morph[k.name][i]).length<.00003,'Existing morph delta preserved'
for x in [-6,6]:
 i=min(range(len(points)),key=lambda i:(old[i]-Vector((x,129,12))).length)
 assert points[i].z-old[i].z>1.0,'Subtle bilateral contour must exist'
navel=[(a,b) for a,b in zip(old,points) if abs(a.x)<.5 and abs(a.y-115.5)<.6 and a.z>9]
assert navel and min(b.z-a.z for a,b in navel)<-.12
color=exam.data.color_attributes['Dana_Navel_Tone']
assert .6<min(c.color[0]/.57 for c in color.data)<.85
for v,c in zip(points,color.data):
 if c.color[0]/.57<.99:assert abs(v.x)<2 and 113<v.y<118 and v.z>9
bm=bmesh.new();bm.from_mesh(exam.data)
assert not [e for e in bm.edges if e.is_boundary and any(100<v.co.y<150 and abs(v.co.x)<40 for v in e.verts)]
bm.free()
for name in ['Bed articulating backrest panel','Bed backrest reinforcing rib left','Bed backrest reinforcing rib right']:
 o=bpy.data.objects[name];assert not o.animation_data
 for v in o.data.vertices:
  p=o.matrix_world@v.co
  if p.y>.22:assert p.z<.738+(p.y-.19)*math.tan(math.radians(35))-.01,'Metal stays beneath white mattress'
for name in ['Dana pillow','Dana pillow perimeter piping']:
 o=bpy.data.objects[name];assert not o.animation_data and o['shared_linen_uv']
 assert max(v.co.z for v in o.data.vertices)<1.20,'Fitted pillow must not cover face'
assert len([o for o in bpy.context.scene.objects if o.type=='ARMATURE'])==1
print('PASS_MICRO_POLISH_INTEGRITY',json.dumps({'original_meshes_exact':original_names,'existing_morph_deltas_preserved':True,'connected_joins':True,'bounded_paired_contour':True,'shallow_navel':True,'localized_crease_tone':True,'backrest_below_sheet':True,'no_donor_bedding_animation':True,'one_patient':True}))
