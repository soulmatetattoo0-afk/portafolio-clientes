"""Build the statue mannequins (GLB) with Blender running as a Python module.

    python tools/mannequin/build.py --out public/mannequin [--res 0.003] [--preview DIR]

Pipeline: signed-distance body -> marching cubes -> Blender decimation ->
tattoo-zone classification -> per-zone vertex split (zone boundaries stay
crisp, shading stays seamless through custom normals) -> GLB export with a
`_ZONE` vertex attribute, plus `zones.json` with the catalog and per-zone
anchors the viewer uses to frame the camera.
"""

from __future__ import annotations

import argparse
import json
import math
import sys
import time
from pathlib import Path

import numpy as np
from skimage.measure import marching_cubes

sys.path.insert(0, str(Path(__file__).parent))
from body import ZONES, Body, female, field, classify, male  # noqa: E402

import bpy  # noqa: E402  (bpy must come after numpy for the wheel's bundled libs)

BOUNDS = ((-0.62, 0.62), (-0.28, 0.20), (-0.01, 1.82))
TARGET_TRIS = 72_000


def prim_zrange(pr):
    if pr.kind == "rc":
        return min(pr.a[2] - pr.r1, pr.b[2] - pr.r2), max(pr.a[2] + pr.r1, pr.b[2] + pr.r2)
    if pr.kind == "sph":
        return pr.c[2] - pr.r1, pr.c[2] + pr.r1
    rmax = float(np.max(pr.radii))
    return pr.c[2] - rmax, pr.c[2] + rmax


def sample_volume(body: Body, h: float) -> tuple[np.ndarray, np.ndarray]:
    xs = np.arange(BOUNDS[0][0], BOUNDS[0][1] + h, h)
    ys = np.arange(BOUNDS[1][0], BOUNDS[1][1] + h, h)
    zs = np.arange(BOUNDS[2][0], BOUNDS[2][1] + h, h)
    vol = np.empty((len(xs), len(ys), len(zs)), dtype=np.float32)
    ranges = [prim_zrange(p) for p in body.prims]
    chunk = 24
    X, Y = np.meshgrid(xs, ys, indexing="ij")
    for z0 in range(0, len(zs), chunk):
        zc = zs[z0 : z0 + chunk]
        lo, hi = zc[0] - 0.07, zc[-1] + 0.07
        sub = Body(body.name, body.height, [p for p, (a, b) in zip(body.prims, ranges) if b >= lo and a <= hi], body.marks)
        P = np.stack(
            [np.repeat(X[..., None], len(zc), 2), np.repeat(Y[..., None], len(zc), 2), np.broadcast_to(zc, X.shape + (len(zc),))],
            axis=-1,
        )
        if not sub.prims:
            vol[:, :, z0 : z0 + chunk] = 1.0
            continue
        vol[:, :, z0 : z0 + chunk] = field(sub, P.reshape(-1, 3)).reshape(P.shape[:-1])
    origin = np.array([xs[0], ys[0], zs[0]])
    return vol, origin


def face_data(V, F):
    a, b, c = V[F[:, 0]], V[F[:, 1]], V[F[:, 2]]
    cr = np.cross(b - a, c - a)
    area2 = np.linalg.norm(cr, axis=1)
    n = cr / np.maximum(area2[:, None], 1e-12)
    return (a + b + c) / 3.0, n, cr


def vertex_normals(V, F):
    _, _, cr = face_data(V, F)
    vn = np.zeros_like(V)
    for k in range(3):
        np.add.at(vn, F[:, k], cr)
    return vn / np.maximum(np.linalg.norm(vn, axis=1, keepdims=True), 1e-12)


