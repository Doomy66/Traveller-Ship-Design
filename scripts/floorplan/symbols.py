"""Copy the library's art into the repo and write its catalogue.

The library is Robert Pearce's Starship Symbols and a few of his Adventure
Class geomorph pieces, as rendered to PNG by Eric B. Smith: whatever a ship
designer reaches for often enough to want it to hand without loading a tile
folder.

Footprints come from the bracketed size in each filename, in feet. The two
numbers are not always width then height, so the image's own aspect decides
which is which. Squares are five feet, rounded up. Images are 60 pixels to the
square and drawn centred on their footprint, so any margin round the drawing
does not matter. Their white is made clear, so the floor shows through.
"""
import json
import math
import os
import re
import struct
import sys

sys.path.insert(0, os.path.dirname(__file__))
import pngtools  # noqa: E402
import sheet  # noqa: E402

ROOT = "D:/SandPit/ShipParts/"
SYM = "CustomTiles/Symbols/"
DV = "AdventureClass/09.3 DV Dorsal-Ventral Add-Ons/"
DST = "D:/GitHub/Traveller-Ship-Design/public/floorplan/symbols/"
CAT = "D:/GitHub/Traveller-Ship-Design/src/floorplan/symbols.json"

# id, name, category, source path under ROOT, and optionally what to say of it
# beyond what is measured, such as "align" to set it against one edge of its
# footprint: a bed's head against a wall.
PICKS = [
    ("lift", "Lift", "access", SYM + "Misc/Elevator 002 [5x5].png"),
    ("lift-large", "Lift, large", "access", SYM + "Misc/Elevator 005 [10x10].png"),
    ("stairs", "Stairs", "access", SYM + "Misc/Stairs 005 [5x5].png"),
    ("stairs-long", "Stairs, long", "access", SYM + "Misc/Stairs 002 [5x10].png"),
    ("airlock", "Airlock", "access", SYM + "Misc/Airlock 001 [10x10].png"),
    ("iris-floor", "Iris valve, floor", "access", SYM + "Misc/Iris Valves 005 [5x5].png"),
    ("iris-ceiling", "Iris valve, ceiling", "access", SYM + "Misc/Iris Valves 013 [5x5].png"),

    ("turret-single-remote", "Single turret, remote", "turrets", DV + "DV-001 [10x10] [1-dTons] Single Turret Remote.png"),
    ("turret-single-gunner", "Single turret, gunner", "turrets", DV + "DV-001 [10x10] [1-dTons] Single Turret with Gunner.png"),
    ("turret-double-remote", "Double turret, remote", "turrets", DV + "DV-002 [10x10] [1-dTons] Double Turrent Remote.png"),
    ("turret-double-gunner", "Double turret, gunner", "turrets", DV + "DV-002 [10x10] [1-dTons] Double Turrent with Gunner.png"),
    ("turret-triple-remote", "Triple turret, remote", "turrets", DV + "DV-003 [10x10] [1-dTons] Triple Turrent Remote.png"),
    ("turret-triple-gunner", "Triple turret, gunner", "turrets", DV + "DV-003 [10x10] [1-dTons] Triple Turrent with Gunner.png"),
    ("turret-sand-remote", "Sandcaster turret, remote", "turrets", DV + "DV-004 [15x15] [1-dTons] Sandcaster Turret Remote.png"),
    ("turret-sand-gunner", "Sandcaster turret, gunner", "turrets", DV + "DV-004 [15x15] [1-dTons] Sandcaster Turret with Gunner.png"),
    ("barbette", "Barbette", "turrets", DV + "DV-005 [30x15] [5-dTons] Generic Barbette.png"),
    ("barbette-missile", "Missile barbette", "turrets", DV + "DV-006 [20x15] [5-dTons] Missile Barbette.png"),
    ("barbette-torpedo", "Torpedo barbette", "turrets", DV + "DV-007 [20x15] [5-dTons] Torpedo Barbette.png"),
    ("barbette-railgun", "Railgun barbette", "turrets", DV + "DV-008 [30x15] [5-dTons] Railgun Barbette.png"),
    ("observation-dome", "Observation dome", "turrets", DV + "DV-009 [10x10] [2-dTons] Observation Dome.png"),
    # Fixed mounts, which take no tonnage: drawn on the hull's edge to show where the guns are.
    # Their drawings sit in one corner of a larger frame, so they are trimmed
    # to the drawing; the mining laser's label is left behind.
    ("fixed-gun", "Fixed mount, gun", "turrets", SYM + "Weaponry/Weaponry 007 [5x10].png", {"trim": None, "tall": True}),
    ("fixed-gun-2", "Fixed mount, gun, other hand", "turrets", SYM + "Weaponry/Weaponry 008 [5x10].png", {"trim": None, "tall": True}),
    ("fixed-gun-dome", "Fixed mount, gun on a dome", "turrets", SYM + "Weaponry/Weaponry 014 [5x10].png", {"trim": None}),
    ("fixed-gun-heavy", "Fixed mount, heavy gun", "turrets", SYM + "Weaponry/Weaponry 013 [5x10].png", {"trim": None, "feet": [15, 10], "squares": [3, 2]}),
    ("mining-laser", "Mining laser", "turrets", SYM + "Weaponry/Weaponry 017 [5x10].png", {"trim": (0, 0, 165, 120)}),

    ("engineering-4", "Engineering, 4 tons", "engineering", SYM + "Engineering/Engineering 010 [10x20].png"),
    ("engineering-8", "Engineering, 8 tons", "engineering", SYM + "Engineering/Engineering 028 [20x20].png"),
    ("engineering-15", "Engineering, 15 tons", "engineering", SYM + "Engineering/Engineering 104 [25x30].png"),
    ("engineering-24", "Engineering, 24 tons", "engineering", SYM + "Engineering/Engineering 049 [30x40].png"),
    ("engineering-35", "Engineering, 35 tons", "engineering", SYM + "Engineering/Engineering 108 [35x50].png"),
    ("engineering-36", "Engineering, 36 tons", "engineering", SYM + "Engineering/Engineering 109 [40x45].png"),
    ("engineering-42", "Engineering, 42 tons", "engineering", SYM + "Engineering/Engineering 101 [35x60].png"),
    ("engineering-63", "Engineering, 63 tons", "engineering", SYM + "Engineering/Engineering 111 [45x70].png"),

    ("stateroom-1", "Stateroom", "rooms", SYM + "Staterooms/Stateroom 015 [10x15].png"),
    ("stateroom-2", "Stateroom, alternative", "rooms", SYM + "Staterooms/Stateroom 016 [10x15].png"),
    ("stateroom-3", "Stateroom, double", "rooms", SYM + "Staterooms/Stateroom 020 [10x15].png"),
    ("stateroom-small", "Stateroom, small", "rooms", SYM + "Staterooms/Stateroom 005 [10x10].png"),
    ("stateroom-large", "Stateroom, large", "rooms", SYM + "Staterooms/Stateroom 073 [15x20].png"),
    ("stateroom-larger", "Stateroom, larger", "rooms", SYM + "Staterooms/Stateroom 064 [15x25].png"),
    ("stateroom-suite", "Stateroom suite", "rooms", SYM + "Staterooms/Stateroom 113 [15x30].png"),
    ("quad-suite", "Quad suite", "rooms", SYM + "Staterooms/Stateroom 077 [20x20].png"),
    ("luxury-stateroom", "Luxury stateroom", "rooms", DV + "DV-014 [30x30] [14-dTons] Luxury Stateroom.png"),
    ("crew-quarters", "Crew quarters with galley", "rooms", SYM + "Staterooms/Stateroom 102 [20x40].png"),
    ("low-berth", "Low berth", "rooms", SYM + "Low Berth/Low Berth 003 [5x5].png"),
    ("fresher", "Fresher", "rooms", SYM + "Fresher/Fresher 001 [5x5].png"),

    # Rooms for the book's standard fittings, drawn complete, at the book's
    # sizes where it gives one: a 6-ton workshop, a 4-ton medical bay,
    # laboratory, briefing room and brig.
    ("workshop", "Workshop, 6 tons", "modules", SYM + "Shop & Repair Area/Shop 013 [15x20].png"),
    ("workshop-small", "Workshop, small", "modules", SYM + "Shop & Repair Area/Shop 004 [10x20].png"),
    ("medical-bay", "Medical bay, 4 tons", "modules", SYM + "Medical/Medical 004 [10x20].png"),
    ("laboratory", "Laboratory, 4 tons", "modules", SYM + "Lab/Lab 001 [10x20].png"),
    ("briefing-room", "Briefing room, 4 tons", "modules", SYM + "Briefing Room/Briefing Room 003 [10x20].png"),
    ("brig", "Brig, three cells", "modules", SYM + "Brig & Security/Brig 007 [10x20].png"),
    ("security-office", "Security office", "modules", SYM + "Brig & Security/Security 005 [10x20].png"),
    ("armoury", "Armoury", "modules", SYM + "Misc/Armory 001 [10x20].png"),
    ("classroom", "Classroom", "modules", SYM + "Classroom/Classroom 001 [10x20].png"),
    ("computer-room", "Computer room", "modules", SYM + "Computer/Computer 004 [10x10].png"),
    ("office", "Office", "modules", SYM + "Offices/Office 002 [10x10].png"),
    ("storage", "Storage", "modules", SYM + "Storage/Storage 007 [10x20].png"),

    # Plain rooms, walls and a door, in the sizes a plan reaches for most.
    ("empty-5x5", "Empty room, 5 by 5 feet", "empty", SYM + "Empty Room/Empty Room 001 [5x5].png"),
    ("empty-5x10", "Empty room, 5 by 10 feet", "empty", SYM + "Empty Room/Empty Room 002 [5x10].png"),
    ("empty-10x10", "Empty room, 10 by 10 feet", "empty", SYM + "Empty Room/Empty Room 007 [10x10].png"),
    ("empty-10x15", "Empty room, 10 by 15 feet", "empty", SYM + "Empty Room/Empty Room 012 [10x15].png"),
    ("empty-10x20", "Empty room, 10 by 20 feet", "empty", SYM + "Empty Room/Empty Room 019 [10x20].png"),
    ("empty-15x15", "Empty room, 15 by 15 feet", "empty", SYM + "Empty Room/Empty Room 029 [15x15].png"),
    ("empty-15x20", "Empty room, 15 by 20 feet", "empty", SYM + "Empty Room/Empty Room 035 [15x20].png"),
    ("empty-20x20", "Empty room, 20 by 20 feet", "empty", SYM + "Empty Room/Empty Room 042 [20x20].png"),
    ("empty-20x30", "Empty room, 20 by 30 feet", "empty", SYM + "Empty Room/Empty Room 070 [20x30].png"),
    ("empty-20x40", "Empty room, 20 by 40 feet", "empty", SYM + "Empty Room/Empty Room 073 [20x40].png"),

    ("lounge-small", "Lounge, small", "common", SYM + "Lounge/Lounge 014 [10x20].png"),
    ("lounge", "Lounge", "common", SYM + "Lounge/Lounge 027 [15x20].png"),
    ("lounge-large", "Lounge, large", "common", SYM + "Lounge/Lounge 031 [20x20].png"),
    ("galley", "Galley and mess", "common", SYM + "Galley & Mess/Galley & Mess Halls 013 [20x20].png"),
    ("mess-hall", "Galley and mess hall", "common", SYM + "Galley & Mess/Galley & Mess Halls 012 [20x40].png"),
    ("luxury-lounge", "Luxury lounge", "common", DV + "DV-013 [30x30] [14-dTons] Luxury Lounge.png"),

    ("bed", "Bed", "furniture", SYM + "Furniture, Consoles, & Equipment/Bed 001 [5x10].png"),
    ("bed-small", "Bed, small", "furniture", SYM + "Furniture, Consoles, & Equipment/Bed 006 [5x7].png", {"align": "left"}),
    ("medical-bed", "Medical bed", "furniture", SYM + "Furniture, Consoles, & Equipment/Medical Bed 001 [4x6].png", {"align": "left"}),
    ("chair", "Chair", "furniture", SYM + "Furniture, Consoles, & Equipment/Couch & Chairs 003 [2x3].png"),
    ("armchair", "Armchair", "furniture", SYM + "Furniture, Consoles, & Equipment/Couch & Chairs 016 [6x6].png"),
    ("couch", "Couch", "furniture", SYM + "Furniture, Consoles, & Equipment/Couch & Chairs 017 [5x10].png"),
    ("lounge-seating", "Lounge seating", "furniture", SYM + "Furniture, Consoles, & Equipment/Couch & Chairs 012 [10x10].png"),
    ("table-small", "Table, small", "furniture", SYM + "Furniture, Consoles, & Equipment/Table 010 [5x5].png"),
    ("table", "Table", "furniture", SYM + "Furniture, Consoles, & Equipment/Table 003 [6x10].png"),
    ("table-long", "Table, long", "furniture", SYM + "Furniture, Consoles, & Equipment/Table 001 [10x20].png"),
    ("desk", "Desk", "furniture", SYM + "Furniture, Consoles, & Equipment/Desk 002 [4x5].png"),
    ("desk-large", "Desk, large", "furniture", SYM + "Furniture, Consoles, & Equipment/Desk 008 [5x10].png"),
    ("counter", "Counter", "furniture", SYM + "Furniture, Consoles, & Equipment/Counter 007 [2x5].png"),

    ("console", "Console", "consoles", SYM + "Furniture, Consoles, & Equipment/Console 008 [5x10].png"),
    ("console-wide", "Console, wide", "consoles", SYM + "Furniture, Consoles, & Equipment/Console 006 [6x15].png"),
    ("bridge-console", "Bridge console", "consoles", SYM + "Furniture, Consoles, & Equipment/Azhanti Style Bridge Console 003 [12x12].png"),
    ("bridge-station", "Bridge station", "consoles", SYM + "Bridge/Bridge 006 [10x10].png"),
]


