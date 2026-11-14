import { useCallback, useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate, useParams } from "react-router";
import {
  artisanClient,
  type AgentInfo,
  type DirectoryInfo,
  type ModelInfo,
  type McpServerInfo,
  type SessionInfo,
  type SkillInfo,
} from "./lib/artisan-client.js";
import { WorkspaceProvider, useWorkspaceWs } from "./lib/workspace-ws.js";
import { RequireAuth } from "./routes/auth/RequireAuth.js";
import { Sidebar } from "./routes/shell/partials/Sidebar.js";
import { NewSessionDialog } from "./routes/shell/partials/NewSessionDialog.js";
import { DirectoryDialog } from "./routes/shell/partials/DirectoryDialog.js";
import { useTabs } from "./routes/shell/hooks/useTabs.js";
import { useCatalog } from "./routes/shell/hooks/useCatalog.js";
import { SessionScreen } from "./routes/chat/SessionScreen.js";
import { AgentView, type AgentViewProps } from "./routes/agents/AgentView.js";
import { AgentWizard } from "./routes/agents/partials/AgentWizard.js";
import { SkillView } from "./routes/skills/SkillView.js";
import { GlobalInstructionView } from "./routes/settings/GlobalInstructionView.js";
import { McpView } from "./routes/mcp/McpView.js";
import { McpDialog } from "./routes/mcp/partials/McpDialog.js";
import { SkillDialog } from "./routes/skills/partials/SkillDialog.js";

/**
 * Artisan shell: sidebar (sessions by directory) + tabbed workspace (one tab
 * per session, all rooms joined on one workspace WS) + agent/skill pages.
 */
export function App() {
  return (
    <BrowserRouter>
      <RequireAuth>
        <WorkspaceProvider>
          <Shell />
        </WorkspaceProvider>
      </RequireAuth>
    </BrowserRouter>
  );
}

