"""Draw the app icons: a sage tile with a circle and a breath wave (the header mark). Needs Pillow.
    python tools/make-icons.py"""
import os, math
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BG, FG = (46, 114, 96), (244, 246, 241)

def icon(size, pad=0.0, radius=0.22):
    S = size * 4  # draw large, then scale down for smooth edges
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if radius: d.rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * radius), fill=BG)
    else: d.rectangle([0, 0, S, S], fill=BG)
    c, inner = S / 2, S * (1 - 2 * pad)
    r, w = inner * 0.30, max(2, int(inner * 0.06))
    d.ellipse([c - r, c - r, c + r, c + r], outline=FG, width=w)
    # the breath wave, from the header mark: M4 13 c2.5 0 3 -3 5.5 -3 s3 4 5.5 4 3 -2 5 -2 (in a 24-unit box)
    u = inner / 24 * 0.95
    def P(x, y): return (c + (x - 12) * u, c + (y - 12) * u)
    pts = []
    def cubic(p0, p1, p2, p3, n=400):
        for i in range(n + 1):
            t = i / n; m = 1 - t
            pts.append(tuple(m**3 * a + 3 * m * m * t * b + 3 * m * t * t * cc + t**3 * dd for a, b, cc, dd in zip(p0, p1, p2, p3)))
    cubic(P(4, 13), P(6.5, 13), P(7, 10), P(9.5, 10))
    cubic(P(9.5, 10), P(12, 10), P(12.5, 14), P(15, 14))
    cubic(P(15, 14), P(17.5, 14), P(18, 12), P(20, 12))
    for p in pts: d.ellipse([p[0] - w / 2, p[1] - w / 2, p[0] + w / 2, p[1] + w / 2], fill=FG)  # a round brush along the curve
    return im.resize((size, size), Image.LANCZOS)

out = os.path.join(ROOT, "icons")
icon(192).save(os.path.join(out, "icon-192.png"))
icon(512).save(os.path.join(out, "icon-512.png"))
icon(512, pad=0.1, radius=0).save(os.path.join(out, "maskable-512.png"))
icon(180, radius=0).convert("RGB").save(os.path.join(out, "apple-touch-icon.png"))
icon(32, radius=0.18).save(os.path.join(out, "favicon-32.png"))
print("icons written")
