"""
The mannequin's tattoos: cobalt flash painted on porcelain.

The bodies carry no UVs, so the ink is two flat sheets, one seen from the
front and one from the back, projected onto the figure in the shader
(src/mannequin/engine.ts). Each sheet is drawn in the figure's own bounding
box: ink-zones.json holds, per body and side, where every zone falls in that
box (measured from the GLB). Every motif is drawn in a 100-unit square in the
old sailor flash manner (bold even lines, few fills) and set into its zone.

    python3 tools/mannequin/ink.py   ->  public/mannequin/ink-{f,m}-{front,back}.svg

The sheets are black on transparent; the shader turns them into cobalt.
"""

import json
import math
import os
import re

HERE = os.path.dirname(__file__)
OUT = os.path.join(HERE, "..", "..", "public", "mannequin")
ZONES = json.load(open(os.path.join(HERE, "ink-zones.json")))
W = 1000  # sheet width in user units; the height follows the figure's aspect

# ----------------------------------------------------------------- helpers


def mirror(d):
    """Mirror an absolute path (M/L/C/Q/Z with x,y pairs) across x = 50."""
    out, i = [], 0
    for tok in re.findall(r"[MLCQZ]|-?\d+(?:\.\d+)?", d):
        if tok.isalpha():
            out.append(tok)
            i = 0
            continue
        v = float(tok)
        out.append(f"{100 - v:g}" if i % 2 == 0 else f"{v:g}")
        i += 1
    return " ".join(out)


def p(d, fill=False):
    return f'<path d="{d}" fill="{"#000" if fill else "none"}"/>'


def both(d, fill=False):
    return p(d, fill) + p(mirror(d), fill)


def circle(x, y, r, fill=False):
    return f'<circle cx="{x}" cy="{y}" r="{r}" fill="{"#000" if fill else "none"}"/>'


def star(x, y, r, points=5):
    pts = []
    for k in range(points * 2):
        a = -math.pi / 2 + k * math.pi / points
        rr = r if k % 2 == 0 else r * 0.42
        pts.append(f"{x + rr * math.cos(a):.2f} {y + rr * math.sin(a):.2f}")
    return p("M" + " L".join(pts) + " Z", fill=True)


def text(x, y, s, size, italic=False, spacing=1.5):
    style = "italic" if italic else "normal"
    fam = "Georgia, 'Times New Roman', serif"
    return (
        f'<text x="{x}" y="{y}" font-family="{fam}" font-style="{style}" font-weight="700" font-size="{size}" '
        f'letter-spacing="{spacing}" text-anchor="middle" fill="#000" stroke="none">{s}</text>'
    )


def banner(y, h, word, size=None, x0=12, x1=88):
    """A ribbon with folded tails and a word on it."""
    m = y + h / 2
    s = p(f"M{x0} {y} L{x1} {y} L{x1} {y + h} L{x0} {y + h} Z")
    s += p(f"M{x0} {y + 2} L{x0 - 8} {y + 4} L{x0 - 4} {m + 2} L{x0 - 8} {y + h + 3} L{x0} {y + h}")
    s += p(f"M{x1} {y + 2} L{x1 + 8} {y + 4} L{x1 + 4} {m + 2} L{x1 + 8} {y + h + 3} L{x1} {y + h}")
    s += text(50, m + (size or h * 0.55) * 0.36, word, size or h * 0.55)
    return s


# ----------------------------------------------------------------- motifs (100 x 100)


def rose():
    s = p("M28 54 C24 34 44 24 50 32 C56 24 76 34 72 54 C68 70 32 70 28 54 Z")
    s += p("M41 48 C40 37 60 37 59 48 C58 57 45 57 45 49 C45 43 55 43 55 49")
    s += p("M28 54 C38 61 62 61 72 54")
    s += p("M34 40 C40 47 46 44 50 32") + p("M66 40 C60 47 54 44 50 32")
    s += both("M30 64 C18 62 10 70 8 78 C20 80 28 74 30 64 Z")
    s += both("M29 65 L14 76")
    s += p("M50 67 L50 92")
    return s