def size(path):
    with open(path, "rb") as f:
        head = f.read(24)
    return struct.unpack(">II", head[16:24])


os.makedirs(DST, exist_ok=True)
for old in os.listdir(DST):
    if old.endswith(".png"):
        os.remove(DST + old)

catalogue = []
for ident, name, category, rel, *extra in PICKS:
    src = ROOT + rel
    options = dict(extra[0]) if extra else {}
    a, b = map(int, re.search(r"\[(\d+)x(\d+)\]", rel).groups())
    w, h = size(src)
    tall = options.pop("tall", False)
    wide, high = (max(a, b), min(a, b)) if w >= h and not tall else (min(a, b), max(a, b))
    # The drawing's white made clear, as the sheet's pieces are, so the floor's
    # colour shows through and nothing draws as a black block when the screen
    # inverts it.
    _, _, px = pngtools.read(src)
    px = [[(r, g, b, 0) if min(r, g, b) >= sheet.WHITE else (r, g, b, a) for r, g, b, a in row] for row in px]
    if "trim" in options:
        # To the drawing, within the part kept, a little clear all round.
        keep = options.pop("trim") or (0, 0, w, h)
        drawn = [(x, y) for y in range(keep[1], min(keep[3], h)) for x in range(keep[0], min(keep[2], w)) if px[y][x][3] > 20]
        x0, x1 = max(0, min(x for x, _ in drawn) - sheet.PAD), min(w, max(x for x, _ in drawn) + sheet.PAD + 1)
        y0, y1 = max(0, min(y for _, y in drawn) - sheet.PAD), min(h, max(y for _, y in drawn) + sheet.PAD + 1)
        px = [row[x0:x1] for row in px[y0:y1]]
        w, h = x1 - x0, y1 - y0
    pngtools.write(DST + ident + ".png", px)
    catalogue.append({
        "id": ident,
        "name": name,
        "category": category,
        "file": f"floorplan/symbols/{ident}.png",
        "feet": [wide, high],
        "squares": [max(1, math.ceil(wide / 5)), max(1, math.ceil(high / 5))],
        "pixels": [w, h],
        "source": rel,
        **options,
    })

