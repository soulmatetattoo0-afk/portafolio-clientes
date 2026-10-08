"""Statue mannequins from the MakeHuman base mesh (CC0), with tattoo zones.

    python tools/mannequin/human.py --out public/mannequin [--preview DIR] [--only f|m] [--tris 72000]

Source
------
`mh/` holds the few MakeHuman 1.x assets this build needs, copied verbatim
from https://github.com/makehumancommunity/makehuman (all CC0 1.0, see
mh/LICENSE.ASSETS.md and the headers of each file):

- `base.obj`: the hm08 base mesh (19,158 vertices, quads, decimetres, Y up,
  facing +Z, the figure's left side at +X). Only the `body` group is exported;
  the `helper-*` groups are dropped and the `joint-*` cubes are read for their
  centroids, which are the skeleton joints.
- `*-young.target`: MakeHuman macro targets (vertex index + xyz offset). The
  base mesh is MakeHuman's neutral human (gender 0.5); a fully female or male
  young adult of average muscle and weight is base + the three ethnic
  `<ethnic>-<gender>-young` targets at 1/3 each (the universal
  `averagemuscle-averageweight` target for "young" is empty, so the whole
  gender shape lives in the ethnic targets). `universal-*-maxmuscle-
  averageweight` adds tone: MakeHuman weighs it by `muscle*2-1`, so 0.15 is a
  muscle slider at 0.575.
- `default.mhskel` + `default_weights.mhw`: the default rig (joints as vertex
  groups) and per-bone vertex weights. The weights decide which limb segment a
  surface point belongs to; geometry (height bands between joints, normals)
  splits front/back/sides.

Blend
-----
    f: 1/3 african-female-young + 1/3 asian-female-young + 1/3 caucasian-female-young + 0.15 maxmuscle
    m: 1/3 african-male-young   + 1/3 asian-male-young   + 1/3 caucasian-male-young   + 0.25 maxmuscle

Each figure is then scaled to the catalog height (167 cm / 178 cm) with the
soles on y = 0.

Output (same contract as build.py)
---------------------------------
body-f.glb / body-m.glb: one mesh, metres, glTF Y up, facing +Z, left side at
+X, with a `_ZONE` float vertex attribute (ids from body.ZONES, never
renumbered), every vertex duplicated per zone that touches it so zone borders
are crisp while custom normals keep the shading seamless. zones.json: the
catalog plus per-zone anchors (centre, mean normal, extent) in glTF space.

Pipeline: parse → morph → Catmull-Clark twice (214k quads, a smooth statue
with ~5 mm polygons) → classify every fine polygon from interpolated bone
weights + geometry, with majority smoothing over adjacency → collapse-decimate
to the triangle budget with X symmetry while the vertices on zone borders are
kept (so borders stay 5 mm curves instead of 3 cm teeth) → labels back onto
the coarse triangles → per-zone vertex split with custom normals → GLB export
via Blender. The viewer feathers the border in its shader.
"""

from __future__ import annotations

import argparse
import json
import math
import sys
import time
from pathlib import Path

import numpy as np
from scipy.spatial import cKDTree

sys.path.insert(0, str(Path(__file__).parent))
from body import ZONES, ZONE_ID  # noqa: E402
from build import blender_reset, export_glb, face_data, split_by_zone, vertex_normals  # noqa: E402

import bpy  # noqa: E402  (bpy must come after numpy for the wheel's bundled libs)

MH = Path(__file__).parent / "mh"
HEIGHT_CM = {"f": 167, "m": 178}
BLEND = {
    "f": {
        "african-female-young": 1 / 3,
        "asian-female-young": 1 / 3,
        "caucasian-female-young": 1 / 3,
        "universal-female-young-maxmuscle-averageweight": 0.15,
    },
    "m": {
        "african-male-young": 1 / 3,
        "asian-male-young": 1 / 3,
        "caucasian-male-young": 1 / 3,
        "universal-male-young-maxmuscle-averageweight": 0.25,
    },
}