def swallow():
    s = p("M22 52 C34 42 56 42 70 46 C74 44 80 42 86 43 L92 46 L85 48 C80 54 74 58 66 58 C52 62 36 60 22 52 Z")
    s += p("M46 46 C48 30 62 16 82 10 C74 22 68 34 60 45")
    s += p("M52 46 C56 34 64 26 74 20")
    s += p("M44 58 C40 72 28 82 12 86 C22 76 30 66 34 58")
    s += p("M24 52 L6 42 L16 52 L6 62 Z", fill=True)
    s += p("M40 56 C52 61 66 59 76 53")
    s += circle(82, 46, 1.6, fill=True)
    return s


def eagle():
    s = p("M45 22 C44 12 56 11 56 19 L61 23 L55 25 L54 31")
    s += circle(51, 18, 1.4, fill=True)
    s += p("M44 30 C39 42 41 54 50 61 C59 54 61 42 56 30 Z")
    s += "".join(p(f"M{46 + 4 * k} {38 + 6 * r} L{48 + 4 * k} {41 + 6 * r} L{50 + 4 * k} {38 + 6 * r}") for k in range(2) for r in range(3))
    wing = "M44 31 C32 22 16 16 0 18 C8 23 10 27 5 31 C12 31 14 35 9 39 C16 39 20 42 16 46 C26 44 36 42 44 41"
    s += both(wing)
    s += both("M5 31 L30 33") + both("M9 39 L32 38") + both("M16 46 L36 42")
    s += p("M44 60 L39 72 L46 67 L50 75 L54 67 L61 72 L56 60")
    s += both("M46 60 L42 66 M42 66 L39 65 M42 66 L41 69")
    for x, y in ((16, 58), (30, 66), (84, 58), (70, 66), (24, 64), (76, 64)):
        s += star(x, y, 3)
    return s


def ship():
    s = p("M14 60 L86 60 L76 74 L24 74 Z")
    s += p("M20 66 L80 66")
    s += p("M36 60 L36 14") + p("M60 60 L60 10")
    s += p("M22 20 C30 24 42 24 50 20 L50 34 C42 38 30 38 22 34 Z")
    s += p("M20 38 C30 42 44 42 52 38 L52 54 C44 58 30 58 20 54 Z")
    s += p("M48 16 C56 20 66 20 74 16 L74 30 C66 34 56 34 48 30 Z")
    s += p("M46 34 C56 38 68 38 78 34 L78 52 C68 56 56 56 46 52 Z")
    s += p("M60 10 L70 12 L60 15 Z", fill=True)
    s += p("M86 60 L96 52")
    s += p("M6 80 C12 76 18 76 24 80 C30 84 36 84 42 80 C48 76 54 76 60 80 C66 84 72 84 78 80 C84 76 90 76 96 80")
    s += p("M14 8 C17 6 20 6 22 8") + p("M24 4 C27 2 30 2 32 4") + p("M78 6 C81 4 84 4 86 6")
    return s


def ship_banner():
    """The ship with its ribbon, on a 100 x 120 box (scaled down into 100)."""
    s = f'<g transform="scale(1 0.82)">{ship()}</g>'
    s += banner(84, 12, "HOMEWARD BOUND", size=6.4, x0=10, x1=90)
    return s


def butterfly():
    s = p("M48 30 C46 44 46 60 50 72 C54 60 54 44 52 30 Z", fill=True)
    s += circle(50, 27, 3.2, fill=True)
    s += both("M48 40 C38 20 14 14 10 28 C6 42 28 50 48 48 Z")
    s += both("M48 52 C34 52 18 60 22 72 C26 82 44 72 48 60 Z")
    s += both("M48 40 C34 34 22 32 16 30") + both("M48 48 C36 44 26 42 18 42")
    s += circle(28, 33, 5) + circle(72, 33, 5) + circle(28, 33, 1.6, fill=True) + circle(72, 33, 1.6, fill=True)
    s += circle(32, 64, 3) + circle(68, 64, 3)
    s += both("M48 26 C44 18 40 14 36 12") + circle(36, 12, 1.4, fill=True) + circle(64, 12, 1.4, fill=True)
    return s


