import { useState } from "react";
import { Loader2, Plus, Search } from "lucide-react";
import type { UseMutationResult } from "@tanstack/react-query";
import { NewSessionDialog } from "./new-session-dialog";
import { useSessionList, groupSessionsByDirectory } from "./use-session-list";
import type { SessionDirectoryGroup } from "./use-session-list";
import { useCodeDirectories } from "../directories/use-code-directories";
import type { CodeDirectory } from "../directories/use-code-directories";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface SidenavProps {
  selectedId: string | null;
  onSelect: (id: string) => void;
  activeStreaming: boolean;
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

function DirectoryGroupHeader({
  group,
  rename,
}: {
  group: SessionDirectoryGroup;
  rename: UseMutationResult<CodeDirectory, Error, { id: string; displayName: string }>;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");

  const commit = () => {
    setEditing(false);
    const trimmed = value.trim();
    if (group.id && trimmed && trimmed !== group.label) rename.mutate({ id: group.id, displayName: trimmed });
  };

  if (group.id === null) {
    return <div className="text-muted-foreground/70 px-3 pb-1 pt-3 text-[11px] font-semibold">{group.label}</div>;
  }

  if (editing) {
    return (
      <div className="px-3 pb-1 pt-3">
        <input
          autoFocus
          aria-label="Directory name"
          className="bg-accent h-5 w-full rounded-sm px-1 text-[11px] font-semibold outline-none"
          value={value}
          onFocus={(e) => e.target.select()}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") setEditing(false);
          }}
        />
      </div>
    );
  }

  return (
    <div
      className="text-muted-foreground/70 px-3 pb-1 pt-3 text-[11px] font-semibold"
      title={`${group.cwd} — double-click to rename`}
      onDoubleClick={() => {
        setValue(group.label);
        setEditing(true);
      }}
    >
      {group.label}
    </div>
  );
}

export function Sidenav({ selectedId, onSelect, activeStreaming }: SidenavProps) {
  const { sessions, create, remove } = useSessionList(onSelect);
  const { directories, renameDirectory } = useCodeDirectories();
  const [newSessionOpen, setNewSessionOpen] = useState(false);

  const directoryGroups = groupSessionsByDirectory(sessions.data ?? [], directories.data ?? []);

  return (
    <aside className="bg-card border-r flex h-full w-60 shrink-0 flex-col border-r">
      <div className="border-b flex items-center justify-between border-b px-3 py-2">
        <span className="text-sm font-semibold">Agents</span>
        <div className="flex gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm" onClick={() => setNewSessionOpen(true)}>
                <Plus />
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
        {directoryGroups.map((group) => (
          <div key={group.id ?? "none"}>
            <DirectoryGroupHeader group={group} rename={renameDirectory} />
            {group.sessions.map((session) => (
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

      <NewSessionDialog open={newSessionOpen} onOpenChange={setNewSessionOpen} create={create} />
    </aside>
  );
}
