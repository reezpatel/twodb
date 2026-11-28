# /// script
# requires-python = ">=3.10"
# dependencies = ["markitdown[pptx,xlsx,xls,pdf]", "mammoth", "markdownify"]
# ///
import json, os
from markitdown import MarkItDown

inp = json.load(open(os.environ["PIPELINE_INPUT"]))
out = os.environ["PIPELINE_OUT_DIR"]
src = inp["document"]

if src.lower().endswith(".docx"):
    # markitdown's docx pre-processing mangles namespaces with current bs4/lxml ("Could not find the body element"),
    # so docx goes straight through mammoth → HTML → Markdown (headings, lists, tables, links, inline styles kept).
    import mammoth
    from markdownify import markdownify
    with open(src, "rb") as fh:
        html = mammoth.convert_to_html(fh).value
    md, title = markdownify(html, heading_style="ATX"), None
else:
    res = MarkItDown().convert(src)
    md = res.markdown if hasattr(res, "markdown") else res.text_content
    title = getattr(res, "title", None)

open(os.path.join(out, "document.md"), "w").write(md)
json.dump({"file": "document.md", "title": title, "characters": len(md)}, open(os.path.join(out, "result.json"), "w"))