# ---------------------------------------------------------------------------
# MakeHuman file readers (plain parsers; the data is treated as data only)
# ---------------------------------------------------------------------------


def load_obj(path: Path):
    verts, groups, cur = [], {}, "default"
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            if line.startswith("v "):
                verts.append([float(x) for x in line.split()[1:4]])
            elif line.startswith("g "):
                cur = line.split()[1]
                groups.setdefault(cur, [])
            elif line.startswith("f "):
                groups.setdefault(cur, []).append([int(t.split("/")[0]) - 1 for t in line.split()[1:]])
    return np.asarray(verts, dtype=np.float64), groups


def load_target(path: Path):
    idx, delta = [], []
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            if not line or line[0] == "#":
                continue
            parts = line.split()
            if len(parts) < 4:
                continue
            idx.append(int(parts[0]))
            delta.append([float(parts[1]), float(parts[2]), float(parts[3])])
    return np.asarray(idx, dtype=np.int64), np.asarray(delta, dtype=np.float64)


def load_skeleton(path: Path):
    data = json.loads(path.read_text(encoding="utf-8"))
    bones = {name: {"head": b["head"], "tail": b["tail"], "parent": b.get("parent")} for name, b in data["bones"].items()}
    joints = {name: np.asarray(v, dtype=np.int64) for name, v in data["joints"].items()}
    return bones, joints


def load_weights(path: Path):
    data = json.loads(path.read_text(encoding="utf-8"))["weights"]
    return {bone: (np.asarray([i for i, _ in rows], dtype=np.int64), np.asarray([w for _, w in rows], dtype=np.float64)) for bone, rows in data.items()}


# ---------------------------------------------------------------------------
# Body parts from bone weights
# ---------------------------------------------------------------------------

PARTS = [
    "head", "neck", "spine01", "spine02", "spine03", "spine04", "pelvis",
    "pelvis_L", "pelvis_R", "breast_L", "breast_R", "clavicle_L", "clavicle_R",
    "shoulder_L", "shoulder_R", "upperarm_L", "upperarm_R", "forearm_L", "forearm_R",
    "hand_L", "hand_R", "thigh_L", "thigh_R", "lowerleg_L", "lowerleg_R", "foot_L", "foot_R",
]
PART_INDEX = {p: i for i, p in enumerate(PARTS)}


def part_of_bone(bone: str) -> str | None:
    side = "_L" if bone.endswith(".L") else "_R" if bone.endswith(".R") else ""
    base = bone[:-2] if side else bone
    if base in ("neck01", "neck02", "neck03"):
        return "neck"
    if base in ("spine01", "spine02", "spine03", "spine04"):
        return base
    if base in ("spine05", "root"):
        return "pelvis"
    if base == "pelvis":
        return "pelvis" + side
    if base == "breast":
        return "breast" + side
    if base == "clavicle":
        return "clavicle" + side
    if base == "shoulder01":
        return "shoulder" + side
    if base.startswith("upperarm"):
        return "upperarm" + side
    if base.startswith("lowerarm"):
        return "forearm" + side
    if base == "wrist" or base.startswith("metacarpal") or base.startswith("finger"):
        return "hand" + side
    if base.startswith("upperleg"):
        return "thigh" + side
    if base.startswith("lowerleg"):
        return "lowerleg" + side
    if base == "foot" or base.startswith("toe"):
        return "foot" + side
    return "head"  # head, jaw, eyes, tongue and every face bone


def part_weights(weights: dict, n_verts: int) -> np.ndarray:
    """(n_verts, len(PARTS)) matrix of normalised part weights."""
    W = np.zeros((n_verts, len(PARTS)), dtype=np.float64)
    for bone, (idx, w) in weights.items():
        part = part_of_bone(bone)
        np.add.at(W[:, PART_INDEX[part]], idx, w)
    W /= np.maximum(W.sum(axis=1, keepdims=True), 1e-9)
    return W


