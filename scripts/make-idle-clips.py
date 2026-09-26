"""
Demos's idle clips (DECISIONS #316): a Kling render per pose, turned
into a small video that carries its own transparency.

Each source clip is Kling v3.0 (std, 5s, 1:1, silent) with the 3D pose's
own render as BOTH the first and the last frame, so the clip starts and
ends on the still the page already shows: the swap is invisible and the
clip loops. The prompt asks for one gentle action, a blink, planted feet,
a locked camera and a plain white ground. About 6 credits each.

This script, per pose:
  1. downloads the source clip (the URLs are Higgsfield's CDN; a new
     render replaces its line in SOURCES),
  2. cuts every frame off its white with rembg and un-premultiplies
     against white, as scripts/place-3d-demos.py does for the stills, so
     no pale fringe shows on a dark stage. `isnet-general-use` for most
     poses; the celebration's bounce blurs his tail, which isnet reads as
     half background (a grey ghost of a tail on the dark stage), so that
     pose is cut with `birefnet-general-lite`, about eight times slower.
     Holes the matte leaves INSIDE him (an eyelid mid-blink read as
     background) are filled from the frame, since nothing enclosed by
     fur is ever meant to be see-through,
  3. places every frame with ONE transform, the one that lays the first
     frame exactly over the shipped still (public/demos-onboard-<pose>
     .webp, 1024 square), scaled to OUT, so nothing jitters,
  4. stacks colour (premultiplied) over alpha (as grey) and encodes
     public/idle/<pose>.webm (VP9) and .mp4 (H.264, for Safari).

components/DemosClip.tsx puts the halves back together in a shader.
lib/idle-clips.ts lists the poses; lib/idle-clips.test.ts holds the
files to existing and to CLIP_MAX_BYTES.

    pip install pillow numpy rembg onnxruntime imageio-ffmpeg
    python3 scripts/make-idle-clips.py            # every pose
    python3 scripts/make-idle-clips.py wave       # one
"""

import glob
import os
import subprocess
import sys
import tempfile
import urllib.request

import imageio_ffmpeg
import numpy as np
from PIL import Image
from rembg import new_session, remove
from scipy.ndimage import binary_erosion, binary_fill_holes

CDN = "https://d8j0ntlcm91z4.cloudfront.net/user_3B6GJ2qFPzJeS439soyfKOK3IXx/"
SOURCES = {
    # pose: (source clip, what he does in it)
    "wave": ("hf_20260926_063026_e6dea738-cbcd-4584-b192-ff5710757375.mp4", "waves the raised paw, blinks"),
    "speaking": ("hf_20260926_063628_be244a12-0683-4683-881e-c384b1661e41.mp4", "talks and gestures, blinks"),
    "celebrate": ("hf_20260926_063629_ca09841c-fae5-40e6-97cc-befb948157ab.mp4", "two happy bounces, arms up"),
    "clipboard": ("hf_20260926_063628_1f7a729e-6ad2-4799-b53d-50e4b5cfc39b.mp4", "glances at the clipboard, nods"),
    "clock": ("hf_20260926_063628_fee7a5f9-760d-4e53-979e-cfa89efd1d3e.mp4", "glances at the clock, smiles"),
    "hello": ("hf_20260926_063629_cfdb2936-2f31-4ade-b766-ed77a8065c10.mp4", "blinks, tilts his head"),
    "listening": ("hf_20260926_064004_8251ccc0-8aef-454a-9fc5-986c7842188c.mp4", "paw at his ear, tilts and nods"),
}
OUT = 640  # the clip's square: 2x the largest stage he stands on
MATTE = {"celebrate": "birefnet-general-lite"}  # default isnet-general-use
# (mp4 CRF, webm CRF). The bounce moves every pixel every frame, so the
# celebration needs a harder squeeze to stay inside CLIP_MAX_BYTES.
CRF = {"celebrate": (30, 42)}  # default (24, 34)
EDGE = 4  # px of the source frame at his outline that keep the soft matte
FF = imageio_ffmpeg.get_ffmpeg_exe()