def anchor():
    s = circle(50, 12, 5)
    s += p("M50 17 L50 86")
    s += p("M38 26 L62 26") + circle(38, 26, 1.6, fill=True) + circle(62, 26, 1.6, fill=True)
    s += p("M16 62 C20 80 36 88 50 88 C64 88 80 80 84 62")
    s += both("M16 62 L12 72 M16 62 L25 67")
    s += p("M50 20 C66 28 36 40 52 50 C66 58 38 70 54 80 C60 84 66 86 70 92")
    return s


def dagger_heart():
    s = p("M50 80 C30 66 18 54 22 42 C26 30 42 30 50 42 C58 30 74 30 78 42 C82 54 70 66 50 80 Z")
    s += p("M30 44 C32 38 38 36 42 38")
    s += p("M47 26 L50 96 L53 26 Z")
    s += p("M36 24 L64 24 L64 28 L36 28 Z", fill=True)
    s += p("M47 10 L53 10 L53 23 L47 23 Z")
    s += p("M47 14 L53 14 M47 18 L53 18")
    s += circle(50, 7, 3)
    s += p("M58 84 C56 88 58 91 60 91 C62 91 63 88 60 84 Z", fill=True)
    s += p("M40 88 C38 92 40 95 42 95 C44 95 45 92 42 88 Z", fill=True)
    return s


def fish():
    s = p("M8 50 C22 32 50 30 66 41 C72 45 74 50 72 55 C56 68 24 68 8 50 Z")
    s += p("M72 46 L92 32 L86 50 L92 68 L72 55")
    s += p("M80 40 L84 50 L80 60")
    s += circle(19, 46, 2.6) + circle(19, 46, 1, fill=True)
    s += p("M26 39 C31 45 31 55 26 61")
    for x in (34, 42, 50, 58):
        s += p(f"M{x} 42 C{x + 4} 46 {x + 4} 50 {x} 52") + p(f"M{x} 52 C{x + 4} 56 {x + 4} 59 {x} 61")
    s += p("M38 35 L44 24 L54 36") + p("M38 64 L42 74 L50 64")
    s += p("M8 50 L4 52")
    return s


def eye_pyramid():
    s = p("M50 10 L88 80 L12 80 Z")
    s += p("M30 58 C40 46 60 46 70 58 C60 69 40 69 30 58 Z")
    s += circle(50, 58, 6.5) + circle(50, 58, 2.6, fill=True)
    for a in range(-60, 61, 20):
        r = math.radians(a - 90)
        s += p(f"M{50 + 12 * math.cos(r):.1f} {6 + 12 * math.sin(r) + 8:.1f} L{50 + 20 * math.cos(r):.1f} {6 + 20 * math.sin(r) + 8:.1f}")
    s += "".join(circle(22 + 8 * k, 88, 1.3, fill=True) for k in range(8))
    return s


def love_heart():
    s = p("M50 74 C30 60 16 48 20 34 C24 22 42 22 50 36 C58 22 76 22 80 34 C84 48 70 60 50 74 Z")
    s += p("M28 36 C30 30 36 28 40 30")
    s += banner(42, 13, "LOVE", size=8.5, x0=14, x1=86)
    s += both("M50 80 L50 92") + p("M44 86 L56 86")
    return s


def snake():
    body = "M54 12 C30 16 28 32 50 36 C72 40 72 56 50 60 C28 64 28 80 50 84 C60 86 66 90 70 96"
    s = f'<path d="{body}" fill="none" stroke-width="9"/>'
    # the belly line down the middle reads as a double outline once the inside is cleared in the shader mask below
    s += f'<path d="{body}" fill="none" stroke="#fff" stroke-width="5" class="clear"/>'
    s += "".join(p(f"M{x} {y} L{x + 3} {y + 3}") for x, y in ((42, 20), (60, 38), (40, 50), (58, 64), (42, 76)))
    s += p("M54 12 L46 6 L52 1 L62 6 Z", fill=True)
    s += p("M46 6 L40 4 M40 4 L37 1 M40 4 L37 7")
    return s