# ---------------------------------------------------------------------------
# Figure: morph, measure, scale
# ---------------------------------------------------------------------------


class Figure:
    def __init__(self, name: str):
        self.name = name
        V, groups = load_obj(MH / "base.obj")
        for target, w in BLEND[name].items():
            idx, delta = load_target(MH / f"{target}.target")
            V[idx] += w * delta
        self.quads = np.asarray(groups["body"], dtype=np.int64)
        self.body_idx = np.unique(self.quads)
        bones, joints = load_skeleton(MH / "default.mhskel")
        self.joint = {name: V[idx].mean(axis=0) for name, idx in joints.items()}
        self.bones = bones
        # Decimetres -> metres, feet on the floor, catalog height.
        body = V[self.body_idx]
        raw_height_cm = (body[:, 1].max() - body[:, 1].min()) * 10.0
        self.scale = 0.1 * HEIGHT_CM[name] / raw_height_cm
        self.shift = np.array([0.0, -body[:, 1].min(), 0.0])
        self.V = (V + self.shift) * self.scale
        self.joint = {k: (v + self.shift) * self.scale for k, v in self.joint.items()}
        self.raw_height_cm = raw_height_cm
        self.W = part_weights(load_weights(MH / "default_weights.mhw"), len(V))

    def head(self, bone: str) -> np.ndarray:
        return self.joint[self.bones[bone]["head"]]

    def tail(self, bone: str) -> np.ndarray:
        return self.joint[self.bones[bone]["tail"]]


# ---------------------------------------------------------------------------
# Mesh processing in Blender: subdivide + decimate (Blender axes: +Z up, -Y front)
# ---------------------------------------------------------------------------


def to_blender(P: np.ndarray) -> np.ndarray:
    return np.stack([P[:, 0], -P[:, 2], P[:, 1]], axis=1)


def from_blender(P: np.ndarray) -> np.ndarray:
    return np.stack([P[:, 0], P[:, 2], -P[:, 1]], axis=1)


def mesh_arrays(me):
    V = np.empty(len(me.vertices) * 3)
    me.vertices.foreach_get("co", V)
    loop_total = np.empty(len(me.polygons), dtype=np.int64)
    me.polygons.foreach_get("loop_total", loop_total)
    n = int(loop_total[0])
    assert np.all(loop_total == n), "mixed polygon sizes"
    F = np.empty(len(me.polygons) * n, dtype=np.int64)
    me.polygons.foreach_get("vertices", F)
    return from_blender(V.reshape(-1, 3)), F.reshape(-1, n)


def subdivide(V_body: np.ndarray, quads: np.ndarray, levels: int):
    """Catmull-Clark the skin `levels` times; returns the object and its (V, quads)."""
    me = bpy.data.meshes.new("skin")
    me.from_pydata(to_blender(V_body).tolist(), [], quads.tolist())
    me.update()
    ob = bpy.data.objects.new("skin", me)
    bpy.context.scene.collection.objects.link(ob)
    bpy.context.view_layer.objects.active = ob
    ob.select_set(True)
    sub = ob.modifiers.new("sub", "SUBSURF")
    sub.levels = sub.render_levels = levels
    sub.subdivision_type = "CATMULL_CLARK"
    bpy.ops.object.modifier_apply(modifier="sub")
    V, Q = mesh_arrays(ob.data)
    return ob, V, Q


