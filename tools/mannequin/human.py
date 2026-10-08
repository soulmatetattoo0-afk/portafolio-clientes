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


def smooth_poly_labels(P: np.ndarray, labels: np.ndarray, iters: int, need: int | None = None) -> np.ndarray:
    """Majority vote over edge neighbours (vectorised): a polygon takes the label
    that at least `need` of its neighbours agree on (all but one by default,
    so only speckles and single-polygon teeth change and the borders the
    rules drew stay where they are)."""
    nbr = poly_neighbours(P)
    k = nbr.shape[1]
    need = max(2, k - 1) if need is None else need
    lab = labels.copy()
    pad = np.append(lab, -1)
    for _ in range(iters):
        pad[:-1] = lab
        nl = pad[nbr]  # -1 where no neighbour
        new = lab.copy()
        for i in range(k):
            cand = nl[:, i]
            count = np.zeros(len(lab), dtype=np.int64)
            for j in range(k):
                count += (nl[:, j] == cand) & (cand >= 0)
            new = np.where((count >= need) & (cand != lab), cand, new)
        lab = new
    return lab


def smooth_normals(P: np.ndarray, N: np.ndarray, iters: int) -> np.ndarray:
    """Average each polygon's normal with its edge neighbours' a few times, so
    the zone rules read the body's overall shape rather than every bump."""
    nbr = poly_neighbours(P)
    valid = nbr >= 0
    out = N.copy()
    for _ in range(iters):
        acc = out.copy()
        for k in range(nbr.shape[1]):
            acc += np.where(valid[:, k : k + 1], out[np.maximum(nbr[:, k], 0)], 0.0)
        out = acc / np.maximum(np.linalg.norm(acc, axis=1, keepdims=True), 1e-12)
    return out


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
    """Zone id per face. Figure space: metres, y up, +z front, left side +x.

    Each atomic zone follows the muscle group it is named after. Bone weights
    decide the limb a face belongs to (arm, forearm, hand, thigh, lower leg,
    foot, neck or torso); inside each limb the borders are geometric, from
    skeleton landmarks and from the mesh itself:

    - shoulder: the deltoid cap around the humeral head, ending in a V on the
      outer arm at ~45 % of the humerus and much higher on the inner side.
    - upper arm: from the deltoid insertion to the elbow, all the way round.
    - forearm inner/outer: split by the volar (palm-side) direction.
    - chest L/R: the pectoral, bounded below by the pec's lower edge, measured
      on the mesh as the lowest downward-facing skin under each breast (the
      inframammary fold), fitted as a curve across the chest; bounded on the
      side where the skin turns sideways (the anterior axillary line).
    - chest centre: the sternum strip, from the notch to just under the fold.
    - stomach: under the pecs down to the pubis, between the hip points.
    - ribs: the lateral band from under the armpit down to the iliac crest.
    - back upper: traps and lats down to the bottom of the ribcage.
    - back lower: below that to the sacrum, ending on a V at the glutes.
    - hip: the iliac and gluteal sides, the glutes and the front hip points.
    - thigh from the gluteal fold; shin = front of the lower leg; calf = the rest.
    """
    # Interpolated part weights from the nearest base-mesh vertices.
    base = fig.V[fig.body_idx]
    tree = cKDTree(base)
    d, nn = tree.query(centers, k=4)
    wk = 1.0 / np.maximum(d, 1e-5)
    wk /= wk.sum(axis=1, keepdims=True)
    W = np.einsum("fk,fkp->fp", wk, fig.W[fig.body_idx][nn])
    part = np.array(PARTS, dtype=object)[W.argmax(axis=1)]

    x, y, z = centers[:, 0], centers[:, 1], centers[:, 2]
    ax = np.abs(x)
    nx, ny, nz = normals[:, 0], normals[:, 1], normals[:, 2]
    side = np.where(x >= 0, "L", "R")
    is_L = (side == "L")[:, None]
    zone = np.full(len(centers), "none", dtype=object)

    # Landmarks (heights in metres).
    S = {s: fig.head(f"upperarm01.{s}") for s in "LR"}  # shoulder joint (acromion)
    E = {s: fig.head(f"lowerarm01.{s}") for s in "LR"}  # elbow
    Wr = {s: fig.head(f"wrist.{s}") for s in "LR"}  # wrist
    y_shoulder = S["L"][1]
    z_clav = fig.tail("clavicle.L")[2]  # the clavicle line splits top-of-shoulder faces front/back
    y_breast = fig.tail("breast.L")[1]  # breast bone tip: the nipple line
    y_back = fig.head("spine02")[1]  # bottom of the ribcage at the back: upper/lower back
    y_crest = fig.tail("spine04")[1] - 0.02  # iliac crest: ribs above, hips below
    y_sacrum = fig.head("pelvis.L")[1]  # top of the sacrum: the lower back ends here in the middle
    y_pubis = fig.head("upperleg01.L")[1] - 0.03  # stomach ends; the crotch stays unselectable
    y_gluteal = fig.head("upperleg02.L")[1] - 0.01  # gluteal fold: glutes above, thigh below

    # Facing, from the horizontal part of the normal: 0 = straight ahead, pi = straight back.
    phi = np.arctan2(np.abs(nx), nz)
    facing_front = phi < np.radians(62)
    facing_back = phi > np.radians(118)
    facing_side = ~facing_front & ~facing_back

    def put(mask, fn):
        for i in np.nonzero(mask)[0]:
            zone[i] = fn(i)

    # Head stays unselectable; neck splits front/sides vs nape.
    neck = part == "neck"
    put(neck & (nz < -0.35), lambda i: "nape")
    put(neck & (nz >= -0.35), lambda i: "neck")

    # --- Arms. The deltoid is a cap around the humeral head: on the outer arm it
    # reaches ~45 % of the way to the elbow (its V-shaped insertion), on the
    # inner side it stops just under the armpit.
    arm = np.isin(part, ["shoulder_L", "shoulder_R", "upperarm_L", "upperarm_R", "clavicle_L", "clavicle_R"])
    S_f = np.where(is_L, S["L"], S["R"])
    E_f = np.where(is_L, E["L"], E["R"])
    lateral = ax / abs(S["L"][0])
    hum = E_f - S_f
    t_arm = np.einsum("ij,ij->i", centers - S_f, hum) / np.maximum(np.einsum("ij,ij->i", hum, hum), 1e-9)
    radial = centers - S_f - hum * t_arm[:, None]
    radial /= np.maximum(np.linalg.norm(radial, axis=1, keepdims=True), 1e-9)
    hum_u = hum / np.maximum(np.linalg.norm(hum, axis=1, keepdims=True), 1e-9)
    outward = np.where(is_L, [[1.0, 0.0, 0.0]], [[-1.0, 0.0, 0.0]])
    outward = outward - hum_u * np.einsum("ij,ij->i", outward, hum_u)[:, None]
    outward /= np.maximum(np.linalg.norm(outward, axis=1, keepdims=True), 1e-9)
    f_out = (np.einsum("ij,ij->i", radial, outward) + 1.0) / 2.0  # 1 outer arm, 0 armpit side
    f_out = f_out * f_out * (3.0 - 2.0 * f_out)
    t_deltoid = 0.14 + 0.31 * f_out
    # The deltoid's front and back borders run diagonally from the clavicle and
    # the scapular spine down to the arm, so the arm/torso split widens with depth.
    lat_thr = 0.72 + 2.0 * np.maximum(0.0, y_shoulder - 0.01 - y)
    arm_proper = arm & (lateral > lat_thr)
    put(arm_proper & (t_arm < t_deltoid), lambda i: f"shoulder_{side[i]}")
    put(arm_proper & (t_arm >= t_deltoid), lambda i: f"upper_arm_{side[i]}")

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
    fore = np.isin(part, ["forearm_L", "forearm_R"])
    # Radial direction around the forearm axis, so the split is a clean line
    # along the bone rather than a wobble of the surface normal.
    E_ff = np.where(is_L, E["L"], E["R"])
    W_ff = np.where(is_L, Wr["L"], Wr["R"])
    fa = W_ff - E_ff
    t_f = np.einsum("ij,ij->i", centers - E_ff, fa) / np.maximum(np.einsum("ij,ij->i", fa, fa), 1e-9)
    r_f = centers - E_ff - fa * t_f[:, None]
    r_f /= np.maximum(np.linalg.norm(r_f, axis=1, keepdims=True), 1e-9)
    inner = np.einsum("ij,ij->i", r_f, np.where(is_L, volar["L"], volar["R"])) > 0
    put(fore & inner, lambda i: f"forearm_inner_{side[i]}")
    put(fore & ~inner, lambda i: f"forearm_outer_{side[i]}")
    put(np.isin(part, ["hand_L", "hand_R"]), lambda i: f"hand_{side[i]}")

    # --- Legs. The glutes and the side of the hip above the gluteal fold are
    # "hip"; the thigh starts under the fold (and at the front, at the groin).
    thigh = np.isin(part, ["thigh_L", "thigh_R"])
    glute = thigh & (y > y_gluteal) & (nz < 0.2) & (phi > np.radians(70))
    put(thigh & ~glute, lambda i: f"thigh_{side[i]}")
    put(glute, lambda i: f"hip_{side[i]}")
    lower = np.isin(part, ["lowerleg_L", "lowerleg_R"])
    K_f = np.where(is_L, fig.head("lowerleg01.L"), fig.head("lowerleg01.R"))
    A_f = np.where(is_L, fig.tail("lowerleg02.L"), fig.tail("lowerleg02.R"))
    la = A_f - K_f
    t_l = np.einsum("ij,ij->i", centers - K_f, la) / np.maximum(np.einsum("ij,ij->i", la, la), 1e-9)
    r_l = centers - K_f - la * t_l[:, None]
    r_l /= np.maximum(np.linalg.norm(r_l, axis=1, keepdims=True), 1e-9)
    la_u = la / np.maximum(np.linalg.norm(la, axis=1, keepdims=True), 1e-9)
    fwd = np.array([[0.0, 0.0, 1.0]]) - la_u * la_u[:, 2:3]
    fwd /= np.maximum(np.linalg.norm(fwd, axis=1, keepdims=True), 1e-9)
    shin = np.einsum("ij,ij->i", r_l, fwd) > 0.25  # the front ~150 degrees of the lower leg
    put(lower & shin, lambda i: f"shin_{side[i]}")
    put(lower & ~shin, lambda i: f"calf_{side[i]}")
    put(np.isin(part, ["foot_L", "foot_R"]), lambda i: f"foot_{side[i]}")

    # --- Torso: everything spine-, pelvis-, breast- or clavicle-driven, plus
    # the inner part of the shoulder girdle (trapezius, scapula).
    torso = np.isin(part, ["spine01", "spine02", "spine03", "spine04", "pelvis", "pelvis_L", "pelvis_R", "breast_L", "breast_R", "clavicle_L", "clavicle_R"]) | (arm & ~arm_proper)
    # Half-width per 2 cm band of torso faces, for a normalised lateral coordinate u.
    band = np.round(y / 0.02).astype(np.int64)
    ys, ws = [], []
    for bnd in np.unique(band[torso]):
        sel = torso & (band == bnd)
        ys.append(bnd * 0.02)
        ws.append(max(np.percentile(ax[sel], 97), 0.03))
    half_w = np.interp(y, ys, ws)
    u = ax / half_w

    # The pec's lower edge, read off the mesh: under each breast the skin faces
    # down; the lowest of that downward-facing skin, per 1 cm column, is the
    # fold. A quadratic through those columns is the chest's lower border.
    y_fold_default = y_breast - 0.055
    under = torso & (ny < -0.3) & (nz > -0.2) & (y > y_breast - 0.11) & (y < y_breast + 0.02) & (ax > 0.025) & (ax < 0.16)
    cols, vals, wts = [], [], []
    for c in np.arange(0.025, 0.16, 0.01):
        sel = under & (ax >= c) & (ax < c + 0.01)
        if sel.sum() >= 4:
            cols.append(c + 0.005)
            vals.append(np.percentile(y[sel], 15))
            wts.append(np.sqrt(sel.sum()))
    if len(cols) >= 4:
        coef = np.polyfit(cols, vals, 2, w=wts)
        fold_poly = np.poly1d(coef)
    else:
        fold_poly = np.poly1d([y_fold_default])
    x_lo, x_hi = 0.035, 0.145
    fold = fold_poly(np.clip(ax, x_lo, x_hi))
    fold = np.clip(fold, y_fold_default - 0.035, y_fold_default + 0.035)
    # At the sternum the chest ends a little higher (the xiphoid); past the
    # breast the edge climbs to the armpit along the anterior axillary line.
    fold = fold + np.where(ax < x_lo, 0.012 * (1 - ax / x_lo), 0.0) + np.where(ax > x_hi, 1.6 * (ax - x_hi), 0.0)
    y_fold = fold
    print(f"[{fig.name}] pec lower edge: {fold_poly(0.1):.3f} m at |x|=10 cm ({len(cols)} columns measured, default {y_fold_default:.3f})")

    top = torso & (ny > 0.55) & (y > y_shoulder - 0.06)
    put(top & (z < z_clav), lambda i: "back_upper")
    put(top & (z >= z_clav), lambda i: f"chest_{side[i]}")
    rest = torso & ~top
    y_armpit = y_shoulder - 0.08

    back = rest & facing_back
    # The glutes start at the sacrum in the middle and higher towards the
    # sides, so the lower back ends on a shallow V, like the belt line does.
    y_glute = y_sacrum - 0.03 + 0.6 * ax
    put(back & (y > y_back), lambda i: "back_upper")
    put(back & (y <= y_back) & (y > y_glute), lambda i: "back_lower")
    put(back & (y <= y_glute), lambda i: f"hip_{side[i]}")

    flank = rest & facing_side
    armpit = flank & (y > y_armpit)
    put(armpit & (nz >= 0), lambda i: f"chest_{side[i]}")
    put(armpit & (nz < 0), lambda i: "back_upper")
    # The outer side of the breast turns sideways but is still the pec, up to
    # the anterior axillary line.
    breast_side = flank & ~armpit & (y > y_fold) & (nz > 0.1) & (u < 0.86)
    put(breast_side, lambda i: f"chest_{side[i]}")
    put(flank & ~armpit & ~breast_side & (y > y_crest), lambda i: f"ribs_{side[i]}")
    put(flank & ~armpit & ~breast_side & (y <= y_crest), lambda i: f"hip_{side[i]}")

    front = rest & facing_front
    sternum_w = 0.03
    sternum_tail = 0.035 if fig.name == "f" else 0.015  # under-bust centre on the woman
    chest = front & (y > y_fold)
    # Beyond the breast's width and below the armpit the front-facing skin is the side of the ribcage.
    chest_lateral = chest & (ax > x_hi + 0.025) & (y < y_armpit)
    put(chest_lateral, lambda i: f"ribs_{side[i]}")
    chest = chest & ~chest_lateral
    put(chest & (ax >= sternum_w), lambda i: f"chest_{side[i]}")
    put(chest & (ax < sternum_w), lambda i: "chest_center")
    below = front & (y <= y_fold) & (y > y_pubis)
    sternum_low = below & (ax < sternum_w) & (y > fold_poly(x_lo) + 0.012 - sternum_tail)
    put(sternum_low, lambda i: "chest_center")
    hip_front = below & ~sternum_low & (y < y_crest) & (u > 0.66)
    put(hip_front, lambda i: f"hip_{side[i]}")
    put(below & ~sternum_low & ~hip_front, lambda i: "stomach")
    # Below the pubic area the sides are still the hip; the crotch itself stays unselectable.
    put(front & (y <= y_pubis) & (u > 0.5), lambda i: f"hip_{side[i]}")

    return np.array([ZONE_ID[str(zs)] for zs in zone], dtype=np.int32)


