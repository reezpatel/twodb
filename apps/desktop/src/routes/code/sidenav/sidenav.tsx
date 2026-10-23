import { useState } from "react";
import { useNavigate } from "react-router";
import { Archive, Bot, Check, ChevronRight, Loader2, MoreHorizontal, Pencil, Plus, Search, Trash2, Boxes } from "lucide-react";import type { UseMutationResult } from "@tanstack/react-query";
import { NewDirectoryDialog } from "../directories/new-directory-dialog";
import { useSessionList, groupSessionsByDirectory, useSessionEvents } from "./use-session-list";
import type { AgentListItem, CodeSession, SessionDirectoryGroup } from "./use-session-list";
import { useCodeDirectories } from "../directories/use-code-directories";
import type { CodeDirectory } from "../directories/use-code-directories";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { SpaceSelect } from "@/components/space-select";
import { SideNav } from "@/components/side-nav";
import { cn } from "@/lib/utils";

interface SidenavProps {
  selectedId: string | null;
  onSelect: (id: string) => void;
  activeStreaming: boolean;
}

type SidenavTab = "code" | "assistant" | "persona" | "collaborator" | "sentinel";

const TABS: { id: SidenavTab; label: string }[] = [
  { id: "code", label: "Code" },
  { id: "assistant", label: "Assistant" },
  { id: "persona", label: "Personas" },
  { id: "collaborator", label: "Collabs" },
  { id: "sentinel", label: "Sentinel" },
];

