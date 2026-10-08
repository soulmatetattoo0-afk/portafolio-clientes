"""Procedural statue mannequin: signed-distance body definition + tattoo zones.

Units are meters, Blender axes: +Z up, the figure faces -Y, and the figure's
left side is +X (suffix "_L"). Each primitive carries a `part` tag that the
zone classifier uses to decide which tattoo zone a surface point belongs to.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field

import numpy as np

# ---------------------------------------------------------------------------
# Zone catalog (ids are stable: they are baked into the GLB `_ZONE` attribute)
# ---------------------------------------------------------------------------

ZONES = [
    # id, slug, es, en
    (0, "none", "Sin zona", "No zone"),
    (1, "neck", "Cuello", "Neck"),
    (2, "nape", "Nuca", "Nape"),
    (3, "shoulder_L", "Hombro izquierdo", "Left shoulder"),
    (4, "shoulder_R", "Hombro derecho", "Right shoulder"),
    (5, "upper_arm_L", "Brazo izquierdo", "Left upper arm"),
    (6, "upper_arm_R", "Brazo derecho", "Right upper arm"),
    (7, "forearm_inner_L", "Antebrazo interno izquierdo", "Left inner forearm"),
    (8, "forearm_inner_R", "Antebrazo interno derecho", "Right inner forearm"),
    (9, "forearm_outer_L", "Antebrazo externo izquierdo", "Left outer forearm"),
    (10, "forearm_outer_R", "Antebrazo externo derecho", "Right outer forearm"),
    (11, "hand_L", "Mano izquierda", "Left hand"),
    (12, "hand_R", "Mano derecha", "Right hand"),
    (13, "chest_L", "Pecho izquierdo", "Left chest"),
    (14, "chest_R", "Pecho derecho", "Right chest"),
    (15, "stomach", "Abdomen", "Stomach"),
    (16, "ribs_L", "Costillas izquierdas", "Left ribs"),
    (17, "ribs_R", "Costillas derechas", "Right ribs"),
    (18, "back_upper", "Espalda alta", "Upper back"),
    (19, "back_lower", "Espalda baja", "Lower back"),
    (20, "hip_L", "Cadera izquierda", "Left hip"),
    (21, "hip_R", "Cadera derecha", "Right hip"),
    (22, "thigh_L", "Muslo izquierdo", "Left thigh"),
    (23, "thigh_R", "Muslo derecho", "Right thigh"),
    (24, "shin_L", "Espinilla izquierda", "Left shin"),
    (25, "shin_R", "Espinilla derecha", "Right shin"),
    (26, "calf_L", "Pantorrilla izquierda", "Left calf"),
    (27, "calf_R", "Pantorrilla derecha", "Right calf"),
    (28, "foot_L", "Pie izquierdo", "Left foot"),
    (29, "foot_R", "Pie derecho", "Right foot"),
    # Appended later; ids are never renumbered.
    (30, "chest_center", "Centro del pecho", "Centre chest"),
]
ZONE_ID = {slug: zid for zid, slug, _, _ in ZONES}


# ---------------------------------------------------------------------------
# Primitives
# ---------------------------------------------------------------------------


def _v(x) -> np.ndarray:
    return np.asarray(x, dtype=np.float64)


def _norm(x) -> np.ndarray:
    x = _v(x)
    return x / np.linalg.norm(x)


@dataclass
class Prim:
    kind: str  # "rc" round cone, "ell" ellipsoid, "sph" sphere
    part: str
    k: float = 0.03  # smooth-union radius
    sub: bool = False  # subtract instead of union
    a: np.ndarray | None = None
    b: np.ndarray | None = None
    r1: float = 0.0
    r2: float = 0.0
    c: np.ndarray | None = None
    radii: np.ndarray | None = None
    frame: np.ndarray | None = None  # 3x3, rows are local axes
    meta: dict = field(default_factory=dict)

    def sdf(self, p: np.ndarray) -> np.ndarray:
        if self.kind == "sph":
            return np.linalg.norm(p - self.c, axis=-1) - self.r1
        if self.kind == "ell":
            q = (p - self.c) @ self.frame.T
            k0 = np.linalg.norm(q / self.radii, axis=-1)
            k1 = np.linalg.norm(q / (self.radii * self.radii), axis=-1)
            return k0 * (k0 - 1.0) / np.maximum(k1, 1e-9)
        if self.kind == "rc":
            return _round_cone(p, self.a, self.b, self.r1, self.r2)
        raise ValueError(self.kind)


def _round_cone(p, a, b, r1, r2):
    # Inigo Quilez, "round cone - exact" with arbitrary endpoints.
    ba = b - a
    l2 = float(ba @ ba)
    rr = r1 - r2
    a2 = l2 - rr * rr
    il2 = 1.0 / l2
    pa = p - a
    y = pa @ ba
    z = y - l2
    w = pa * l2 - ba[None, :] * y[..., None] if pa.ndim == 2 else pa * l2 - ba * y[..., None]
    x2 = np.einsum("...i,...i->...", w, w)
    y2 = y * y * l2
    z2 = z * z * l2
    k = np.sign(rr) * rr * rr * x2
    d3 = (np.sqrt(np.maximum(x2 * a2 * il2, 0.0)) + y * rr) * il2 - r1
    d1 = np.sqrt(x2 + z2) * il2 - r2
    d2 = np.sqrt(x2 + y2) * il2 - r1
    out = np.where(np.sign(y) * a2 * y2 < k, d2, d3)
    out = np.where(np.sign(z) * a2 * z2 > k, d1, out)
    return out


def sph(part, c, r, k=0.03, sub=False):
    return Prim("sph", part, k=k, sub=sub, c=_v(c), r1=r)


def ell(part, c, radii, k=0.03, axis=None, up=None):
    """Ellipsoid. `axis` = direction of the first radius; `up` hints the second."""
    if axis is None:
        frame = np.eye(3)
    else:
        u = _norm(axis)
        hint = _v(up) if up is not None else np.array([0.0, 1.0, 0.0])
        w = np.cross(u, hint)
        if np.linalg.norm(w) < 1e-6:
            w = np.cross(u, [1.0, 0.0, 0.0])
        w = _norm(w)
        v = np.cross(w, u)
        frame = np.stack([u, v, w])
    return Prim("ell", part, k=k, c=_v(c), radii=_v(radii), frame=frame)


def rc(part, a, b, r1, r2, k=0.03, **meta):
    return Prim("rc", part, k=k, a=_v(a), b=_v(b), r1=r1, r2=r2, meta=meta)


def mirror(prims: list[Prim]) -> list[Prim]:
    """Mirror left-side primitives (+X) to the right side (-X)."""
    out = []
    M = np.diag([-1.0, 1.0, 1.0])
    for p in prims:
        q = Prim(p.kind, p.part.replace("_L", "_R"), k=p.k, sub=p.sub, r1=p.r1, r2=p.r2, meta=dict(p.meta))
        if p.a is not None:
            q.a = p.a @ M
            q.b = p.b @ M
        if p.c is not None:
            q.c = p.c @ M
        if p.radii is not None:
            q.radii = p.radii.copy()
            # Reflect the frame; keep it right-handed by flipping the last axis.
            f = p.frame @ M
            f[2] *= -1.0
            q.frame = f
        out.append(q)
    return out


# ---------------------------------------------------------------------------
# Limb builders (left side; mirrored afterwards)
# ---------------------------------------------------------------------------


def _dir_xz(deg_from_down: float) -> np.ndarray:
    a = math.radians(deg_from_down)
    return np.array([math.sin(a), 0.0, -math.cos(a)])


def arm(S, upper_deg, fore_deg, L_up, L_fore, r):
    """Arm in anatomical position (palm facing forward, thumb lateral)."""
    S = _v(S)
    d1 = _dir_xz(upper_deg)
    d2 = _dir_xz(fore_deg)
    E = S + L_up * d1
    W = E + L_fore * d2
    side = "_L"
    lat1 = np.array([-d1[2], 0.0, d1[0]])  # lateral, perpendicular to the arm in XZ
    lat2 = np.array([-d2[2], 0.0, d2[0]])
    Y = np.array([0.0, 1.0, 0.0])
    P = []
    # Deltoid cap.
    P.append(ell("shoulder" + side, S + 0.045 * d1 + 0.006 * lat1, (r["delt_len"], r["delt_lat"], r["delt_y"]), k=0.05, axis=d1, up=lat1))
    # Upper arm.
    P.append(rc("upper_arm" + side, S + 0.05 * d1, E, r["up1"], r["up2"], k=0.03, seg=("S", "E")))
    P.append(ell("upper_arm" + side, S + 0.55 * L_up * d1 - 0.012 * Y, (0.30 * L_up, r["bicep"], r["bicep"] * 1.05), k=0.03, axis=d1, up=lat1))
    P.append(ell("upper_arm" + side, S + 0.42 * L_up * d1 + 0.016 * Y, (0.32 * L_up, r["bicep"] * 0.95, r["bicep"]), k=0.03, axis=d1, up=lat1))
    # Elbow.
    P.append(sph("elbow" + side, E, r["elbow"], k=0.025))
    # Forearm, muscle mass near the elbow, flattened wrist.
    P.append(rc("forearm" + side, E, W, r["fore1"], r["fore2"], k=0.025))
    P.append(ell("forearm" + side, E + 0.30 * L_fore * d2, (0.34 * L_fore, r["fore_mass_lat"], r["fore_mass_y"]), k=0.03, axis=d2, up=lat2))
    P.append(ell("forearm" + side, W - 0.01 * d2, (0.03, r["wrist_lat"], r["wrist_y"]), k=0.02, axis=d2, up=lat2))
    P += hand(W, d2, lat2, r["hand"])
    return P, {"S": S, "E": E, "W": W, "d1": d1, "d2": d2}


def hand(W, d, lat, s):
    """Statue hand: palm, four fingers held together, thumb. Palm faces -Y."""
    Y = np.array([0.0, 1.0, 0.0])
    P = [ell("hand_L", W + 0.050 * s * d, (0.052 * s, 0.043 * s, 0.016 * s), k=0.014, axis=d, up=lat)]
    knuckles = W + 0.098 * s * d
    fingers = [  # lateral offset, length, radius at base, radius at tip
        (0.0275, 0.077, 0.0086, 0.0072),
        (0.0092, 0.086, 0.0089, 0.0074),
        (-0.0092, 0.080, 0.0086, 0.0071),
        (-0.0265, 0.064, 0.0078, 0.0064),
    ]
    for off, length, ra, rb in fingers:
        base = knuckles + off * s * lat - 0.004 * s * d
        direction = _norm(d + 0.10 * off / 0.027 * lat * 0.35)
        tip = base + length * s * direction - 0.012 * s * Y
        P.append(rc("hand_L", base, tip, ra * s, rb * s, k=0.0035))
    tb = W + 0.022 * s * d + 0.034 * s * lat - 0.010 * s * Y
    tm = tb + 0.034 * s * _norm(d + 0.9 * lat) - 0.016 * s * Y
    tt = tm + 0.034 * s * _norm(d + 0.25 * lat) - 0.014 * s * Y
    P.append(rc("hand_L", tb, tm, 0.0145 * s, 0.0115 * s, k=0.010))
    P.append(rc("hand_L", tm, tt, 0.0112 * s, 0.0086 * s, k=0.004))
    return P


def leg(H, K, A, r, foot_scale=1.0):
    H, K, A = _v(H), _v(K), _v(A)
    dt = _norm(K - H)
    ds = _norm(A - K)
    Y = np.array([0.0, 1.0, 0.0])
    X = np.array([1.0, 0.0, 0.0])
    Lt = np.linalg.norm(K - H)
    Ls = np.linalg.norm(A - K)
    P = [
        rc("thigh_L", H, K, r["th1"], r["th2"], k=0.05),
        ell("thigh_L", H + 0.45 * Lt * dt - 0.022 * Y, (0.40 * Lt, r["quad_x"], r["quad_y"]), k=0.035, axis=dt, up=X),
        ell("thigh_L", H + 0.40 * Lt * dt + 0.028 * X, (0.38 * Lt, r["vl_x"], r["vl_y"]), k=0.035, axis=dt, up=X),
        ell("thigh_L", H + 0.28 * Lt * dt - 0.030 * X, (0.32 * Lt, r["add_x"], r["add_y"]), k=0.035, axis=dt, up=X),
        ell("thigh_L", H + 0.45 * Lt * dt + 0.030 * Y, (0.40 * Lt, r["ham_x"], r["ham_y"]), k=0.035, axis=dt, up=X),
        sph("knee_L", K, r["knee"], k=0.04),
        ell("knee_L", K - 0.032 * Y + 0.008 * _v([0, 0, 1]), (0.022, 0.011, 0.024), k=0.02),
        rc("lower_leg_L", K, A, r["sh1"], r["sh2"], k=0.03),
        ell("lower_leg_L", K + 0.28 * Ls * ds + 0.030 * Y, (0.27 * Ls, r["calf_x"], r["calf_y"]), k=0.035, axis=ds, up=X),
        sph("lower_leg_L", A + 0.020 * X, 0.017, k=0.015),
        sph("lower_leg_L", A - 0.018 * X, 0.016, k=0.015),
    ]
    f = foot_scale
    heel = A + _v([0.0, 0.030 * f, -0.050 * f])
    ball = _v([A[0] + 0.012 * f, A[1] - 0.140 * f, 0.024])
    P += [
        rc("foot_L", A + _v([0, 0, -0.012]), ball + _v([0, 0, 0.006]), 0.037 * f, 0.028 * f, k=0.025),
        rc("foot_L", heel, ball, 0.031 * f, 0.024 * f, k=0.02),
        ell("foot_L", ball + _v([0.002, -0.036 * f, -0.002]), (0.044 * f, 0.038 * f, 0.019 * f), k=0.018),
    ]
    return P, {"H": H, "K": K, "A": A}


# ---------------------------------------------------------------------------
# Bodies
# ---------------------------------------------------------------------------


@dataclass
class Body:
    name: str
    height: float
    prims: list[Prim]
    marks: dict


def male() -> Body:
    # Retail-mannequin head: one smooth egg, no features, narrowing to the chin.
    head = [
        ell("head", (0, 0.010, 1.690), (0.074, 0.090, 0.104), k=0.0),
        ell("head", (0, -0.006, 1.612), (0.056, 0.066, 0.074), k=0.05),
    ]
    neck = [rc("neck", (0, 0.006, 1.445), (0, 0.0, 1.610), 0.057, 0.049, k=0.035)]
    torso = [
        ell("torso", (0, 0.008, 1.270), (0.152, 0.118, 0.175), k=0.05),
        ell("chest", (0.074, -0.064, 1.333), (0.088, 0.048, 0.066), k=0.045),
        ell("chest", (-0.074, -0.064, 1.333), (0.088, 0.048, 0.066), k=0.045),
        ell("torso", (0, 0.035, 1.300), (0.172, 0.085, 0.150), k=0.05),
        ell("torso", (0, 0.025, 1.455), (0.122, 0.062, 0.052), k=0.05),
        ell("torso", (0, -0.010, 1.085), (0.130, 0.100, 0.140), k=0.06),
        ell("pelvis", (0, 0.005, 0.955), (0.160, 0.105, 0.108), k=0.05),
        ell("glute", (0.072, 0.050, 0.885), (0.083, 0.073, 0.096), k=0.04),
        ell("glute", (-0.072, 0.050, 0.885), (0.083, 0.073, 0.096), k=0.04),
        ell("pelvis", (0, -0.020, 0.865), (0.060, 0.060, 0.050), k=0.04),
    ]
    arm_r = dict(
        delt_len=0.076, delt_lat=0.044, delt_y=0.052, up1=0.049, up2=0.039, bicep=0.040,
        elbow=0.035, fore1=0.041, fore2=0.025, fore_mass_lat=0.042, fore_mass_y=0.036,
        wrist_lat=0.030, wrist_y=0.019, hand=1.0,
    )
    arm_l, am = arm((0.178, 0.005, 1.425), 13, 17, 0.29, 0.255, arm_r)
    leg_r = dict(
        th1=0.084, th2=0.054, quad_x=0.052, quad_y=0.046, vl_x=0.032, vl_y=0.048, add_x=0.036,
        add_y=0.046, ham_x=0.046, ham_y=0.044, knee=0.041, sh1=0.047, sh2=0.030, calf_x=0.047, calf_y=0.044,
    )
    leg_l, lm = leg((0.090, 0.005, 0.915), (0.096, -0.004, 0.505), (0.106, 0.020, 0.086), leg_r)
    prims = head + neck + torso + arm_l + mirror(arm_l) + leg_l + mirror(leg_l)
    return Body("m", 1.78, prims, {**am, **lm, "s": 1.0})


def female() -> Body:
    head = [
        ell("head", (0, 0.008, 1.590), (0.068, 0.084, 0.098), k=0.0),
        ell("head", (0, -0.004, 1.518), (0.050, 0.060, 0.068), k=0.05),
    ]
    neck = [rc("neck", (0, 0.006, 1.355), (0, 0.0, 1.515), 0.046, 0.040, k=0.035)]
    torso = [
        ell("torso", (0, 0.005, 1.195), (0.134, 0.098, 0.160), k=0.05),
        ell("torso", (0, 0.030, 1.220), (0.150, 0.075, 0.140), k=0.05),
        ell("torso", (0, 0.020, 1.362), (0.105, 0.052, 0.042), k=0.05),
        ell("chest", (0.068, -0.070, 1.205), (0.066, 0.056, 0.058), k=0.035),
        ell("chest", (-0.068, -0.070, 1.205), (0.066, 0.056, 0.058), k=0.035),
        ell("torso", (0, -0.006, 1.020), (0.108, 0.082, 0.125), k=0.06),
        ell("pelvis", (0, 0.008, 0.900), (0.164, 0.106, 0.108), k=0.055),
        ell("glute", (0.076, 0.056, 0.828), (0.090, 0.080, 0.100), k=0.045),
        ell("glute", (-0.076, 0.056, 0.828), (0.090, 0.080, 0.100), k=0.045),
        ell("pelvis", (0, -0.018, 0.812), (0.058, 0.058, 0.048), k=0.04),
    ]
    arm_r = dict(
        delt_len=0.064, delt_lat=0.036, delt_y=0.042, up1=0.040, up2=0.031, bicep=0.032,
        elbow=0.029, fore1=0.033, fore2=0.021, fore_mass_lat=0.034, fore_mass_y=0.029,
        wrist_lat=0.026, wrist_y=0.016, hand=0.91,
    )
    arm_l, am = arm((0.156, 0.005, 1.338), 12, 16, 0.270, 0.235, arm_r)
    leg_r = dict(
        th1=0.086, th2=0.049, quad_x=0.048, quad_y=0.044, vl_x=0.035, vl_y=0.046, add_x=0.039,
        add_y=0.046, ham_x=0.046, ham_y=0.044, knee=0.038, sh1=0.043, sh2=0.026, calf_x=0.043, calf_y=0.041,
    )
    leg_l, lm = leg((0.092, 0.008, 0.860), (0.090, -0.004, 0.475), (0.098, 0.018, 0.080), leg_r, foot_scale=0.9)
    prims = head + neck + torso + arm_l + mirror(arm_l) + leg_l + mirror(leg_l)
    return Body("f", 1.67, prims, {**am, **lm, "s": 1.67 / 1.78})


# ---------------------------------------------------------------------------
# Field evaluation
# ---------------------------------------------------------------------------


def smin(a, b, k):
    if k <= 0:
        return np.minimum(a, b)
    h = np.maximum(k - np.abs(a - b), 0.0) / k
    return np.minimum(a, b) - h * h * k * 0.25


def field(body: Body, p: np.ndarray) -> np.ndarray:
    d = np.full(p.shape[:-1], 1e3)
    for pr in body.prims:
        di = pr.sdf(p)
        if pr.sub:
            d = -smin(-d, di, pr.k)
        else:
            d = smin(d, di, pr.k)
    # Flat soles: intersect with the half-space above the floor.
    d = -smin(-d, p[..., 2] - 0.001, 0.006)
    return d


def nearest_part(body: Body, p: np.ndarray) -> np.ndarray:
    """Index of the union primitive whose surface is closest to each point."""
    best = np.full(p.shape[0], 1e3)
    idx = np.zeros(p.shape[0], dtype=np.int32)
    for i, pr in enumerate(body.prims):
        if pr.sub:
            continue
        di = pr.sdf(p)
        m = di < best
        best[m] = di[m]
        idx[m] = i
    return idx


# ---------------------------------------------------------------------------
# Zone classification
# ---------------------------------------------------------------------------


def classify(body: Body, centers: np.ndarray, normals: np.ndarray) -> np.ndarray:
    s = body.marks["s"]
    parts = np.array([pr.part for pr in body.prims])[nearest_part(body, centers)]
    x, y, z = centers[:, 0], centers[:, 1], centers[:, 2]
    nx, ny, nz = normals[:, 0], normals[:, 1], normals[:, 2]
    side = np.where(x >= 0, "L", "R")
    zone = np.full(len(centers), "none", dtype=object)

    def put(mask, slug_fn):
        for i in np.nonzero(mask)[0]:
            zone[i] = slug_fn(i)

    # Neck / nape.
    m = parts == "neck"
    put(m & (ny > 0.35), lambda i: "nape")
    put(m & (ny <= 0.35), lambda i: "neck")

    # Torso family.
    torso = np.isin(parts, ["torso", "chest", "pelvis"])
    S_z = body.marks["S"][2]
    back = torso & (ny > 0.30)
    put(back & (z > 1.17 * s), lambda i: "back_upper")
    put(back & (z <= 1.17 * s) & (z > 0.96 * s), lambda i: "back_lower")
    front = torso & ~back
    sideways = front & (np.abs(nx) > 0.55)
    put(sideways & (z > 0.99 * s) & (z < S_z - 0.07), lambda i: f"ribs_{side[i]}")
    put(sideways & (z <= 0.99 * s) & (z > 0.84 * s), lambda i: f"hip_{side[i]}")
    top = front & ~sideways & (nz > 0.55) & (z > S_z - 0.06)
    put(top & (y >= 0.0), lambda i: "back_upper")
    put(top & (y < 0.0), lambda i: f"chest_{side[i]}")
    facing = front & ~sideways & ~top
    put(facing & (z > 1.165 * s), lambda i: f"chest_{side[i]}")
    put(facing & (z <= 1.165 * s) & (z > 0.925 * s), lambda i: "stomach")

    # Arms.
    put(np.char.startswith(parts.astype(str), "shoulder"), lambda i: f"shoulder_{side[i]}")
    put(np.char.startswith(parts.astype(str), "upper_arm"), lambda i: f"upper_arm_{side[i]}")
    put(np.char.startswith(parts.astype(str), "hand"), lambda i: f"hand_{side[i]}")
    fore = np.char.startswith(parts.astype(str), "forearm")
    elbow = np.char.startswith(parts.astype(str), "elbow")
    E = body.marks["E"]
    d1 = body.marks["d1"]
    for i in np.nonzero(elbow)[0]:
        e = E * np.array([1.0 if x[i] >= 0 else -1.0, 1.0, 1.0])
        dd = d1 * np.array([1.0 if x[i] >= 0 else -1.0, 1.0, 1.0])
        if (centers[i] - e) @ dd < 0:
            zone[i] = f"upper_arm_{side[i]}"
        else:
            fore[i] = True
    put(fore & (ny < 0.0), lambda i: f"forearm_inner_{side[i]}")
    put(fore & (ny >= 0.0), lambda i: f"forearm_outer_{side[i]}")

    # Legs.
    put(np.char.startswith(parts.astype(str), "thigh"), lambda i: f"thigh_{side[i]}")
    put(np.char.startswith(parts.astype(str), "foot"), lambda i: f"foot_{side[i]}")
    K_z = body.marks["K"][2]
    lower = np.char.startswith(parts.astype(str), "lower_leg")
    knee = np.char.startswith(parts.astype(str), "knee")
    put(knee & (z > K_z), lambda i: f"thigh_{side[i]}")
    lower = lower | (knee & (z <= K_z))
    put(lower & (ny < -0.15), lambda i: f"shin_{side[i]}")
    put(lower & (ny >= -0.15), lambda i: f"calf_{side[i]}")

    return np.array([ZONE_ID[str(zs)] for zs in zone], dtype=np.int32)
