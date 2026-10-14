"""Take the outer walls off a room drawing, leaving what is inside them.

A floor plan draws its own walls round every room, so a fitted room laid on
it does not need its own: they double the line, and where the plan's room is
a different shape they stand in the wrong place.

Run on the drawing as it comes, before its white is made clear. There the
floor inside the walls and the space outside them are both clear, while
furniture is filled white and machinery grey. So a wall is a long straight
black stroke, across, down or at forty-five degrees, a few pixels thick, with
clear on both sides of it; an outline round machinery or furniture has fill
on one side and stays. Doors and dashes left standing alone where a wall was
are small pieces near it, and go too.
"""
from collections import deque

DARK = 100        # a channel this dark or darker is line
THICK = 7         # a wall stroke is at most this many pixels across
LONG = 24         # and runs straight for at least this many
NEAR = 6          # a small leftover this near a wall that went is part of it
SMALL = 700       # pixels; anything larger left near a wall is kept
BAND = 5          # how far either side of the footprint's edge a wall lies

DIRECTIONS = [((1, 0), (0, 1)), ((0, 1), (1, 0)), ((1, 1), (1, -1)), ((1, -1), (1, 1))]


def unwall(pixels, footprint=None):
    """The drawing without its walls, and how many pixels went. footprint is its size in squares, at 60 pixels each, centred in the image."""
    height, width = len(pixels), len(pixels[0])
    clear = lambda x, y: not (0 <= x < width and 0 <= y < height) or pixels[y][x][3] < 128  # noqa: E731
    dark = lambda x, y: 0 <= x < width and 0 <= y < height and pixels[y][x][3] >= 128 and max(pixels[y][x][:3]) <= DARK  # noqa: E731

    wall = [[False] * width for _ in range(height)]
    for y in range(height):
        for x in range(width):
            if not dark(x, y):
                continue
            for (dx, dy), (nx, ny) in DIRECTIONS:
                # Across the stroke: its thickness here, and what lies either side.
                a = 0
                while a <= THICK and dark(x + nx * (a + 1), y + ny * (a + 1)):
                    a += 1
                b = 0
                while b <= THICK and dark(x - nx * (b + 1), y - ny * (b + 1)):
                    b += 1
                if a + b + 1 > THICK:
                    continue
                side1 = any(clear(x + nx * (a + k), y + ny * (a + k)) for k in (1, 2, 3))
                side2 = any(clear(x - nx * (b + k), y - ny * (b + k)) for k in (1, 2, 3))
                if not (side1 and side2):
                    continue
                # Along it: how far it runs straight.
                run = 1
                k = 1
                while run < LONG and dark(x + dx * k, y + dy * k):
                    run += 1
                    k += 1
                k = 1
                while run < LONG and dark(x - dx * k, y - dy * k):
                    run += 1
                    k += 1
                if run >= LONG:
                    wall[y][x] = True
                    break

    # Where machinery stands against a wall, the wall has fill on its inner
    # side and is not clear both sides. Such walls lie along the edge of the
    # drawing's own footprint, so there a stroke with clear just outside the
    # footprint goes too; machinery reaching past the edge has fill outside.
    if footprint is not None:
        fw, fh = footprint
        left, top = (width - fw * 60) // 2, (height - fh * 60) // 2
        right, bottom = left + fw * 60, top + fh * 60
        for y in range(height):
            for x in range(width):
                if not dark(x, y):
                    continue
                if abs(x - left) <= BAND and top - BAND <= y <= bottom + BAND and clear(left - BAND - 3, y):
                    wall[y][x] = True
                elif abs(x - right) <= BAND and top - BAND <= y <= bottom + BAND and clear(right + BAND + 3, y):
                    wall[y][x] = True
                elif abs(y - top) <= BAND and left - BAND <= x <= right + BAND and clear(x, top - BAND - 3):
                    wall[y][x] = True
                elif abs(y - bottom) <= BAND and left - BAND <= x <= right + BAND and clear(x, bottom + BAND + 3):
                    wall[y][x] = True

    # The wall's own soft edge goes with it.
    out = [list(row) for row in pixels]
    taken = 0
    for y in range(height):
        for x in range(width):
            if wall[y][x]:
                for ox in (-1, 0, 1):
                    for oy in (-1, 0, 1):
                        px, py = x + ox, y + oy
                        if 0 <= px < width and 0 <= py < height and out[py][px][3] > 0 and (ox == oy == 0 or max(out[py][px][:3]) < 200):
                            r, g, b, _ = out[py][px]
                            out[py][px] = (r, g, b, 0)
                            taken += 1

    # Small pieces left standing where a wall was: doors set in it, dashes.
    near = [[False] * width for _ in range(height)]
    queue = deque((x, y, 0) for y in range(height) for x in range(width) if wall[y][x])
    while queue:
        x, y, d = queue.popleft()
        if d > NEAR:
            continue
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < width and 0 <= ny < height and not near[ny][nx]:
                near[ny][nx] = True
                queue.append((nx, ny, d + 1))
    seen = [[False] * width for _ in range(height)]
    for y in range(height):
        for x in range(width):
            if seen[y][x] or out[y][x][3] == 0:
                continue
            piece = []
            stack = [(x, y)]
            seen[y][x] = True
            while stack:
                cx, cy = stack.pop()
                piece.append((cx, cy))
                for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                    if 0 <= nx < width and 0 <= ny < height and not seen[ny][nx] and out[ny][nx][3] > 0:
                        seen[ny][nx] = True
                        stack.append((nx, ny))
            if len(piece) <= SMALL and any(near[py][px] for px, py in piece):
                for px, py in piece:
                    r, g, b, _ = out[py][px]
                    out[py][px] = (r, g, b, 0)
                    taken += 1
    return out, taken


if __name__ == "__main__":
    import os
    import sys

    sys.path.insert(0, os.path.dirname(__file__))
    import pngtools

    src, dst = sys.argv[1], sys.argv[2]
    footprint = (int(sys.argv[3]), int(sys.argv[4])) if len(sys.argv) > 4 else None
    _, _, px = pngtools.read(src)
    result, taken = unwall(px, footprint)
    pngtools.write(dst, result)
    print(taken, "pixels of wall taken off")
