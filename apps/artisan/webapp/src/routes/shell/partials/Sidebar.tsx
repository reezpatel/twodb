import { useEffect, useMemo, useState } from "react";
import { Plus, MessageSquare, Bot, BookOpen, Cpu } from "lucide-react";
import { artisanClient, type SessionInfo } from "../../../lib/artisan-client.js";

export interface SidebarProps {
  sessions: SessionInfo[];
  activeSessionId: string | null;
  onOpenSession: (session: SessionInfo) => void;
  onNew: () => void;
  onNav: (page: "agents" | "skills") => void;
}

/** Left sidebar: sessions grouped by directory (runner + path), nav links. */
export function Sidebar(props: SidebarProps) {
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? props.sessions.filter((s) => s.title.toLowerCase().includes(q) || s.directory.toLowerCase().includes(q) || s.runner.toLowerCase().includes(q))
      : props.sessions;
    const map = new Map<string, SessionInfo[]>();
    for (const s of filtered) {
      const key = `${s.runner} · ${s.directory}`;
      const list = map.get(key) ?? [];
      list.push(s);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [props.sessions, query]);

  return (
    <div className="flex h-full min-h-0 w-64 shrink-0 flex-col border-r border-outline">
      <div className="flex items-center gap-2 border-b border-outline px-3 py-2.5">
        <span className="text-[14px] font-semibold tracking-tight">Artisan</span>
      </div>
      <div className="px-2.5 py-2">
        <button
          type="button"
          onClick={props.onNew}
          className="flex w-full items-center gap-1.5 rounded-md border border-outline px-2.5 py-1.5 text-[12px] text-ink-muted transition-colors hover:text-ink"
        >
          <Plus className="size-3.5" />
          New session
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
        {groups.map(([key, sessions]) => (
          <div key={key} className="mb-2">
            <p className="truncate px-1.5 py-1 font-mono text-[10px] text-ink-muted" title={key}>{key}</p>
            {sessions.map((s) => (
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
          </div>
        ))}
        {groups.length === 0 ? <p className="px-2.5 py-4 text-center text-[12px] text-ink-muted">No sessions</p> : null}
      </div>
      <div className="border-t border-outline px-2 py-2">
        <NavItem icon={Bot} label="Agents" onClick={() => props.onNav("agents")} />
        <NavItem icon={BookOpen} label="Skills" onClick={() => props.onNav("skills")} />
        <NavItem icon={Cpu} label="Runners" onClick={() => props.onNav("agents")} />
      </div>
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