def smooth_labels(F, labels, iters=3):
    """Majority vote over edge-adjacent faces to remove speckles on zone borders."""
    edges = np.concatenate([F[:, [0, 1]], F[:, [1, 2]], F[:, [2, 0]]])
    fid = np.tile(np.arange(len(F)), 3)
    key = np.sort(edges, axis=1)
    order = np.lexsort((key[:, 1], key[:, 0]))
    ks, fs = key[order], fid[order]
    same = np.all(ks[1:] == ks[:-1], axis=1)
    pairs = np.stack([fs[:-1][same], fs[1:][same]], axis=1)
    nbr = [[] for _ in range(len(F))]
    for a, b in pairs:
        nbr[a].append(b)
        nbr[b].append(a)
    lab = labels.copy()
    for _ in range(iters):
        new = lab.copy()
        for i, ns in enumerate(nbr):
            if len(ns) < 2:
                continue
            vals = lab[ns]
            u, cnt = np.unique(vals, return_counts=True)
            j = np.argmax(cnt)
            if u[j] != lab[i] and cnt[j] >= 2:
                new[i] = u[j]
        lab = new
    return lab


def split_by_zone(V, F, N, labels):
    """Duplicate every vertex once per zone that touches it."""
    key = F * 64 + labels[:, None]  # (vertex, zone) pairs; zone < 64
    uniq, inv = np.unique(key.ravel(), return_inverse=True)
    src = uniq // 64
    zone = (uniq % 64).astype(np.float32)
    return V[src], inv.reshape(F.shape), N[src], zone


def blender_reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def decimate(V, F, target):
    me = bpy.data.meshes.new("raw")
    me.from_pydata(V.tolist(), [], F.tolist())
    me.update()
    ob = bpy.data.objects.new("raw", me)
    bpy.context.scene.collection.objects.link(ob)
    bpy.context.view_layer.objects.active = ob
    ob.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.remove_doubles(threshold=1e-6)
    bpy.ops.object.mode_set(mode="OBJECT")
    mod = ob.modifiers.new("dec", "DECIMATE")
    mod.decimate_type = "COLLAPSE"
    mod.ratio = min(1.0, target / max(len(me.polygons), 1))
    mod.use_symmetry = True
    mod.symmetry_axis = "X"
    tri = ob.modifiers.new("tri", "TRIANGULATE")
    sm = ob.modifiers.new("smooth", "CORRECTIVE_SMOOTH")
    sm.factor = 0.35
    sm.iterations = 4
    sm.use_only_smooth = True
    sm.smooth_type = "LENGTH_WEIGHTED"
    sm.rest_source = "ORCO"
    bpy.ops.object.modifier_apply(modifier="dec")
    bpy.ops.object.modifier_apply(modifier="tri")
    bpy.ops.object.modifier_apply(modifier="smooth")
    me = ob.data
    Vd = np.empty(len(me.vertices) * 3)
    me.vertices.foreach_get("co", Vd)
    Fd = np.empty(len(me.polygons) * 3, dtype=np.int64)
    me.polygons.foreach_get("vertices", Fd)
    bpy.data.objects.remove(ob)
    return Vd.reshape(-1, 3), Fd.reshape(-1, 3)


def export_glb(name, V, F, N, zone, path):
    me = bpy.data.meshes.new(name)
    me.from_pydata(V.tolist(), [], F.tolist())
    me.update()
    me.shade_smooth()
    me.normals_split_custom_set_from_vertices(N.tolist())
    attr = me.attributes.new("_ZONE", "FLOAT", "POINT")
    attr.data.foreach_set("value", zone)
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    for o in bpy.context.scene.objects:
        o.select_set(o == ob)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.export_scene.gltf(
        filepath=str(path),
        export_format="GLB",
        use_selection=True,
        export_attributes=True,
        export_normals=True,
        export_texcoords=False,
        export_materials="NONE",
        export_yup=True,
        export_apply=False,
    )
    return ob


ZONE_COLORS = np.array(
    [[0.55, 0.55, 0.55]]
    + [[(math.sin(i * 2.3) + 1) / 2 * 0.8 + 0.1, (math.sin(i * 1.7 + 2) + 1) / 2 * 0.8 + 0.1, (math.sin(i * 3.1 + 4) + 1) / 2 * 0.8 + 0.1] for i in range(1, 32)]
)


