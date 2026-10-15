"""Cut the pieces out of Robert Pearce's "Symbols & Abbreviations" sheet.

The sheet (Geomorphs/Symbols & Abbreviations.png, 1320 by 2200 pixels) draws
each symbol at 60 pixels to the square, the scale of everything else, with
its name beside it. Each piece below has a box drawn round it by hand, in the
coordinates of the sheet shown at 1200 pixels wide (so multiplied by 1.1
here). The box is then tightened to the drawing inside it, and the sheet's
white made transparent so a floor colour shows through. The name beside each
piece is left behind.

Run on its own, it writes a contact sheet of every cut for checking.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
import pngtools  # noqa: E402

SHEET = "D:/SandPit/ShipParts/Geomorphs/Symbols & Abbreviations.png"
SCALE = 1320 / 1200

# id, name, category, box (x0, y0, x1, y1) on the sheet shown 1200 wide, and
# optionally what to say of it beyond what is measured: a footprint where the
# drawing's stroke would round it up a square, "fit" to draw it to that
# footprint, and "align" to set it against one edge rather than the middle.
ITEMS = [
    ("sheet-bed", "Bed, labelled", "rooms", (48, 170, 125, 215)),
    ("sheet-bed-storage", "Bed with storage", "rooms", (151, 165, 250, 225)),
    ("sheet-bunks", "Bunk beds", "rooms", (48, 218, 134, 296)),
    ("sheet-triple-bunks", "Steerage triple bunks", "rooms", (278, 220, 398, 289)),
    ("sheet-mini-stateroom", "Mini-stateroom, bed over desk", "rooms", (58, 406, 182, 475)),

    ("sheet-desk-1", "Desk with chairs", "furniture", (51, 280, 108, 349), {"squares": [1, 1]}),
    ("sheet-desk-2", "Desk and chair", "furniture", (116, 291, 182, 355)),
    ("sheet-desk-3", "Desk, small", "furniture", (185, 291, 222, 349)),
    ("sheet-chairs", "Chairs", "furniture", (46, 355, 132, 395)),
    ("sheet-couch", "Couch", "furniture", (135, 360, 249, 395)),
    ("sheet-locker", "Locker", "furniture", (46, 790, 112, 862), {"squares": [1, 1], "fit": True}),
    ("sheet-locker-small", "Locker, small", "furniture", (121, 790, 190, 835), {"squares": [1, 1], "fit": True, "align": "top"}),
    ("sheet-weapons-locker", "Weapons locker", "furniture", (198, 790, 265, 862), {"squares": [1, 1], "fit": True}),
    ("sheet-holo-table", "Holo table with seats", "furniture", (45, 878, 162, 989)),
    ("sheet-window", "Window, security glass", "furniture", (48, 1006, 165, 1029)),
    ("sheet-repair-bench", "Repair bench", "furniture", (48, 1041, 275, 1105)),

    ("sheet-panel-1", "Control panel", "consoles", (166, 878, 235, 942)),
    ("sheet-panel-2", "Work station", "consoles", (238, 878, 302, 939)),
    ("sheet-panel-3", "Work station, seated", "consoles", (308, 878, 374, 939)),

    ("sheet-fresher", "Fresher: toilet, sink and shower", "freshers", (44, 536, 109, 604)),
    ("sheet-toilet-sink", "Toilet and sink", "freshers", (78, 608, 110, 652)),
    ("sheet-toilet", "Toilet", "freshers", (78, 651, 110, 692)),
    ("sheet-sink-round", "Sink, round", "freshers", (226, 651, 261, 688)),
    ("sheet-sink-square", "Sink, square", "freshers", (258, 651, 288, 688)),
    ("sheet-sink-wide", "Sink, wide", "freshers", (286, 652, 339, 688)),
    ("sheet-sinks", "Sinks, row of three", "freshers", (337, 655, 387, 688)),
    ("sheet-shower", "Shower", "freshers", (46, 696, 112, 739)),
    ("sheet-shower-round", "Shower, round", "freshers", (118, 686, 184, 745)),

    ("sheet-medical-bed", "Medical bed", "medical", (45, 1151, 125, 1196)),
    ("sheet-autodoc", "Autodoc", "medical", (301, 1151, 382, 1199)),
    ("sheet-privacy-screen", "Privacy screen", "medical", (41, 1199, 132, 1222)),
    ("sheet-restraint-bed", "Restraint bed, gurney", "medical", (46, 1226, 125, 1272)),
    ("sheet-low-berth", "Low berth", "medical", (51, 1271, 123, 1335), {"squares": [1, 1]}),

    ("sheet-booth", "Corner booth", "common", (45, 1408, 130, 1494)),
    ("sheet-table-4", "Table for four", "common", (129, 1411, 199, 1484)),
    ("sheet-table-round", "Round table", "common", (201, 1415, 259, 1482)),
    ("sheet-table-diagonal", "Table, set diagonally", "common", (258, 1415, 322, 1482)),
    ("sheet-table-2", "Table for two", "common", (326, 1406, 362, 1482)),
    ("sheet-mess-table", "Mess hall table", "common", (46, 1501, 144, 1595)),
    ("sheet-pool-table", "Gaming table", "common", (248, 1495, 365, 1564)),
    ("sheet-gaming-round", "Gaming table, round", "common", (368, 1496, 435, 1564)),
    ("sheet-galley", "Small galley with sink", "common", (46, 1606, 142, 1642)),

    ("sheet-machinery", "Machinery", "engineering", (578, 416, 679, 516)),
    ("sheet-drive", "Drive", "engineering", (686, 416, 800, 526)),
    ("sheet-batteries", "Batteries", "engineering", (851, 417, 954, 508)),
    ("sheet-batteries-2", "Batteries, bank", "engineering", (951, 419, 1107, 521)),
    ("sheet-computer", "Computer", "engineering", (579, 565, 679, 609)),
    ("sheet-computer-panel", "Computer with access panel", "engineering", (685, 565, 839, 615)),

    ("sheet-elevator", "Elevator", "access", (581, 658, 679, 755)),
    ("sheet-elevator-double", "Elevators, pair", "access", (679, 694, 801, 759)),
    ("sheet-stairs-down", "Stairs down", "access", (801, 651, 919, 755)),
    ("sheet-stairwell", "Stairwell", "access", (926, 651, 1104, 774)),
    ("sheet-iris-updown", "Iris valve, up and down", "access", (584, 978, 634, 1025)),
    ("sheet-hatch-down", "Hatch, down", "access", (884, 889, 935, 939)),
    ("sheet-hatch-up", "Hatch, up", "access", (884, 935, 934, 982)),
    ("sheet-hatch-updown", "Hatch, up and down", "access", (884, 978, 935, 1025)),

    ("sheet-missile-tube", "Missile launch tube", "turrets", (571, 1061, 639, 1195), {"despeck": True}),
    ("sheet-probe-tube", "Probe launch tube", "turrets", (751, 1065, 819, 1195)),
    ("sheet-manned-turret", "Manned turret", "turrets", (956, 1058, 1094, 1179)),

    ("sheet-cargo-10x20", "Cargo, 10 by 20 feet", "cargo", (581, 1236, 809, 1354)),
    ("sheet-cargo-10x10", "Cargo, 10 by 10 feet", "cargo", (811, 1236, 929, 1354)),
    ("sheet-cargo-5x5", "Cargo, 5 by 5 feet", "cargo", (935, 1291, 996, 1355)),
    ("sheet-cargo-small", "Small cargo", "cargo", (999, 1217, 1129, 1357)),

    ("sheet-bushes", "Bushes and trees", "landscape", (576, 166, 770, 250)),
    ("sheet-stone-path", "Stone path", "landscape", (918, 171, 1023, 234)),
    ("sheet-bench", "Bench", "landscape", (595, 261, 659, 285)),
    ("sheet-boulders", "Boulders", "landscape", (679, 249, 772, 325)),
    ("sheet-fountain", "Fountain", "landscape", (905, 236, 1004, 334)),
    ("sheet-landscape", "Landscape area", "landscape", (573, 321, 799, 372)),
]

WHITE = 245
PAD = 2


def cut(pixels, box):
    """The box's drawing, tightened to what is in it, with white made clear."""
    x0, y0, x1, y1 = (int(round(v * SCALE)) for v in box)
    xs, ys = [], []
    for y in range(y0, y1):
        row = pixels[y]
        for x in range(x0, x1):
            r, g, b, a = row[x]
            if a > 0 and min(r, g, b) < WHITE:
                xs.append(x)
                ys.append(y)
    if not xs:
        raise ValueError(f"nothing drawn in {box}")
    left, right = max(x0, min(xs) - PAD), min(x1, max(xs) + PAD + 1)
    top, bottom = max(y0, min(ys) - PAD), min(y1, max(ys) + PAD + 1)
    out = []
    for y in range(top, bottom):
        line = []
        for x in range(left, right):
            r, g, b, a = pixels[y][x]
            line.append((r, g, b, 0) if min(r, g, b) >= WHITE else (r, g, b, a))
        out.append(line)
    return out