# The pieces cut from the Symbols & Abbreviations sheet, in the same library.
catalogue.extend(sheet.extract(DST))

# Pieces cut from a larger drawing: id, name, category, source, footprint in
# squares, the top left of the cut in the source's pixels (60 to the square),
# and the part of the cut to keep, so a bay's walls are left behind.
CUTS = [
    # The air/raft alone, out of a 20 by 20 foot bay: the craft's own 10 by 20
    # feet, its 4 tons, to stand in the 5-ton docking space the book gives it.
    ("air-raft", "Air/raft", "craft", SYM + "Dock, Small Craft/Air-Raft 001 [20x20].png", (2, 4), (180, 62), (8, 9, 113, 232)),
]

for ident, name, category, rel, (sw, sh), (cx, cy), (kx0, ky0, kx1, ky1) in CUTS:
    _, _, px = pngtools.read(ROOT + rel)
    out = []
    for y in range(sh * 60):
        line = []
        for x in range(sw * 60):
            r, g, b, a = px[cy + y][cx + x]
            keep = kx0 <= x <= kx1 and ky0 <= y <= ky1 and min(r, g, b) < sheet.WHITE
            line.append((r, g, b, a) if keep else (r, g, b, 0))
        out.append(line)
    pngtools.write(DST + ident + ".png", out)
    catalogue.append({
        "id": ident,
        "name": name,
        "category": category,
        "file": f"floorplan/symbols/{ident}.png",
        "feet": [sw * 5, sh * 5],
        "squares": [sw, sh],
        "pixels": [sw * 60, sh * 60],
        "source": f"{rel} cut at {(cx, cy)}",
    })

