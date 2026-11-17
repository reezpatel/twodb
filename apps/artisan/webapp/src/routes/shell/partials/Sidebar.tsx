import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Plus, Bot, BookOpen, Plug, Settings, LogOut, SquareTerminal, MessageCircle, FolderPlus, Pencil, Search, ChevronRight, Archive, Check, MoreHorizontal, Trash2 } from "lucide-react";
import { artisanClient, type AgentInfo, type DirectoryInfo, type McpServerInfo, type SessionInfo, type SkillInfo, type SpaceInfo } from "../../../lib/artisan-client.js";
import { SessionSearchDialog } from "./SessionSearchDialog.js";
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
  onRenameSession: (session: SessionInfo, title: string) => Promise<void> | void;
  onArchiveSession: (session: SessionInfo, archived: boolean) => Promise<void> | void;
  onDeleteSession: (session: SessionInfo) => Promise<void> | void;
  skills: SkillInfo[];
  activeSkillId: string | null;
  onNewSkill: () => void;
  onOpenSkill: (skill: SkillInfo) => void;
  onDeleteSkill: (skill: SkillInfo) => Promise<void> | void;
  mcpServers: McpServerInfo[];
  activeMcpId: string | null;
  onNewMcp: () => void;
  onOpenMcp: (server: McpServerInfo) => void;
  onDeleteMcp: (server: McpServerInfo) => Promise<void> | void;
  /** Plain LLM chats (session type llm_chat) — the Chat tab. */
  chats: SessionInfo[];
  /** Spaces — the Chat tab has one section per space, each with its own `+`. */
  spaces: SpaceInfo[];
  onNewChat: (spaceId: string) => void;
  /** Footer: Settings opens the settings dialog; Sign out ends the SSO session. */
  onOpenSettings: () => void;
  onSignOut: () => void;
  /** Below lg the sidebar is a slide-over sheet: `open` shows it, `onClose` dismisses (backdrop / Escape). */
  overlay?: boolean;
  open?: boolean;
  onClose?: () => void;
  userName?: string;
  agents: AgentInfo[];
  onNewAgent: () => void;
  onOpenAgent: (agent: AgentInfo) => void;
  activeAgentId: string | null;
  onDeleteAgent: (agent: AgentInfo) => Promise<void> | void;
}

type SidebarTab = "sessions" | "chat" | "agents" | "skills" | "mcp";
const SIDEBAR_TABS: Array<{ id: SidebarTab; label: string; icon: typeof Bot }> = [
  { id: "sessions", label: "Sessions", icon: SquareTerminal },
  { id: "chat", label: "Chat", icon: MessageCircle },
  { id: "agents", label: "Agents", icon: Bot },
  { id: "skills", label: "Skills", icon: BookOpen },
  { id: "mcp", label: "MCP", icon: Plug },
];

interface DirGroup {
  dir: DirectoryInfo | null; // null = legacy sessions with no registered directory
  key: string;
  label: string;
  sessions: SessionInfo[];
}