def despeck(piece, largest=200):
    """Drop scraps of a neighbour caught at the cut's edge: drawn pieces of no
    more than this many pixels that touch the border. The drawing itself is
    one large piece, or a few."""
    h, w = len(piece), len(piece[0])
    seen = [[False] * w for _ in range(h)]
    for sy in range(h):
        for sx in range(w):
            if seen[sy][sx] or piece[sy][sx][3] == 0:
                continue
            part, stack = [], [(sx, sy)]
            seen[sy][sx] = True
            while stack:
                x, y = stack.pop()
                part.append((x, y))
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1), (x + 1, y + 1), (x - 1, y - 1), (x + 1, y - 1), (x - 1, y + 1)):
                    if 0 <= nx < w and 0 <= ny < h and not seen[ny][nx] and piece[ny][nx][3] > 0:
                        seen[ny][nx] = True
                        stack.append((nx, ny))
            edge = any(x in (0, 1, w - 2, w - 1) or y in (0, 1, h - 2, h - 1) for x, y in part)
            if edge and len(part) <= largest:
                for x, y in part:
                    r, g, b, _ = piece[y][x]
                    piece[y][x] = (r, g, b, 0)
    # Tighten again round what is left.
    drawn = [(x, y) for y in range(h) for x in range(w) if piece[y][x][3] > 0]
    left, right = max(0, min(x for x, _ in drawn) - PAD), min(w, max(x for x, _ in drawn) + PAD + 1)
    top, bottom = max(0, min(y for _, y in drawn) - PAD), min(h, max(y for _, y in drawn) + PAD + 1)
    return [row[left:right] for row in piece[top:bottom]]


