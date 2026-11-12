// In-place markdown edits for agents (append / replace_section / replace).
export type DocOp =
  | { op: "append"; markdown: string }
  | { op: "prepend"; markdown: string }
  | { op: "replace_section"; heading: string; markdown: string }
  | { op: "replace"; find: string; with: string; all?: boolean };

export class DocOpError extends Error {}

interface Heading {
  line: number;
  level: number;
  text: string;
}

function headings(lines: string[]): Heading[] {
  const out: Heading[] = [];
  let fence: string | null = null;
  lines.forEach((l, i) => {
    const f = /^\s*(```+|~~~+)/.exec(l);
    if (f) {
      if (!fence) fence = f[1]![0]!;
      else if (f[1]![0] === fence) fence = null;
      return;
    }
    if (fence) return;
    const m = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(l);
    if (m) out.push({ line: i, level: m[1]!.length, text: m[2]!.trim() });
  });
  return out;
}

export function applyDocOps(markdown: string, ops: DocOp[]): string {
  let md = markdown;
  for (const op of ops) {
    if (op.op === "append") md = md.replace(/\s*$/, "") + "\n\n" + op.markdown.replace(/^\s+/, "").replace(/\s*$/, "") + "\n";
    else if (op.op === "prepend") md = op.markdown.replace(/\s*$/, "") + "\n\n" + md.replace(/^\s+/, "");
    else if (op.op === "replace") {
      if (!md.includes(op.find)) throw new DocOpError(`replace: text not found: ${JSON.stringify(op.find.slice(0, 60))}`);
      md = op.all ? md.split(op.find).join(op.with) : md.replace(op.find, () => op.with);
    } else {
      const lines = md.split("\n");
      const hs = headings(lines);
      const want = op.heading.replace(/^#+\s*/, "").trim().toLowerCase();
      const i = hs.findIndex((h) => h.text.toLowerCase() === want);
      if (i < 0) throw new DocOpError(`replace_section: heading not found: ${op.heading}`);
      const h = hs[i]!;
      const next = hs.slice(i + 1).find((x) => x.level <= h.level);
      const end = next ? next.line : lines.length;
      const body = op.markdown.replace(/^\n+|\s+$/g, "");
      const replacement = [lines[h.line]!, "", ...(body ? body.split("\n") : []), ...(next ? [""] : [])];
      lines.splice(h.line, end - h.line, ...replacement);
      md = lines.join("\n");
    }
  }
  return md;
}
