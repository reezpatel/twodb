import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import {
  Archive,
  Bot,
  Check,
  CodeXml,
  Loader2,
  MessageSquare,
  ShieldCheck,
  UserRound,
  Users,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
  Boxes,
} from "lucide-react";
import type { UseMutationResult } from "@tanstack/react-query";
import { markSessionSeen } from "../code-room-ws";
import { NewDirectoryDialog } from "../directories/new-directory-dialog";
import { useSessionList, groupSessionsByDirectory, useSessionEvents } from "./use-session-list";
import type { AgentListItem, CodeSession, SessionDirectoryGroup, SessionLiveState } from "./use-session-list";
import { useCodeDirectories } from "../directories/use-code-directories";
import type { CodeDirectory } from "../directories/use-code-directories";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { SpaceSelect } from "@/components/space-select";
import { SideNav, SideNavContent } from "@/components/blocks/side-nav/side-nav";
import { SideNavHeader } from "@/components/blocks/side-nav/side-nav-header";
import { SideNavTab, SideNavTabs } from "@/components/blocks/side-nav/side-nav-tabs";
import {
  NavSection,
  NavSectionAction,
  NavSectionActions,
  NavSectionContent,
  NavSectionHeader,
  NavSectionInput,
  NavSectionTitle,
} from "@/components/blocks/side-nav/nav-section";
import { NavItem, NavItemActions, NavItemLabel, type NavItemStatus } from "@/components/blocks/side-nav/nav-item";
import { NavEmptyState } from "@/components/blocks/side-nav/nav-empty-state";
import { NavFooter } from "@/components/blocks/side-nav/nav-footer";
import { NavFooterItem } from "@/components/blocks/side-nav/nav-footer-item";
import { cn } from "@/lib/utils";
import { urls } from "@/lib/url-registry";

interface SidenavProps {
  selectedId: string | null;
  onSelect: (id: string) => void;
  activeStreaming: boolean;
}

type SidenavTab = "code" | "assistant" | "persona" | "collaborator" | "sentinel";

const TABS: { id: SidenavTab; label: string; icon: ReactNode }[] = [
  { id: "code", label: "Code", icon: <CodeXml /> },
  { id: "assistant", label: "Assistant", icon: <MessageSquare /> },
  { id: "persona", label: "Personas", icon: <UserRound /> },
  { id: "collaborator", label: "Collabs", icon: <Users /> },
  { id: "sentinel", label: "Sentinel", icon: <ShieldCheck /> },
];

const AGENT_TAB_LABELS: Record<Exclude<SidenavTab, "code" | "assistant">, { singular: string; plural: string; description: string }> = {
  persona: { singular: "persona", plural: "personas", description: "Reusable agents with their own instructions and work directory." },
  collaborator: { singular: "collaborator", plural: "collaborators", description: "Agents that sessions can call on as helpers, without a work directory." },
  sentinel: { singular: "sentinel", plural: "sentinels", description: "The organization's assistant, which answers in assistant channels." },
};

const AGENT_TAB_TYPE: Record<Exclude<SidenavTab, "code" | "assistant">, AgentListItem["type"]> = {
  persona: "persona",
  collaborator: "collaborator",
  sentinel: "sentinel",
};

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
      <NavSectionHeader title="Assistant chats — no working directory">
        <NavSectionTitle>{group.label}</NavSectionTitle>
        <NavSectionActions>
          <NavSectionAction title="New assistant chat" disabled={create.isPending} onClick={() => create.mutate(null)}>
            <Plus aria-hidden="true" />
          </NavSectionAction>
        </NavSectionActions>
      </NavSectionHeader>
    );
  }

  if (editing) {
    return (
      <NavSectionHeader>
        <NavSectionInput
          autoFocus
          aria-label="Directory name"
          value={value}
          onFocus={(e) => e.target.select()}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") setEditing(false);
          }}
        />
      </NavSectionHeader>
    );
  }

  return (
    <NavSectionHeader
      title={`${group.cwd} — double-click to rename`}
      onDoubleClick={() => {
        setValue(group.label);
        setEditing(true);
      }}
    >
      <NavSectionTitle>{group.label}</NavSectionTitle>
      <NavSectionActions>
        <NavSectionAction
          title="New session in this directory"
          disabled={create.isPending}
          onClick={() => group.id && create.mutate(group.id)}
          onDoubleClick={(e) => e.stopPropagation()}
        >
          <Plus aria-hidden="true" />
        </NavSectionAction>
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild>
            <NavSectionAction title="Directory options">
              <MoreHorizontal aria-hidden="true" />
            </NavSectionAction>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
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
      </NavSectionActions>

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
    </NavSectionHeader>
  );
}

