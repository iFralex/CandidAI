#!/usr/bin/env python3
"""
Generate all icon assets for CandidAI from a single source PNG.

Usage:
    python3 scripts/generate-icons.py [path/to/logo.png]

Defaults to site/public/logo.png if no argument is given.
Outputs:
    site/public/          → favicon.ico, favicon-*.png, apple-touch-icon.png,
                            android-chrome-*.png, og-image.png
    desktop/assets/       → icon.icns (macOS), icon.ico (Windows)
"""

import os
import sys
import subprocess
import shutil

try:
    from PIL import Image
except ImportError:
    print("Pillow not found — installing...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "pillow", "-q"])
    from PIL import Image

# ── Paths ──────────────────────────────────────────────────────────────────────

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT       = os.path.dirname(SCRIPT_DIR)
SRC        = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "site", "public", "logo.png")
PUB        = os.path.join(ROOT, "site", "public")
ASSETS     = os.path.join(ROOT, "desktop", "assets")

# ── Load source ────────────────────────────────────────────────────────────────

if not os.path.exists(SRC):
    sys.exit(f"Error: source image not found at {SRC}")

print(f"Source: {SRC}")
img = Image.open(SRC).convert("RGBA")
w, h = img.size
if abs(w - h) / max(w, h) > 0.05:
    print(f"  Warning: image is not square ({w}×{h}). Icons may look squished.")

# ── Helpers ────────────────────────────────────────────────────────────────────

def resize(size: int) -> Image.Image:
    return img.resize((size, size), Image.LANCZOS)

def save(image: Image.Image, *parts: str) -> None:
    path = os.path.join(*parts)
    image.save(path)
    print(f"  ✓ {os.path.relpath(path, ROOT)}")

# ── site/public ────────────────────────────────────────────────────────────────

print("\n── Web / PWA icons ──")

# favicon.ico  (16 + 32 + 48 in one file)
ico_frames = [resize(s) for s in (16, 32, 48)]
ico_path   = os.path.join(PUB, "favicon.ico")
ico_frames[0].save(
    ico_path, format="ICO",
    sizes=[(16,16),(32,32),(48,48)],
    append_images=ico_frames[1:],
)
print(f"  ✓ {os.path.relpath(ico_path, ROOT)}")

web_icons = {
    "favicon-16x16.png":        16,
    "favicon-32x32.png":        32,
    "apple-touch-icon.png":    180,
    "android-chrome-192x192.png": 192,
    "android-chrome-512x512.png": 512,
    "og-image.png":            512,
}
for name, size in web_icons.items():
    save(resize(size), PUB, name)

# ── desktop/assets ─────────────────────────────────────────────────────────────

print("\n── Desktop app icons ──")
os.makedirs(ASSETS, exist_ok=True)

# .ico for Windows — use ImageMagick when available (PIL produces broken ICOs)
win_ico = os.path.join(ASSETS, "icon.ico")
if shutil.which("magick"):
    # Pad to square first (logo may not be square), then resize to exact sizes
    clone_args = []
    for s in (16, 24, 32, 48, 64, 128, 256):
        clone_args += ["(", "-clone", "0", "-resize", f"{s}x{s}", ")"]
    subprocess.run(
        [
            "magick", SRC,
            "-gravity", "center", "-background", "none",
            "-extent", "%[fx:max(w,h)]x%[fx:max(w,h)]",
        ] + clone_args + ["-delete", "0", win_ico],
        check=True,
    )
else:
    # Fallback: PIL with square crop/pad
    side = max(img.size)
    padded = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    padded.paste(img, ((side - img.width) // 2, (side - img.height) // 2))
    win_frames = [padded.resize((s, s), Image.LANCZOS) for s in (16, 24, 32, 48, 64, 128, 256)]
    win_frames[0].save(win_ico, format="ICO", append_images=win_frames[1:])
print(f"  ✓ {os.path.relpath(win_ico, ROOT)}")

# .icns for macOS via iconutil (macOS only)
if shutil.which("iconutil"):
    iconset_dir = os.path.join(ASSETS, "icon.iconset")
    os.makedirs(iconset_dir, exist_ok=True)

    for s in (16, 32, 64, 128, 256, 512, 1024):
        resize(s).save(os.path.join(iconset_dir, f"icon_{s}x{s}.png"))
        if s <= 512:
            resize(s).save(os.path.join(iconset_dir, f"icon_{s//2}x{s//2}@2x.png"))

    icns_path = os.path.join(ASSETS, "icon.icns")
    subprocess.run(
        ["iconutil", "-c", "icns", iconset_dir, "-o", icns_path],
        check=True,
    )
    shutil.rmtree(iconset_dir)
    print(f"  ✓ {os.path.relpath(icns_path, ROOT)}")
else:
    # Fallback: save a high-res PNG named icon.icns (electron-builder accepts it on non-mac CI)
    fallback = os.path.join(ASSETS, "icon.png")
    resize(1024).save(fallback)
    print(f"  ✓ {os.path.relpath(fallback, ROOT)}  (iconutil not available — saved PNG fallback)")

# Next.js App Router: app/favicon.ico takes precedence over public/
app_favicon = os.path.join(ROOT, "site", "src", "app", "favicon.ico")
shutil.copy2(os.path.join(PUB, "favicon.ico"), app_favicon)
print(f"  ✓ {os.path.relpath(app_favicon, ROOT)}  (Next.js app dir copy)")

# electron-builder looks for icons in buildResources (default: desktop/build/)
build_dir = os.path.join(ROOT, "desktop", "build")
os.makedirs(build_dir, exist_ok=True)
for fname in ("icon.icns", "icon.ico"):
    src = os.path.join(ASSETS, fname)
    dst = os.path.join(build_dir, fname)
    if os.path.exists(src):
        shutil.copy2(src, dst)
        print(f"  ✓ {os.path.relpath(dst, ROOT)}  (buildResources copy)")

print("\nDone.")
