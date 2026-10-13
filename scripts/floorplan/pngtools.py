"""Just enough PNG to cut pieces out of a sheet: read a non-interlaced PNG of 8 bits, or a palette or grey one of fewer, to RGBA rows; write RGBA.

No imaging library, so the scripts run on a bare Python install.
"""
import struct
import zlib


def read(path):
    data = open(path, "rb").read()
    assert data[:8] == b"\x89PNG\r\n\x1a\n", "not a PNG"
    pos = 8
    width = height = depth = ctype = None
    palette, trns, idat = [], b"", b""
    while pos < len(data):
        length, kind = struct.unpack(">I4s", data[pos:pos + 8])
        body = data[pos + 8:pos + 8 + length]
        pos += 12 + length
        if kind == b"IHDR":
            width, height, depth, ctype, _, _, interlace = struct.unpack(">IIBBBBB", body)
            assert interlace == 0, "only non-interlaced PNGs"
            assert depth == 8 or (ctype in (0, 3) and depth in (1, 2, 4)), "only 8-bit PNGs, or palette and grey of fewer bits"
        elif kind == b"PLTE":
            palette = [tuple(body[i:i + 3]) for i in range(0, len(body), 3)]
        elif kind == b"tRNS":
            trns = body
        elif kind == b"IDAT":
            idat += body
        elif kind == b"IEND":
            break
    channels = {0: 1, 2: 3, 3: 1, 4: 2, 6: 4}[ctype]
    # Fewer than 8 bits pack several pixels to a byte; filtering is then by whole bytes.
    stride = (width * depth + 7) // 8 if depth < 8 else width * channels
    step = channels if depth == 8 else 1
    raw = zlib.decompress(idat)
    rows, prev = [], bytearray(stride)
    for y in range(height):
        f = raw[y * (stride + 1)]
        line = bytearray(raw[y * (stride + 1) + 1:(y + 1) * (stride + 1)])
        for i in range(stride):
            a = line[i - step] if i >= step else 0
            b = prev[i]
            c = prev[i - step] if i >= step else 0
            if f == 1:
                line[i] = (line[i] + a) & 255
            elif f == 2:
                line[i] = (line[i] + b) & 255
            elif f == 3:
                line[i] = (line[i] + ((a + b) >> 1)) & 255
            elif f == 4:
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                line[i] = (line[i] + (a if pa <= pb and pa <= pc else b if pb <= pc else c)) & 255
        rows.append(line)
        prev = line
    if depth < 8:
        # Unpack to one value a byte, scaling grey up to the full range.
        per = 8 // depth
        mask = (1 << depth) - 1
        scale = 255 // mask if ctype == 0 else 1
        rows = [bytearray(((line[x // per] >> (8 - depth * (x % per + 1))) & mask) * scale for x in range(width)) for line in rows]
    out = []
    for line in rows:
        px = []
        for x in range(width):
            if ctype == 3:
                i = line[x]
                r, g, b = palette[i]
                px.append((r, g, b, trns[i] if i < len(trns) else 255))
            elif ctype == 2:
                px.append((line[3 * x], line[3 * x + 1], line[3 * x + 2], 255))
            elif ctype == 6:
                px.append(tuple(line[4 * x:4 * x + 4]))
            elif ctype == 0:
                v = line[x]
                px.append((v, v, v, 255))
            else:
                v = line[2 * x]
                px.append((v, v, v, line[2 * x + 1]))
        out.append(px)
    return width, height, out


def write(path, pixels):
    height = len(pixels)
    width = len(pixels[0]) if height else 0
    raw = bytearray()
    for row in pixels:
        raw.append(0)
        for r, g, b, a in row:
            raw += bytes((r, g, b, a))

    def chunk(kind, body):
        return struct.pack(">I", len(body)) + kind + body + struct.pack(">I", zlib.crc32(kind + body) & 0xFFFFFFFF)

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(bytes(raw), 9))
    png += chunk(b"IEND", b"")
    open(path, "wb").write(png)