type SessionRowProps = {
  session: CodeSession;
  selectedId: string | null;
  activeStreaming: boolean;
  live: Map<string, SessionLiveState>;
  rename: UseMutationResult<CodeSession, Error, { id: string; title: string }, unknown>;
  remove: UseMutationResult<unknown, Error, string, unknown>;
  setArchived: UseMutationResult<unknown, Error, { id: string; archived: boolean }, unknown>;
  archiveMode: boolean;
  onSelect: (id: string) => void;
};

function SessionRow({ session, selectedId, activeStreaming, live, rename, remove, setArchived, archiveMode, onSelect }: SessionRowProps) {
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const navigate = useNavigate();

  if (renaming) {
    const commitRename = () => {
      const trimmed = renameValue.trim();
      setRenaming(false);
      if (trimmed && trimmed !== session.title) rename.mutate({ id: session.id, title: trimmed });
    };
    return (
      <NavItem>
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
            if (e.key === "Escape") setRenaming(false);
          }}
        />
      </NavItem>
    );
  }

  const state = live.get(session.id);
  const running = state?.running ?? (session.id === selectedId && activeStreaming);
  const needsInput = state?.needsInput ?? false;
  const unseen = selectedId !== session.id && !running && (state?.unseenUpdates ?? session.unseenUpdates ?? false);
  const status: NavItemStatus = needsInput ? "need-attention" : running ? "running" : unseen ? "completed" : "none";

  return (
    <NavItem
      active={selectedId === session.id}
      status={status}
      statusLabel={needsInput ? "Waiting for your answer" : unseen && !running ? "New activity" : undefined}
      onClick={() => onSelect(session.id)}
    >
      <NavItemLabel>{session.title}</NavItemLabel>
      <NavItemActions>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button title="Session options" onClick={(e) => e.stopPropagation()}>
              <MoreHorizontal aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem
              onSelect={() => {
                setRenameValue(session.title);
                setRenaming(true);
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
                  if (session.id === selectedId) navigate(urls.code.root());
                  remove.mutate(session.id);
                }
              }}
            >
              <Trash2 size={13} aria-hidden="true" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </NavItemActions>
    </NavItem>
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
  live: Map<string, SessionLiveState>;
  create: UseMutationResult<CodeSession, Error, string | null | { codeDirectoryId: string | null; agentId: string }, unknown>;
  rename: UseMutationResult<CodeSession, Error, { id: string; title: string }, unknown>;
  remove: UseMutationResult<unknown, Error, string, unknown>;
  setArchived: UseMutationResult<unknown, Error, { id: string; archived: boolean }, unknown>;
  archiveMode: boolean;
  onSelect: (id: string) => void;
}) {
  const anyActive = sessions.some((s) => s.id === selectedId);

  return (
    <NavSection collapsible className="mt-2">
      <NavSectionHeader className={cn("pt-0", anyActive && "text-foreground")}>
        <NavSectionTitle title={agent.description ?? undefined}>
          <Bot className="size-3 shrink-0" aria-hidden="true" />
          <span className="truncate">{agent.name ?? agent.description ?? "agent"}</span>
          <span className="text-muted-foreground/50 shrink-0 font-mono text-[10px] font-normal">{agent.model.split("/").pop() ?? agent.model}</span>
        </NavSectionTitle>
        <NavSectionActions>
          <NavSectionAction
            title="New session with this agent"
            disabled={create.isPending}
            onClick={() => {
              // Personas run in their work directory when set; collaborators and
              // the sentinel run directory-less (assistant-style).
              const dir = agent.type === "persona" ? agent.workDirectoryId : null;
              create.mutate({ codeDirectoryId: dir, agentId: agent.id });
            }}
          >
            <Plus aria-hidden="true" />
          </NavSectionAction>
        </NavSectionActions>
      </NavSectionHeader>
      <NavSectionContent>
        {sessions.length === 0 ? (
          <p className="text-muted-foreground/60 py-1 pl-9 text-[11px]">no sessions yet</p>
        ) : (
          sessions.map((session) => (
            <SessionRow
              key={session.id}
              session={session}
              selectedId={selectedId}
              activeStreaming={activeStreaming}
              live={live}
              rename={rename}
              remove={remove}
              setArchived={setArchived}
              archiveMode={archiveMode}
              onSelect={onSelect}
            />
          ))
        )}
      </NavSectionContent>
    </NavSection>
  );
}

