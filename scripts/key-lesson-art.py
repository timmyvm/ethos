"""
The lesson art, keyed off its ground (the cohesion fix round, 26 Oct).

The fifteen Liquid Glass renders (#322, scripts/cut-lesson-art.mjs) are
each one frosted object on a vertical gradient in its trait's tone. As
tiles they were the loudest thing in the app: a first-time tester in
dark called Lessons "too bright", and on the hero stage the tile was a
square of colour set on the sky where every other stage has a figure
standing on its floor. So the gradient goes and the object stays.

The ground is known, which makes this a difference matte rather than a
guess: each row's ground is the median of the 14px border columns on
both sides (the gradient is vertical), with the top band's left-to-right
falloff carried down so the vignette does not read as object. A pixel's
alpha is its distance from that ground, eased; its colour is then
un-premultiplied against the same ground, so a glass edge keeps its
light and loses the tone it was sitting on. The contact shadow survives
as a soft shadow, which is what lets the object stand on a floor.

Run after cut-lesson-art.mjs, over its output, in place. A file that
already has transparency is left alone, so a second run is a no-op:

    pip install pillow numpy
    python3 scripts/key-lesson-art.py
"""

import glob
import os

import numpy as np
from PIL import Image

DIR = os.path.join(os.path.dirname(__file__), "..", "public", "lessons")
BORDER = 14
# Distance from the ground (0..sqrt(3)) where alpha starts and where it is full.
LO, SPAN = 0.06, 0.22


def key(rgb: np.ndarray) -> np.ndarray:
    h, w, _ = rgb.shape
    border = np.concatenate([rgb[:, :BORDER], rgb[:, -BORDER:]], axis=1)
    row = np.median(border, axis=1)
    ground = np.repeat(row[:, None, :], w, axis=1)
    top = np.median(rgb[:BORDER], axis=0)
    falloff = (top - np.median(row[:BORDER], axis=0))[None, :, :]
    ground = np.clip(ground + falloff * np.linspace(1, 0.3, h)[:, None, None], 0, 1)
    d = np.sqrt(((rgb - ground) ** 2).sum(-1))
    a = np.clip((d - LO) / SPAN, 0, 1) ** 0.8
    a3 = a[..., None]
    fg = np.where(a3 > 0.02, (rgb - (1 - a3) * ground) / np.maximum(a3, 0.02), rgb)
    return np.dstack([np.clip(fg, 0, 1), a])


for path in sorted(glob.glob(os.path.join(DIR, "*.webp"))):
    name = os.path.basename(path)
    im = Image.open(path)
    if im.mode == "RGBA" and np.asarray(im)[..., 3].min() < 255:
        print(f"have  {name}")
        continue
    rgba = key(np.asarray(im.convert("RGB")).astype(np.float32) / 255)
    out = Image.fromarray((rgba * 255).round().astype(np.uint8), "RGBA")
    before = os.path.getsize(path)
    out.save(path, "WEBP", quality=86, method=6, exact=False)
    print(f"key   {name}  {before // 1024}KB -> {os.path.getsize(path) // 1024}KB")
