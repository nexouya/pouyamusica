"""Premium liquid-glass brand icon for pouya music."""
from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SS = 4
MASTER = 1024

# Brand palette — cool indigo → electric cyan (modern, god-tier)
C_INK = (8, 10, 18)
C_DEEP = (12, 16, 32)
C_MID = (28, 40, 78)
C_ACCENT = (99, 140, 255)
C_ACCENT2 = (72, 220, 255)
C_GLOW = (140, 120, 255)
C_WHITE = (255, 255, 255)


def rounded_mask(size: int, radius: int) -> Image.Image:
    m = Image.new("L", (size, size), 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=255)
    return m


def lerp(a, b, t):
    return a + (b - a) * t


def lerp_rgb(a, b, t):
    return tuple(int(lerp(a[i], b[i], t)) for i in range(3))


def gradient_bg(s: int) -> Image.Image:
    img = Image.new("RGBA", (s, s))
    d = ImageDraw.Draw(img)
    # diagonal dark gradient
    for y in range(s):
        for x in range(0, s, 4):  # coarse then blur
            tx = x / (s - 1)
            ty = y / (s - 1)
            t = (tx * 0.35 + ty * 0.65)
            col = lerp_rgb(C_DEEP, C_INK, t)
            d.rectangle((x, y, x + 3, y), fill=(*col, 255))
    # radial accent bloom
    bloom = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    bd = ImageDraw.Draw(bloom)
    # top-left cyan
    for i in range(40, 0, -1):
        a = int(22 * (i / 40) ** 1.8)
        r = int(s * 0.7 * i / 40)
        cx, cy = int(s * 0.22), int(s * 0.18)
        bd.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(*C_ACCENT2, a))
    # bottom-right violet
    for i in range(36, 0, -1):
        a = int(26 * (i / 36) ** 1.8)
        r = int(s * 0.65 * i / 36)
        cx, cy = int(s * 0.82), int(s * 0.88)
        bd.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(*C_GLOW, a))
    bloom = bloom.filter(ImageFilter.GaussianBlur(s * 0.05))
    img = Image.alpha_composite(img, bloom)
    return img