def sun():
    s = circle(50, 50, 16)
    s += circle(44, 46, 1.8, fill=True) + circle(56, 46, 1.8, fill=True) + p("M43 56 C47 60 53 60 57 56")
    for k in range(12):
        a = k * math.pi / 6
        s += p(f"M{50 + 22 * math.cos(a):.1f} {50 + 22 * math.sin(a):.1f} L{50 + 34 * math.cos(a):.1f} {50 + 34 * math.sin(a):.1f}")
    return s


def moon():
    return p("M62 16 C38 18 28 40 32 58 C36 78 58 88 76 80 C56 78 44 62 46 44 C48 30 54 22 62 16 Z") + star(70, 34, 6) + star(78, 56, 4)


def flower():
    s = circle(50, 40, 6)
    for k in range(6):
        a = k * math.pi / 3
        cx, cy = 50 + 14 * math.cos(a), 40 + 14 * math.sin(a)
        s += circle(round(cx, 1), round(cy, 1), 8)
    s += p("M50 54 L50 92") + p("M50 72 C40 66 32 68 28 74 C36 78 44 76 50 72 Z") + p("M50 82 C60 76 68 78 72 84 C64 88 56 86 50 82 Z")
    return s


def waves():
    rows = ""
    for y in (30, 50, 70):
        rows += p(f"M2 {y} C10 {y - 8} 18 {y - 8} 26 {y} C34 {y + 8} 42 {y + 8} 50 {y} C58 {y - 8} 66 {y - 8} 74 {y} C82 {y + 8} 90 {y + 8} 98 {y}")
    return rows


def sparkle():
    return p("M50 20 L54 46 L80 50 L54 54 L50 80 L46 54 L20 50 L46 46 Z", fill=True)


def script(word):
    def draw():
        return text(50, 62, word, 30, italic=True, spacing=0)

    return draw


def bars():
    return "".join(p(f"M{20 + k * 12} 30 L{20 + k * 12} 70") for k in range(6)) + p("M14 76 L86 76")


MOTIFS = {
    "rose": rose,
    "swallow": swallow,
    "eagle": eagle,
    "ship": ship_banner,
    "butterfly": butterfly,
    "anchor": anchor,
    "dagger": dagger_heart,
    "fish": fish,
    "eye": eye_pyramid,
    "love": love_heart,
    "snake": snake,
    "sun": sun,
    "moon": moon,
    "flower": flower,
    "waves": waves,
    "sparkle": sparkle,
    "bars": bars,
}

# ----------------------------------------------------------------- the layouts

