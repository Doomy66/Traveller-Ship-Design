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

# id, name, category, box (x0, y0, x1, y1) on the sheet shown 1200 wide
ITEMS = [
    ("sheet-bed", "Bed, labelled", "rooms", (50, 172, 124, 214)),
    ("sheet-bed-storage", "Bed with storage", "rooms", (153, 166, 248, 222)),
    ("sheet-bunks", "Bunk beds", "rooms", (50, 220, 132, 292)),
    ("sheet-triple-bunks", "Steerage triple bunks", "rooms", (280, 222, 396, 287)),
    ("sheet-mini-stateroom", "Mini-stateroom, bed over desk", "rooms", (60, 408, 180, 474)),

    ("sheet-desk-1", "Desk with chairs", "furniture", (53, 293, 107, 347)),
    ("sheet-desk-2", "Desk and chair", "furniture", (118, 293, 180, 354)),
    ("sheet-desk-3", "Desk, small", "furniture", (186, 293, 220, 347)),
    ("sheet-chairs", "Chairs", "furniture", (48, 357, 130, 394)),
    ("sheet-couch", "Couch", "furniture", (136, 362, 247, 393)),
    ("sheet-locker", "Locker", "furniture", (48, 792, 110, 860)),
    ("sheet-locker-small", "Locker, small", "furniture", (123, 792, 188, 834)),
    ("sheet-weapons-locker", "Weapons locker", "furniture", (200, 792, 264, 860)),
    ("sheet-holo-table", "Holo table with seats", "furniture", (46, 880, 160, 987)),
    ("sheet-window", "Window, security glass", "furniture", (50, 1008, 164, 1027)),
    ("sheet-repair-bench", "Repair bench", "furniture", (50, 1043, 274, 1104)),

    ("sheet-panel-1", "Control panel", "consoles", (168, 880, 234, 942)),
    ("sheet-panel-2", "Work station", "consoles", (240, 880, 300, 937)),
    ("sheet-panel-3", "Work station, seated", "consoles", (310, 880, 372, 937)),

    ("sheet-fresher", "Fresher: toilet, sink and shower", "freshers", (45, 538, 107, 602)),
    ("sheet-toilet-sink", "Toilet and sink", "freshers", (80, 610, 108, 650)),
    ("sheet-toilet", "Toilet", "freshers", (80, 653, 108, 690)),
    ("sheet-sink-round", "Sink, round", "freshers", (228, 653, 259, 686)),
    ("sheet-sink-square", "Sink, square", "freshers", (260, 653, 286, 686)),
    ("sheet-sink-wide", "Sink, wide", "freshers", (288, 654, 337, 686)),
    ("sheet-sinks", "Sinks, row of three", "freshers", (339, 656, 385, 686)),
    ("sheet-shower", "Shower", "freshers", (48, 698, 110, 737)),
    ("sheet-shower-round", "Shower, round", "freshers", (120, 688, 182, 744)),

    ("sheet-medical-bed", "Medical bed", "medical", (46, 1153, 124, 1194)),
    ("sheet-autodoc", "Autodoc", "medical", (303, 1153, 380, 1197)),
    ("sheet-privacy-screen", "Privacy screen", "medical", (43, 1201, 130, 1220)),
    ("sheet-restraint-bed", "Restraint bed, gurney", "medical", (48, 1228, 124, 1270)),
    ("sheet-low-berth", "Low berth", "medical", (53, 1273, 114, 1334)),

    ("sheet-booth", "Corner booth", "common", (46, 1410, 128, 1492)),
    ("sheet-table-4", "Table for four", "common", (131, 1413, 197, 1482)),
    ("sheet-table-round", "Round table", "common", (203, 1416, 257, 1480)),
    ("sheet-table-diagonal", "Table, set diagonally", "common", (260, 1416, 320, 1480)),
    ("sheet-table-2", "Table for two", "common", (328, 1408, 360, 1480)),
    ("sheet-mess-table", "Mess hall table", "common", (48, 1503, 142, 1594)),
    ("sheet-pool-table", "Gaming table", "common", (250, 1496, 340, 1562)),
    ("sheet-gaming-round", "Gaming table, round", "common", (370, 1498, 434, 1562)),
    ("sheet-galley", "Small galley with sink", "common", (48, 1608, 140, 1640)),

    ("sheet-machinery", "Machinery", "engineering", (580, 418, 677, 514)),
    ("sheet-drive", "Drive", "engineering", (688, 418, 798, 522)),
    ("sheet-batteries", "Batteries", "engineering", (853, 428, 950, 504)),
    ("sheet-batteries-2", "Batteries, bank", "engineering", (955, 423, 1104, 509)),
    ("sheet-computer", "Computer", "engineering", (581, 566, 677, 607)),
    ("sheet-computer-panel", "Computer with access panel", "engineering", (686, 566, 837, 614)),

    ("sheet-elevator", "Elevator", "access", (583, 660, 677, 754)),
    ("sheet-elevator-double", "Elevators, pair", "access", (681, 695, 799, 757)),
    ("sheet-stairs-down", "Stairs down", "access", (803, 653, 917, 744)),
    ("sheet-stairwell", "Stairwell", "access", (928, 653, 1102, 772)),
    ("sheet-iris-updown", "Iris valve, up and down", "access", (585, 980, 632, 1022)),
    ("sheet-hatch-down", "Hatch, down", "access", (885, 891, 934, 937)),
    ("sheet-hatch-up", "Hatch, up", "access", (885, 936, 932, 980)),
    ("sheet-hatch-updown", "Hatch, up and down", "access", (885, 980, 934, 1024)),

    ("sheet-missile-tube", "Missile launch tube", "turrets", (573, 1063, 637, 1194)),
    ("sheet-probe-tube", "Probe launch tube", "turrets", (753, 1066, 817, 1194)),
    ("sheet-manned-turret", "Manned turret", "turrets", (958, 1060, 1092, 1177)),

    ("sheet-cargo-10x20", "Cargo, 10 by 20 feet", "cargo", (583, 1238, 807, 1352)),
    ("sheet-cargo-10x10", "Cargo, 10 by 10 feet", "cargo", (813, 1238, 927, 1352)),
    ("sheet-cargo-5x5", "Cargo, 5 by 5 feet", "cargo", (936, 1293, 995, 1354)),
    ("sheet-cargo-small", "Small cargo", "cargo", (1001, 1220, 1127, 1354)),

    ("sheet-bushes", "Bushes and trees", "landscape", (578, 168, 768, 252)),
    ("sheet-stone-path", "Stone path", "landscape", (920, 173, 1012, 232)),
    ("sheet-bench", "Bench", "landscape", (596, 263, 657, 284)),
    ("sheet-boulders", "Boulders", "landscape", (681, 251, 770, 324)),
    ("sheet-fountain", "Fountain", "landscape", (906, 238, 1002, 332)),
    ("sheet-landscape", "Landscape area", "landscape", (575, 323, 797, 370)),
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


def extract(dst):
    """Write every piece to dst as <id>.png and return their catalogue entries."""
    _, _, pixels = pngtools.read(SHEET)
    entries = []
    for ident, name, category, box in ITEMS:
        piece = cut(pixels, box)
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
        })
    return entries


def contact(path):
    """Every cut on a grey grid, named by position, to check the boxes by eye."""
    _, _, pixels = pngtools.read(SHEET)
    cells = [cut(pixels, box) for _, _, _, box in ITEMS]
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
