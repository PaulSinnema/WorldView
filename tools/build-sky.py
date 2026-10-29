# Star sky for the globe background: NASA SVS "Deep Star Maps 2020" (Gaia DR2 / Hipparcos / Tycho, celestial ICRF)
# → 6 cube faces for Cesium's SkyBox in WorldView/wwwroot/sky/
# Run once: python -m pip install OpenEXR numpy pillow  then  python tools/build-sky.py [--size 2048] [--keep]
import argparse, os, tempfile, urllib.request
import numpy as np
from PIL import Image

URL = 'https://svs.gsfc.nasa.gov/vis/a000000/a004800/a004851/starmap_2020_8k.exr'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'WorldView', 'wwwroot', 'sky')
ap = argparse.ArgumentParser()
ap.add_argument('--size', type=int, default=2048)
ap.add_argument('--keep', action='store_true')  # keep/reuse the downloaded EXR
ap.add_argument('--exposure', type=float, default=1.0)
args = ap.parse_args()

tmp = os.path.join(tempfile.gettempdir(), 'starmap_2020_8k.exr')
if not os.path.exists(tmp) or not args.keep:
    print('download', URL)
    urllib.request.urlretrieve(URL, tmp)

def read_exr(path):
    import OpenEXR
    if hasattr(OpenEXR, 'File'):  # OpenEXR >= 3.3
        with OpenEXR.File(path) as f:
            ch = f.channels()
            if 'RGB' in ch: return np.asarray(ch['RGB'].pixels, dtype=np.float32)
            return np.stack([np.asarray(ch[c].pixels, dtype=np.float32) for c in 'RGB'], axis=-1)
    import Imath  # older API
    f = OpenEXR.InputFile(path); dw = f.header()['dataWindow']
    w, h = dw.max.x - dw.min.x + 1, dw.max.y - dw.min.y + 1
    pt = Imath.PixelType(Imath.PixelType.FLOAT)
    return np.stack([np.frombuffer(f.channel(c, pt), dtype=np.float32).reshape(h, w) for c in 'RGB'], axis=-1)

img = read_exr(tmp)
H, W, _ = img.shape
print('exr', W, H)

# Tone map: exposure from the bright end, soft shoulder, sRGB gamma
lum = img.mean(axis=2)
scale = args.exposure / max(np.percentile(lum, 99.97), 1e-6)
img = img * scale
img = img / (1 + img * 0.15)  # gentle shoulder keeps star colours
img = np.clip(img, 0, 1) ** (1 / 2.2)

# Cube face directions (ICRF), OpenGL cube-map convention used by WebGL/Cesium
N = args.size
c = (np.arange(N) + 0.5) / N * 2 - 1
a, b = np.meshgrid(c, c)  # a: column (s), b: row (t), row 0 at the top of the image
one = np.ones_like(a)
FACES = {
    'px': (one, -b, -a), 'nx': (-one, -b, a),
    'py': (a, one, b), 'ny': (a, -one, -b),
    'pz': (a, -b, one), 'nz': (-a, -b, -one),
}
os.makedirs(OUT, exist_ok=True)
for name, (x, y, z) in FACES.items():
    r = np.sqrt(x * x + y * y + z * z)
    ra = np.arctan2(y, x)             # right ascension
    dec = np.arcsin(z / r)            # declination
    # SVS map: centred on RA 0h, RA increases to the left; top row = +90°
    u = (0.5 - ra / (2 * np.pi)) * W - 0.5
    v = (0.5 - dec / np.pi) * H - 0.5
    # Bilinear sampling (wraps in RA)
    u0 = np.floor(u).astype(int); v0 = np.clip(np.floor(v).astype(int), 0, H - 2)
    fu = (u - u0)[..., None]; fv = np.clip(v - v0, 0, 1)[..., None]
    u0 %= W; u1 = (u0 + 1) % W
    p = (img[v0, u0] * (1 - fu) + img[v0, u1] * fu) * (1 - fv) + (img[v0 + 1, u0] * (1 - fu) + img[v0 + 1, u1] * fu) * fv
    # Cesium uploads cube faces flipped vertically (checked against its own Tycho sky box)
    Image.fromarray((p * 255 + 0.5).astype(np.uint8)).transpose(Image.Transpose.FLIP_TOP_BOTTOM).save(os.path.join(OUT, f'{name}.jpg'), quality=85, optimize=True)
    print(name, os.path.getsize(os.path.join(OUT, f'{name}.jpg')) // 1024, 'KB')

if not args.keep: os.remove(tmp)