def draw_premium(out_size: int) -> Image.Image:
    s = out_size * SS
    img = gradient_bg(s)
    d = ImageDraw.Draw(img)

    cx = cy = s // 2

    # --- outer soft glass ring ---
    ring = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    rd = ImageDraw.Draw(ring)
    R = int(s * 0.36)
    # frosted disc
    rd.ellipse(
        (cx - R, cy - R, cx + R, cy + R),
        fill=(18, 24, 48, 200),
    )
    ring = ring.filter(ImageFilter.GaussianBlur(s * 0.012))
    # crisp ring
    rd2 = ImageDraw.Draw(ring)
    rd2.ellipse(
        (cx - R, cy - R, cx + R, cy + R),
        outline=(*C_ACCENT, 110),
        width=max(3, s // 120),
    )
    # inner glass fill with gradient feel via two overlapping ellipses
    inner = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    idd = ImageDraw.Draw(inner)
    idd.ellipse(
        (cx - R + 6, cy - R + 6, cx + R - 6, cy + R - 6),
        fill=(20, 28, 56, 160),
    )
    inner = inner.filter(ImageFilter.GaussianBlur(s * 0.008))
    ring = Image.alpha_composite(ring, inner)

    # specular highlight on ring (top-left crescent)
    spec = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    sd = ImageDraw.Draw(spec)
    for ang in range(195, 295, 1):
        t = (ang - 195) / 100
        a = int(90 * math.sin(math.pi * t))
        x1 = cx + int((R - 8) * math.cos(math.radians(ang)))
        y1 = cy + int((R - 8) * math.sin(math.radians(ang)))
        x2 = cx + int((R - 2) * math.cos(math.radians(ang)))
        y2 = cy + int((R - 2) * math.sin(math.radians(ang)))
        sd.line([(x1, y1), (x2, y2)], fill=(255, 255, 255, a), width=max(3, s // 160))
    spec = spec.filter(ImageFilter.GaussianBlur(s * 0.006))
    ring = Image.alpha_composite(ring, spec)

    # soft outer glow under orb
    glow = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    for i in range(24, 0, -1):
        a = int(35 * (i / 24) ** 2)
        rr = R + int(s * 0.08 * i / 24)
        gd.ellipse((cx - rr, cy - rr, cx + rr, cy + rr), fill=(*C_ACCENT, a))
    glow = glow.filter(ImageFilter.GaussianBlur(s * 0.035))
    img = Image.alpha_composite(img, glow)
    img = Image.alpha_composite(img, ring)
    d = ImageDraw.Draw(img)

    # --- spectrum ribbons (modern brand mark) ---
    # 5 vertical capsules of varying height, slight arc offset — abstract sound
    bars_layer = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    bd = ImageDraw.Draw(bars_layer)

    n = 5
    gap = int(s * 0.048)
    bw = int(s * 0.052)
    heights = [0.28, 0.52, 0.72, 0.48, 0.32]
    total_w = n * bw + (n - 1) * gap
    x0 = cx - total_w // 2

    for i, hf in enumerate(heights):
        h = int(R * 1.55 * hf)
        x = x0 + i * (bw + gap)
        y0 = cy - h // 2
        y1 = y0 + h
        # vertical gradient bar: cyan top → violet bottom
        bar = Image.new("RGBA", (bw, h), (0, 0, 0, 0))
        bdd = ImageDraw.Draw(bar)
        for yy in range(h):
            t = yy / max(1, h - 1)
            # center bright, ends fade slightly via alpha
            col = lerp_rgb(C_ACCENT2, C_ACCENT, t)
            # middle peak brighter
            peak = 1.0 - abs(t - 0.42) * 0.55
            alpha = int(255 * min(1, 0.55 + 0.45 * peak))
            bdd.line([(0, yy), (bw - 1, yy)], fill=(*col, alpha))
        # round capsule
        mask = Image.new("L", (bw, h), 0)
        ImageDraw.Draw(mask).rounded_rectangle((0, 0, bw - 1, h - 1), radius=bw // 2, fill=255)
        # soft bloom behind bar
        bloomb = bar.filter(ImageFilter.GaussianBlur(s * 0.012))
        bars_layer.alpha_composite(bloomb, (x - 2, y0 - 2))
        bars_layer.paste(bar, (x, y0), mask)

    # center bar taller highlight (focus)
    # already in heights[2]

    # tiny play chevron above? skip — keep pure brand mark

    # clip bars softly to not fight ring too much
    img = Image.alpha_composite(img, bars_layer)
    d = ImageDraw.Draw(img)

    # --- liquid sheen sweep across glass ---
    sheen = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    sh = ImageDraw.Draw(sheen)
    # diagonal light band
    for i in range(-s, s, 2):
        # band from top-right
        x = s // 2 + i
        sh.line(
            [(x, 0), (x + s // 3, s)],
            fill=(255, 255, 255, 0),
            width=1,
        )
    # simpler: elliptical highlight
    sh.ellipse(
        (cx - int(R * 0.75), cy - int(R * 0.9), cx + int(R * 0.15), cy - int(R * 0.15)),
        fill=(255, 255, 255, 28),
    )
    sheen = sheen.filter(ImageFilter.GaussianBlur(s * 0.02))
    # clip to orb
    om = Image.new("L", (s, s), 0)
    ImageDraw.Draw(om).ellipse((cx - R, cy - R, cx + R, cy + R), fill=255)
    sheen.putalpha(Image.composite(sheen.split()[3], Image.new("L", (s, s), 0), om))
    img = Image.alpha_composite(img, sheen)

    # --- plate edge (very subtle premium frame) ---
    edge = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    ed = ImageDraw.Draw(edge)
    rad = int(s * 0.22)
    ed.rounded_rectangle(
        (1, 1, s - 2, s - 2),
        radius=rad,
        outline=(255, 255, 255, 36),
        width=max(2, s // 220),
    )
    # hairline accent bottom
    ed.rounded_rectangle(
        (int(s * 0.08), int(s * 0.93), int(s * 0.92), int(s * 0.955)),
        radius=int(s * 0.01),
        fill=(*C_ACCENT, 40),
    )
    img = Image.alpha_composite(img, edge)

    # final rounded plate mask
    mask = rounded_mask(s, rad)
    final = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    final.paste(img, (0, 0), mask)

    out = final.resize((out_size, out_size), Image.Resampling.LANCZOS)
    return out


def save_ico(path: Path, base: Image.Image) -> None:
    sizes = [16, 24, 32, 48, 64, 128, 256]
    base.resize((256, 256), Image.Resampling.LANCZOS).save(
        path, format="ICO", sizes=[(sz, sz) for sz in sizes]
    )


def main() -> None:
    master = draw_premium(MASTER)

    dirs = [ROOT / "public", ROOT / "icons", ROOT / "src-tauri" / "icons"]
    for od in dirs:
        od.mkdir(parents=True, exist_ok=True)

    master.save(ROOT / "public" / "app-icon.png", "PNG", optimize=True)
    master.save(ROOT / "icon.png", "PNG", optimize=True)
    master.save(ROOT / "icons" / "icon.png", "PNG", optimize=True)
    master.save(ROOT / "src-tauri" / "icons" / "icon.png", "PNG", optimize=True)

    mapping = {
        "32x32.png": 32,
        "128x128.png": 128,
        "128x128@2x.png": 256,
        "Square30x30Logo.png": 30,
        "Square44x44Logo.png": 44,
        "Square71x71Logo.png": 71,
        "Square89x89Logo.png": 89,
        "Square107x107Logo.png": 107,
        "Square142x142Logo.png": 142,
        "Square150x150Logo.png": 150,
        "Square284x284Logo.png": 284,
        "Square310x310Logo.png": 310,
        "StoreLogo.png": 50,
    }
    for name, px in mapping.items():
        img = master.resize((px, px), Image.Resampling.LANCZOS)
        img.save(ROOT / "icons" / name, "PNG", optimize=True)
        img.save(ROOT / "src-tauri" / "icons" / name, "PNG", optimize=True)

    save_ico(ROOT / "icons" / "icon.ico", master)
    save_ico(ROOT / "src-tauri" / "icons" / "icon.ico", master)

    print("Premium icon written")
    for p in (ROOT / "public" / "app-icon.png", ROOT / "src-tauri" / "icons" / "icon.ico"):
        print(f"  {p.name}: {p.stat().st_size} bytes")


if __name__ == "__main__":
    main()