def decimate_keeping(ob, keep: np.ndarray, target_tris: int):
    """Collapse-decimate to the budget while vertices flagged in `keep` survive,
    so zone borders keep the fine mesh's resolution. Returns (V, triangles)."""
    me = ob.data
    vg = ob.vertex_groups.new(name="keep")
    vg.add(np.nonzero(keep)[0].tolist(), 1.0, "REPLACE")
    n_tris = sum(len(p.vertices) - 2 for p in me.polygons)
    dec = ob.modifiers.new("dec", "DECIMATE")
    dec.decimate_type = "COLLAPSE"
    dec.ratio = min(1.0, target_tris / max(n_tris, 1))
    dec.use_symmetry = True
    dec.symmetry_axis = "X"
    dec.vertex_group = "keep"
    dec.invert_vertex_group = True
    dec.vertex_group_factor = 10.0
    bpy.ops.object.modifier_apply(modifier="dec")
    tri = ob.modifiers.new("tri", "TRIANGULATE")
    bpy.ops.object.modifier_apply(modifier="tri")
    V, F = mesh_arrays(ob.data)
    bpy.data.objects.remove(ob)
    return V, F


def poly_data(V, P):
    """Centroids and unit normals of polygons (triangles or quads)."""
    c = V[P].mean(axis=1)
    a, b, d = V[P[:, 0]], V[P[:, 1]], V[P[:, 2]]
    cr = np.cross(b - a, d - a)
    if P.shape[1] == 4:
        cr += np.cross(d - a, V[P[:, 3]] - a)
    n = cr / np.maximum(np.linalg.norm(cr, axis=1, keepdims=True), 1e-12)
    return c, n


def poly_neighbours(P: np.ndarray) -> np.ndarray:
    """(n_polys, sides) array of edge-adjacent polygon ids, -1 where none."""
    k = P.shape[1]
    edges = np.concatenate([np.stack([P[:, i], P[:, (i + 1) % k]], axis=1) for i in range(k)])
    pid = np.tile(np.arange(len(P)), k)
    slot = np.repeat(np.arange(k), len(P))
    key = np.sort(edges, axis=1)
    order = np.lexsort((key[:, 1], key[:, 0]))
    ks, ps, ss = key[order], pid[order], slot[order]
    same = np.all(ks[1:] == ks[:-1], axis=1)
    nbr = np.full((len(P), k), -1, dtype=np.int64)
    nbr[ps[:-1][same], ss[:-1][same]] = ps[1:][same]
    nbr[ps[1:][same], ss[1:][same]] = ps[:-1][same]
    return nbr


def smooth_poly_labels(P: np.ndarray, labels: np.ndarray, iters: int) -> np.ndarray:
    """Majority vote over edge neighbours (vectorised): a polygon takes the label
    that at least two of its neighbours agree on, which erases speckles and
    rounds off single-polygon teeth along a border."""
    nbr = poly_neighbours(P)
    lab = labels.copy()
    pad = np.append(lab, -1)
    for _ in range(iters):
        pad[:-1] = lab
        nl = pad[nbr]  # -1 where no neighbour
        new = lab.copy()
        for i in range(nl.shape[1]):
            for j in range(i + 1, nl.shape[1]):
                agree = (nl[:, i] == nl[:, j]) & (nl[:, i] >= 0)
                new = np.where(agree, nl[:, i], new)
        lab = new
    return lab


def border_vertices(P: np.ndarray, labels: np.ndarray, n_verts: int, rings: int = 1) -> np.ndarray:
    """Vertices touched by polygons of two different zones, dilated by `rings`."""
    nbr = poly_neighbours(P)
    pad = np.append(labels, -1)
    nl = pad[nbr]
    on_border = np.any((nl >= 0) & (nl != labels[:, None]), axis=1)
    keep = np.zeros(n_verts, dtype=bool)
    keep[np.unique(P[on_border])] = True
    for _ in range(rings):
        touched = np.any(keep[P], axis=1)
        keep[np.unique(P[touched])] = True
    return keep


# ---------------------------------------------------------------------------
# Zone classification
# ---------------------------------------------------------------------------


def unit(v):
    v = np.asarray(v, dtype=np.float64)
    return v / max(np.linalg.norm(v), 1e-12)


