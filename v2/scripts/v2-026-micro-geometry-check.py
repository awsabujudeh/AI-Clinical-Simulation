"""Read-only validation of v10 -> v12 affected authoring scope."""
import bpy,bmesh,hashlib,json
from pathlib import Path
ROOT=Path(r'C:\Projects\AI-Clinical-Simulation/visual-patient-lab/blender')
def signature(obj):
 mesh=obj.data
 payload=[[(tuple(v.co),[(g.group,g.weight) for g in v.groups]) for v in mesh.vertices],
          [(tuple(p.vertices),p.material_index) for p in mesh.polygons],
          [(k.name,[tuple(v.co) for v in k.data]) for k in mesh.shape_keys.key_blocks] if mesh.shape_keys else None,
          [list(row) for row in obj.matrix_world]]
 return hashlib.sha256(json.dumps(payload).encode()).hexdigest()
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'patient_anaphylaxis_dana_v10.blend'),load_ui=False)
before={o.name:signature(o) for o in bpy.data.objects if o.type=='MESH'}
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'patient_anaphylaxis_dana_v12.blend'),load_ui=False)
after={o.name:signature(o) for o in bpy.data.objects if o.type=='MESH'}
changed={name for name in before if before[name]!=after.get(name)}
assert changed=={'Dana_Exam_Skin','Dana_Clinical_Exam_Top'},changed
assert before.keys()==after.keys(),'No extra patient/environment object'
o=bpy.data.objects['Dana_Exam_Skin'];bm=bmesh.new();bm.from_mesh(o.data)
local=[e for e in bm.edges if all(abs(v.co.x)<16 and 130<v.co.y<151 for v in e.verts)]
assert all(e.is_manifold for e in local),'Open/overlapping collar join'
assert not [e for e in local if e.calc_face_angle()>1.4],'Folded collar'
for side in [-1,1]:
 edges=[e for e in bm.edges if all(24<side*v.co.x<38 for v in e.verts)]
 assert edges and all(e.is_manifold for e in edges)
 assert max(e.calc_face_angle() for e in edges)<1,'Sharp arm geometry'
keys=o.data.shape_keys.key_blocks
for key in keys:
 if key.name=='Mouth_Open':continue # retained authored lower jaw influence
 assert max((key.data[v.index].co-keys[0].data[v.index].co).length for v in o.data.vertices if abs(v.co.x)<17 and 133<v.co.y<151)<.00001
assert bpy.data.objects['Dana_Clinical_Exam_Top'].data.materials[0].diffuse_color[3]==1
print('PASS: only examination skin/coverage meshes changed; ordinary Dana, environment, pose and facial keys preserved.')
print('PASS: manifold collar and bilateral arm joins, no folded collar, opaque coverage.')
