// TipTap JSON helpers: plain text (search + preview), page mentions
// (backlinks) and embedded databases (inline database blocks).

interface PMNode {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  content?: PMNode[];
}

const BLOCKS = new Set(["paragraph", "heading", "listItem", "taskItem", "blockquote", "codeBlock", "callout", "tableCell", "tableHeader", "detailsSummary"]);

export function extractText(doc: unknown, max = 200_000): string {
  const parts: string[] = [];
  let len = 0;
  const walk = (n: PMNode) => {
    if (len > max) return;
    if (n.type === "text" && n.text) {
      parts.push(n.text);
      len += n.text.length;
    } else if (n.type === "pageMention" && typeof n.attrs?.title === "string") {
      parts.push(n.attrs.title);
    }
    n.content?.forEach(walk);
    if (n.type && BLOCKS.has(n.type)) parts.push("\n");
  };
  if (doc && typeof doc === "object") walk(doc as PMNode);
  return parts.join("").replace(/\n{2,}/g, "\n").trim().slice(0, max);
}

function collect(doc: unknown, type: string, attr: string): string[] {
  const out = new Set<string>();
  const walk = (n: PMNode) => {
    if (n.type === type && typeof n.attrs?.[attr] === "string") out.add(n.attrs[attr] as string);
    n.content?.forEach(walk);
  };
  if (doc && typeof doc === "object") walk(doc as PMNode);
  return [...out];
}

export const extractMentions = (doc: unknown) => collect(doc, "pageMention", "id");
export const extractEmbeddedDatabases = (doc: unknown) => collect(doc, "databaseView", "databaseId");

export const emptyDoc = () => ({ type: "doc", content: [{ type: "paragraph" }] });