def cut(frame, session):
    """One frame off its white: RGBA floats, holes filled, un-premultiplied."""
    c = remove(frame, session=session).convert("RGBA")
    a = np.asarray(c).astype(np.float32) / 255
    # He is solid: everything more than a few pixels inside his outline
    # (holes filled) is taken from the frame itself at full opacity, so a
    # blinking eyelid or a pale eyebrow the matte half-dropped cannot show
    # the stage through him. Only the band at his edge keeps the matte,
    # which is where fur is actually soft.
    inside = binary_erosion(binary_fill_holes(a[..., 3] > 0.5), iterations=EDGE)
    if inside.any():
        a = a.copy()
        a[inside, :3] = np.asarray(frame).astype(np.float32)[inside] / 255
        a[inside, 3] = 1.0
    rgb, al = a[..., :3], a[..., 3:4]
    rgb = np.where(al > 0.02, np.clip((rgb - (1 - al)) / np.clip(al, 1e-3, 1), 0, 1), rgb)
    al = np.where(al < 0.03, 0, al)
    return np.concatenate([rgb, al], axis=-1)


def transform(first, pose):
    """One transform for every frame: the first frame onto the still."""
    fy, fx = np.nonzero(first[..., 3] > 0.5)
    still = Image.open(f"public/demos-onboard-{pose}.webp").convert("RGBA").getbbox()
    scale = (still[3] - still[1]) / (fy.max() - fy.min() + 1) * OUT / 1024
    return scale, still[0] * OUT / 1024 - fx.min() * scale, still[1] * OUT / 1024 - fy.min() * scale


def stacked(c, scale, ox, oy):
    """Colour (premultiplied) over alpha as grey, on the OUT square."""
    h, w = c.shape[:2]
    im = Image.fromarray((c * 255).round().astype(np.uint8), "RGBA")
    im = im.resize((round(w * scale), round(h * scale)), Image.LANCZOS)
    canvas = Image.new("RGBA", (OUT, OUT), (0, 0, 0, 0))
    canvas.paste(im, (round(ox), round(oy)), im)
    a = np.asarray(canvas).astype(np.float32) / 255
    colour = a[..., :3] * a[..., 3:4]
    alpha = np.repeat(a[..., 3:4], 3, axis=-1)
    return Image.fromarray((np.concatenate([colour, alpha]) * 255).round().astype(np.uint8), "RGB")


def encode(stack, pose, fps):
    base = f"public/idle/{pose}"
    crf_mp4, crf_webm = CRF.get(pose, (24, 34))
    common = [FF, "-v", "error", "-y", "-framerate", fps, "-i", f"{stack}/s%04d.png", "-an", "-pix_fmt", "yuv420p"]
    subprocess.run(common + ["-c:v", "libx264", "-crf", str(crf_mp4), "-preset", "slow", "-movflags", "+faststart", f"{base}.mp4"], check=True)
    subprocess.run(common + ["-c:v", "libvpx-vp9", "-b:v", "0", "-crf", str(crf_webm), "-row-mt", "1", "-deadline", "good", "-cpu-used", "2", f"{base}.webm"], check=True)
    return os.path.getsize(f"{base}.webm"), os.path.getsize(f"{base}.mp4")


def main(poses):
    os.makedirs("public/idle", exist_ok=True)
    # The heavy matte last, and one model loaded at a time: BiRefNet alone
    # holds about 12GB.
    poses = sorted(poses, key=lambda p: p in MATTE)
    model, session = None, None
    for pose in poses:
        name, _ = SOURCES[pose]
        if MATTE.get(pose, "isnet-general-use") != model:
            model = MATTE.get(pose, "isnet-general-use")
            session = None
            session = new_session(model)
        with tempfile.TemporaryDirectory() as tmp:
            src = f"{tmp}/src.mp4"
            urllib.request.urlretrieve(CDN + name, src)
            probe = subprocess.run([FF, "-i", src], capture_output=True, text=True).stderr
            fps = [t for t in probe.split(",") if " fps" in t][0].strip().split(" ")[0]
            os.makedirs(f"{tmp}/f")
            os.makedirs(f"{tmp}/s")
            subprocess.run([FF, "-v", "error", "-i", src, "-vsync", "0", f"{tmp}/f/f%04d.png"], check=True)
            # One frame in memory at a time: 121 float frames at 960 and
            # BiRefNet together ran a phone-sized cgroup out of memory.
            files = sorted(glob.glob(f"{tmp}/f/f*.png"))
            place = None
            for i, f in enumerate(files):
                c = cut(Image.open(f).convert("RGB"), session)
                place = place or transform(c, pose)
                stacked(c, *place).save(f"{tmp}/s/s{i:04d}.png")
            webm, mp4 = encode(f"{tmp}/s", pose, fps)
            print(f"{pose}: {len(files)} frames at {fps}fps, webm {webm // 1024}KB, mp4 {mp4 // 1024}KB")


if __name__ == "__main__":
    main(sys.argv[1:] or list(SOURCES))
