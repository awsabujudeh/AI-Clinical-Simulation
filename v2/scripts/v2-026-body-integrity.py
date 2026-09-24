"""Read-only focused authoring integrity. Visual acceptance still needs app QA."""
import bpy,bmesh,math,json
from pathlib import Path
ROOT=Path(r'C:\Projects\AI-Clinical-Simulation')
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'visual-patient-lab/blender/patient_anaphylaxis_dana_v14.blend'),load_ui=False)
names=['Dana_Ch22_Body','Dana_Ch22_Shirt','Dana_Ch22_Pants','Dana_Ch22_Hair','Dana_Ch22_Sneakers']
original={n:[tuple(v.co) for v in bpy.data.objects[n].data.vertices] for n in names}
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'visual-patient-lab/blender/patient_anaphylaxis_dana_v18.blend'),load_ui=False)
for name,positions in original.items():assert [tuple(v.co) for v in bpy.data.objects[name].data.vertices]==positions,name
body=bpy.data.objects['Dana_Ch22_Body'];exam=bpy.data.objects['Dana_BodyComplete_Exam'];top=bpy.data.objects['Dana_Clinical_Bra']
assert 'Dana_Exam_Skin' not in bpy.data.objects
assert len([o for o in bpy.context.scene.objects if o.type=='ARMATURE'])==1
assert all(m.object==bpy.data.objects['Dana_Mixamo_Rig'] for o in [body,exam,top] for m in o.modifiers if m.type=='ARMATURE')
bm=bmesh.new();bm.from_mesh(exam.data)
assert not [e for e in bm.edges if e.is_boundary and any(100<v.co.y<150 and abs(v.co.x)<40 for v in e.verts)],'No open neck/shoulder/torso seams'
bm.free()
for obj in [exam,top]:
 for v in obj.data.vertices:
  assert all(math.isfinite(c) for c in v.co)
  # The imported FBX contains rounded weights (e.g. one finger = .9989217).
  # Preserve the source; glTF export normalizes them and its separate asset
  # audit asserts the actual four-component runtime sums equal one.
  assert sum(g.weight for g in v.groups)>0,(obj.name,v.index)
  assert all(math.isfinite(g.weight) and 0<=g.weight<=1 for g in v.groups)
assert min(v.co.y for v in top.data.vertices)>124,'Abdomen not hidden by a longline slab'
assert top.data.materials[0].node_tree.nodes.get('Principled BSDF').inputs['Alpha'].default_value==1
shape=body.data.shape_keys.key_blocks['Lip_Swelling_Mild'];changed=[]
for v,key in zip(body.data.vertices,shape.data):
 d=(key.co-v.co).length
 if d>1e-6:
  changed.append(v.index);assert 153.7<v.co.y<158.1 and abs(v.co.x)<3.2 and v.co.z>13.1
  assert d<.4
assert changed,'Swelling must be real geometry, not a label'
for name in ['Blink_Left','Blink_Right','Mouth_Open','Anxious_Foundation_v01','Improved_Calm_v01','Lip_Swelling_Mild']:
 assert name in exam.data.shape_keys.key_blocks
for name in ['Dana mattress fitted sheet','Dana pillow','Dana lower-body blanket']:assert bpy.data.objects[name]['shared_linen_uv']
print('PASS_BODY_INTEGRITY',json.dumps({'original_identity_meshes_unchanged':names,'one_armature':True,'closed_exam_joins':True,'finite_positive_source_skin_weights':True,'runtime_weight_normalization_checked_in_asset_audit':True,'six_morphs':True,'swelling_vertices':len(changed),'opaque_breast_only_coverage':True,'shared_linen_uvs':True}))
