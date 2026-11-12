import { useMemo } from "react";
import { sanitizeHtml } from "./lib/sanitize";

/** Read-only, sanitized rendering of editor HTML. */
export function RichTextView({ html, className }: { html: string; className?: string }) {
  const clean = useMemo(() => sanitizeHtml(html), [html]);
  return <div className={`twodb-editor twodb-editor-view ${className ?? ""}`}><div className="twodb-editor-content" dangerouslySetInnerHTML={{ __html: clean }} /></div>;
}
