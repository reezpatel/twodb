import { useMediaQuery } from "@/lib/use-media-query";
import { cn } from "@/lib/utils";

/** One hunk split into aligned left/right line arrays for side-by-side. */
interface Hunk {
  header: string;
  left: (string | null)[];
  right: (string | null)[];
}

const SKIP = /^(diff |index |--- |\+\+\+ |\\ No newline)/;
const HUNK_RE = /^@@ -\d+(?:,\d+)? \+\d+(?:,\d+)? @@/;

/** Parse a unified diff into aligned hunks. null = padding gap so a change
 * line lines up with its counterpart on the other side. */
export function parseHunks(text: string): Hunk[] {
  const hunks: Hunk[] = [];
  let current: Hunk | null = null;
  for (const raw of text.split("\n")) {
    if (!raw || SKIP.test(raw)) continue;
    if (HUNK_RE.test(raw)) {
      current = { header: raw, left: [], right: [] };
      hunks.push(current);
      continue;
    }
    if (!current) continue;
    const kind = raw[0];
    const line = raw.slice(1);
    if (kind === "+") current.right.push(line);
    else if (kind === "-") current.left.push(line);
    else if (kind === " ") {
      // Context aligns both sides — flush any pending gap first.
      const l = current.left.length;
      const r = current.right.length;
      if (l < r) for (let i = l; i < r; i++) current.left[i] ??= null;
      else if (r < l) for (let i = r; i < l; i++) current.right[i] ??= null;
      current.left.push(line);
      current.right.push(line);
    }
  }
  return hunks;
}

function HunkHeader({ header }: { header: string }) {
  return <div className="bg-muted text-muted-foreground px-3 py-0.5 font-mono text-[10px] whitespace-pre">{header}</div>;
}

function Line({ text, tone, num }: { text: string | null; tone: "add" | "del" | "ctx"; num?: number }) {
  if (text === null) return <div className="min-h-[1.25rem] bg-muted/30" aria-hidden="true" />;
  return (
    <div
      className={cn(
        "flex min-h-[1.25rem] items-start font-mono text-xs",
        tone === "add" && "bg-success/10 text-success",
        tone === "del" && "bg-destructive/10 text-destructive",
        tone === "ctx" && "text-muted-foreground",
      )}
    >
      {num !== undefined && <span className="text-muted-foreground/50 w-10 shrink-0 select-none pr-2 text-right text-[10px] leading-5">{num > 0 ? num : ""}</span>}
      <span className="px-2 leading-5 whitespace-pre">{text}</span>
    </div>
  );
}

/** Side-by-side on wide viewports, single linear column below (mobile).
 * Line numbers are computed from each hunk header, per side. */
export function DiffView({ text, sideBySide }: { text: string; sideBySide?: boolean }) {
  const isWide = useMediaQuery("(min-width: 1280px)");
  const split = sideBySide ?? isWide;
  const hunks = parseHunks(text);
  if (hunks.length === 0) {
    // Not hunk-shaped (or empty) — fall back to plain preformatted text.
    return <pre className="text-muted-foreground px-3 py-2 font-mono text-xs whitespace-pre-wrap">{text}</pre>;
  }
  return (
    <div className="text-xs">
      {hunks.map((h, hi) => {
        const m = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(h.header);
        let lnL = m ? Number(m[1]) : 0;
        let lnR = m ? Number(m[2]) : 0;
        return (
          <div key={hi}>
            <HunkHeader header={h.header} />
            {split ? (
              <div className="grid grid-cols-2 divide-x">
                <div>
                  {h.left.map((l, i) => (
                    <Line key={i} text={l} tone={l === null ? "ctx" : i < h.right.length && h.right[i] === l ? "ctx" : "del"} num={l === null ? 0 : lnL++} />
                  ))}
                </div>
                <div>
                  {h.right.map((r, i) => (
                    <Line key={i} text={r} tone={r === null ? "ctx" : i < h.left.length && h.left[i] === r ? "ctx" : "add"} num={r === null ? 0 : lnR++} />
                  ))}
                </div>
              </div>
            ) : (
              <div>
                {h.left.map((l, i) =>
                  l === null ? null : <Line key={`d${i}`} text={l} tone="del" num={lnL++} />,
                )}
                {h.right.map((r, i) =>
                  r === null ? null : <Line key={`a${i}`} text={r} tone="add" num={lnR++} />,
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
