import bpy,bmesh
bpy.ops.wm.open_mainfile(filepath=r'C:\Projects\AI-Clinical-Simulation\visual-patient-lab\blender\patient_anaphylaxis_dana_v04.blend',load_ui=False)
for name in ['Dana_Ch22_Body','Dana_Exam_Skin']:
 o=bpy.data.objects[name];bm=bmesh.new();bm.from_mesh(o.data)
 edges={e for e in bm.edges if e.is_boundary};loops=[]
 while edges:
  edge=edges.pop();loop={*edge.verts};todo=list(edge.verts)
  while todo:
   for e in todo.pop().link_edges:
    if e in edges:edges.remove(e);loop.update(e.verts);todo.extend(e.verts)
  loops.append(loop)
 print('BOUNDARIES',name)
 for loop in loops:
  print(len(loop),[[round(f(v.co[i] for v in loop),3) for i in range(3)] for f in [min,max]])
 print('MODIFIERS',[(m.name,m.type) for m in o.modifiers])
 print('MATERIALS',[(m.name,[(n.name,n.image.name if n.type=='TEX_IMAGE' and n.image else '') for n in m.node_tree.nodes]) for m in o.data.materials])
