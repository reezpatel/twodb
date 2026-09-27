import { Loader2, Plus, Search } from "lucide-react";
import { useSessionList } from "./use-session-list";
import type { CodeSession } from "./use-session-list";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface SidenavProps {
  selectedId: string | null;
  onSelect: (id: string) => void;
  activeStreaming: boolean;
}

function groupLabel(updatedAt: string) {
  const date = new Date(updatedAt);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return "Today";
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return "Earlier";
}

function relativeTime(updatedAt: string) {
  const diff = Date.now() - new Date(updatedAt).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export function Sidenav({ selectedId, onSelect, activeStreaming }: SidenavProps) {
  const { sessions, create, remove } = useSessionList(onSelect);

  const groups = new Map<string, CodeSession[]>();
  for (const session of sessions.data ?? []) {
    const label = groupLabel(session.updatedAt);
    const bucket = groups.get(label) ?? [];
    bucket.push(session);
    groups.set(label, bucket);
  }

  return (
    <aside className="bg-card border-r flex h-full w-60 shrink-0 flex-col border-r">
      <div className="border-b flex items-center justify-between border-b px-3 py-2">
        <span className="text-sm font-semibold">Agents</span>
        <div className="flex gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm" onClick={() => create.mutate()} disabled={create.isPending}>
                {create.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">New session</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm" disabled title="Filter (coming soon)">
                <Search />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Filter (coming soon)</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {sessions.isPending && (
          <div className="flex justify-center py-8">
            <Loader2 className="text-muted-foreground size-4 animate-spin" />
          </div>
        )}
        {[...groups.entries()].map(([label, items]) => (
          <div key={label}>
            <div className="text-muted-foreground/70 px-3 pb-1 pt-3 text-[11px] font-semibold tracking-wide uppercase">{label}</div>
            {items.map((session) => (
              <div
                key={session.id}
                className={cn(
                  "group mx-1 flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent",
                  selectedId === session.id && "bg-accent font-medium",
                )}
                onClick={() => onSelect(session.id)}
              >
                <span
                  className={cn(
                    "size-2 shrink-0 rounded-full",
                    selectedId === session.id && activeStreaming ? "animate-pulse bg-primary" : "bg-muted-foreground/30",
                  )}
                />
                <span className="min-w-0 flex-1 truncate">{session.title}</span>
                <span className="text-muted-foreground/70 text-xs">{relativeTime(session.updatedAt)}</span>
                <button
                  className="text-muted-foreground/50 hover:text-destructive hidden shrink-0 text-sm leading-none group-hover:block"
                  title="Delete session"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm(`Delete "${session.title}"?`)) remove.mutate(session.id);
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        ))}
        {(sessions.data ?? []).length === 0 && !sessions.isPending && (
          <p className="text-muted-foreground p-3 text-sm">No sessions yet — hit + to start one.</p>
        )}
      </div>

      <div className="border-t border-t p-2">
        <Button variant="ghost" size="sm" className="text-muted-foreground w-full justify-start" disabled title="Archive (coming soon)">
          Archive
        </Button>
        <Button variant="ghost" size="sm" className="text-muted-foreground w-full justify-start" disabled title="Skills & tools (coming soon)">
          Skills &amp; tools
        </Button>
      </div>
    </aside>
  );
}