function AgentTabContent(props: {
  tab: Exclude<SidenavTab, "code" | "assistant">;
  agents: AgentListItem[];
  sessionsByAgent: Map<string, CodeSession[]>;
  selectedId: string | null;
  activeStreaming: boolean;
  live: Map<string, SessionLiveState>;
  create: UseMutationResult<CodeSession, Error, string | null | { codeDirectoryId: string | null; agentId: string }, unknown>;
  rename: UseMutationResult<CodeSession, Error, { id: string; title: string }, unknown>;
  remove: UseMutationResult<unknown, Error, string, unknown>;
  setArchived: UseMutationResult<unknown, Error, { id: string; archived: boolean }, unknown>;
  archiveMode: boolean;
  onSelect: (id: string) => void;
}) {
  const { agents, sessionsByAgent, selectedId } = props;
  const navigate = useNavigate();
  const [showAll, setShowAll] = useState(false);
  // Agents with sessions (or the selected one) always show; the rest collapse
  // behind a "show all" toggle so orgs with many agents stay navigable.
  const withSessions = agents.filter((a) => (sessionsByAgent.get(a.id) ?? []).length > 0 || a.id === boundAgentId(selectedId, sessionsByAgent));
  const rest = agents.filter((a) => !withSessions.includes(a));
  const visible = showAll ? agents : withSessions;

  return (
    <div className="py-1">
      {agents.length === 0 && (
        <NavEmptyState icon={<Bot />} title={`No ${AGENT_TAB_LABELS[props.tab].plural} yet`} description={AGENT_TAB_LABELS[props.tab].description}>
          <Button size="sm" variant="secondary" onClick={() => navigate(urls.settings.llm.agents())}>
            Create {AGENT_TAB_LABELS[props.tab].singular}
          </Button>
        </NavEmptyState>
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
  const live = useSessionEvents(true, selectedId);
  const { directories, renameDirectory, updateDirectory } = useCodeDirectories();
  const [newDirOpen, setNewDirOpen] = useState(false);
  const [tab, setTab] = useState<SidenavTab>("code");

  const directoryGroups = groupSessionsByDirectory(sessions.data ?? [], directories.data ?? []);

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

  // The Assistant group (directory-less) is its own tab; the code tab keeps
  // only directory-bound groups. Agent tabs render agents instead.
  const agentTab = activeTab === "code" || activeTab === "assistant" ? null : activeTab;
  const directorySections = agentTab ? [] : directoryGroups.filter((g) => (activeTab === "code" ? g.id !== null : g.id === null));
  const directoriesById = new Map((directories.data ?? []).map((d) => [d.id, d]));
  const tabAgents = agentTab ? (agents.data ?? []).filter((a) => a.type === AGENT_TAB_TYPE[agentTab]) : [];

  // Opening a session that was already flagged (live frames only cover new flags).
  const selectedSessionId = selectedSession?.id;
  const selectedWasUnseen = useRef(false);
  selectedWasUnseen.current = selectedSession?.unseenUpdates ?? false;
  useEffect(() => {
    if (selectedSessionId && selectedWasUnseen.current) markSessionSeen(selectedSessionId);
  }, [selectedSessionId]);

  // Agent tabs show their own empty state (no agents / no sessions per agent).
  const hasSessions = (sessions.data ?? []).length > 0;
  const emptyState =
    hasSessions || sessions.isPending
      ? null
      : archiveMode
        ? {
            icon: <Archive />,
            title: "Nothing archived",
            description: "Sessions you archive will appear here",
            actionIcon: null,
            actionLabel: "Back to sessions",
            disabled: false,
            onAction: () => setArchiveMode(false),
          }
        : activeTab === "code"
          ? {
              icon: <CodeXml />,
              title: "No sessions yet",
              description: "Start a session in a project directory to work with an agent.",
              actionIcon: <Plus />,
              actionLabel: "New session",
              disabled: false,
              onAction: () => setNewDirOpen(true),
            }
          : activeTab === "assistant"
            ? {
                icon: <MessageSquare />,
                title: "No assistant chats yet",
                description: "Chat with the assistant without picking a working directory.",
                actionIcon: <Plus />,
                actionLabel: "New assistant chat",
                disabled: create.isPending,
                onAction: () => create.mutate(null),
              }
            : null;

  // Agent-bound sessions by agent id.
  const sessionsByAgent = new Map<string, CodeSession[]>();
  for (const s of sessions.data ?? []) {
    if (!s.agentId) continue;
    const bucket = sessionsByAgent.get(s.agentId) ?? [];
    bucket.push(s);
    sessionsByAgent.set(s.agentId, bucket);
  }

  return (
    <SideNav>
      <SideNavHeader title="Sessions">
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
      </SideNavHeader>

      {/* Tabs — five buckets. Code = directory sessions; Assistant = directory-less
          chats; the rest group sessions by their bound agent type. */}
      <SideNavTabs>
        {TABS.map((t) => (
          <SideNavTab key={t.id} icon={t.icon} label={t.label} active={activeTab === t.id} onClick={() => setTab(t.id)} />
        ))}
      </SideNavTabs>

      <SideNavContent>
        {sessions.isPending && (
          <div className="flex justify-center py-8">
            <Loader2 className="text-muted-foreground size-4 animate-spin" />
          </div>
        )}

        {directorySections.map((group) => (
          <NavSection key={group.id ?? "none"}>
            <DirectoryGroupHeader
              group={group}
              directory={group.id ? directoriesById.get(group.id) : undefined}
              rename={renameDirectory}
              update={updateDirectory}
              create={create}
            />
            {group.sessions.map((session) => (
              <SessionRow
                key={session.id}
                session={session}
                selectedId={selectedId}
                activeStreaming={activeStreaming}
                live={live}
                rename={rename}
                remove={remove}
                setArchived={setArchived}
                archiveMode={archiveMode}
                onSelect={onSelect}
              />
            ))}
          </NavSection>
        ))}
        {/* Agent tabs: one expandable group per agent of the tab's type, each
            holding its sessions; + starts a fresh session bound to the agent. */}
        {agentTab && (
          <AgentTabContent
            tab={agentTab}
            agents={tabAgents}
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

        {emptyState && (
          <NavEmptyState icon={emptyState.icon} title={emptyState.title} description={emptyState.description}>
            <Button size="sm" variant="outline" disabled={emptyState.disabled} onClick={emptyState.onAction}>
              {emptyState.actionIcon} {emptyState.actionLabel}
            </Button>
          </NavEmptyState>
        )}
      </SideNavContent>

      <NavFooter>
        <NavFooterItem
          icon={<Archive />}
          active={archiveMode}
          onClick={() => setArchiveMode((v) => !v)}
          title={archiveMode ? "Showing archived sessions — click to show active" : "Show archived sessions"}
        >
          Archive
          {archiveMode && <Check className="ml-auto" aria-hidden="true" />}
        </NavFooterItem>
        <NavFooterItem disabled title="Skills & tools (coming soon)">
          Skills &amp; tools
        </NavFooterItem>
      </NavFooter>

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