def classify(fig: Figure, centers: np.ndarray, normals: np.ndarray) -> np.ndarray:
    """Zone id per face. Figure space: metres, y up, +z front, left side +x."""
    # Interpolated part weights from the nearest base-mesh vertices.
    base = fig.V[fig.body_idx]
    tree = cKDTree(base)
    d, nn = tree.query(centers, k=4)
    wk = 1.0 / np.maximum(d, 1e-5)
    wk /= wk.sum(axis=1, keepdims=True)
    W = np.einsum("fk,fkp->fp", wk, fig.W[fig.body_idx][nn])
    part = np.array(PARTS, dtype=object)[W.argmax(axis=1)]
    weight = lambda p: W[:, PART_INDEX[p]]  # noqa: E731

    x, y, z = centers[:, 0], centers[:, 1], centers[:, 2]
    nx, ny, nz = normals[:, 0], normals[:, 1], normals[:, 2]
    side = np.where(x >= 0, "L", "R")
    zone = np.full(len(centers), "none", dtype=object)

    # Landmarks (heights in metres).
    S = {s: fig.head(f"upperarm01.{s}") for s in "LR"}  # shoulder joint
    E = {s: fig.head(f"lowerarm01.{s}") for s in "LR"}  # elbow
    Wr = {s: fig.head(f"wrist.{s}") for s in "LR"}  # wrist
    y_shoulder = S["L"][1]
    y_chest = fig.head("spine02")[1] + 0.35 * (fig.head("spine01")[1] - fig.head("spine02")[1])  # under the pectorals
    y_back = fig.head("spine02")[1]  # bottom of the ribcage: upper/lower back
    y_crest = fig.head("spine04")[1]  # iliac crest: ribs above, hips below
    y_sacrum = fig.head("pelvis.L")[1]  # lower back ends, glutes begin
    y_hip = fig.head("upperleg01.L")[1]  # hip joint: stomach ends
    z_neck = fig.head("neck01")[2]

    # Volar (palm-side) direction of each forearm, perpendicular to its axis.
    volar = {}
    for s in "LR":
        fingers = fig.head(f"finger3-1.{s}") - fig.head(f"wrist.{s}")
        thumb = fig.head(f"finger1-1.{s}") - fig.head(f"finger5-1.{s}")
        palm = unit(np.cross(fingers, thumb))
        if s == "R":
            palm = -palm  # mirrored hand: the cross product flips handedness
        axis = unit(Wr[s] - E[s])
        volar[s] = unit(palm - axis * (palm @ axis))

    def put(mask, fn):
        for i in np.nonzero(mask)[0]:
            zone[i] = fn(i)

    # Head stays unselectable; neck splits front/sides vs nape.
    neck = part == "neck"
    put(neck & (nz < -0.35), lambda i: "nape")
    put(neck & (nz >= -0.35), lambda i: "neck")

    # Arms. The deltoid cap is the first third of the shoulder->elbow axis.
    arm = np.isin(part, ["shoulder_L", "shoulder_R", "upperarm_L", "upperarm_R"])
    is_L = (side == "L")[:, None]
    S_f = np.where(is_L, S["L"], S["R"])
    E_f = np.where(is_L, E["L"], E["R"])
    lateral = np.abs(x) / abs(S["L"][0])
    t_arm = np.einsum("ij,ij->i", centers - S_f, E_f - S_f) / np.maximum(np.einsum("ij,ij->i", E_f - S_f, E_f - S_f), 1e-9)
    arm_proper = arm & (lateral > 0.72)
    put(arm_proper & (t_arm < 0.34), lambda i: f"shoulder_{side[i]}")
    put(arm_proper & (t_arm >= 0.34), lambda i: f"upper_arm_{side[i]}")
    fore = np.isin(part, ["forearm_L", "forearm_R"])
    inner = np.einsum("ij,ij->i", normals, np.where(is_L, volar["L"], volar["R"])) > 0
    put(fore & inner, lambda i: f"forearm_inner_{side[i]}")
    put(fore & ~inner, lambda i: f"forearm_outer_{side[i]}")
    put(np.isin(part, ["hand_L", "hand_R"]), lambda i: f"hand_{side[i]}")

    # Legs.
    put(np.isin(part, ["thigh_L", "thigh_R"]), lambda i: f"thigh_{side[i]}")
    lower = np.isin(part, ["lowerleg_L", "lowerleg_R"])
    put(lower & (nz > 0.15), lambda i: f"shin_{side[i]}")
    put(lower & (nz <= 0.15), lambda i: f"calf_{side[i]}")
    put(np.isin(part, ["foot_L", "foot_R"]), lambda i: f"foot_{side[i]}")

    # Torso: everything spine-, pelvis-, breast- or clavicle-driven, plus the
    # inner part of the shoulder girdle (trapezius, scapula).
    torso = np.isin(part, ["spine01", "spine02", "spine03", "spine04", "pelvis", "pelvis_L", "pelvis_R", "breast_L", "breast_R", "clavicle_L", "clavicle_R"]) | (arm & ~arm_proper)
    top = torso & (ny > 0.55) & (y > y_shoulder - 0.06)
    put(top & (z < z_neck), lambda i: "back_upper")
    put(top & (z >= z_neck), lambda i: f"chest_{side[i]}")
    rest = torso & ~top
    back = rest & (nz < -0.30)
    # The glutes start at the sacrum in the middle and higher towards the
    # sides, so the lower back ends on a shallow V, like the belt line does.
    y_glute = y_sacrum - 0.03 + 0.45 * np.abs(x)
    put(back & (y > y_back), lambda i: "back_upper")
    put(back & (y <= y_back) & (y > y_glute), lambda i: "back_lower")
    put(back & (y <= y_glute), lambda i: f"hip_{side[i]}")
    # Flanks: the outer part of the torso's width at that height, where the
    # surface already turns sideways. Half-width per 2 cm band of torso faces.
    band = np.round(y / 0.02).astype(np.int64)
    half_w = np.zeros(len(x))
    for bnd in np.unique(band[torso]):
        sel = torso & (band == bnd)
        half_w[sel] = np.percentile(np.abs(x[sel]), 97)
    flank = rest & ~back & (((np.abs(x) > 0.58 * half_w) & (np.abs(nx) > 0.35)) | (np.abs(nx) > 0.8))
    armpit = flank & (y > y_shoulder - 0.09)
    put(armpit & (nz >= 0), lambda i: f"chest_{side[i]}")
    put(armpit & (nz < 0), lambda i: "back_upper")
    put(flank & ~armpit & (y > y_crest), lambda i: f"ribs_{side[i]}")
    put(flank & ~armpit & (y <= y_crest), lambda i: f"hip_{side[i]}")
    front = rest & ~back & ~flank
    breast = (weight("breast_L") + weight("breast_R")) > 0.08
    put(front & ((y > y_chest) | breast), lambda i: f"chest_{side[i]}")
    put(front & ~((y > y_chest) | breast) & (y > y_hip - 0.08), lambda i: "stomach")
    # Below the pubic area at the front is the crotch: left unselectable.

    return np.array([ZONE_ID[str(zs)] for zs in zone], dtype=np.int32)