# Curved seating drawn inside a square frame, which a plan does not want: the
# frame's lines, at the edges of the drawing, are taken off, this many pixels
# deep, leaving the curves.
UNFRAME = {"sheet-booth": 4, "couch": 4}
# Of those, the ones whose seats ended on the frame's top line and need ends of their own.
CLOSE_TOP = {"couch"}
for ident, depth in UNFRAME.items():
    _, _, px = pngtools.read(DST + ident + ".png")
    dark = [(x, y) for y, row in enumerate(px) for x, (r, g, b, a) in enumerate(row) if a > 0]
    x0, x1 = min(x for x, _ in dark), max(x for x, _ in dark)
    y0, y1 = min(y for _, y in dark), max(y for _, y in dark)
    edge = lambda x, y: x < x0 + depth or x > x1 - depth or y < y0 + depth or y > y1 - depth  # noqa: E731
    out = [[(r, g, b, 0) if edge(x, y) else (r, g, b, a) for x, (r, g, b, a) in enumerate(row)] for y, row in enumerate(px)]
    if ident in CLOSE_TOP:
        # The seats ran into the frame's top line; end each side of the
        # curve with a line of its own across the seat, where the frame was.
        top = y0 + depth
        mid = (x0 + x1) // 2
        for half in (range(x0, mid), range(mid, x1 + 1)):
            xs = [x for x in half if out[top][x][3] > 0]
            if xs:
                for y in (top, top + 1):
                    for x in range(min(xs), max(xs) + 1):
                        out[y][x] = (0, 0, 0, 255)
    pngtools.write(DST + ident + ".png", out)

