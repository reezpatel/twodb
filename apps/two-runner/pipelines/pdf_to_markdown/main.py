# /// script
# requires-python = ">=3.10"
# dependencies = ["pymupdf4llm", "pymupdf"]
# ///
import json, os, re
import pymupdf, pymupdf4llm

inp = json.load(open(os.environ["PIPELINE_INPUT"]))
out = os.environ["PIPELINE_OUT_DIR"]
img_dir = os.path.join(out, "images")
os.makedirs(img_dir, exist_ok=True)
min_side = int(inp.get("minImageSize") or 64)

doc = pymupdf.open(inp["pdf"])
pages = None
if inp.get("pages"):
    a, _, b = str(inp["pages"]).partition("-")
    pages = list(range(int(a) - 1, int(b or a)))

# Extract every embedded image once (xref-deduplicated) and remember which page it first appears on.
saved, seen = [], {}
for pno in (pages if pages is not None else range(len(doc))):
    for img in doc.get_page_images(pno, full=True):
        xref = img[0]
        if xref in seen:
            continue
        try:
            ex = doc.extract_image(xref)
        except Exception:
            continue
        if not ex or min(ex["width"], ex["height"]) < min_side:
            continue
        name = f"{len(saved) + 1:03d}.{ex['ext']}"
        open(os.path.join(img_dir, name), "wb").write(ex["image"])
        seen[xref] = name
        saved.append({"file": f"images/{name}", "page": pno + 1, "width": ex["width"], "height": ex["height"]})

md = pymupdf4llm.to_markdown(doc, pages=pages)
# Append an image index so references survive even where the layout parser inlined none.
if saved:
    md += "\n\n---\n\n## Images\n\n" + "\n\n".join(f"![page {s['page']}]({s['file']})" for s in saved) + "\n"
open(os.path.join(out, "document.md"), "w").write(md)
if not saved:
    os.rmdir(img_dir)
json.dump({"file": "document.md", "pages": len(doc), "images": saved, "characters": len(md)}, open(os.path.join(out, "result.json"), "w"))