# zone -> (motif, fill of the box 0..1, mirror, rotation degrees, nudge [dx, dy] in box fractions)
FRONT = {
    "f": {
        "neck": (script("Vanta"), 0.95, False, 0, (0, 0)),
        "chest_L+chest_R": ("eagle", 1.0, False, 0, (0, 0.05)),
        "shoulder_L": ("rose", 0.9, False, 0, (0, 0)),
        "shoulder_R": ("rose", 0.9, True, 0, (0, 0)),
        "stomach@top": ("ship", 0.92, False, 0, (0, 0)),
        "stomach@bottom": ("butterfly", 0.8, False, 0, (0, 0)),
        "hip_L": ("swallow", 0.95, True, -12, (0, 0)),
        "hip_R": ("swallow", 0.95, False, 12, (0, 0)),
        "upper_arm_L": ("dagger", 0.95, False, -35, (0, 0)),
        "upper_arm_R": ("anchor", 0.95, False, 35, (0, 0)),
        "forearm_inner_L": ("fish", 0.95, False, -55, (0, 0)),
        "forearm_inner_R": ("flower", 0.95, False, 55, (0, 0)),
        "hand_L": ("sparkle", 0.6, False, 0, (0, -0.1)),
        "hand_R": ("sparkle", 0.6, False, 0, (0, -0.1)),
        "thigh_L": ("snake", 0.9, False, 0, (0, 0)),
        "thigh_R": ("love", 0.95, False, 0, (0, -0.1)),
        "shin_L": ("dagger", 0.85, False, 0, (0, 0)),
        "shin_R": ("swallow", 0.85, False, -80, (0, 0)),
        "foot_L": ("waves", 0.9, False, 0, (0, 0)),
        "foot_R": ("waves", 0.9, False, 0, (0, 0)),
    },
}
FRONT["m"] = dict(FRONT["f"])
FRONT["m"].update(
    {
        "neck": ("sun", 0.9, False, 0, (0, 0)),
        "thigh_L": ("eye", 0.9, False, 0, (0, 0)),
        "thigh_R": ("snake", 0.9, True, 0, (0, 0)),
        "forearm_inner_R": ("rose", 0.95, False, 55, (0, 0)),
    }
)
BACK = {
    "f": {
        "nape": ("sparkle", 0.7, False, 0, (0, 0)),
        "back_upper@top": ("eye", 0.95, False, 0, (0, 0)),
        "back_upper@bottom": ("butterfly", 0.95, False, 0, (0, 0)),
        "back_lower": ("love", 0.95, False, 0, (0, 0)),
        "shoulder_L": ("fish", 0.95, True, -15, (0, 0)),
        "shoulder_R": ("anchor", 0.85, False, 15, (0, 0)),
        "upper_arm_L": ("swallow", 0.95, True, 35, (0, 0)),
        "upper_arm_R": ("swallow", 0.95, False, -35, (0, 0)),
        "forearm_outer_L": ("moon", 0.95, False, 55, (0, 0)),
        "forearm_outer_R": ("sun", 0.95, False, -55, (0, 0)),
        "hand_L": ("bars", 0.55, False, 0, (0, -0.1)),
        "hand_R": ("bars", 0.55, False, 0, (0, -0.1)),
        "hip_L": ("flower", 0.85, False, 0, (0, 0)),
        "hip_R": ("rose", 0.85, False, 0, (0, 0)),
        "thigh_L": ("dagger", 0.9, False, 0, (0, 0)),
        "thigh_R": ("eagle", 0.95, False, 0, (0, 0)),
        "calf_L": ("fish", 0.85, False, 90, (0, 0)),
        "calf_R": ("ship", 0.85, False, 0, (0, 0)),
        "foot_L": ("waves", 0.9, False, 0, (0, 0)),
        "foot_R": ("waves", 0.9, False, 0, (0, 0)),
    }
}
BACK["m"] = dict(BACK["f"])
BACK["m"].update({"back_upper@top": ("eagle", 1.0, False, 0, (0, 0)), "back_upper@bottom": ("eye", 0.9, False, 0, (0, 0))})

FILLERS = ["star", "dot", "drop", "cross"]


def box_for(zones, key, aspect):
    """A zone's box in sheet units; "a+b" joins two zones; "@top"/"@bottom" take a part."""
    part = None
    if "@" in key:
        key, part = key.split("@")
    boxes = [zones[k] for k in key.split("+") if k in zones]
    if not boxes:
        return None
    x0 = min(b[0] for b in boxes) * W
    y0 = min(b[1] for b in boxes) * W * aspect
    x1 = max(b[2] for b in boxes) * W
    y1 = max(b[3] for b in boxes) * W * aspect
    if part == "top":
        y1 = y0 + (y1 - y0) * 0.66
    elif part == "bottom":
        y0 = y0 + (y1 - y0) * 0.62
    return x0, y0, x1, y1


def place(motif, box, fill, flip, rot, nudge, lw):
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0
    size = min(w, h) * fill
    if rot and abs(rot) >= 45:
        # turned along a limb: follow its length, but never much wider than the limb itself
        size = min(max(w, h) * fill * 0.9, min(w, h) * 1.7)
    k = size / 100
    cx = (x0 + x1) / 2 + nudge[0] * w
    cy = (y0 + y1) / 2 + nudge[1] * h
    draw = motif if callable(motif) else MOTIFS[motif]
    flipT = " scale(-1 1) translate(-100 0)" if flip else ""
    return (
        f'<g transform="translate({cx:.1f} {cy:.1f}) rotate({rot}) scale({k:.4f}) translate(-50 -50){flipT}" '
        f'stroke-width="{lw / k:.2f}">{draw()}</g>'
    )