# ---------------------------------------------------------------------------
# Preview renders: one colour per zone (L saturated, R pale) with a legend
# ---------------------------------------------------------------------------


BASE_COLORS = {
    "neck": "#e03030", "nape": "#7a1515", "shoulder": "#f2d600", "upper_arm": "#d040d0",
    "forearm_inner": "#20c0c0", "forearm_outer": "#f08020", "hand": "#6040c0", "chest": "#30b030",
    "stomach": "#ff70a0", "ribs": "#205090", "back_upper": "#b0b020", "back_lower": "#8040a0",
    "hip": "#a07040", "thigh": "#e05020", "shin": "#3060e0", "calf": "#80d040", "foot": "#c02080",
}


def zone_palette() -> np.ndarray:
    """RGB per zone id; paired _L/_R zones share a hue, the right side is paler."""
    cols = np.full((64, 3), 0.45)
    for zid, slug, _, _ in ZONES:
        if zid == 0:
            continue
        base = slug[:-2] if slug.endswith(("_L", "_R")) else slug
        h = BASE_COLORS[base].lstrip("#")
        rgb = np.array([int(h[i : i + 2], 16) / 255 for i in (0, 2, 4)])
        cols[zid] = rgb * 0.55 + 0.45 if slug.endswith("_R") else rgb
    return cols


