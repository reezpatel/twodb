import { useMemo, useState } from "react";
import { Plus, MessageSquare, Bot, BookOpen, Cpu, FolderPlus, Pencil, FolderOpen } from "lucide-react";
import { artisanClient, type DirectoryInfo, type SessionInfo } from "../../../lib/artisan-client.js";
import { useResizableWidth } from "../../../lib/useResizableWidth.js";

export interface SidebarProps {
  sessions: SessionInfo[];
  directories: DirectoryInfo[];
  activeSessionId: string | null;
  onOpenSession: (session: SessionInfo) => void;
  /** Create a session in a directory without a dialog. */
  onNewSession: (dir: DirectoryInfo) => void;
  /** Open the add/edit-directory dialog. */
  onAddDirectory: () => void;
  onEditDirectory: (dir: DirectoryInfo) => void;
  onNav: (page: "agents" | "skills") => void;
}

interface DirGroup {
  dir: DirectoryInfo | null; // null = legacy sessions with no registered directory
  key: string;
  label: string;
  sessions: SessionInfo[];
}

/** Left sidebar: registered directories as sections, each with a `+` to start a session. */
export function Sidebar(props: SidebarProps) {
  const [query, setQuery] = useState("");
  const { width, Handle } = useResizableWidth("artisan.sidebar.left", 256, 180, 480);

  const groups = useMemo<DirGroup[]>(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? props.sessions.filter((s) => s.title.toLowerCase().includes(q) || s.directory.toLowerCase().includes(q))
      : props.sessions;

    // Bucket sessions under their registered directory (by runner:path); unmatched → legacy.
    const byPath = new Map(props.directories.map((d) => [`${d.runner}:${d.path}`, d]));
    const buckets = new Map<string, SessionInfo[]>();
    for (const s of filtered) {
      const key = `${s.runner}:${s.directory}`;
      const list = buckets.get(key) ?? [];
      list.push(s);
      buckets.set(key, list);
    }
    const out: DirGroup[] = [];
    for (const d of props.directories) {
      const key = `${d.runner}:${d.path}`;
      const sessions = buckets.get(key) ?? [];
      if (q && sessions.length === 0) continue;
      out.push({ dir: d, key, label: d.title, sessions });
    }
    // Sessions with no registered directory (legacy / ad-hoc paths).
    for (const [key, sessions] of buckets) {
      if (byPath.has(key)) continue;
      const first = sessions[0];
      out.push({ dir: null, key, label: first ? `${first.runner} · ${first.directory}` : key, sessions });
    }
    return out;
  }, [props.sessions, props.directories, query]);

  return (
    <div className="flex h-full min-h-0 shrink-0" style={{ width }}>
      <div className="flex h-full min-h-0 w-full flex-col border-r border-outline">
        <div className="flex items-center gap-2 border-b border-outline px-3 py-2.5">
          <span className="text-[14px] font-semibold tracking-tight">Artisan</span>
        </div>
        <div className="px-2.5 py-2">
          <button
            type="button"
            onClick={props.onAddDirectory}
            className="flex w-full items-center gap-1.5 rounded-md border border-outline px-2.5 py-1.5 text-[12px] text-ink-muted transition-colors hover:text-ink"
          >
            <FolderPlus className="size-3.5" />
            Add directory
          </button>
        </div>
        <div className="px-2.5 pb-2">
          <input
            value={query}
            placeholder="Search…"
            className="h-7 w-full rounded-md bg-surface-muted px-2.5 text-[12px] outline-none"
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-2">
          {groups.map((g) => (
            <div key={g.key} className="mb-2">
              <div className="group flex items-center gap-1 px-1.5 py-1">
                {g.dir ? <FolderOpen className="size-3 shrink-0 text-ink-muted" /> : null}
                <p className="min-w-0 flex-1 truncate font-mono text-[10px] text-ink-muted" title={`${g.dir?.runner ?? ""}:${g.dir?.path ?? g.label}`}>
                  {g.label}
                </p>
                {g.dir ? (
                  <>
                    <button
                      type="button"
                      aria-label={`New session in ${g.label}`}
                      title="New session"
                      className="rounded p-0.5 text-ink-muted opacity-0 transition-opacity hover:bg-surface-muted hover:text-ink group-hover:opacity-100"
                      onClick={() => props.onNewSession(g.dir!)}
                    >
                      <Plus className="size-3" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Edit ${g.label}`}
                      title="Directory settings"
                      className="rounded p-0.5 text-ink-muted opacity-0 transition-opacity hover:bg-surface-muted hover:text-ink group-hover:opacity-100"
                      onClick={() => props.onEditDirectory(g.dir!)}
                    >
                      <Pencil className="size-3" />
                    </button>
                  </>
                ) : null}
              </div>
              {g.sessions.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => props.onOpenSession(s)}
                  className={`flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors ${
                    s.id === props.activeSessionId ? "bg-surface-muted text-ink" : "text-ink-muted hover:bg-surface-muted/60 hover:text-ink"
                  }`}
                >
                  <MessageSquare className="size-3.5 shrink-0" />
                  <span className="truncate">{s.title}</span>
                </button>
              ))}
              {g.sessions.length === 0 ? <p className="px-2 py-0.5 text-[11px] text-ink-muted/70">No sessions</p> : null}
            </div>
          ))}
          {groups.length === 0 ? <p className="px-2.5 py-4 text-center text-[12px] text-ink-muted">No directories yet — add one to begin.</p> : null}
        </div>
        <div className="border-t border-outline px-2 py-2">
          <NavItem icon={Bot} label="Agents" onClick={() => props.onNav("agents")} />
          <NavItem icon={BookOpen} label="Skills" onClick={() => props.onNav("skills")} />
          <NavItem icon={Cpu} label="Runners" onClick={() => props.onNav("agents")} />
        </div>
      </div>
      <Handle edge="left" />
    </div>
  );
}

function NavItem(props: { icon: typeof Bot; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-[13px] text-ink-muted transition-colors hover:bg-surface-muted/60 hover:text-ink"
    >
      <props.icon className="size-3.5" />
      {props.label}
    </button>
  );
}

// Re-export for convenience (used by App to refresh alongside sessions).
export { artisanClient };
