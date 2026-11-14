import { useCallback, useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from "react-router";
import { artisanClient, type DirectoryInfo, type SessionInfo } from "./lib/artisan-client.js";
import { WorkspaceProvider, useWorkspaceWs } from "./lib/workspace-ws.js";
import { RequireAuth } from "./routes/auth/RequireAuth.js";
import { Sidebar } from "./routes/shell/partials/Sidebar.js";
import { NewSessionDialog } from "./routes/shell/partials/NewSessionDialog.js";
import { DirectoryDialog } from "./routes/shell/partials/DirectoryDialog.js";
import { useTabs } from "./routes/shell/hooks/useTabs.js";
import { useCatalog } from "./routes/shell/hooks/useCatalog.js";
import { SessionScreen } from "./routes/chat/SessionScreen.js";
import { AgentsView } from "./routes/agents/AgentsView.js";
import { SkillsView } from "./routes/skills/SkillsView.js";

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
  const [newOpen, setNewOpen] = useState(false);
  const [dirDialog, setDirDialog] = useState<{ open: boolean; directory?: DirectoryInfo }>({ open: false });
  const [quickCreateDir, setQuickCreateDir] = useState<DirectoryInfo | null>(null);

  const refreshSessions = useCallback(async () => {
    try {
      setSessions(await artisanClient.listSessions());
      setDirectories(await artisanClient.listRegisteredDirectories());
    } catch {
      // offline
    }
  }, []);

  useEffect(() => {
    void refreshSessions();
    const t = setInterval(() => void refreshSessions(), 15_000);
    return () => clearInterval(t);
  }, [refreshSessions]);

  // App-wide Cmd/Ctrl+0 → broadcast expand/collapse-all for thinking/tool blocks.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "0") {
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

  const createSession = async (input: { runner: string; directory: string; model: string; title?: string; message?: string; directoryId?: string }) => {
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
  const onAgents = location.pathname.startsWith("/agents");
  const onSkills = location.pathname.startsWith("/skills");

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
        onNav={(page) => navigate(`/${page}`)}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {/* connection dot */}
        <div className="flex items-center gap-1.5 border-b border-outline px-3 py-1 text-[10px] text-ink-muted">
          <span className={`inline-block size-1.5 rounded-full ${connected ? "bg-emerald-500" : "bg-red-400"}`} />
          {connected ? "live" : "reconnecting…"}
        </div>
        {showTabs ? (
          <div className="flex items-end overflow-x-auto border-b border-outline bg-stone pt-1.5" style={{ scrollbarWidth: "none" }}>
            {tabs.tabs.map((t) => (
              <div
                key={t.sessionId}
                className={`group flex min-w-32 max-w-48 shrink-0 cursor-pointer items-center gap-1.5 rounded-t-md border border-b-0 px-2.5 py-1.5 text-[12px] ${
                  t.sessionId === tabs.active ? "border-outline bg-paper text-ink" : "border-transparent text-ink-muted hover:text-ink"
                }`}
                onClick={() => { tabs.setActive(t.sessionId); navigate(`/s/${t.sessionId}`); }}
              >
                <span className="truncate">{t.label}</span>
                <button
                  type="button"
                  className="ml-auto hidden rounded p-0.5 hover:bg-surface-muted group-hover:block"
                  onClick={(e) => { e.stopPropagation(); tabs.close(t.sessionId); }}
                >
                  ×
                </button>
              </div>
            ))}
            <button type="button" title="Add directory" className="ml-1 px-2 py-1 text-[13px] text-ink-muted hover:text-ink" onClick={() => setDirDialog({ open: true })}>+</button>
          </div>
        ) : null}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <Routes>
            <Route path="/" element={showTabs && tabs.active ? <SessionScreen sessionId={tabs.active} onOpenChild={(id) => tabs.open(id)} title={tabs.tabs.find((t) => t.sessionId === tabs.active)?.label} /> : <EmptyState onNew={() => setNewOpen(true)} />} />
            <Route path="/s/:sessionId" element={<ChatViewRoute tabs={tabs} />} />
            <Route path="/agents" element={<AgentsView />} />
            <Route path="/skills" element={<SkillsView />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
      {newOpen ? (
        <NewSessionDialog
          models={catalog.models}
          runners={catalog.runners}
          busy={false}
          onClose={() => setNewOpen(false)}
          onCreate={createSession}
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
                defaultModel: input.defaultModel ?? null,
                projectSettings: input.projectSettings,
              });
            } else {
              await artisanClient.createDirectory(input);
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

function ChatViewRoute(props: { tabs: ReturnType<typeof useTabs> }) {
  const { sessionId } = useParams2();
  const found = props.tabs.tabs.some((t) => t.sessionId === sessionId);
  useEffect(() => {
    if (sessionId && !found) props.tabs.open(sessionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, found]);
  if (!sessionId) return null;
  return <SessionScreen sessionId={sessionId} onOpenChild={(id) => props.tabs.open(id)} title={undefined} />;
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