def render_previews(ob, zone, outdir: Path, tag: str):
    me = ob.data
    col = me.color_attributes.new("zcol", "FLOAT_COLOR", "POINT")
    rgba = np.concatenate([ZONE_COLORS[zone.astype(int)], np.ones((len(zone), 1))], axis=1)
    col.data.foreach_set("color", rgba.ravel())
    mat = bpy.data.materials.new("prev")
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    at = nt.nodes.new("ShaderNodeAttribute")
    at.attribute_name = "zcol"
    nt.links.new(at.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.6
    me.materials.append(mat)

    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 12
    scene.cycles.device = "CPU"
    scene.render.resolution_x = 640
    scene.render.resolution_y = 900
    world = bpy.data.worlds.new("w")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[1].default_value = 0.6
    scene.world = world
    sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN"))
    sun.data.energy = 3.5
    sun.rotation_euler = (math.radians(50), math.radians(10), math.radians(-30))
    scene.collection.objects.link(sun)
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
    cam.data.type = "ORTHO"
    cam.data.ortho_scale = 2.0
    scene.collection.objects.link(cam)
    scene.camera = cam
    views = {"front": (0, -4, 0.9, 90, 0, 0), "back": (0, 4, 0.9, 90, 0, 180), "side": (4, 0, 0.9, 90, 0, 90)}
    for v, (x, y, z, rx, ry, rz) in views.items():
        cam.location = (x, y, z)
        cam.rotation_euler = (math.radians(rx), math.radians(ry), math.radians(rz))
        scene.render.filepath = str(outdir / f"{tag}-{v}.png")
        bpy.ops.render.render(write_still=True)


def build(body: Body, h: float, out: Path, preview: Path | None):
    t = time.time()
    vol, origin = sample_volume(body, h)
    verts, faces, _, _ = marching_cubes(vol, level=0.0, spacing=(h, h, h))
    verts = verts + origin
    faces = faces.astype(np.int64)
    # Make faces point outwards.
    c, _, cr = face_data(verts, faces)
    if np.sum(np.einsum("ij,ij->i", c, cr)) < 0:
        faces = faces[:, ::-1]
    print(f"[{body.name}] marching cubes: {len(faces)} tris in {time.time() - t:.0f}s")

    blender_reset()
    V, F = decimate(verts, faces, TARGET_TRIS)
    centers, fn, _ = face_data(V, F)
    labels = smooth_labels(F, classify(body, centers, fn), iters=10)
    N = vertex_normals(V, F)
    Vs, Fs, Ns, zone = split_by_zone(V, F, N, labels)
    print(f"[{body.name}] decimated: {len(F)} tris, {len(Vs)} verts after zone split")

    out.mkdir(parents=True, exist_ok=True)
    ob = export_glb(f"body_{body.name}", Vs, Fs, Ns, zone, out / f"body-{body.name}.glb")

    # Per-zone anchors (three.js / glTF space: x, z, -y) for camera framing.
    anchors = {}
    for zid, slug, _, _ in ZONES:
        m = labels == zid
        if zid == 0 or not m.any():
            continue
        cz = centers[m]
        nz = fn[m].sum(axis=0)
        nz = nz / max(np.linalg.norm(nz), 1e-9)
        lo, hi = cz.min(axis=0), cz.max(axis=0)
        to_gl = lambda p: [round(float(p[0]), 4), round(float(p[2]), 4), round(float(-p[1]), 4)]  # noqa: E731
        anchors[slug] = {"center": to_gl(cz.mean(axis=0)), "normal": to_gl(nz), "extent": round(float(np.linalg.norm(hi - lo)), 4)}

    if preview:
        preview.mkdir(parents=True, exist_ok=True)
        render_previews(ob, zone, preview, body.name)
    return anchors


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--res", type=float, default=0.003)
    ap.add_argument("--preview", type=Path)
    ap.add_argument("--only", choices=["f", "m"])
    args = ap.parse_args()

    bodies = [b for b in (female(), male()) if not args.only or b.name == args.only]
    catalog = {"zones": [{"id": i, "slug": s, "es": es, "en": en} for i, s, es, en in ZONES], "bodies": {}}
    for body in bodies:
        anchors = build(body, args.res, args.out, args.preview)
        catalog["bodies"][body.name] = {"file": f"body-{body.name}.glb", "height_cm": round(body.height * 100), "anchors": anchors}
    if not args.only:
        (args.out / "zones.json").write_text(json.dumps(catalog, indent=1, ensure_ascii=False))


if __name__ == "__main__":
    main()
