"""
The app icon set (DECISIONS, 26 Sep): the 3D Demos, face on, on sky.

One picture cut to every size the platforms ask for:

  app/icon.png                  256, rounded, transparent corners (Next
                                serves it as the tab icon)
  app/favicon.ico               16, 32 and 48 inside, rounded, the head
                                cropped tighter so a face survives 16px
  public/icon-192.png, -512     the PWA icons, rounded
  public/icon-maskable-512.png  full bleed, the head held inside the
                                central 80% so a circle or squircle mask
                                never clips an ear
  public/apple-touch-icon.png   180, square and opaque, because iOS
                                rounds it and composites alpha onto black
  public/splash-demos.webp      the same head with no tile, 384 square
                                for Splash.tsx's 128, fading out below
                                the chin so it stands on the white room
                                and the dark one alike (#296): the tap and
                                the screen it opens show one face

Why face on and why sky: the flat side profile on ink (#291) vanished on
a dark home screen and at 16px was a nose and an ear. Face on, the eyes
are the mark at every size, and sky is the terracotta coat's complement,
so he stands off the tile on white and on black alike. Sky is the
introduction's own picture tone (#300), never a tap.

The head is cut from the 3D hello pose in assets/3d/ (scripts/
place-3d-demos.py), the tail that rises into that crop is dropped, and
the fur keeps its own soft shadow on the tile.

    pip install pillow numpy
    python3 scripts/make-icons.py
"""

from PIL import Image, ImageDraw, ImageFilter
import numpy as np

SRC = "assets/3d/demos-onboard-hello.webp"
SKY = (168, 218, 245, 255)  # --pop-sky, light
GLOW = (255, 255, 255, 150)
RADIUS = 0.23  # the corner #291 settled on


def box_blur(x, r):
    """A (2r+1)-wide box mean over the first two axes, in float, edges
    clamped. Separable, by cumulative sums; numpy only."""
    def along(v, axis):
        pad = [(0, 0)] * v.ndim
        pad[axis] = (r + 1, r)
        c = np.cumsum(np.pad(v, pad, mode="edge"), axis=axis)
        hi = np.take(c, np.arange(2 * r + 1, c.shape[axis]), axis=axis)
        lo = np.take(c, np.arange(0, c.shape[axis] - 2 * r - 1), axis=axis)
        return (hi - lo) / (2 * r + 1)
    return along(along(x, 0), 1)


def defringe(a):
    """
    Give every soft edge pixel the colour of the fur beside it (auth-13).

    The 3D cutout's soft edge carries a dark matte: its half-transparent
    pixels average about (71, 52, 44) where the fur beside them is about
    (221, 171, 143), and un-premultiplying does not recover it, so on the
    white room the ears and crown wore a grey keyline. The alpha stays
    exactly as cut; only the colour under it is pulled in from the
    nearest solid fur, the nearest ring that has any.
    """
    rgb = a[..., :3].astype(np.float32)
    alpha = a[..., 3].astype(np.float32) / 255
    solid = (alpha > 0.96).astype(np.float32)
    est = rgb.copy()
    todo = alpha <= 0.96
    for r in (1, 2, 3, 5, 8, 13, 21):
        w = box_blur(solid, r)
        num = box_blur(rgb * solid[..., None], r)
        take = todo & (w > 0.02)
        est[take] = num[take] / w[take][:, None]
        todo &= ~take
        if not todo.any():
            break
    out = a.copy()
    soft = alpha <= 0.96
    out[..., :3][soft] = np.clip(est[soft].round(), 0, 255).astype(np.uint8)
    return out


def head():
    """The hello pose trimmed, the tail cleared, the edge defringed, and
    the head's span."""
    im = Image.open(SRC).convert("RGBA")
    im = im.crop(im.getbbox())
    a = np.array(im)
    h, w = a.shape[:2]
    alpha = a[..., 3] > 128
    # Runs are found on any fur at all, so the tail's soft edge goes
    # with it rather than leaving a ghost of its outline on the tile.
    faint = a[..., 3] > 4
    # The head is the silhouette over the top quarter; the tail only
    # rises into the frame below that, left of the body.
    top = alpha[: int(h * 0.25)]
    xs = np.nonzero(top.any(axis=0))[0]
    x0, x1 = xs.min(), xs.max()
    cx = (x0 + x1) / 2
    # Row by row, keep the run of fur under the head and everything to
    # its right; a run wholly to its left is the tail. A straight cut
    # at the head's edge sliced his arm, which is wider than his head.
    for y in range(int(h * 0.25), h):
        row = faint[y]
        on = np.flatnonzero(np.diff(np.concatenate(([0], row.astype(np.int8), [0]))))
        runs = list(zip(on[::2], on[1::2]))
        body = [r for r in runs if r[0] <= cx < r[1]]
        if not body:
            continue
        for start, end in runs:
            if end <= body[0][0]:
                a[y, start:end, 3] = 0
    return Image.fromarray(defringe(a)), cx, x1 - x0


