import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DOMPurify from "dompurify";
import type { EmailAttachment } from "../email-api";

const REMOTE_RE = /^(https?:)?\/\//i;

/**
 * Sanitizes message HTML for a script-less sandboxed iframe: cid: images map
 * to stored attachments, remote images stay blocked by a CSP until the user
 * opts in, links open in a new window.
 */
export function useMessageHtml(html: string, attachments: EmailAttachment[]) {
  const [allowRemote, setAllowRemote] = useState(false);
  const [height, setHeight] = useState(120);
  const frameRef = useRef<HTMLIFrameElement>(null);

  const { doc, remoteCount } = useMemo(() => {
    const byCid = new Map(attachments.filter((a) => a.contentId).map((a) => [a.contentId!.toLowerCase(), a]));
    let remote = 0;
    DOMPurify.addHook("afterSanitizeAttributes", (node) => {
      if (node.tagName === "A") {
        node.setAttribute("target", "_blank");
        node.setAttribute("rel", "noopener noreferrer");
      }
      for (const attr of ["src", "background"]) {
        const value = node.getAttribute(attr);
        if (!value) continue;
        if (value.toLowerCase().startsWith("cid:")) {
          const att = byCid.get(value.slice(4).toLowerCase());
          if (att) node.setAttribute(attr, `${att.url}?inline=1`);
        } else if (REMOTE_RE.test(value)) {
          remote += 1;
        }
      }
    });
    const clean = DOMPurify.sanitize(html, { WHOLE_DOCUMENT: false, FORBID_TAGS: ["script", "iframe", "object", "embed", "form", "base", "meta", "link"], ADD_ATTR: ["target"] });
    DOMPurify.removeHook("afterSanitizeAttributes");
    const origin = window.location.origin;
    const csp = `default-src 'none'; style-src 'unsafe-inline'; font-src data: ${allowRemote ? "https:" : ""}; img-src data: ${origin} ${allowRemote ? "https: http:" : ""};`;
    return {
      remoteCount: remote,
      doc: `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="${csp}"><meta name="referrer" content="no-referrer"><style>
html,body{margin:0;padding:0;background:#fff;color:#1f2328;font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;word-wrap:break-word;overflow-wrap:anywhere}
body{padding:16px}img{max-width:100%;height:auto}table{max-width:100%}pre{white-space:pre-wrap}blockquote{margin:0 0 0 .8ex;border-left:2px solid #d0d7de;padding-left:1ex;color:#57606a}
</style></head><body>${clean}</body></html>`,
    };
  }, [html, attachments, allowRemote]);

  const measure = useCallback(() => {
    const body = frameRef.current?.contentDocument?.documentElement;
    if (body) setHeight(Math.min(Math.max(body.scrollHeight, 60), 20000));
  }, []);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    let observer: ResizeObserver | null = null;
    const onLoad = () => {
      measure();
      const body = frame.contentDocument?.body;
      if (body && "ResizeObserver" in window) {
        observer = new ResizeObserver(measure);
        observer.observe(body);
      }
    };
    frame.addEventListener("load", onLoad);
    return () => {
      frame.removeEventListener("load", onLoad);
      observer?.disconnect();
    };
  }, [doc, measure]);

  return { frameRef, doc, height, remoteCount, allowRemote, setAllowRemote };
}