# ---------------------------------------------------------------------------
# Preview renders: one colour per zone (L saturated, R pale) with a legend
# ---------------------------------------------------------------------------


BASE_COLORS = {
    "neck": "#e03030", "nape": "#7a1515", "shoulder": "#f2d600", "upper_arm": "#d040d0",
    "forearm_inner": "#20c0c0", "forearm_outer": "#f08020", "hand": "#6040c0", "chest": "#30b030", "chest_center": "#107070",
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
        fc.size = 0.036
        txt = bpy.data.objects.new(f"legend_{slug}", fc)
        txt.data.materials.append(zone_material(f"legend_{slug}", pal[zid], emission=True))
        txt.parent = cam
        txt.visible_shadow = False
        txt.location = (-0.70, 0.90 - k * 0.05, -3.0)
        scene.collection.objects.link(txt)
    # Whole figure from three sides, then the torso and arms up close (the
    # borders that matter most), at the figure's own chest height.
    yc = 0.70 * HEIGHT_CM[tag] / 100
    views = {
        "front": (0, -4, 0.9, 0, 2.0),
        "back": (0, 4, 0.9, 180, 2.0),
        "side": (4, 0, 0.9, 90, 2.0),
        "torso-front": (0, -4, yc, 0, 0.95),
        "torso-back": (0, 4, yc, 180, 0.95),
        "torso-side": (4, 0, yc, 90, 0.95),
        "torso-quarter": (-2.8, -2.8, yc, -45, 0.95),
    }
    legend = [o for o in scene.collection.objects if o.name.startswith("legend_")]
    for v, (x, y, z, rz, scale) in views.items():
        cam.location = (x, y, z)
        cam.rotation_euler = (math.radians(90), 0, math.radians(rz))
        cam.data.ortho_scale = scale
        for o in legend:
            o.hide_render = scale < 1.5
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
    qn = smooth_normals(Q, qn, iters=6)
    # Speckles first, then two gentle passes that round single-polygon teeth
    # off the borders without moving them.
    fine = smooth_poly_labels(Q, classify(fig, qc, qn), iters=6)
    fine = smooth_poly_labels(Q, fine, iters=2, need=2)
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
