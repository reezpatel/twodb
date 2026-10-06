import { useState } from "react";
import { useNavigate } from "react-router";
import { Loader2, MoreHorizontal, Pencil, Plus, Search, Trash2 } from "lucide-react";
import type { UseMutationResult } from "@tanstack/react-query";
import { NewDirectoryDialog } from "../directories/new-directory-dialog";
import { useSessionList, groupSessionsByDirectory, useSessionEvents } from "./use-session-list";
import type { CodeSession, SessionDirectoryGroup } from "./use-session-list";
import { useCodeDirectories } from "../directories/use-code-directories";
import type { CodeDirectory } from "../directories/use-code-directories";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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
  create,
}: {
  group: SessionDirectoryGroup;
  rename: UseMutationResult<CodeDirectory, Error, { id: string; displayName: string }>;
  create: UseMutationResult<CodeSession, Error, string | null>;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");

  const commit = () => {
    setEditing(false);
    const trimmed = value.trim();
    if (group.id && trimmed && trimmed !== group.label) rename.mutate({ id: group.id, displayName: trimmed });
  };

  if (group.id === null) {
    return (
      <div
        className="group/header text-muted-foreground/70 flex items-center justify-between gap-1 px-3 pb-1 pt-3 text-[11px] font-semibold"
        title="Assistant chats — no working directory"
      >
        <span className="truncate">{group.label}</span>
        <button
          className="text-muted-foreground/50 hover:bg-accent hover:text-foreground flex size-4 shrink-0 items-center justify-center rounded-sm opacity-0 transition-opacity group-hover/header:opacity-100 focus-visible:opacity-100"
          title="New assistant chat"
          disabled={create.isPending}
          onClick={(e) => {
            e.stopPropagation();
            create.mutate(null);
          }}
        >
          <Plus size={12} aria-hidden="true" />
        </button>
      </div>
    );
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
      className="group/header text-muted-foreground/70 flex items-center justify-between gap-1 px-3 pb-1 pt-3 text-[11px] font-semibold"
      title={`${group.cwd} — double-click to rename`}
      onDoubleClick={() => {
        setValue(group.label);
        setEditing(true);
      }}
    >
      <span className="truncate">{group.label}</span>
      <button
        className="text-muted-foreground/50 hover:bg-accent hover:text-foreground flex size-4 shrink-0 items-center justify-center rounded-sm opacity-0 transition-opacity group-hover/header:opacity-100 focus-visible:opacity-100"
        title="New session in this directory"
        disabled={create.isPending}
        onClick={(e) => {
          e.stopPropagation();
          if (group.id) create.mutate(group.id);
        }}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        <Plus size={12} aria-hidden="true" />
      </button>
    </div>
  );
}

export function Sidenav({ selectedId, onSelect, activeStreaming }: SidenavProps) {
  const { sessions, create, remove, rename } = useSessionList(onSelect);
  const live = useSessionEvents(true);
  const { directories, renameDirectory } = useCodeDirectories();
  const [newDirOpen, setNewDirOpen] = useState(false);
  const [renaming, setRenaming] = useState<CodeSession | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const navigate = useNavigate();

  const directoryGroups = groupSessionsByDirectory(sessions.data ?? [], directories.data ?? []);

  return (
    <aside className="bg-card border-r flex h-full w-60 shrink-0 flex-col border-r">
      <div className="border-b flex items-center justify-between border-b px-3 py-2">
        <span className="text-sm font-semibold">Agents</span>
        <div className="flex gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm" onClick={() => setNewDirOpen(true)}>
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
            <DirectoryGroupHeader group={group} rename={renameDirectory} create={create} />
            {group.sessions.map((session) => {
              const isRenamingThis = renaming?.id === session.id;
              if (isRenamingThis) {
                const commitRename = () => {
                  const trimmed = renameValue.trim();
                  setRenaming(null);
                  if (trimmed && trimmed !== session.title) rename.mutate({ id: session.id, title: trimmed });
                };
                return (
                  <div key={session.id} className="mx-1 flex items-center gap-2 rounded-md px-2 py-1">
                    <span className="size-2 shrink-0 rounded-full bg-muted-foreground/30" />
                    <input
                      autoFocus
                      aria-label="Session name"
                      className="bg-accent h-6 min-w-0 flex-1 rounded-sm px-1 text-sm outline-none"
                      value={renameValue}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={commitRename}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitRename();
                        if (e.key === "Escape") setRenaming(null);
                      }}
                    />
                  </div>
                );
              }
              const state = live.get(session.id);
              const running = state?.running ?? (session.id === selectedId && activeStreaming);
              const needsInput = state?.needsInput ?? false;
              const unseen = state?.unseenUpdates ?? session.unseenUpdates ?? false;
              return (
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
                    needsInput
                      ? "bg-amber-500 ring-2 ring-amber-500/30"
                      : running
                        ? "animate-pulse bg-primary"
                        : unseen
                          ? "bg-primary/60"
                          : "bg-muted-foreground/30",
                  )}
                  title={needsInput ? "waiting for your answer" : running ? "running" : unseen ? "new activity" : undefined}
                />
                <span className="min-w-0 flex-1 truncate">{session.title}</span>
                <span className="text-muted-foreground/70 text-xs">{relativeTime(session.updatedAt)}</span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="text-muted-foreground/50 hover:text-foreground size-4 shrink-0 rounded-sm opacity-0 transition-opacity group-hover:opacity-100 data-[state=open]:opacity-100"
                      title="Session options"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreHorizontal size={13} aria-hidden="true" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenuItem
                      onSelect={() => {
                        setRenameValue(session.title);
                        setRenaming(session);
                      }}
                    >
                      <Pencil size={13} aria-hidden="true" /> Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={() => {
                        if (window.confirm(`Delete "${session.title}"?`)) {
                          if (session.id === selectedId) navigate("/apps/code");
                          remove.mutate(session.id);
                        }
                      }}
                    >
                      <Trash2 size={13} aria-hidden="true" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              );
            })}
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

      <NewDirectoryDialog
        open={newDirOpen}
        onOpenChange={setNewDirOpen}
        title="New session"
        submitLabel="Create session"
        onCreated={(dir) => create.mutate(dir.id)}
      />
    </aside>
  );
}
