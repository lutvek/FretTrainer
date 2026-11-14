#!/usr/bin/env python3
"""Ritar appikonerna i icons/ (kräver Pillow). Användning: python3 tools/make-icons.py"""
from pathlib import Path
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "icons"
BG, WOOD, FRET, STRING, DOT = "#14161c", "#4a3226", "#c9c2b8", "#e8e2d6", "#ff9f43"


def draw(size, pad):
    """pad = andel av kanten som lämnas tom (maskable-ikoner beskärs av systemet)."""
    s = 4 * size  # rita stort och skala ned för mjuka kanter
    img = Image.new("RGB", (s, s), BG)
    d = ImageDraw.Draw(img)
    x0, x1 = s * pad, s * (1 - pad)
    y0, y1 = s * (pad + 0.12), s * (1 - pad - 0.12)
    d.rounded_rectangle([x0, y0, x1, y1], radius=s * 0.03, fill=WOOD)
    w = x1 - x0
    for i in range(1, 4):  # band
        x = x0 + w * i / 4
        d.rectangle([x - s * 0.008, y0, x + s * 0.008, y1], fill=FRET)
    d.rectangle([x0, y0, x0 + s * 0.03, y1], fill=STRING)  # sadel
    for i in range(6):  # strängar
        y = y0 + (y1 - y0) * (i + 0.5) / 6
        t = s * (0.004 + 0.0025 * i)
        d.rectangle([x0, y - t, x1, y + t], fill=STRING)
    cx, cy, r = x0 + w * 2.5 / 4, y0 + (y1 - y0) * 3.5 / 6, s * 0.075
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=DOT)
    return img.resize((size, size), Image.LANCZOS)


OUT.mkdir(exist_ok=True)
draw(180, 0.12).save(OUT / "apple-touch-icon.png")
draw(192, 0.12).save(OUT / "icon-192.png")
draw(512, 0.12).save(OUT / "icon-512.png")
draw(512, 0.2).save(OUT / "icon-maskable-512.png")
print("Skrev ikoner i", OUT)