def zone_material(name: str, rgb, emission: bool = False):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    out = nt.nodes["Material Output"]
    if emission:
        em = nt.nodes.new("ShaderNodeEmission")
        em.inputs["Color"].default_value = (*rgb, 1.0)
        em.inputs["Strength"].default_value = 1.0
        nt.links.new(em.outputs["Emission"], out.inputs["Surface"])
    else:
        bsdf = nt.nodes["Principled BSDF"]
        at = nt.nodes.new("ShaderNodeAttribute")
        at.attribute_name = "zcol"
        nt.links.new(at.outputs["Color"], bsdf.inputs["Base Color"])
        bsdf.inputs["Roughness"].default_value = 0.6
    return mat


def render_previews(ob, zone: np.ndarray, outdir: Path, tag: str):
    me = ob.data
    pal = zone_palette()
    col = me.color_attributes.new("zcol", "FLOAT_COLOR", "POINT")
    rgba = np.concatenate([pal[zone.astype(int)], np.ones((len(zone), 1))], axis=1)
    col.data.foreach_set("color", rgba.ravel())
    me.materials.append(zone_material("prev", None))

    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 16
    scene.cycles.device = "CPU"
    scene.render.resolution_x = 720
    scene.render.resolution_y = 1000
    world = bpy.data.worlds.new("w")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[1].default_value = 0.6
    scene.world = world
    from mathutils import Vector

    for name, energy, towards in (("key", 2.6, (0.4, 1.0, -0.8)), ("fill", 2.2, (-0.4, -1.0, -0.6)), ("side", 1.4, (-1.0, 0.2, -0.4))):
        sun = bpy.data.objects.new(name, bpy.data.lights.new(name, "SUN"))
        sun.data.energy = energy
        sun.rotation_euler = Vector(towards).to_track_quat("-Z", "Y").to_euler()
        scene.collection.objects.link(sun)
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
    cam.data.type = "ORTHO"
    cam.data.ortho_scale = 2.0
    scene.collection.objects.link(cam)
    scene.camera = cam
    # Legend parented to the camera: zone names in their own colour, unlit.
    for k, (zid, slug, _, _) in enumerate([z for z in ZONES if z[0]]):
        fc = bpy.data.curves.new(f"legend_{slug}", type="FONT")
        fc.body = slug
        fc.size = 0.042
        txt = bpy.data.objects.new(f"legend_{slug}", fc)
        txt.data.materials.append(zone_material(f"legend_{slug}", pal[zid], emission=True))
        txt.parent = cam
        txt.visible_shadow = False
        txt.location = (-0.70, 1.32 - k * 0.062, -3.0)
        scene.collection.objects.link(txt)
    views = {"front": (0, -4, 0.9, 90, 0, 0), "back": (0, 4, 0.9, 90, 0, 180), "side": (4, 0, 0.9, 90, 0, 90)}
    for v, (x, y, z, rx, ry, rz) in views.items():
        cam.location = (x, y, z)
        cam.rotation_euler = (math.radians(rx), math.radians(ry), math.radians(rz))
        scene.render.filepath = str(outdir / f"{tag}-{v}.png")
        bpy.ops.render.render(write_still=True)


# ---------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------


