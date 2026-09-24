"""Read-only Blender asset audit; writes only V2-026 diagnostic JSON."""
import bpy, json, math
from pathlib import Path
from mathutils import Quaternion
ROOT = Path(r"C:\Projects\AI-Clinical-Simulation")
OUT = ROOT / "v2/test-results/v2-026"
OUT.mkdir(parents=True, exist_ok=True)
def inspect():
    return {
        "objects": [{"name": o.name, "type": o.type, "location": list(o.location), "dimensions": list(o.dimensions),
          **({"vertices": len(o.data.vertices), "materials": [m.name for m in o.data.materials if m],
              "armature_modifiers": [m.object.name for m in o.modifiers if m.type == 'ARMATURE' and m.object],
              "vertex_groups": len(o.vertex_groups), "shape_keys": [k.name for k in o.data.shape_keys.key_blocks] if o.data.shape_keys else []} if o.type == 'MESH' else {}),
          **({"bones": [b.name for b in o.data.bones]} if o.type == 'ARMATURE' else {})} for o in bpy.context.scene.objects],
        "images": [{"name": i.name, "size": list(i.size), "packed": bool(i.packed_file), "path": i.filepath, "has_data": i.has_data} for i in bpy.data.images],
        "actions": [a.name for a in bpy.data.actions], "collections": [c.name for c in bpy.data.collections]
    }
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=str(ROOT / "visual-patient-lab/assets/characters/Dana.fbx"))
report = {"fbx": inspect()}
rig = next((o for o in bpy.context.scene.objects if o.type == 'ARMATURE'), None)
if rig:
    bone = next((b for b in rig.pose.bones if 'LeftForeArm' in b.name), None)
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH' and any(m.type == 'ARMATURE' and m.object == rig for m in o.modifiers)]
    def positions():
        bpy.context.view_layer.update()
        dg = bpy.context.evaluated_depsgraph_get()
        return [[v.co.copy() for v in o.evaluated_get(dg).data.vertices] for o in meshes]
    before = positions()
    if bone:
        bone.rotation_mode = 'QUATERNION'; bone.rotation_quaternion = Quaternion((0, 1, 0), .35)
        after = positions()
        report['skinning_probe'] = {"bone": bone.name, "max_vertex_displacement": max((a-b).length for av,bv in zip(after,before) for a,b in zip(av,bv))}
existing = ROOT / "visual-patient-lab/blender/patient_anaphylaxis_dana_v01.blend"
if existing.exists():
    bpy.ops.wm.open_mainfile(filepath=str(existing), load_ui=False)
    report['existing_dana_blend'] = inspect()
motion = ROOT / 'visual-patient-lab/assets/motion/mixamo/Laying Hand Gesture.fbx'
if motion.exists():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=str(motion))
    report['existing_hand_gesture_motion'] = inspect()
(OUT / "dana-asset-audit.json").write_text(json.dumps(report, indent=2), encoding='utf8')
print('DANA_AUDIT_COMPLETE', str(OUT / 'dana-asset-audit.json'))
