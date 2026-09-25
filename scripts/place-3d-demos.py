"""
The 3D Demos set (DECISIONS, 25 Sep): places the cut renders in
assets/3d/ onto the geometry every surface already expects.

The renders came from Higgsfield (Nano Banana Pro), each one the shipped
flat pose as the first reference and the approved 3D wave as the second,
so the pose is the old one and the rendering is the new one. Their white
background was cut locally with rembg (`isnet-general-use`) and then
un-premultiplied against white, which is what keeps a pale fringe off the
fur on the near-black ground. assets/3d/ holds those cutouts, trimmed and
at most 1024 on a side; re-cut only from a fresh render, never from
public/.

What this does is the part a set needs and a single pose does not:

  introduction  1024 square, feet on 993, the ears-to-feet height 923
                (the mic, the set's canonical), bbox centred. Measured to
                the ears in a band over the feet rather than to the top
                of the box, so arms thrown above the head do not shrink
                the body.
  in-app        512 square, each pose contained in the box its flat
                predecessor filled and stood on the same bottom.
  unit marks    256 square, one box for all seven.
  splash        the head alone, contained in 432x285 (Splash.tsx shows
                it at 144x95).

    pip install pillow numpy
    python3 scripts/place-3d-demos.py
"""

from PIL import Image
import numpy as np

SRC = "assets/3d/demos-{}.webp"


def load(name):
    im = Image.open(SRC.format(name)).convert("RGBA")
    return im.crop(im.getbbox())


def feet_centre(im):
    a = np.asarray(im)[..., 3]
    xs = np.nonzero(a[int(a.shape[0] * 0.95):] > 128)[1]
    return xs.mean() if len(xs) else a.shape[1] / 2


def ears_top(im):
    """Top of the silhouette in a band over the feet: the ears, not a paw."""
    a = np.asarray(im)[..., 3]
    cx, band = feet_centre(im), im.size[1] * 0.13
    x0, x1 = int(max(0, cx - band)), int(min(a.shape[1], cx + band))
    return np.nonzero((a[:, x0:x1] > 128).any(axis=1))[0].min()


def place(im, canvas, scale, centre_x, bottom):
    w, h = im.size
    im = im.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.LANCZOS)
    out = Image.new("RGBA", canvas, (0, 0, 0, 0))
    out.paste(im, (round(centre_x - im.size[0] / 2), round(bottom - im.size[1])), im)
    return out


def save(im, path):
    im.save(path, "WEBP", quality=84, method=6)
    print(path, im.getbbox())


INTRO = ["wave", "speaking", "celebrate", "fingers", "telescope", "listening",
         "mic", "headphones", "clock", "hello", "clipboard"]
for pose in INTRO:
    im = load(f"onboard-{pose}")
    s = 923 / (im.size[1] - ears_top(im))
    s = min(s, 1000 / im.size[0], 990 / im.size[1])
    save(place(im, (1024, 1024), s, 512, 993), f"public/demos-onboard-{pose}.webp")


def contain(name, dst, box, canvas):
    im = load(name)
    x0, y0, x1, y1 = box
    s = min((x1 - x0) / im.size[0], (y1 - y0) / im.size[1])
    save(place(im, canvas, s, (x0 + x1) / 2, y1), dst)


contain("celebrate", "public/demos-celebrate.webp", (40, 30, 472, 478), (512, 512))
contain("practice", "public/demos-practice.webp", (30, 48, 482, 466), (512, 512))
contain("asleep", "public/demos-asleep.webp", (36, 70, 476, 480), (512, 512))
contain("listening", "public/demos-listening.webp", (40, 60, 472, 512), (512, 512))
contain("speaking", "public/demos-speaking.webp", (20, 56, 492, 512), (512, 512))
contain("side-profile", "public/demos.webp", (48, 96, 464, 470), (512, 512))
for unit in ["boss", "compression", "filler", "fire", "pace", "pause", "structure"]:
    contain(f"unit-{unit}", f"public/unit/{unit}.webp", (8, 10, 248, 246), (256, 256))

head = load("side-profile")
s = min(420 / head.size[0], 280 / head.size[1])
head = head.resize((round(head.size[0] * s), round(head.size[1] * s)), Image.LANCZOS)
splash = Image.new("RGBA", (432, 285), (0, 0, 0, 0))
splash.paste(head, ((432 - head.size[0]) // 2, (285 - head.size[1]) // 2), head)
save(splash, "public/splash-demos.webp")
