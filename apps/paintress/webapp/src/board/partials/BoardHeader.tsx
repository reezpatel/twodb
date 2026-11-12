import { useState } from "react";
import { Link } from "react-router";
import { ArrowLeft, Bot, User } from "lucide-react";
import type { SocketStatus } from "../hooks/useBoardSocket";

/** Top bar: back to the list, board name (click to rename), connection state and who else is on the board. */
export function BoardHeader(props: {
  name: string;
  status: SocketStatus;
  presence: { actor: string; kind: "human" | "agent" }[];
  onRename(name: string): void;
  right?: React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const dot = props.status === "open" ? "bg-success" : "bg-warning";
  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-outline bg-popover px-3">
      <Link to="/" aria-label="All boards" className="rounded-full p-1.5 text-ink-muted hover:bg-paper-grid">
        <ArrowLeft className="size-4" />
      </Link>
      {editing ? (
        <input
          autoFocus
          defaultValue={props.name}
          className="h-8 rounded-sm border border-ion-deep bg-paper px-2 text-[15px] font-semibold outline-none"
          onBlur={(e) => {
            setEditing(false);
            const v = e.currentTarget.value.trim();
            if (v && v !== props.name) props.onRename(v);
          }}
          onKeyDown={(e) => (e.key === "Enter" && e.currentTarget.blur()) || (e.key === "Escape" && setEditing(false))}
        />
      ) : (
        <button type="button" onClick={() => setEditing(true)} className="truncate rounded-sm px-1 text-[15px] font-semibold text-ink hover:bg-paper-grid">
          {props.name || "…"}
        </button>
      )}
      <span title={props.status === "open" ? "Live" : "Reconnecting"} className={`size-2 rounded-full ${dot}`} />
      <div className="ml-auto flex items-center gap-2">
        {props.right}
        {props.presence.map((p) => (
          <span key={p.actor} title={p.actor} className="flex items-center gap-1 rounded-full border border-outline px-2 py-0.5 text-[11px] text-ink-muted">
            {p.kind === "agent" ? <Bot className="size-3.5" /> : <User className="size-3.5" />}
            {p.kind === "agent" ? "AI" : "You"}
          </span>
        ))}
      </div>
    </header>
  );
}