const AGENT_TAB_TYPE: Record<Exclude<SidenavTab, "code" | "assistant">, AgentListItem["type"]> = {
  persona: "persona",
  collaborator: "collaborator",
  sentinel: "sentinel",
};

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
  directory,
  rename,
  update,
  create,
}: {
  group: SessionDirectoryGroup;
  directory: CodeDirectory | undefined;
  rename: UseMutationResult<CodeDirectory, Error, { id: string; displayName: string }>;
  update: UseMutationResult<CodeDirectory, Error, { id: string; patch: Record<string, unknown> }>;
  create: UseMutationResult<CodeSession, Error, string | null | { codeDirectoryId: string | null; agentId: string }, unknown>;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [spaceOpen, setSpaceOpen] = useState(false);
  const [spaceId, setSpaceId] = useState<string | null>(null);

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
      <span className="flex shrink-0 items-center gap-1">
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
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild>
            <button
              className="text-muted-foreground/50 hover:bg-accent hover:text-foreground flex size-4 shrink-0 items-center justify-center rounded-sm opacity-0 transition-opacity group-hover/header:opacity-100 data-[state=open]:opacity-100"
              title="Directory options"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal size={12} aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem
              onSelect={() => {
                setValue(group.label);
                setEditing(true);
              }}
            >
              <Pencil size={13} aria-hidden="true" /> Rename
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                setSpaceId(directory?.spaceId ?? null);
                setSpaceOpen(true);
              }}
            >
              <Boxes size={13} aria-hidden="true" /> Edit space…
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </span>

      <Dialog open={spaceOpen} onOpenChange={setSpaceOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit space — {group.label}</DialogTitle>
            <DialogDescription>
              Directories in a space match that space's resources (connections, skills, agents, MCP…); directories with no space see only base resources.
            </DialogDescription>
          </DialogHeader>
          <SpaceSelect id={`dir-space-${group.id}`} value={spaceId} onChange={setSpaceId} label="Space" />
          <DialogFooter>
            <Button
              size="sm"
              disabled={update.isPending || spaceId === (directory?.spaceId ?? null)}
              onClick={() => {
                if (!group.id) return;
                update.mutate({ id: group.id, patch: { spaceId } }, { onSuccess: () => setSpaceOpen(false) });
              }}
            >
              {update.isPending ? <Loader2 size={14} className="animate-spin" /> : null} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Sessions under one agent: a header (agent name + model + new-session +)
 * and that agent's sessions, reusing the same row treatment as the code tab. */
function AgentSessions({
  agent,
  sessions,
  selectedId,
  activeStreaming,
  live,
  create,
  rename,
  remove,
  setArchived,
  archiveMode,
  onSelect,
}: {
  agent: AgentListItem;
  sessions: CodeSession[];
  selectedId: string | null;
  activeStreaming: boolean;
  live: Map<string, { running: boolean; needsInput: boolean; unseenUpdates: boolean }>;
  create: UseMutationResult<CodeSession, Error, string | null | { codeDirectoryId: string | null; agentId: string }, unknown>;
  rename: UseMutationResult<CodeSession, Error, { id: string; title: string }, unknown>;
  remove: UseMutationResult<unknown, Error, string, unknown>;
  setArchived: UseMutationResult<unknown, Error, { id: string; archived: boolean }, unknown>;
  archiveMode: boolean;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const [renaming, setRenaming] = useState<CodeSession | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const navigate = useNavigate();
  const anyActive = sessions.some((s) => s.id === selectedId);

  return (
    <div className="mt-2">
      <div
        className={cn(
          "group/header text-muted-foreground/70 flex items-center gap-1 px-3 pb-1 text-[11px] font-semibold",
          anyActive && "text-foreground",
        )}
      >
        <button className="flex min-w-0 flex-1 items-center gap-1 text-left" onClick={() => setOpen((v) => !v)} title={agent.description ?? undefined}>
          <ChevronRight size={12} className={cn("shrink-0 transition-transform", open && "rotate-90")} aria-hidden="true" />
          <Bot size={12} className="shrink-0" aria-hidden="true" />
          <span className="truncate">{agent.name ?? agent.description ?? "agent"}</span>
          <span className="text-muted-foreground/50 shrink-0 font-mono text-[10px] font-normal">{agent.model.split("/").pop() ?? agent.model}</span>
        </button>
        <button
          className="text-muted-foreground/50 hover:bg-accent hover:text-foreground flex size-4 shrink-0 items-center justify-center rounded-sm opacity-0 transition-opacity group-hover/header:opacity-100 focus-visible:opacity-100"
          title="New session with this agent"
          disabled={create.isPending}
          onClick={(e) => {
            e.stopPropagation();
            // Personas run in their work directory when set; collaborators and
            // the sentinel run directory-less (assistant-style).
            const dir = agent.type === "persona" ? agent.workDirectoryId : null;
            create.mutate({ codeDirectoryId: dir, agentId: agent.id });
          }}
        >
          <Plus size={12} aria-hidden="true" />
        </button>
      </div>
      {open &&
        (sessions.length === 0 ? (
          <p className="text-muted-foreground/60 py-1 pl-9 text-[11px]">no sessions yet</p>
        ) : (
          sessions.map((session) => {
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
                    <DropdownMenuItem onSelect={() => setArchived.mutate({ id: session.id, archived: !archiveMode })}>
                      <Archive size={13} aria-hidden="true" /> {archiveMode ? "Unarchive" : "Archive"}
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
          })
        ))}
    </div>
  );
}

function AgentTabContent(props: {
  tab: Exclude<SidenavTab, "code" | "assistant">;
  agents: AgentListItem[];
  sessionsByAgent: Map<string, CodeSession[]>;
  selectedId: string | null;
  activeStreaming: boolean;
  live: Map<string, { running: boolean; needsInput: boolean; unseenUpdates: boolean }>;
  create: UseMutationResult<CodeSession, Error, string | null | { codeDirectoryId: string | null; agentId: string }, unknown>;
  rename: UseMutationResult<CodeSession, Error, { id: string; title: string }, unknown>;
  remove: UseMutationResult<unknown, Error, string, unknown>;
  setArchived: UseMutationResult<unknown, Error, { id: string; archived: boolean }, unknown>;
  archiveMode: boolean;
  onSelect: (id: string) => void;
}) {
  const { agents, sessionsByAgent, selectedId } = props;
  const [showAll, setShowAll] = useState(false);
  // Agents with sessions (or the selected one) always show; the rest collapse
  // behind a "show all" toggle so orgs with many agents stay navigable.
  const withSessions = agents.filter((a) => (sessionsByAgent.get(a.id) ?? []).length > 0 || a.id === boundAgentId(selectedId, sessionsByAgent));
  const rest = agents.filter((a) => !withSessions.includes(a));
  const visible = showAll ? agents : withSessions;

  return (
    <div className="py-1">
      {agents.length === 0 && (
        <p className="text-muted-foreground p-3 text-xs">
          No {props.tab === "collaborator" ? "collaborator" : props.tab} agents yet — create one in Settings → LLM → Agents.
        </p>
      )}
      {visible.map((agent) => (
        <AgentSessions key={agent.id} agent={agent} sessions={sessionsByAgent.get(agent.id) ?? []} {...props} selectedId={selectedId} />
      ))}
      {!showAll && rest.length > 0 && (
        <button className="text-muted-foreground hover:text-foreground mx-1 mt-1 rounded-md px-2 py-1 text-[11px]" onClick={() => setShowAll(true)}>
          show {rest.length} more…
        </button>
      )}
      {showAll && rest.length > 0 && (
        <button className="text-muted-foreground hover:text-foreground mx-1 mt-1 rounded-md px-2 py-1 text-[11px]" onClick={() => setShowAll(false)}>
          show less
        </button>
      )}
    </div>
  );
}

/** Agent id whose session is currently selected, if any. */
function boundAgentId(selectedId: string | null, sessionsByAgent: Map<string, CodeSession[]>): string | null {
  if (!selectedId) return null;
  for (const [agentId, list] of sessionsByAgent) if (list.some((s) => s.id === selectedId)) return agentId;
  return null;
}

export function Sidenav({ selectedId, onSelect, activeStreaming }: SidenavProps) {
  const { sessions, agents, create, remove, rename, setArchived, archiveMode, setArchiveMode } = useSessionList(onSelect);
  const live = useSessionEvents(true);
  const { directories, renameDirectory, updateDirectory } = useCodeDirectories();
  const [newDirOpen, setNewDirOpen] = useState(false);
  const [renaming, setRenaming] = useState<CodeSession | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [tab, setTab] = useState<SidenavTab>("code");
  const navigate = useNavigate();

  // Persisted sidenav width — resizable via its right edge (desktop only).
  const [sidenavWidth, setSidenavWidth] = useState(() => {
    const raw = Number(localStorage.getItem("twodb.codeSidenavWidth"));
    return Number.isFinite(raw) && raw >= 180 && raw <= 420 ? raw : 240;
  });
  const persistSidenavWidth = (w: number) => {
    const clamped = Math.min(420, Math.max(180, w));
    setSidenavWidth(clamped);
    localStorage.setItem("twodb.codeSidenavWidth", String(Math.round(clamped)));
  };

  const directoryGroups = groupSessionsByDirectory(sessions.data ?? [], directories.data ?? []);

  // The Assistant group (directory-less) is its own tab; the code tab keeps
  // only directory-bound groups.
  const codeGroups = directoryGroups.filter((g) => g.id !== null);
  const assistantGroup = directoryGroups.find((g) => g.id === null);

  // Which tab holds the selected session — switching selection flips the tab
  // so following a subagent link from the sidebar opens in the right place.
  const selectedSession = (sessions.data ?? []).find((s) => s.id === selectedId);
  const selectedAgent = selectedSession?.agentId ? (agents.data ?? []).find((a) => a.id === selectedSession.agentId) : undefined;
  const activeTab: SidenavTab =
    selectedAgent && selectedAgent.type !== "sub_agent"
      ? (selectedAgent.type as Exclude<SidenavTab, "code" | "assistant">)
      : selectedSession && !selectedSession.agentId && !selectedSession.codeDirectoryId
        ? "assistant"
        : tab;

  // Agent-bound sessions by agent id.
  const sessionsByAgent = new Map<string, CodeSession[]>();
  for (const s of sessions.data ?? []) {
    if (!s.agentId) continue;
    const bucket = sessionsByAgent.get(s.agentId) ?? [];
    bucket.push(s);
    sessionsByAgent.set(s.agentId, bucket);
  }

  return (
    <SideNav className="bg-card gap-0 overflow-hidden border-r p-0" width={sidenavWidth} onWidthChange={persistSidenavWidth}>
      <div className="border-b flex items-center justify-between border-b px-3 py-2">
        <span className="text-sm font-semibold">Sessions</span>
        <div className="flex gap-1">
          {tab === "code" && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" onClick={() => setNewDirOpen(true)}>
                  <Plus />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">New session</TooltipContent>
            </Tooltip>
          )}
          {tab === "assistant" && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" disabled={create.isPending} onClick={() => create.mutate(null)}>
                  <Plus />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">New assistant chat</TooltipContent>
            </Tooltip>
          )}
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

      {/* Tabs — five buckets. Code = directory sessions; Assistant = directory-less
          chats; the rest group sessions by their bound agent type. */}
      <div className="border-b flex shrink-0 gap-0.5 overflow-x-auto border-b px-1.5 py-1.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={cn(
              "flex-1 shrink-0 rounded-md px-1.5 py-1 text-[11px] font-medium whitespace-nowrap transition-colors",
              activeTab === t.id ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
            )}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {sessions.isPending && (
          <div className="flex justify-center py-8">
            <Loader2 className="text-muted-foreground size-4 animate-spin" />
          </div>
        )}

        {(activeTab === "code" || activeTab === "assistant") &&
          (activeTab === "code" ? codeGroups : assistantGroup ? [assistantGroup] : []).map((group) => (
          <div key={group.id ?? "none"}>
            <DirectoryGroupHeader
              group={group}
              directory={(directories.data ?? []).find((d) => d.id === group.id)}
              rename={renameDirectory}
              update={updateDirectory}
              create={create}
            />
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
                    <DropdownMenuItem onSelect={() => setArchived.mutate({ id: session.id, archived: !archiveMode })}>
                      <Archive size={13} aria-hidden="true" /> {archiveMode ? "Unarchive" : "Archive"}
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
        {/* Agent tabs: one expandable group per agent of the tab's type, each
            holding its sessions; + starts a fresh session bound to the agent. */}
        {activeTab !== "code" && activeTab !== "assistant" && (
          <AgentTabContent
            tab={activeTab}
            agents={(agents.data ?? []).filter((a) => a.type === AGENT_TAB_TYPE[activeTab])}
            sessionsByAgent={sessionsByAgent}
            selectedId={selectedId}
            activeStreaming={activeStreaming}
            live={live}
            create={create}
            rename={rename}
            remove={remove}
            setArchived={setArchived}
            archiveMode={archiveMode}
            onSelect={onSelect}
          />
        )}

        {(sessions.data ?? []).length === 0 && !sessions.isPending && (
          <p className="text-muted-foreground p-3 text-sm">
            {archiveMode
              ? "Nothing archived yet — archive from a session's ⋯ menu."
              : activeTab === "code"
                ? "No sessions yet — hit + to start one."
                : "No sessions yet."}
          </p>
        )}
      </div>

      <div className="border-t border-t p-2">
        <Button
          variant="ghost"
          size="sm"
          className={cn("w-full justify-start", archiveMode ? "text-foreground" : "text-muted-foreground")}
          onClick={() => setArchiveMode((v) => !v)}
          title={archiveMode ? "Showing archived sessions — click to show active" : "Show archived sessions"}
        >
          <Archive size={14} aria-hidden="true" />
          Archive
          {archiveMode && <Check size={14} className="ml-auto" aria-hidden="true" />}
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
    </SideNav>
  );
}
