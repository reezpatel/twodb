import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, ChevronLeft, ChevronRight, File, Folder, FolderPlus, Loader2 } from "lucide-react";
import { cn } from "../../../lib/cn.js";
import { artisanClient } from "../../../lib/artisan-client.js";

interface Entry {
  name: string;
  dir: boolean;
}

const join = (dir: string, name: string) => (dir.endsWith("/") ? `${dir}${name}` : `${dir}/${name}`);
const parentOf = (p: string) => (p === "/" ? "/" : p.replace(/\/[^/]+\/?$/, "") || "/");

/**
 * Finder-style folder picker over a runner's filesystem (port of the legacy
 * RunnerFinder): back/forward history, editable path bar, single click to
 * highlight, double click / Enter to open, and "New folder".
 * `onChange` reports the chosen folder: the highlighted subfolder, else the
 * folder being viewed.
 */
export function FolderPicker({ runner, startPath, onChange, className }: {
  runner: string;
  startPath: string;
  onChange: (path: string | null) => void;
  className?: string;
}) {
  const [history, setHistory] = useState<{ stack: string[]; index: number }>({ stack: [startPath], index: 0 });
  const [listing, setListing] = useState<{ path: string; entries: Entry[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const [showHidden, setShowHidden] = useState(false);
  const [creating, setCreating] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const target = history.stack[history.index];

  const load = useCallback(
    async (p: string) => {
      setLoading(true);
      setError(null);
      try {
        const l = await artisanClient.listRunnerDir(runner, p);
        setListing(l);
        // Keep the history entry in sync with the resolved absolute path.
        setHistory((h) => (h.stack[h.index] === l.path ? h : { ...h, stack: h.stack.map((s, i) => (i === h.index ? l.path : s)) }));
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [runner],
  );

  useEffect(() => {
    setHighlight(null);
    void load(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, load]);

  const here = listing?.path ?? null;
  const chosen = highlight ? (here ? join(here, highlight) : null) : error ? null : here;
  useEffect(() => onChange(chosen), [chosen, onChange]);

  const navigate = (p: string) =>
    setHistory((h) => ({ stack: [...h.stack.slice(0, h.index + 1), p], index: h.index + 1 }));

  const entries = useMemo(() => {
    const list = (listing?.entries ?? []).filter((e) => showHidden || !e.name.startsWith("."));
    return [...list].sort((a, b) => Number(b.dir) - Number(a.dir) || a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));
  }, [listing, showHidden]);

  const open = (e: Entry) => {
    if (e.dir && here) navigate(join(here, e.name));
  };

  const onKey = (ev: React.KeyboardEvent) => {
    if (creating !== null) return;
    const dirs = entries.filter((e) => e.dir);
    const i = dirs.findIndex((e) => e.name === highlight);
    if (ev.key === "ArrowDown") {
      ev.preventDefault();
      setHighlight(dirs[Math.min(dirs.length - 1, i + 1)]?.name ?? null);
    } else if (ev.key === "ArrowUp") {
      ev.preventDefault();
      setHighlight(i <= 0 ? null : dirs[i - 1].name);
    } else if (ev.key === "Enter" && highlight) {
      ev.preventDefault();
      open({ name: highlight, dir: true });
    } else if (ev.key === "Backspace" && here && here !== "/") {
      ev.preventDefault();
      navigate(parentOf(here));
    }
  };

  useEffect(() => {
    if (!highlight) return;
    listRef.current?.querySelector(`[data-name="${CSS.escape(highlight)}"]`)?.scrollIntoView({ block: "nearest" });
  }, [highlight]);

  const submitFolder = async () => {
    const name = (creating ?? "").trim();
    if (!name || !here) return setCreating(null);
    if (/[/\0]/.test(name)) return setCreateError("Name can't contain /");
    setCreateError(null);
    try {
      const path = join(here, name);
      await artisanClient.makeRunnerDir(runner, path);
      setCreating(null);
      await load(here);
      setHighlight(name);
    } catch (e) {
      setCreateError((e as Error).message);
    }
  };

  const btn = "flex size-7 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink disabled:pointer-events-none disabled:opacity-30";

  return (
    <div className={cn("flex min-h-0 flex-col overflow-hidden rounded-lg bg-surface-muted/40", className)}>
      <div className="flex shrink-0 items-center gap-0.5 px-1.5 py-1.5">
        <button type="button" className={btn} aria-label="Back" disabled={history.index === 0} onClick={() => setHistory((h) => ({ ...h, index: h.index - 1 }))}>
          <ChevronLeft className="size-4" />
        </button>
        <button type="button" className={btn} aria-label="Forward" disabled={history.index >= history.stack.length - 1} onClick={() => setHistory((h) => ({ ...h, index: h.index + 1 }))}>
          <ChevronRight className="size-4" />
        </button>
        <button type="button" className={btn} aria-label="Up one level" disabled={!here || here === "/"} onClick={() => here && navigate(parentOf(here))}>
          <ArrowUp className="size-4" />
        </button>
        <input
          className="mx-1 h-7 min-w-0 flex-1 rounded-md bg-paper px-2 font-mono text-[12px] text-ink outline-none placeholder:text-ink-muted/60 focus:ring-1 focus:ring-outline-strong"
          placeholder="/absolute/path or ~/…"
          value={draft ?? here ?? target}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => setDraft(null)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              const v = (draft ?? "").trim();
              setDraft(null);
              if (v && v !== here) navigate(v);
            }
            if (e.key === "Escape") setDraft(null);
          }}
        />
        <button type="button" className={btn} title="New folder" aria-label="New folder" disabled={!here || Boolean(error)} onClick={() => { setCreating(""); setCreateError(null); }}>
          <FolderPlus className="size-4" />
        </button>
      </div>

      <div ref={listRef} tabIndex={0} aria-label="Folders" onKeyDown={onKey} className="min-h-0 flex-1 overflow-y-auto bg-paper/60 p-1 outline-none">
        {error ? (
          <div className="flex flex-col items-center gap-1 px-3 py-10 text-center text-[12px]">
            <span className="text-destructive">{error}</span>
            <span className="text-ink-muted">Fix the path above and press Enter, or go back.</span>
          </div>
        ) : loading && !listing ? (
          <div className="flex justify-center py-10"><Loader2 className="size-4 animate-spin text-ink-muted" /></div>
        ) : (
          <div className={cn("flex flex-col gap-px", loading && "pointer-events-none opacity-50")}>
            {creating !== null ? (
              <div className="flex items-center gap-2 rounded-md bg-surface-muted px-2 py-1">
                <Folder className="size-4 shrink-0 text-primary/70" />
                <input
                  autoFocus
                  value={creating}
                  onChange={(e) => setCreating(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); void submitFolder(); }
                    if (e.key === "Escape") { e.stopPropagation(); setCreating(null); }
                  }}
                  onBlur={() => { if (!creating.trim()) setCreating(null); }}
                  placeholder="New folder name"
                  className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-muted/60"
                />
                <span className="text-[11px] text-ink-muted">↵ create</span>
              </div>
            ) : null}
            {createError ? <p className="px-2 py-1 text-[12px] text-destructive">{createError}</p> : null}
            {entries.length === 0 && creating === null ? <p className="px-3 py-10 text-center text-[12px] text-ink-muted">Empty folder.</p> : null}
            {entries.map((e) => {
              const sel = highlight === e.name;
              const Icon = e.dir ? Folder : File;
              return (
                <button
                  key={e.name}
                  type="button"
                  data-name={e.name}
                  disabled={!e.dir}
                  onClick={() => setHighlight(e.name)}
                  onDoubleClick={() => open(e)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] outline-none transition-colors",
                    e.dir ? "text-ink hover:bg-surface-muted" : "cursor-default text-ink-muted/50",
                    sel && "bg-primary/15 font-medium hover:bg-primary/15",
                  )}
                >
                  <Icon className={cn("size-4 shrink-0", e.dir ? "text-primary/70" : "text-ink-muted/50")} />
                  <span className="min-w-0 flex-1 truncate">{e.name}</span>
                  {e.dir ? <ChevronRight className="size-3.5 shrink-0 text-ink-muted/50" /> : null}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex h-7 shrink-0 items-center justify-between gap-3 px-2.5 text-[11px] text-ink-muted">
        <span className="min-w-0 truncate">
          Selected: <span className="font-mono text-ink">{chosen ?? "—"}</span>
        </span>
        <label className="flex shrink-0 cursor-pointer items-center gap-1.5">
          <input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} className="size-3 accent-[var(--color-primary)]" />
          hidden
        </label>
      </div>
    </div>
  );
}