/** Left sidebar: registered directories as sections, each with a `+` to start a session. */
export function Sidebar(props: SidebarProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [tab, setTabState] = useState<SidebarTab>(() => (["chat", "agents", "skills", "mcp"].includes(localStorage.getItem("artisan.sidebar.tab") ?? "") ? (localStorage.getItem("artisan.sidebar.tab") as SidebarTab) : "sessions"));
  const setTab = (t: SidebarTab) => {
    setTabState(t);
    localStorage.setItem("artisan.sidebar.tab", t);
  };
  const [archiveMode, setArchiveMode] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(localStorage.getItem("artisan.sidebar.collapsed") ?? "{}");
    } catch {
      return {};
    }
  });
  const toggle = (key: string) =>
    setCollapsed((c) => {
      const next = { ...c, [key]: !c[key] };
      localStorage.setItem("artisan.sidebar.collapsed", JSON.stringify(next));
      return next;
    });
  const { width, Handle } = useResizableWidth("artisan.sidebar.left", 256, 180, 480);

  // Sessions run by the directory agent only — chats with a custom agent live on that agent's Sessions tab.
  const directorySessions = useMemo(() => props.sessions.filter((s) => !s.agentId), [props.sessions]);

  const groups = useMemo<DirGroup[]>(() => {
    const filtered = directorySessions.filter((s) => !!s.archivedAt === archiveMode);

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
      if (sessions.length === 0) continue; // hide empty directories
      out.push({ dir: d, key, label: d.title, sessions });
    }
    // Sessions with no registered directory (legacy / ad-hoc paths).
    for (const [key, sessions] of buckets) {
      if (byPath.has(key)) continue;
      const first = sessions[0];
      out.push({ dir: null, key, label: first ? `${first.runner} · ${first.directory}` : key, sessions });
    }
    return out;
  }, [directorySessions, props.directories, archiveMode]);
  // Search covers every session, including chats with custom agents.
  const searchable = useMemo(() => [...props.sessions, ...props.chats].filter((s) => !s.archivedAt), [props.sessions, props.chats]);
  const chatGroups = useMemo(() => {
    const shown = props.chats.filter((s) => !!s.archivedAt === archiveMode);
    const known = new Set(props.spaces.map((sp) => sp.id));
    const groups = props.spaces.map((sp) => ({ id: sp.id, name: sp.name, chats: shown.filter((c) => c.spaceId === sp.id) }));
    const orphans = shown.filter((c) => !known.has(c.spaceId)); // chats whose space is no longer visible
    if (orphans.length) groups.push({ id: "_other", name: "Other", chats: orphans });
    // While archived, hide empty sections (nothing to create there).
    return archiveMode ? groups.filter((g) => g.chats.length > 0) : groups;
  }, [props.chats, props.spaces, archiveMode]);

  useEffect(() => {
    if (!props.overlay || !props.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") props.onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [props.overlay, props.open, props.onClose]);

  if (props.overlay && !props.open) return null;

  return (
    <>
    {props.overlay ? <div aria-hidden className="fixed inset-0 z-40 bg-black/50" onClick={props.onClose} /> : null}
    <div
      className={props.overlay ? "fixed inset-y-0 left-0 z-50 flex min-h-0 bg-paper shadow-xl" : "flex h-full min-h-0 shrink-0"}
      style={{ width: props.overlay ? "min(85vw, 320px)" : width }}
    >
      <div className="flex h-full min-h-0 w-full flex-col border-r border-outline/50 bg-card/50 p-3">
        <div className="flex shrink-0 items-center justify-between gap-2 px-1 pb-2">
          <span className="min-w-0 flex-1 truncate px-1.5 font-sans text-[13px] font-medium text-ink">{tab === "agents" ? "Agents" : tab === "skills" ? "Skills" : tab === "mcp" ? "MCP servers" : tab === "chat" ? "Chat" : "Sessions"}</span>
          {tab === "sessions" ? (
            <>
              <button type="button" aria-label="Add directory" title="Add directory" onClick={props.onAddDirectory} className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-paper-grid hover:text-ink">
                <FolderPlus className="size-4" strokeWidth={1.5} />
              </button>
              <button type="button" aria-label="Search sessions" title="Search sessions" onClick={() => setSearchOpen(true)} className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-paper-grid hover:text-ink">
                <Search className="size-4" strokeWidth={1.5} />
              </button>
            </>
          ) : tab === "chat" ? null : (
            <button type="button" aria-label={tab === "skills" ? "New skill" : tab === "mcp" ? "New MCP server" : "New agent"} title={tab === "skills" ? "New skill" : tab === "mcp" ? "New MCP server" : "New agent"} onClick={tab === "skills" ? props.onNewSkill : tab === "mcp" ? props.onNewMcp : props.onNewAgent} className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-paper-grid hover:text-ink">
              <Plus className="size-4" strokeWidth={1.5} />
            </button>
          )}
        </div>
        <div role="tablist" className="mb-2 flex shrink-0 gap-1 rounded-[8px] bg-paper-grid/60 p-0.5">
          {SIDEBAR_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              aria-label={t.label}
              title={t.label}
              onClick={() => setTab(t.id)}
              className={`flex h-7 flex-1 items-center justify-center rounded-[6px] transition-colors ${tab === t.id ? "bg-stone text-ink" : "text-muted-foreground hover:text-ink"}`}
            >
              <t.icon className="size-4" strokeWidth={1.5} />
            </button>
          ))}
        </div>
        <SessionSearchDialog open={searchOpen} sessions={searchable} agents={props.agents} onClose={() => setSearchOpen(false)} onSelect={props.onOpenSession} />
        {tab === "skills" ? <SkillList skills={props.skills} activeId={props.activeSkillId} onOpen={props.onOpenSkill} onNew={props.onNewSkill} onDelete={props.onDeleteSkill} /> : null}
        {tab === "mcp" ? <McpList servers={props.mcpServers} activeId={props.activeMcpId} onOpen={props.onOpenMcp} onNew={props.onNewMcp} onDelete={props.onDeleteMcp} /> : null}
        {tab === "agents" ? <AgentList agents={props.agents} activeId={props.activeAgentId} onEdit={props.onOpenAgent} onNew={props.onNewAgent} onDelete={props.onDeleteAgent} /> : null}
        {tab === "chat" ? (
          <div className="mt-1 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {chatGroups.map((g) => (
              <div key={g.id} className="flex flex-col">
                <div className="group/header flex items-center pr-1">
                  <button
                    type="button"
                    className="group/title flex min-w-0 flex-1 items-center gap-1 px-2.5 pb-1 text-left"
                    aria-expanded={!collapsed[`chat:${g.id}`]}
                    onClick={() => toggle(`chat:${g.id}`)}
                    title={g.name}
                  >
                    <span className="min-w-0 truncate font-sans text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/50 transition-colors group-hover/title:text-muted-foreground">{g.name}</span>
                    <ChevronRight className={`size-3 shrink-0 text-muted-foreground/40 opacity-0 transition-all group-hover/title:opacity-100 ${collapsed[`chat:${g.id}`] ? "" : "rotate-90"}`} strokeWidth={2} />
                  </button>
                  {g.id !== "_other" ? (
                    <button type="button" aria-label={`New chat in ${g.name}`} title="New chat" className="rounded-sm p-1 text-muted-foreground opacity-100 transition-opacity hover:bg-paper-grid hover:text-ink md:opacity-0 md:focus-visible:opacity-100 md:group-hover/header:opacity-100" onClick={() => props.onNewChat(g.id)}>
                      <Plus className="size-3.5" />
                    </button>
                  ) : null}
                </div>
                {collapsed[`chat:${g.id}`] ? null : (
                  <div className="flex flex-col gap-0.5">
                    {g.chats.map((s) => (
                      <SessionRow key={s.id} session={s} active={s.id === props.activeSessionId} {...props} />
                    ))}
                    {g.chats.length === 0 ? <p className="px-2.5 py-1 text-[11px] text-muted-foreground/60">no chats yet</p> : null}
                  </div>
                )}
              </div>
            ))}
            {chatGroups.length === 0 ? (
              <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
                <div className="flex size-10 items-center justify-center rounded-full bg-surface-muted text-ink-muted">
                  {archiveMode ? <Archive className="size-5" /> : <MessageCircle className="size-5" />}
                </div>
                <p className="text-sm font-medium tracking-wide">{archiveMode ? "Nothing archived" : "No spaces"}</p>
                <p className="text-sm leading-relaxed text-ink-muted">{archiveMode ? "Chats you archive will appear here" : "Chats live in a space — none is available to you yet."}</p>
              </div>
            ) : null}
          </div>
        ) : null}
        <div className={`mt-1 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${tab !== "sessions" ? "hidden" : ""}`}>
          {groups.map((g) => (
            <div key={g.key} className="flex flex-col">
              <div className="group/header flex items-center pr-1">
                <button
                  type="button"
                  className="group/title flex min-w-0 flex-1 items-center gap-1 px-2.5 pb-1 text-left"
                  aria-expanded={!collapsed[g.key]}
                  onClick={() => toggle(g.key)}
                  title={`${g.dir?.runner ?? ""}:${g.dir?.path ?? g.label}`}
                >
                  <span className="min-w-0 truncate font-sans text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/50 transition-colors group-hover/title:text-muted-foreground">{g.label}</span>
                  <ChevronRight className={`size-3 shrink-0 text-muted-foreground/40 opacity-0 transition-all group-hover/title:opacity-100 ${collapsed[g.key] ? "" : "rotate-90"}`} strokeWidth={2} />
                </button>
                {g.dir ? (
                  <span className="flex shrink-0 items-center text-muted-foreground opacity-0 transition-opacity focus-within:opacity-100 group-hover/header:opacity-100">
                    <button type="button" aria-label={`New session in ${g.label}`} title="New session" className="rounded-sm p-1 hover:bg-paper-grid hover:text-ink" onClick={() => props.onNewSession(g.dir!)}>
                      <Plus className="size-3.5" />
                    </button>
                    <button type="button" aria-label={`Edit ${g.label}`} title="Directory settings" className="rounded-sm p-1 hover:bg-paper-grid hover:text-ink" onClick={() => props.onEditDirectory(g.dir!)}>
                      <Pencil className="size-3.5" />
                    </button>
                  </span>
                ) : null}
              </div>
              {collapsed[g.key] ? null : (
                <div className="flex flex-col gap-0.5">
                  {g.sessions.map((s) => (
                    <SessionRow key={s.id} session={s} active={s.id === props.activeSessionId} {...props} />
                  ))}
                  {g.sessions.length === 0 && !archiveMode ? <p className="px-2.5 py-1 text-[11px] text-muted-foreground/60">no sessions yet</p> : null}
                </div>
              )}
            </div>
          ))}
          {groups.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
              <div className="flex size-10 items-center justify-center rounded-full bg-surface-muted text-ink-muted">
                {archiveMode ? <Archive className="size-5" /> : <FolderPlus className="size-5" />}
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium tracking-wide">{archiveMode ? "Nothing archived" : "No sessions yet"}</p>
                <p className="text-sm leading-relaxed text-ink-muted">
                  {archiveMode ? "Sessions you archive will appear here" : "Add a project directory to start a session with an agent."}
                </p>
              </div>
              <button
                type="button"
                className="rounded-md border border-outline px-3 py-1 text-[12px] hover:bg-surface-muted"
                onClick={archiveMode ? () => setArchiveMode(false) : props.onAddDirectory}
              >
                {archiveMode ? "Back to sessions" : "Add directory"}
              </button>
            </div>
          ) : null}
        </div>
        <div className="mt-auto flex shrink-0 flex-col gap-0.5 border-t border-outline/50 pt-3">
          {tab === "sessions" || tab === "chat" ? (
            <NavRow icon={Archive} label="Archive" active={archiveMode} onClick={() => setArchiveMode((v) => !v)} title={archiveMode ? "Showing archived sessions — click to show active" : "Show archived sessions"}>
              {archiveMode ? <Check className="size-3.5" /> : null}
            </NavRow>
          ) : null}
          <NavRow icon={Settings} label="Settings" onClick={props.onOpenSettings} title="Settings" />
          <NavRow icon={LogOut} label="Sign out" onClick={props.onSignOut} title={props.userName ? `Sign out ${props.userName}` : "Sign out"} />
        </div>
      </div>
      {props.overlay ? null : <Handle edge="right" />}
    </div>
    </>
  );
}