def tile(size, head_frac, top_frac):
    im, cx, span = head()
    t = Image.new("RGBA", (size, size), SKY)
    g = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    r = size * 0.43
    ImageDraw.Draw(g).ellipse(
        (size / 2 - r, size * 0.41 - r, size / 2 + r, size * 0.41 + r), fill=GLOW
    )
    t.alpha_composite(g.filter(ImageFilter.GaussianBlur(r * 0.4)))
    s = size * head_frac / span
    im = im.resize((round(im.size[0] * s), round(im.size[1] * s)), Image.LANCZOS)
    shadow = Image.new("RGBA", im.size, (0, 0, 0, 0))
    shadow.putalpha(im.split()[3].point(lambda v: v * 80 // 255))
    shadow = shadow.filter(ImageFilter.GaussianBlur(size * 0.021))
    x, y = round(size / 2 - cx * s), round(size * top_frac)
    # alpha_composite, not paste-with-mask (auth-13): paste blends the
    # alpha channel as well, so every soft pixel of the shadow and the
    # fur punched a hole in the opaque tile (the maskable icon, which is
    # never re-masked, shipped with alpha down to 160 round the head).
    t.alpha_composite(shadow, (x, y + round(size * 0.016)))
    t.alpha_composite(im, (x, y))
    return t


def rounded(im):
    size = im.size[0]
    mask = Image.new("L", im.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        (0, 0, size - 1, size - 1), round(size * RADIUS), fill=255
    )
    out = im.copy()
    out.putalpha(mask)
    return out


# The home-screen framing: the head fills about three quarters of the
# width, ears clear of the top, chest running off the bottom.
full = tile(1024, 0.76, 0.117)
rounded(full.resize((512, 512), Image.LANCZOS)).save("public/icon-512.png", optimize=True)
rounded(full.resize((192, 192), Image.LANCZOS)).save("public/icon-192.png", optimize=True)
rounded(full.resize((256, 256), Image.LANCZOS)).save("app/icon.png", optimize=True)
full.resize((180, 180), Image.LANCZOS).convert("RGB").save(
    "public/apple-touch-icon.png", optimize=True
)

# Maskable: the same picture pulled into the 80% safe circle.
tile(1024, 0.6, 0.2).resize((512, 512), Image.LANCZOS).save(
    "public/icon-maskable-512.png", optimize=True
)

# The favicon: tighter, because at 16px the ears and eyes are all there is.
fav = rounded(tile(1024, 0.9, 0.06))
fav.save(
    "app/favicon.ico",
    sizes=[(16, 16), (32, 32), (48, 48)],
)
# The splash: the head alone, the chest fading to nothing (#296's rule
# for a bust on a plain ground), centred in a square.
im, cx, span = head()
s = 384 * 0.86 / span
im = im.resize((round(im.size[0] * s), round(im.size[1] * s)), Image.LANCZOS)
x = round(192 - cx * s)
canvas = Image.new("RGBA", (384, 384), (0, 0, 0, 0))
# auth-13: alpha_composite keeps the fur's own colour and alpha at its
# soft edge. paste(im, pos, im) onto transparent black mixed every edge
# pixel toward black and squared its alpha, which drew a dark rim round
# the ears and crown on the white ground.
canvas.alpha_composite(im, (x, 14))
a = np.array(canvas).astype(np.float32)
fade_from, fade_to = 250, 372
ramp = np.clip((fade_to - np.arange(384)) / (fade_to - fade_from), 0, 1)
ramp = ramp * ramp * (3 - 2 * ramp)
a[..., 3] *= ramp[:, None]
Image.fromarray(a.round().astype(np.uint8)).save(
    "public/splash-demos.webp", "WEBP", quality=90, method=6
)
print("icons and splash written")

