import { useEffect, useMemo, useState } from "react";
import { FilePen, FilePlus, FileMinus, FileQuestion, Folder, RefreshCw } from "lucide-react";
import { cn } from "../../lib/cn.js";
import { useSessionSide, type GitInfo } from "./hooks/useSessionSide.js";
import { apiFetch } from "../../lib/artisan-client.js";

/** Parse a unified diff into per-line tokens for rendering. */
function parseDiff(diff: string): Array<{ kind: "ctx" | "add" | "del" | "hunk" | "meta"; text: string }> {
  const out: Array<{ kind: "ctx" | "add" | "del" | "hunk" | "meta"; text: string }> = [];
  for (const raw of diff.split("\n")) {
    if (raw.startsWith("@@")) out.push({ kind: "hunk", text: raw });
    else if (raw.startsWith("+") && !raw.startsWith("+++")) out.push({ kind: "add", text: raw });
    else if (raw.startsWith("-") && !raw.startsWith("---")) out.push({ kind: "del", text: raw });
    else if (raw.startsWith("diff ") || raw.startsWith("index ") || raw.startsWith("---") || raw.startsWith("+++")) out.push({ kind: "meta", text: raw });
    else out.push({ kind: "ctx", text: raw });
  }
  return out;
}

function FileGlyph({ status }: { status: string }) {
  const s = status.slice(0, 1);
  if (s === "A" || s === "?") return <FilePlus className="size-3.5 shrink-0 text-success" />;
  if (s === "D") return <FileMinus className="size-3.5 shrink-0 text-destructive" />;
  if (s === "R") return <FileQuestion className="size-3.5 shrink-0 text-info" />;
  return <FilePen className="size-3.5 shrink-0 text-warning" />;
}

/**
 * Changes view: git-status file tree on the left, the selected file's diff on
 * the right (like the legacy app's changes / code-commit surface).
 */
export function ChangesScreen(props: { sessionId: string }) {
  const side = useSessionSide(props.sessionId);
  const git = side.git;
  const files = useMemo(() => git?.files ?? [], [git]);
  const [selected, setSelected] = useState<string | null>(null);
  const [diff, setDiff] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // group files by directory
  const groups = useMemo(() => {
    const map = new Map<string, typeof files>();
    for (const f of files) {
      const dir = f.path.includes("/") ? f.path.slice(0, f.path.lastIndexOf("/")) : "";
      const list = map.get(dir) ?? [];
      list.push(f);
      map.set(dir, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [files]);

  useEffect(() => {
    if (!selected && files.length > 0) setSelected(files[0].path);
  }, [files, selected]);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    setLoading(true);
    apiFetch(`/sessions/${props.sessionId}/diff?path=${encodeURIComponent(selected)}`)
      .then((r) => (r.ok ? r.json() : { diff: "" }))
      .then((d: { diff?: string }) => {
        if (!cancelled) setDiff(d.diff ?? "");
      })
      .catch(() => !cancelled && setDiff(""))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [selected, props.sessionId]);

  const lines = useMemo(() => (diff ? parseDiff(diff) : []), [diff]);

  return (
    <div className="flex h-full min-h-0">
      {/* file tree */}
      <div className="flex w-64 shrink-0 flex-col border-r border-outline">
        <div className="flex shrink-0 items-center gap-2 border-b border-outline px-3 py-2">
          <span className="text-[12px] font-medium">Changes</span>
          {git?.git ? (
            <span className="font-mono text-[10px] text-ink-muted">
              {git.branch} {git.additions ? <span className="text-success">+{git.additions}</span> : null}
              {git.deletions ? <span className="text-destructive"> −{git.deletions}</span> : null}
            </span>
          ) : null}
          <button type="button" aria-label="Refresh" title="Refresh" className="ml-auto rounded p-1 text-ink-muted hover:bg-surface-muted hover:text-ink" onClick={() => side.refresh()}>
            <RefreshCw className="size-3.5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto py-1">
          {!git || git.git === false ? (
            <p className="px-3 py-4 text-[12px] text-ink-muted">Not a git repository</p>
          ) : files.length === 0 ? (
            <p className="px-3 py-4 text-[12px] text-ink-muted">Working tree clean — no changes.</p>
          ) : (
            groups.map(([dir, dirFiles]) => (
              <div key={dir || "."}>
                {dir ? (
                  <p className="flex items-center gap-1 px-2.5 py-0.5 font-mono text-[10px] text-ink-muted">
                    <Folder className="size-3" /> {dir}
                  </p>
                ) : null}
                {dirFiles.map((f) => (
                  <button
                    key={f.path}
                    type="button"
                    onClick={() => setSelected(f.path)}
                    className={cn(
                      "flex w-full items-center gap-1.5 px-2.5 py-1 text-left font-mono text-[11px]",
                      f.path === selected ? "bg-surface-muted text-ink" : "text-ink-muted hover:bg-surface-muted/60 hover:text-ink",
                    )}
                    title={f.path}
                  >
                    <FileGlyph status={f.status} />
                    <span className="truncate">{f.path.split("/").pop()}</span>
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      </div>

      {/* diff */}
      <div className="flex min-w-0 flex-1 flex-col bg-paper">
        <div className="flex shrink-0 items-center gap-2 border-b border-outline px-3 py-2">
          <span className="truncate font-mono text-[12px]">{selected ?? "Select a file"}</span>
          {loading ? <RefreshCw className="size-3 animate-spin text-ink-muted" /> : null}
        </div>
        <div className="min-h-0 flex-1 overflow-auto px-3 py-2 font-mono text-[11px] leading-relaxed">
          {!selected ? <p className="text-ink-muted">Pick a changed file to see its diff.</p> : null}
          {selected && !loading && diff === "" ? <p className="text-ink-muted">No diff (untracked or unchanged content).</p> : null}
          {lines.map((l, i) => (
            <div
              key={i}
              className={cn(
                "whitespace-pre-wrap break-all rounded-sm px-1",
                l.kind === "add" && "bg-success/10 text-success",
                l.kind === "del" && "bg-destructive/10 text-destructive line-through decoration-destructive/40",
                l.kind === "hunk" && "bg-info/10 text-info",
                l.kind === "meta" && "text-ink-muted/70",
                l.kind === "ctx" && "text-ink-muted",
              )}
            >
              {l.text || " "}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