def build(name: str, target_tris: int, out: Path, preview: Path | None):
    t0 = time.time()
    fig = Figure(name)
    print(f"[{name}] morphed: natural height {fig.raw_height_cm:.1f} cm -> {HEIGHT_CM[name]} cm, {len(fig.body_idx)} skin verts, {len(fig.quads)} quads")

    blender_reset()
    # Re-index the skin so the quads reference a compact vertex array.
    remap = np.full(len(fig.V), -1, dtype=np.int64)
    remap[fig.body_idx] = np.arange(len(fig.body_idx))
    ob, Vq, Q = subdivide(fig.V[fig.body_idx], remap[fig.quads], levels=2)
    qc, qn = poly_data(Vq, Q)
    fine = smooth_poly_labels(Q, classify(fig, qc, qn), iters=8)
    keep = border_vertices(Q, fine, len(Vq), rings=1)
    print(f"[{name}] fine mesh: {len(Q)} quads, {int(keep.sum())} border verts kept in {time.time() - t0:.0f}s")

    V, F = decimate_keeping(ob, keep, target_tris)
    centers, fn, cr = face_data(V, F)
    if np.sum(np.einsum("ij,ij->i", centers - centers.mean(axis=0), cr)) < 0:
        F = F[:, ::-1]
        centers, fn, cr = face_data(V, F)
    # Labels come from the fine mesh: borders survived decimation, so every
    # triangle sits on one side of them.
    _, nearest = cKDTree(qc).query(centers)
    labels = smooth_poly_labels(F, fine[nearest], iters=2)
    print(f"[{name}] decimated: {len(F)} tris, {len(V)} verts in {time.time() - t0:.0f}s")

    N = vertex_normals(V, F)
    Vs, Fs, Ns, zone = split_by_zone(V, F, N, labels)
    print(f"[{name}] zones: {len(np.unique(labels))} used, {len(Vs)} verts after zone split")

    out.mkdir(parents=True, exist_ok=True)
    # export_glb works in Blender axes (+Z up, -Y front); the glTF writer turns that into Y up / +Z front.
    ob = export_glb(f"body_{name}", to_blender(Vs), Fs, to_blender(Ns), zone, out / f"body-{name}.glb")

    # Per-zone anchors in glTF space (already y up / +z front here).
    anchors = {}
    for zid, slug, _, _ in ZONES:
        m = labels == zid
        if zid == 0 or not m.any():
            continue
        cz = centers[m]
        nz = fn[m].sum(axis=0)
        nz = nz / max(np.linalg.norm(nz), 1e-9)
        lo, hi = cz.min(axis=0), cz.max(axis=0)
        r4 = lambda p: [round(float(v), 4) for v in p]  # noqa: E731
        anchors[slug] = {"center": r4(cz.mean(axis=0)), "normal": r4(nz), "extent": round(float(np.linalg.norm(hi - lo)), 4)}
    missing = [slug for zid, slug, _, _ in ZONES if zid and slug not in anchors]
    if missing:
        print(f"[{name}] WARNING: zones without faces: {missing}")

    if preview:
        preview.mkdir(parents=True, exist_ok=True)
        render_previews(ob, zone, preview, name)
    print(f"[{name}] done in {time.time() - t0:.0f}s")
    return anchors


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--preview", type=Path)
    ap.add_argument("--only", choices=["f", "m"])
    ap.add_argument("--tris", type=int, default=72_000)
    args = ap.parse_args()

    names = [n for n in ("f", "m") if not args.only or n == args.only]
    catalog_path = args.out / "zones.json"
    catalog = json.loads(catalog_path.read_text()) if catalog_path.exists() else {}
    catalog["zones"] = [{"id": i, "slug": s, "es": es, "en": en} for i, s, es, en in ZONES]
    catalog.setdefault("bodies", {})
    for name in names:
        anchors = build(name, args.tris, args.out, args.preview)
        catalog["bodies"][name] = {"file": f"body-{name}.glb", "height_cm": HEIGHT_CM[name], "anchors": anchors}
    catalog_path.write_text(json.dumps(catalog, indent=1, ensure_ascii=False))


if __name__ == "__main__":
    main()
