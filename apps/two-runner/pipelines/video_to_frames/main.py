# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy", "opencv-python-headless"]
# ///
"""Change-then-settle keyframe extraction (no model): save a frame once the picture stops changing, if it differs from
the last saved one. Catches typed text (saved when complete), image-after-image slideshows and slide changes."""
import json, os, sys
import cv2, numpy as np

inp = json.load(open(os.environ["PIPELINE_INPUT"]))
out_dir = os.path.join(os.environ["PIPELINE_OUT_DIR"], "frames")
os.makedirs(out_dir, exist_ok=True)

FPS = float(inp.get("fps") or 10)
SETTLE = float(inp.get("settleSeconds") or 0.6)
MIN_CHANGE = float(inp.get("minChange") or 0.002)
MAX_FRAMES = int(inp.get("maxFrames") or 500)
# A new word or a small sticker touches well under 1% of the pixels, so "changed" is a FRACTION of pixels, never a mean
# difference over the frame (a mean hides small text entirely).
PIX_THR = 25            # per-pixel difference (0-255) that counts as a changed pixel
ACTIVE_FRAC = 0.0005    # fraction of pixels changing between two samples that means "still animating"
MAX_SIDE = 640          # analysis resolution (long side); small text vanishes below this

cap = cv2.VideoCapture(inp["video"])
if not cap.isOpened():
    sys.exit("cannot open video")
native = cap.get(cv2.CAP_PROP_FPS) or 30.0
step = max(round(native / FPS), 1)
need = max(int(round(SETTLE * native / step)), 1)

def prep(frame):
    h, w = frame.shape[:2]
    scale = min(MAX_SIDE / max(h, w), 1.0)
    g = cv2.cvtColor(cv2.resize(frame, (max(int(w * scale), 1), max(int(h * scale), 1))), cv2.COLOR_BGR2GRAY)
    return cv2.GaussianBlur(g, (5, 5), 0).astype(np.int16)

saved, last_saved, prev, still, dirty, cur, i = [], None, None, 0, True, None, 0

def save(frame, small, t):
    global last_saved
    if len(saved) >= MAX_FRAMES:
        return
    if last_saved is None or (np.abs(small - last_saved) > PIX_THR).mean() > MIN_CHANGE:
        name = f"{len(saved) + 1:03d}_{t:.2f}s.jpg"
        cv2.imwrite(os.path.join(out_dir, name), frame, [cv2.IMWRITE_JPEG_QUALITY, 92])
        saved.append({"file": f"frames/{name}", "seconds": round(t, 2)})
        last_saved = small

while True:
    ok, frame = cap.read()
    if not ok:
        break
    if i % step == 0:
        small, t = prep(frame), i / native
        if prev is not None:
            if (np.abs(small - prev) > PIX_THR).mean() > ACTIVE_FRAC:
                still, dirty = 0, True
            else:
                still += 1
                if dirty and still >= need:
                    dirty = False
                    save(frame, small, t)
        prev, cur = small, (frame, small, t)
    i += 1
if cur and (dirty or not saved):
    save(*cur)   # video ended mid-change (or never changed): keep the final picture

duration = i / native if native else 0
json.dump({"frames": saved, "count": len(saved), "durationSeconds": round(duration, 2)}, open(os.path.join(os.environ["PIPELINE_OUT_DIR"], "result.json"), "w"))
print(f"{len(saved)} frames from {duration:.1f}s", file=sys.stderr)
