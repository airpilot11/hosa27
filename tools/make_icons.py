"""Generate simple hosa27 app icons (teal square with a white brain-check mark) - no extra libraries."""
import struct, zlib, math, sys, os

def png(path, size):
    teal, white = (15, 118, 110), (255, 255, 255)
    rows = []
    c = size / 2
    for y in range(size):
        row = bytearray([0])
        for x in range(size):
            dx, dy = (x - c) / size, (y - c) / size
            r = math.hypot(dx, dy)
            px = teal
            if 0.27 < r < 0.33:            # ring
                px = white
            # check mark inside the ring
            u, v = dx * size / (size * 0.18), dy * size / (size * 0.18)
            if abs(v - (u * 0.9 + 0.1)) < 0.22 and -1.0 < u < -0.2 and u > -1.0:
                px = white
            if abs(v - (-1.3 * u + 0.1)) < 0.22 and -0.25 < u < 1.0:
                px = white
            row += bytes(px)
        rows.append(bytes(row))
    raw = b"".join(rows)
    def chunk(t, d):
        return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
    data = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)) \
        + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")
    with open(path, "wb") as f:
        f.write(data)

out = sys.argv[1]
for name, s in [("icon-192.png", 192), ("icon-512.png", 512), ("apple-touch-icon.png", 180)]:
    png(os.path.join(out, name), s)
print("icons written to", out)
