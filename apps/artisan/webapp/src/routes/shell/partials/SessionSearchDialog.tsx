import { useEffect, useMemo, useRef, useState } from "react";
import { MessageSquare, Search } from "lucide-react";
import type { AgentInfo, SessionInfo } from "../../../lib/artisan-client.js";

const MAX_RESULTS = 6;

/** Command-palette style dialog: search sessions by title, show the top matches. */
export function SessionSearchDialog(props: {
  open: boolean;
  sessions: SessionInfo[];
  agents: AgentInfo[];
  onClose: () => void;
  onSelect: (session: SessionInfo) => void;
}) {
  const { open, sessions, agents, onClose, onSelect } = props;
  const agentOf = (s: SessionInfo) => (s.agentId ? agents.find((a) => a.id === s.agentId) : undefined);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? sessions
          .filter((s) => s.title.toLowerCase().includes(q) || (agentOf(s)?.name.toLowerCase().includes(q) ?? false))
          // Prefer prefix matches, then earlier matches.
          .sort((a, b) => a.title.toLowerCase().indexOf(q) - b.title.toLowerCase().indexOf(q))
      : sessions;
    return list.slice(0, MAX_RESULTS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions, agents, query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => setIndex(0), [query]);

  if (!open) return null;

  const pick = (s: SessionInfo | undefined) => {
    if (!s) return;
    onSelect(s);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-[15vh]" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-label="Search sessions"
        className="w-full max-w-lg overflow-hidden rounded-lg border border-outline bg-surface shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
          else if (e.key === "ArrowDown") {
            e.preventDefault();
            setIndex((i) => Math.min(i + 1, results.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setIndex((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter") pick(results[index]);
        }}
      >
        <div className="flex items-center gap-2 border-b border-outline px-3">
          <Search className="size-4 shrink-0 text-ink-muted" />
          <input
            ref={inputRef}
            value={query}
            placeholder="Search sessions by title or agent…"
            className="h-11 w-full bg-transparent text-[14px] outline-none"
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="max-h-80 overflow-y-auto p-1.5">
          {results.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onMouseEnter={() => setIndex(i)}
              onClick={() => pick(s)}
              className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[13px] ${
                i === index ? "bg-surface-muted text-ink" : "text-ink-muted"
              }`}
            >
              <MessageSquare className="size-3.5 shrink-0" />
              <span className="min-w-0 flex-1 truncate">{s.title}</span>
              <Badges session={s} agent={agentOf(s)} />
            </button>
          ))}
          {results.length === 0 ? <p className="px-2.5 py-6 text-center text-[12px] text-ink-muted">No matching sessions</p> : null}
        </div>
      </div>
    </div>
  );
}

/** Type badge (the agent's type for agent chats, else the session type) + the agent's name when there is one. */
function Badges({ session, agent }: { session: SessionInfo; agent?: AgentInfo }) {
  const type = (agent?.type ?? session.type).replace(/_/g, " ");
  return (
    <span className="flex shrink-0 items-center gap-1">
      <span className="rounded bg-surface-muted px-1.5 py-0.5 font-mono text-[10px] uppercase leading-none text-ink-muted">{type}</span>
      {agent ? <span className="max-w-32 truncate rounded bg-primary/15 px-1.5 py-0.5 text-[10px] leading-none text-ink">{agent.name}</span> : null}
    </span>
  );
}