def extract(dst):
    """Write every piece to dst as <id>.png and return their catalogue entries."""
    _, _, pixels = pngtools.read(SHEET)
    entries = []
    for ident, name, category, box, *extra in ITEMS:
        options = dict(extra[0]) if extra else {}
        piece = cut(pixels, box)
        if options.pop("despeck", False):
            piece = despeck(piece)
        h, w = len(piece), len(piece[0])
        pngtools.write(os.path.join(dst, ident + ".png"), piece)
        entries.append({
            "id": ident,
            "name": name,
            "category": category,
            "file": f"floorplan/symbols/{ident}.png",
            "feet": [round(w / 12), round(h / 12)],
            "squares": [max(1, math.ceil(w / 60 - 0.15)), max(1, math.ceil(h / 60 - 0.15))],
            "pixels": [w, h],
            "source": f"Geomorphs/Symbols & Abbreviations.png {box}",
            **options,
        })
    return entries


def contact(path):
    """Every cut on a grey grid, named by position, to check the boxes by eye."""
    _, _, pixels = pngtools.read(SHEET)
    cells = [cut(pixels, item[3]) for item in ITEMS]
    size, cols = 170, 8
    rows = math.ceil(len(cells) / cols)
    sheet = [[(200, 200, 200, 255)] * (cols * size) for _ in range(rows * size)]
    for i, piece in enumerate(cells):
        ox, oy = (i % cols) * size + 4, (i // cols) * size + 4
        for y, line in enumerate(piece[: size - 8]):
            for x, (r, g, b, a) in enumerate(line[: size - 8]):
                if a > 0:
                    sheet[oy + y][ox + x] = (r, g, b, 255)
                else:
                    sheet[oy + y][ox + x] = (255, 255, 255, 255)
    pngtools.write(path, sheet)


if __name__ == "__main__":
    contact(sys.argv[1] if len(sys.argv) > 1 else "contact.png")
    for i, (ident, *_rest) in enumerate(ITEMS):
        print(i, ident)