def fillers(body, side, aspect, taken, rng):
    """Small flash between the pieces (stars, dots, drops, crosses), as on a painted bust."""
    try:
        from PIL import Image
    except ImportError:
        return ""
    mask = Image.open(os.path.join(HERE, f"mask-{body}-{side}.png")).convert("L")
    mw, mh = mask.size
    px = mask.load()
    H = W * aspect
    out, placed = [], []
    for _ in range(4000):
        x, y = rng.uniform(0, W), rng.uniform(H * 0.11, H * 0.97)
        mx, my = int(x / W * (mw - 1)), int(y / H * (mh - 1))
        # well inside the figure: the pixel and a ring around it
        if not all(px[min(mw - 1, max(0, mx + dx)), min(mh - 1, max(0, my + dy))] > 128 for dx in (-3, 0, 3) for dy in (-3, 0, 3)):
            continue
        if any(x0 - 4 < x < x1 + 4 and y0 - 4 < y < y1 + 4 for x0, y0, x1, y1 in taken):
            continue
        if any((x - a) ** 2 + (y - b) ** 2 < 26**2 for a, b in placed):
            continue
        placed.append((x, y))
        kind = rng.choice(["star", "star", "dot3", "drop", "cross", "sparkle"])
        r = rng.uniform(6, 10)
        if kind == "star":
            out.append(star(round(x, 1), round(y, 1), r))
        elif kind == "dot3":
            out.append("".join(circle(round(x + dx * r, 1), round(y, 1), 2.4, fill=True) for dx in (-1, 0, 1)))
        elif kind == "drop":
            out.append(p(f"M{x:.1f} {y - r:.1f} C{x - r * 0.8:.1f} {y + r * 0.2:.1f} {x - r * 0.6:.1f} {y + r:.1f} {x:.1f} {y + r:.1f} C{x + r * 0.6:.1f} {y + r:.1f} {x + r * 0.8:.1f} {y + r * 0.2:.1f} {x:.1f} {y - r:.1f} Z", fill=True))
        elif kind == "cross":
            out.append(p(f"M{x:.1f} {y - r:.1f} L{x:.1f} {y + r:.1f} M{x - r * 0.6:.1f} {y - r * 0.3:.1f} L{x + r * 0.6:.1f} {y - r * 0.3:.1f}"))
        else:
            out.append(p(f"M{x:.1f} {y - r:.1f} L{x + r * 0.25:.1f} {y - r * 0.25:.1f} L{x + r:.1f} {y:.1f} L{x + r * 0.25:.1f} {y + r * 0.25:.1f} L{x:.1f} {y + r:.1f} L{x - r * 0.25:.1f} {y + r * 0.25:.1f} L{x - r:.1f} {y:.1f} L{x - r * 0.25:.1f} {y - r * 0.25:.1f} Z", fill=True))
    return f'<g stroke-width="3">{"".join(out)}</g>'


def sheet(body, side):
    info = ZONES[f"{body}-{side}"]
    aspect = info["aspect"]
    zones = info["zones"]
    layout = (FRONT if side == "front" else BACK)[body]
    lw = 3.4
    parts, taken = [], []
    for key, (motif, fill, flip, rot, nudge) in layout.items():
        box = box_for(zones, key, aspect)
        if box:
            parts.append(place(motif, box, fill, flip, rot, nudge, lw))
            x0, y0, x1, y1 = box
            cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
            half = min(x1 - x0, y1 - y0) * fill / 2
            taken.append((cx - half, cy - half, cx + half, cy + half))
    import random

    parts.append(fillers(body, side, aspect, taken, random.Random(f"{body}{side}")))
    H = W * aspect
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H:.0f}" width="{W}" height="{H:.0f}">'
        f'<g fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round">{"".join(parts)}</g></svg>'
    )


if __name__ == "__main__":
    for body in ("f", "m"):
        for side in ("front", "back"):
            path = os.path.join(OUT, f"ink-{body}-{side}.svg")
            with open(path, "w") as f:
                f.write(sheet(body, side))
            print(path)