function Shell() {
  const navigate = useNavigate();
  const location = useLocation();
  const { connected } = useWorkspaceWs();
  const catalog = useCatalog();
  const tabs = useTabs();
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [directories, setDirectories] = useState<DirectoryInfo[]>([]);
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [agentWizard, setAgentWizard] = useState(false);
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [skillDialog, setSkillDialog] = useState(false);
  const [mcpServers, setMcpServers] = useState<McpServerInfo[]>([]);
  const [mcpDialog, setMcpDialog] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [dirDialog, setDirDialog] = useState<{ open: boolean; directory?: DirectoryInfo }>({ open: false });
  const [quickCreateDir, setQuickCreateDir] = useState<DirectoryInfo | null>(null);

  const refreshSessions = useCallback(async () => {
    try {
      setSessions(await artisanClient.listSessions({ archived: "include" }));
      setDirectories(await artisanClient.listRegisteredDirectories());
      setAgents(await artisanClient.listAgents());
      setSkills(await artisanClient.listSkills());
      setMcpServers(await artisanClient.listMcpServers());
    } catch {
      // offline
    }
  }, []);

  useEffect(() => {
    void refreshSessions();
    const t = setInterval(() => void refreshSessions(), 15_000);
    return () => clearInterval(t);
  }, [refreshSessions]);

  // App-wide Cmd/Ctrl+O → broadcast expand/collapse-all for thinking/tool blocks.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "o" && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("artisan:toggle-expand"));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // URL → tab (deep links: /s/<id>)
  useEffect(() => {
    const m = location.pathname.match(/^\/s\/([a-z0-9]+)$/i);
    if (m) {
      const id = m[1];
      const s = sessions.find((x) => x.id === id);
      tabs.open(id, s?.title);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, sessions.length]);

  // rename tabs when session titles change
  useEffect(() => {
    for (const s of sessions) {
      const tab = tabs.tabs.find((t) => t.sessionId === s.id);
      if (tab && tab.label !== s.title) tabs.rename(s.id, s.title);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions]);

  const openSession = (s: SessionInfo) => {
    tabs.open(s.id, s.title);
    navigate(`/s/${s.id}`);
  };

  const createSession = async (input: {
    runner: string;
    directory: string;
    model: string;
    title?: string;
    message?: string;
    directoryId?: string;
    agentId?: string;
  }) => {
    const s = await artisanClient.createSession(input);
    setNewOpen(false);
    setQuickCreateDir(null);
    await refreshSessions();
    tabs.open(s.id, s.title);
    navigate(`/s/${s.id}`);
    return null;
  };

  /** Directory `+` button: create a session immediately with the directory's defaults. */
  const quickCreate = async (dir: DirectoryInfo) => {
    try {
      await createSession({
        runner: dir.runner,
        directory: dir.path,
        directoryId: dir.id,
        model: dir.defaultModel ?? catalog.models[0]?.id ?? "",
        title: `session-${Date.now().toString(36).slice(-4)}`,
      });
    } catch {
      setQuickCreateDir(dir); // fall back to the full dialog on error
    }
  };

  const showTabs = tabs.tabs.length > 0;
  const onSessionRoute = location.pathname === "/" || location.pathname.startsWith("/s/");

  return (
    <div className="flex h-screen overflow-hidden bg-paper text-ink">
      <Sidebar
        sessions={sessions}
        directories={directories}
        activeSessionId={tabs.active}
        onOpenSession={openSession}
        onNewSession={(dir) => void quickCreate(dir)}
        onAddDirectory={() => setDirDialog({ open: true })}
        onEditDirectory={(dir) => setDirDialog({ open: true, directory: dir })}
        onRenameSession={async (s, title) => {
          await artisanClient.updateSession(s.id, { title });
          tabs.rename(s.id, title);
          await refreshSessions();
        }}
        onArchiveSession={async (s, archived) => {
          await artisanClient.updateSession(s.id, { archived });
          if (archived) tabs.close(s.id);
          await refreshSessions();
        }}
        onDeleteSession={async (s) => {
          await artisanClient.deleteSession(s.id);
          tabs.close(s.id);
          await refreshSessions();
        }}
        skills={skills}
        activeSkillId={location.pathname.match(/^\/skills\/([^/]+)/)?.[1] ?? null}
        mcpServers={mcpServers}
        activeMcpId={location.pathname.match(/^\/mcp\/([^/]+)/)?.[1] ?? null}
        globalInstructionActive={location.pathname === "/global-instruction"}
        onOpenGlobalInstruction={() => navigate("/global-instruction")}
        onNewMcp={() => setMcpDialog(true)}
        onOpenMcp={(s) => navigate(`/mcp/${s.id}`)}
        onDeleteMcp={async (s) => {
          await artisanClient.deleteMcpServer(s.id);
          if (location.pathname === `/mcp/${s.id}`) navigate("/");
          await refreshSessions();
        }}
        onNewSkill={() => setSkillDialog(true)}
        onOpenSkill={(s) => navigate(`/skills/${s.id}`)}
        onDeleteSkill={async (s) => {
          await artisanClient.deleteSkill(s.id);
          if (location.pathname === `/skills/${s.id}`) navigate("/");
          await refreshSessions();
        }}
        agents={agents}
        onNewAgent={() => setAgentWizard(true)}
        activeAgentId={location.pathname.match(/^\/agents\/([^/]+)/)?.[1] ?? null}
        onOpenAgent={(a) => navigate(`/agents/${a.id}`)}
        onDeleteAgent={async (a) => {
          await artisanClient.deleteAgent(a.id);
          if (location.pathname === `/agents/${a.id}`) navigate("/");
          await refreshSessions();
        }}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {showTabs ? (
          <div className="flex items-end overflow-x-auto bg-stone" style={{ scrollbarWidth: "none" }}>
            {tabs.tabs.map((t) => (
              <div
                key={t.sessionId}
                className={`group flex w-32 max-w-48 shrink-0 cursor-pointer items-center gap-1.5 rounded-t-sm border border-b-0 px-4 pe-2 py-2 text-[12px] ${
                  t.sessionId === tabs.active && onSessionRoute ? "border-outline bg-paper text-ink" : "text-ink-muted hover:text-ink border-r border-outline"
                }`}
                onClick={() => {
                  tabs.setActive(t.sessionId);
                  navigate(`/s/${t.sessionId}`);
                }}
              >
                <span className="truncate">{t.label}</span>
                <button
                  type="button"
                  className="ml-auto flex size-4 shrink-0 items-center justify-center rounded leading-none opacity-0 hover:bg-surface-muted group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    tabs.close(t.sessionId);
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        ) : null}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <Routes>
            <Route
              path="/"
              element={
                showTabs && tabs.active ? (
                  <SessionScreen
                    connected={connected}
                    sessionId={tabs.active}
                    onOpenChild={(id) => tabs.open(id)}
                    title={tabs.tabs.find((t) => t.sessionId === tabs.active)?.label}
                  />
                ) : (
                  <EmptyState onNew={() => setNewOpen(true)} />
                )
              }
            />
            <Route path="/s/:sessionId" element={<ChatViewRoute tabs={tabs} connected={connected} />} />
            <Route
              path="/agents/:agentId"
              element={
                <AgentRoute
                  models={catalog.models}
                  directories={directories}
                  onStartChat={async (input) => {
                    await createSession({ ...input, title: `chat-${Date.now().toString(36).slice(-4)}` });
                  }}
                  onOpenSession={openSession}
                  onChanged={refreshSessions}
                />
              }
            />
            <Route path="/skills/:skillId" element={<SkillRoute agents={agents} onChanged={refreshSessions} />} />
            <Route path="/global-instruction" element={<GlobalInstructionView />} />
            <Route path="/mcp/:mcpId" element={<McpRoute agents={agents} directories={directories} onChanged={refreshSessions} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
      {newOpen ? (
        <NewSessionDialog models={catalog.models} runners={catalog.runners} busy={false} onClose={() => setNewOpen(false)} onCreate={createSession} />
      ) : null}
      {mcpDialog ? (
        <McpDialog
          agents={agents}
          directories={directories}
          onClose={() => setMcpDialog(false)}
          onCreated={async (created) => {
            setMcpDialog(false);
            await refreshSessions();
            navigate(`/mcp/${created[0].id}`);
          }}
        />
      ) : null}
      {skillDialog ? (
        <SkillDialog
          agents={agents}
          onClose={() => setSkillDialog(false)}
          onCreated={async (skill) => {
            setSkillDialog(false);
            await refreshSessions();
            navigate(`/skills/${skill.id}`);
          }}
        />
      ) : null}
      {agentWizard ? (
        <AgentWizard
          models={catalog.models}
          onClose={() => setAgentWizard(false)}
          onCreated={async (agent) => {
            setAgentWizard(false);
            await refreshSessions();
            navigate(`/agents/${agent.id}`);
          }}
        />
      ) : null}
      {dirDialog.open ? (
        <DirectoryDialog
          directory={dirDialog.directory}
          models={catalog.models}
          busy={false}
          onClose={() => setDirDialog({ open: false })}
          onSave={async (input) => {
            if (dirDialog.directory) {
              await artisanClient.updateDirectory(dirDialog.directory.id, {
                title: input.title,
                spaceId: input.spaceId,
                defaultModel: input.defaultModel ?? null,
                projectSettings: input.projectSettings,
              });
            } else {
              const dir = await artisanClient.createDirectory(input);
              setDirDialog({ open: false });
              await refreshSessions();
              // First session for the new directory, with its defaults.
              await quickCreate(dir);
              return null;
            }
            setDirDialog({ open: false });
            await refreshSessions();
            return null;
          }}
        />
      ) : null}
    </div>
  );
}

function SkillRoute(props: { agents: AgentInfo[]; onChanged: () => void | Promise<void> }) {
  const { skillId } = useParams();
  if (!skillId) return null;
  return <SkillView skillId={skillId} agents={props.agents} onChanged={props.onChanged} />;
}

function McpRoute(props: { agents: AgentInfo[]; directories: DirectoryInfo[]; onChanged: () => void | Promise<void> }) {
  const { mcpId } = useParams();
  if (!mcpId) return null;
  return <McpView serverId={mcpId} agents={props.agents} directories={props.directories} onChanged={props.onChanged} />;
}

function AgentRoute(props: {
  models: ModelInfo[];
  directories: DirectoryInfo[];
  onStartChat: AgentViewProps["onStartChat"];
  onOpenSession: (s: SessionInfo) => void;
  onChanged: () => void | Promise<void>;
}) {
  const { agentId } = useParams();
  if (!agentId) return null;
  return (
    <AgentView
      agentId={agentId}
      models={props.models}
      directories={props.directories}
      onStartChat={props.onStartChat}
      onOpenSession={props.onOpenSession}
      onChanged={props.onChanged}
    />
  );
}

function ChatViewRoute(props: { tabs: ReturnType<typeof useTabs>; connected: boolean }) {
  const { sessionId } = useParams2();
  const found = props.tabs.tabs.some((t) => t.sessionId === sessionId);
  useEffect(() => {
    if (sessionId && !found) props.tabs.open(sessionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, found]);
  if (!sessionId) return null;
  return <SessionScreen connected={props.connected} sessionId={sessionId} onOpenChild={(id) => props.tabs.open(id)} title={undefined} />;
}

function useParams2(): { sessionId?: string } {
  // tiny wrapper — react-router's useParams inside Routes is fine, but this
  // component is rendered by <Route element>; read from location directly.
  const loc = useLocation();
  const m = loc.pathname.match(/^\/s\/([a-z0-9]+)$/i);
  return { sessionId: m?.[1] };
}

function EmptyState(props: { onNew: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-ink-muted">
      <p className="text-[15px]">No session open</p>
      <p className="max-w-sm text-center text-[12px]">
        Pick a runner directory to start a coding session — every session keeps its own context, tools, and plan.
      </p>
      <button type="button" className="rounded-md border border-outline px-3 py-1.5 text-[13px] hover:text-ink" onClick={props.onNew}>
        New session
      </button>
    </div>
  );
}