# Fittings that stand against a wall, drawn against that edge of their
# footprint rather than in its middle, as they are turned: a toilet's cistern
# and a sink's tap to the wall behind, a bed's head, a desk's or console's
# back, a booth into its corner. Read off the drawings.
ALIGN = {
    "sheet-toilet": "top", "sheet-toilet-sink": "top", "sheet-sink-round": "top", "sheet-sink-square": "top",
    "sheet-sink-wide": "top", "sheet-sinks": "top", "sheet-shower-round": "top", "sheet-galley": "top",
    "sheet-repair-bench": "top", "sheet-window": "top", "sheet-computer-panel": "top", "sheet-panel-3": "top",
    "sheet-couch": "top", "sheet-desk-3": "top", "counter": "top", "couch": "top",
    "sheet-bed": "left", "sheet-bed-storage": "left", "sheet-autodoc": "left", "sheet-medical-bed": "left",
    "sheet-restraint-bed": "left", "bed": "left", "desk": "left", "desk-large": "left", "console": "left",
    "console-wide": "left",
    "sheet-bunks": "top-left", "sheet-booth": "top-left",
    "fixed-gun": "left", "fixed-gun-2": "left", "fixed-gun-dome": "bottom", "fixed-gun-heavy": "bottom", "mining-laser": "right",
}
# Pieces drawn a little larger than their footprint, whose heavy outline
# would otherwise lie over the room's walls: shrunk to sit just inside.
INSIDE = [
    "sheet-cargo-10x10", "sheet-cargo-10x20", "sheet-cargo-5x5", "sheet-cargo-small",
    "sheet-fresher", "sheet-shower", "sheet-shower-round", "sheet-panel-1", "sheet-panel-2", "sheet-panel-3",
    "sheet-desk-1", "sheet-desk-2", "sheet-gaming-round", "sheet-elevator-double", "sheet-stairs-down", "sheet-triple-bunks",
    "sheet-mini-stateroom", "sheet-manned-turret", "sheet-probe-tube", "sheet-repair-bench", "sheet-low-berth",
    "fixed-gun-dome", "mining-laser",
]
assert set(ALIGN) <= {e["id"] for e in catalogue}, set(ALIGN) - {e["id"] for e in catalogue}
assert set(INSIDE) <= {e["id"] for e in catalogue}, set(INSIDE) - {e["id"] for e in catalogue}
for entry in catalogue:
    if entry["id"] in ALIGN:
        entry["align"] = ALIGN[entry["id"]]
    if entry["id"] in INSIDE:
        entry["fit"] = "inside"

with open(CAT, "w", encoding="utf-8", newline="\n") as f:
    json.dump(catalogue, f, indent=1)
    f.write("\n")
print(len(catalogue), "symbols")
for c in catalogue:
    if c["category"] in ("turrets", "engineering", "rooms", "common"):
        print(c["id"], c["feet"], c["squares"], c["squares"][0] * c["squares"][1] / 2, "t", c["pixels"])
