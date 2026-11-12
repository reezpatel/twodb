import DOMPurify from "dompurify";

/** Sanitizes editor HTML before rendering or storing-for-display. Links open in a new tab safely. */
export function sanitizeHtml(html: string): string {
  const clean = DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    ADD_ATTR: ["target", "data-type", "data-checked"],
    FORBID_TAGS: ["style", "form", "input", "iframe", "object", "embed"],
  });
  const tpl = document.createElement("template");
  tpl.innerHTML = clean;
  tpl.content.querySelectorAll("a[href]").forEach((a) => {
    a.setAttribute("target", "_blank");
    a.setAttribute("rel", "noopener noreferrer nofollow");
  });
  return tpl.innerHTML;
}

/** True when the HTML has no visible content (empty paragraphs only). */
export function isEmptyHtml(html: string): boolean {
  if (!html) return true;
  if (/<(img|hr|ul|ol|pre|table|blockquote)\b/i.test(html)) return false;
  return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim() === "";
}
