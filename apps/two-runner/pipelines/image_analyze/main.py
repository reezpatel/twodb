# /// script
# requires-python = ">=3.10"
# dependencies = ["rapidocr-onnxruntime", "opencv-python-headless", "numpy"]
#
# [tool.uv]
# # rapidocr pulls the GUI build of OpenCV (needs libxcb/GL, absent on servers); the headless build above provides cv2.
# exclude-dependencies = ["opencv-python"]
# ///
import json, os, sys, zipfile
import cv2, numpy as np

inp = json.load(open(os.environ["PIPELINE_INPUT"]))
out = os.environ["PIPELINE_OUT_DIR"]
work = os.path.join(os.environ["PIPELINE_OUT_DIR"], "..", "unzipped")
ann_dir = os.path.join(out, "annotated")
os.makedirs(ann_dir, exist_ok=True)
MIN = float(inp.get("minConfidence") or 0.5)
DO_OCR = inp.get("ocr", True) is not False
DO_DET = bool(inp.get("detect"))
EXT = (".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tif", ".tiff")

# Expand zips; keep a stable display name (zip/inner/path).
files = []
srcs = inp["images"] if isinstance(inp["images"], list) else [inp["images"]]
for src in srcs:
    if src.lower().endswith(".zip") or zipfile.is_zipfile(src):
        dest = os.path.join(work, os.path.basename(os.path.dirname(src)) + "_" + os.path.basename(src))
        with zipfile.ZipFile(src) as z:
            for info in z.infolist():
                n = info.filename
                if info.is_dir() or ".." in n.split("/") or n.startswith("/") or not n.lower().endswith(EXT) or "__MACOSX" in n:
                    continue
                z.extract(info, dest)
                files.append((os.path.splitext(os.path.basename(src))[0] + "/" + n, os.path.join(dest, n)))
    elif src.lower().endswith(EXT):
        files.append((os.path.basename(src), src))
if not files:
    sys.exit("no images found in the input")

ocr = None
if DO_OCR:
    from rapidocr_onnxruntime import RapidOCR
    ocr = RapidOCR()
detector = None
if DET := DO_DET:
    from transformers import pipeline  # optional heavy dependency, resolved by the pipeline env on demand
    import torch
    detector = pipeline("object-detection", model="facebook/detr-resnet-50", device=0 if torch.cuda.is_available() else -1)

results = []
for display, path in files:
    img = cv2.imread(path)
    if img is None:
        results.append({"image": display, "error": "unreadable image"})
        continue
    h, w = img.shape[:2]
    vis = img.copy()
    entry = {"image": display, "width": w, "height": h, "text": [], "objects": []}
    if ocr:
        res, _ = ocr(img)
        for box, text, conf in (res or []):
            conf = float(conf)
            if conf < MIN:
                continue
            pts = np.array(box, dtype=np.int32)
            x1, y1, x2, y2 = int(pts[:, 0].min()), int(pts[:, 1].min()), int(pts[:, 0].max()), int(pts[:, 1].max())
            entry["text"].append({"text": text, "confidence": round(conf, 3), "box": [x1, y1, x2, y2], "polygon": pts.tolist()})
            cv2.polylines(vis, [pts], True, (0, 200, 0), 2)
        entry["fullText"] = "\n".join(t["text"] for t in entry["text"])
    if detector:
        from PIL import Image
        for d in detector(Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))):
            if d["score"] < MIN:
                continue
            b = d["box"]
            box = [int(b["xmin"]), int(b["ymin"]), int(b["xmax"]), int(b["ymax"])]
            entry["objects"].append({"label": d["label"], "confidence": round(float(d["score"]), 3), "box": box})
            cv2.rectangle(vis, (box[0], box[1]), (box[2], box[3]), (0, 0, 255), 2)
            cv2.putText(vis, d["label"], (box[0], max(box[1] - 4, 10)), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 2)
    safe = display.replace("/", "__")
    stem = os.path.splitext(safe)[0]
    cv2.imwrite(os.path.join(ann_dir, stem + ".jpg"), vis, [cv2.IMWRITE_JPEG_QUALITY, 90])
    entry["annotated"] = f"annotated/{stem}.jpg"
    results.append(entry)

json.dump({"images": results, "count": len(results)}, open(os.path.join(out, "result.json"), "w"), ensure_ascii=False)