function SessionRow(props: SidebarProps & { session: SessionInfo; active: boolean }) {
  const { session: s, active } = props;
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(s.title);
  const archived = !!s.archivedAt;
  const [menuOpen, setMenuOpen] = useState(false);

  const commit = async () => {
    setEditing(false);
    const t = title.trim();
    if (t && t !== s.title) await props.onRenameSession(s, t);
    else setTitle(s.title);
  };

  if (editing) {
    return (
      <input
        autoFocus
        value={title}
        className="my-0.5 h-7 w-full rounded-md bg-surface-muted px-2 text-[13px] outline-none"
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(e) => {
          if (e.key === "Enter") void commit();
          if (e.key === "Escape") {
            setTitle(s.title);
            setEditing(false);
          }
        }}
      />
    );
  }

  const act = "rounded-sm p-0.5 text-ink-muted/60 hover:bg-surface-muted hover:text-ink";
  return (
    <div
      className={`group flex items-center gap-2 rounded-[8px] pl-2.5 pr-1 font-sans text-[13px] font-light transition-colors ${
        active ? "bg-stone text-ink" : "text-muted-foreground hover:bg-paper-grid hover:text-ink"
      }`}
    >
            <button type="button" onClick={() => props.onOpenSession(s)} className="min-w-0 flex-1 truncate py-[7px] text-left leading-none" title={s.title}>
        {s.title}
      </button>
      <div className="relative shrink-0">
        <button
          type="button"
          title="Session options"
          aria-label="Session options"
          className={`${act} ${menuOpen ? "" : "opacity-0 group-hover:opacity-100"}`}
          onClick={() => setMenuOpen((v) => !v)}
        >
          <MoreHorizontal className="size-3.5" />
        </button>
        {menuOpen ? (
          <>
            <div className="fixed inset-0 z-40" onMouseDown={() => setMenuOpen(false)} />
            <div className="absolute right-0 top-full z-50 mt-1 w-36 rounded-md border border-outline bg-surface p-1 shadow-lg">
              <MenuItem
                icon={Pencil}
                label="Rename"
                onClick={() => {
                  setMenuOpen(false);
                  setTitle(s.title);
                  setEditing(true);
                }}
              />
              <MenuItem
                icon={Archive}
                label={archived ? "Unarchive" : "Archive"}
                onClick={() => {
                  setMenuOpen(false);
                  void props.onArchiveSession(s, !archived);
                }}
              />
              <MenuItem
                icon={Trash2}
                label="Delete"
                danger
                onClick={() => {
                  setMenuOpen(false);
                  if (window.confirm(`Delete "${s.title}"?`)) void props.onDeleteSession(s);
                }}
              />
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

/** Skills grouped by how they are made available. */
const SKILL_GROUPS: Array<{ mode: SkillInfo["scope"]["mode"]; label: string }> = [
  { mode: "global", label: "Global" },
  { mode: "agents", label: "Agents" },
  { mode: "spaces", label: "Spaces" },
  { mode: "types", label: "Agent types" },
];

function SkillList(props: { skills: SkillInfo[]; activeId: string | null; onOpen: (s: SkillInfo) => void; onNew: () => void; onDelete: (s: SkillInfo) => Promise<void> | void }) {
  const groups = SKILL_GROUPS.map((g) => ({ ...g, list: props.skills.filter((s) => s.scope.mode === g.mode) })).filter((g) => g.list.length > 0);
  return (
    <div className="mt-1 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {groups.map((g) => (
        <div key={g.mode} className="flex flex-col gap-0.5">
          <span className="px-2.5 pb-1 font-sans text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/50">{g.label}</span>
          {g.list.map((s) => (
            <div key={s.id} className={`group flex items-center rounded-[8px] pr-1 transition-colors ${props.activeId === s.id ? "bg-stone text-ink" : "text-muted-foreground hover:bg-paper-grid hover:text-ink"}`}>
              <button type="button" onClick={() => props.onOpen(s)} title={s.description || s.name} className="flex min-w-0 flex-1 items-center py-[7px] pl-2.5 text-left font-sans text-[13px] font-light leading-none">
                <span className="min-w-0 flex-1 truncate">{s.name}</span>
                {g.mode !== "global" ? <span className="ml-2 shrink-0 text-[11px] text-muted-foreground/50">{s.scope.all ? "all" : s.scope.ids.length}</span> : null}
              </button>
              <button
                type="button"
                aria-label={`Delete ${s.name}`}
                title="Delete skill"
                onClick={() => { if (confirm(`Delete skill "${s.name}"?`)) void props.onDelete(s); }}
                className="rounded-sm p-1 opacity-0 transition-opacity hover:bg-stone hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      ))}
      {groups.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
          <p className="text-sm leading-relaxed text-ink-muted">No skills yet. Skills are reusable instructions agents load on demand.</p>
          <button type="button" className="rounded-md border border-outline px-3 py-1 text-[12px] hover:bg-surface-muted" onClick={props.onNew}>New skill</button>
        </div>
      ) : null}
    </div>
  );
}

const MCP_GROUPS: Array<{ mode: McpServerInfo["scope"]["mode"]; label: string }> = [
  { mode: "global", label: "Global" },
  { mode: "agents", label: "Agents" },
  { mode: "spaces", label: "Spaces" },
  { mode: "directories", label: "Directories" },
  { mode: "types", label: "Agent types" },
];

/** MCP servers grouped by how they are made available. */
function McpList(props: { servers: McpServerInfo[]; activeId: string | null; onOpen: (s: McpServerInfo) => void; onNew: () => void; onDelete: (s: McpServerInfo) => Promise<void> | void }) {
  const groups = MCP_GROUPS.map((g) => ({ ...g, list: props.servers.filter((s) => s.scope.mode === g.mode) })).filter((g) => g.list.length > 0);
  return (
    <div className="mt-1 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {groups.map((g) => (
        <div key={g.mode} className="flex flex-col gap-0.5">
          <span className="px-2.5 pb-1 font-sans text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/50">{g.label}</span>
          {g.list.map((s) => (
            <div key={s.id} className={`group flex items-center rounded-[8px] pr-1 transition-colors ${props.activeId === s.id ? "bg-stone text-ink" : "text-muted-foreground hover:bg-paper-grid hover:text-ink"}`}>
              <button type="button" onClick={() => props.onOpen(s)} title={s.url} className="flex min-w-0 flex-1 items-center py-[7px] pl-2.5 text-left font-sans text-[13px] font-light leading-none">
                <span className={`min-w-0 flex-1 truncate ${s.enabled ? "" : "opacity-50"}`}>{s.name}</span>
                {!s.enabled ? <span className="ml-2 shrink-0 text-[10px] uppercase text-muted-foreground/50">off</span> : g.mode !== "global" ? <span className="ml-2 shrink-0 text-[11px] text-muted-foreground/50">{s.scope.all ? "all" : s.scope.ids.length}</span> : null}
              </button>
              <button
                type="button"
                aria-label={`Delete ${s.name}`}
                title="Delete MCP server"
                onClick={() => { if (confirm(`Delete MCP server "${s.name}"?`)) void props.onDelete(s); }}
                className="rounded-sm p-1 opacity-0 transition-opacity hover:bg-stone hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      ))}
      {groups.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
          <p className="text-sm leading-relaxed text-ink-muted">No MCP servers yet. Register remote tool servers and choose which agents they are for.</p>
          <button type="button" className="rounded-md border border-outline px-3 py-1 text-[12px] hover:bg-surface-muted" onClick={props.onNew}>New MCP server</button>
        </div>
      ) : null}
    </div>
  );
}

/** Agents grouped by type (custom types first, auto-created directory agents last). */
function AgentList(props: { agents: AgentInfo[]; activeId: string | null; onEdit: (a: AgentInfo) => void; onNew: () => void; onDelete: (a: AgentInfo) => Promise<void> | void }) {
  const groups = useMemo(() => {
    const by = new Map<string, AgentInfo[]>();
    for (const a of props.agents) {
      if (a.type === "llm_chat") continue; // the shared chat agent lives in Settings → Chat agent
      const list = by.get(a.type) ?? [];
      list.push(a);
      by.set(a.type, list);
    }
    return [...by.entries()]
      .sort(([a], [b]) => Number(a === "directory") - Number(b === "directory") || a.localeCompare(b))
      .map(([type, list]) => ({ type, list: list.sort((x, y) => x.name.localeCompare(y.name)) }));
  }, [props.agents]);

  return (
    <div className="mt-1 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {groups.map((g) => (
        <div key={g.type} className="flex flex-col gap-0.5">
          <span className="px-2.5 pb-1 font-sans text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/50">{g.type.replace(/_/g, " ")}</span>
          {g.list.map((a) => (
            <div key={a.id} className={`group flex items-center rounded-[8px] pr-1 transition-colors ${props.activeId === a.id ? "bg-stone text-ink" : "text-muted-foreground hover:bg-paper-grid hover:text-ink"}`}>
              <button type="button" onClick={() => props.onEdit(a)} title={a.description || a.name} className="flex min-w-0 flex-1 items-center py-[7px] pl-2.5 text-left font-sans text-[13px] font-light leading-none">
                <span className="min-w-0 flex-1 truncate">{a.name}</span>
                {a.directory ? <span className="ml-2 max-w-[40%] shrink-0 truncate text-[11px] text-muted-foreground/50">{a.directory.split("/").filter(Boolean).pop()}</span> : null}
              </button>
              {a.type !== "directory" ? (
                <button
                  type="button"
                  aria-label={`Delete ${a.name}`}
                  title="Delete agent"
                  onClick={() => { if (confirm(`Delete agent "${a.name}"?`)) void props.onDelete(a); }}
                  className="rounded-sm p-1 opacity-0 transition-opacity hover:bg-stone hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
                >
                  <Trash2 className="size-3.5" />
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ))}
      {groups.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
          <p className="text-sm leading-relaxed text-ink-muted">No agents yet. Directory agents appear after the first session in a directory.</p>
          <button type="button" className="rounded-md border border-outline px-3 py-1 text-[12px] hover:bg-surface-muted" onClick={props.onNew}>New agent</button>
        </div>
      ) : null}
    </div>
  );
}

function MenuItem(props: { icon: typeof Bot; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[12px] hover:bg-surface-muted ${props.danger ? "text-red-500" : "text-ink"}`}
    >
      <props.icon className="size-3.5" />
      {props.label}
    </button>
  );
}

/** Same row anatomy as blocks' NavItem (dispatch sidenav). */
function NavRow(props: { icon: typeof Bot; label: string; onClick: () => void; active?: boolean; title?: string; shortcut?: string; children?: ReactNode }) {
  return (
    <button
      type="button"
      title={props.title}
      onClick={props.onClick}
      className={`group flex w-full items-center justify-between gap-2 rounded-[8px] py-[7px] pl-2.5 pr-2 text-left outline-none transition-colors ${
        props.active ? "bg-stone text-ink" : "text-muted-foreground hover:bg-paper-grid hover:text-ink"
      }`}
    >
      <span className="flex min-w-0 items-center gap-2.5">
        <props.icon className={`size-4 shrink-0 ${props.active ? "text-ink" : "text-muted-foreground/80 group-hover:text-ink/80"}`} strokeWidth={1.5} />
        <span className="truncate font-sans text-[13px] font-light leading-none">{props.label}</span>
      </span>
      <span className="flex shrink-0 items-center gap-1.5">
        {props.shortcut ? <kbd className="hidden h-5 items-center rounded-[4px] border border-outline bg-paper px-1.5 font-mono text-[10px] leading-none text-muted-foreground group-hover:inline-flex">{props.shortcut}</kbd> : null}
        {props.children}
      </span>
    </button>
  );
}

// Re-export for convenience (used by App to refresh alongside sessions).
export { artisanClient };
