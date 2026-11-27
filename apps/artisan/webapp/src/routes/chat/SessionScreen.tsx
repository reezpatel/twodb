import { useEffect, useMemo, useRef, useState } from "react";
import { GitBranch, Palette, PanelRight, PanelRightClose, PanelRightOpen } from "lucide-react";
import { useLargeViewport } from "@twodb/blocks";
import { readSessionUi, sessionUiKey, writeJson } from "../../lib/persist.js";
import { useResizableWidth } from "../../lib/useResizableWidth.js";
import { ChatView } from "./ChatView.js";
import { EditorScreen } from "./EditorScreen.js";
import { TerminalScreen } from "./TerminalScreen.js";
import { CheckpointsScreen } from "./CheckpointsScreen.js";
import { InspectorScreen } from "./InspectorScreen.js";
import { ChangesScreen } from "./ChangesScreen.js";
import { CanvasScreen } from "./CanvasScreen.js";
import { ExpandToggle } from "./partials/ExpandToggle.js";
import { SESSION_TABS, SessionTabs, type SessionTabId } from "./partials/SessionTabs.js";
import { GitSection } from "./partials/GitSection.js";
import { SessionSidebar } from "./partials/SessionSidebar.js";
import { useSessionSide } from "./hooks/useSessionSide.js";
import { artisanClient, type SessionPrLink } from "../../lib/artisan-client.js";
import { useWorkspaceWs } from "../../lib/workspace-ws.js";

const MAIN_MIN_WIDTH = 480;

/**
 * One session's full workspace: legacy-style header (title + Chat/Editor/
 * Terminal/Checkpoints tabs + new-thread/compact actions), tab content, and
 * the right sidebar (Subagents, Plan, Git). The chat footer is part of the
 * chat tab and always pins to the bottom of the column.
 */
export function SessionScreen(props: { sessionId: string; onOpenChild: (sessionId: string) => void; title?: string; connected?: boolean }) {
  // Per-session UI state (restored from localStorage; SessionScreen is keyed by session).
  const saved = useMemo(() => readSessionUi(props.sessionId), [props.sessionId]);
  const [tab, setTab] = useState<SessionTabId>(() => (SESSION_TABS.some((t) => t.id === saved.tab) ? (saved.tab as SessionTabId) : "chat"));
  const isLarge = useLargeViewport();
  // Docked on lg+ (open by default); on mobile it is a slide-over sheet, hidden until toggled.
  const [showSidebar, setShowSidebar] = useState(isLarge ? (saved.sidebarOpen ?? true) : false);
  // Right sidebar tabs: Details (plan, git, …) and Canvas.
  const [sidebarView, setSidebarView] = useState<"default" | "canvas" | "git">(() => (["default", "canvas", "git"].includes(saved.sidebarView) ? (saved.sidebarView as "default" | "canvas" | "git") : "default"));
  useEffect(() => {
    setShowSidebar(isLarge ? (readSessionUi(props.sessionId).sidebarOpen ?? true) : false);
  }, [isLarge, props.sessionId]);
  // Remember this session's tab, sidebar tab and (docked) sidebar open state.
  useEffect(() => {
    writeJson(sessionUiKey(props.sessionId), { tab, sidebarView, sidebarOpen: isLarge ? showSidebar : readSessionUi(props.sessionId).sidebarOpen });
  }, [props.sessionId, tab, sidebarView, showSidebar, isLarge]);

  // footer shortcuts (terminal button) request a tab switch
  useEffect(() => {
    const onOpen = (e: Event) => {
      const t = (e as CustomEvent<SessionTabId | "canvas">).detail;
      if (t === "canvas") {
        setSidebarView("canvas");
        setShowSidebar(true);
        return;
      }
      if (t === "terminal" || t === "editor" || t === "changes" || t === "chat" || t === "checkpoints" || t === "inspector") setTab(t);
    };
    window.addEventListener("artisan:open-tab", onOpen);
    return () => window.removeEventListener("artisan:open-tab", onOpen);
  }, []);
  const side = useSessionSide(props.sessionId);
  const { onFrame } = useWorkspaceWs();
  const [prs, setPrs] = useState<SessionPrLink[]>([]);
  useEffect(() => {
    setPrs([]);
    void artisanClient.getSession(props.sessionId).then((d) => setPrs(d.prs ?? [])).catch(() => undefined);
  }, [props.sessionId]);
  useEffect(() => onFrame((f) => {
    if (f.sessionId === props.sessionId && f.type === "pr") setPrs((f.prs as SessionPrLink[]) ?? []);
  }), [onFrame, props.sessionId]);
  const rootRef = useRef<HTMLDivElement>(null);
  // The panel may grow until the main column would drop below MAIN_MIN_WIDTH.
  const maxRight = () => Math.max(200, (rootRef.current?.clientWidth ?? 1200) - MAIN_MIN_WIDTH);
  const right = useResizableWidth(`artisan.session.${props.sessionId}.sidebar.right`, 288, 200, maxRight);
  const [, forceRender] = useState(0);
  useEffect(() => {
    const onResize = () => forceRender((n) => n + 1);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const rightWidth = Math.min(right.width, maxRight());

  const panel = (
    <div className="flex h-full min-h-0 w-full flex-col border-l border-outline">
      <div role="tablist" className="flex shrink-0 items-stretch border-b border-outline">
        {([["default", "Details", PanelRight], ["canvas", "Canvas", Palette], ["git", "Git", GitBranch]] as const).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={sidebarView === id}
            aria-label={label}
            title={label}
            onClick={() => setSidebarView(id)}
            className={`flex size-9 items-center justify-center border-r border-outline transition-colors ${sidebarView === id ? "bg-surface-muted text-ink" : "text-ink-muted hover:bg-surface-muted/60 hover:text-ink"}`}
          >
            <Icon className="size-4" />
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 pb-2.5">
        {sidebarView === "canvas" ? (
          <CanvasScreen sessionId={props.sessionId} hideHeader />
        ) : sidebarView === "git" ? (
          <div className="h-full min-h-0 overflow-y-auto">
            <GitSection git={side.git} refreshing={side.busy} onRefresh={side.refresh} />
          </div>
        ) : (
          <SessionSidebar
            sessionId={props.sessionId}
            model={side.model}
            prs={prs}
            plan={side.plan}
            children={side.children}
            jobs={side.jobs}
            onOpenChild={(id) => {
              if (!isLarge) setShowSidebar(false);
              props.onOpenChild(id);
            }}
          />
        )}
      </div>
    </div>
  );

  return (
    <div ref={rootRef} className="flex min-h-0 flex-1">
      <div className="relative flex min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center gap-1.5 border-b border-outline bg-surface px-3 py-2">
          <SessionTabs active={tab} onChange={setTab} />
          <div className="mx-1.5 hidden h-4 w-px bg-outline lg:block" />
          <span
            className="ml-auto flex items-center gap-1.5 text-[10px] text-ink-muted"
            title={props.connected ? "Connected to the workspace" : "Reconnecting to the workspace"}
          >
            <span className={`inline-block size-1.5 rounded-full ${props.connected ? "bg-emerald-500" : "bg-red-400"}`} />
            <span className="hidden sm:inline">{props.connected ? "live" : "reconnecting…"}</span>
          </span>
          <ExpandToggle className="lg:hidden" />
          <button
            type="button"
            aria-label={showSidebar ? "Hide sidebar" : "Show sidebar"}
            title={showSidebar ? "Hide sidebar" : "Show sidebar"}
            className="rounded-md p-1 text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
            onClick={() => setShowSidebar((v) => !v)}
          >
            {showSidebar ? <PanelRightClose className="size-4" /> : <PanelRightOpen className="size-4" />}
          </button>
        </header>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {tab === "chat" ? <ChatView sessionId={props.sessionId} noHeader /> : null}
          {tab === "editor" ? <EditorScreen sessionId={props.sessionId} /> : null}
          {tab === "terminal" ? <TerminalScreen sessionId={props.sessionId} /> : null}
          {tab === "changes" ? <ChangesScreen sessionId={props.sessionId} /> : null}
          {tab === "checkpoints" ? <CheckpointsScreen sessionId={props.sessionId} /> : null}
          {tab === "inspector" ? <InspectorScreen sessionId={props.sessionId} /> : null}
        </div>
      </div>
      {showSidebar ? (
        isLarge ? (
          <div className="flex h-full min-h-0 shrink-0" style={{ width: rightWidth }}>
            <right.Handle edge="left" />
            <div className="h-full min-h-0 w-full">{panel}</div>
          </div>
        ) : (
          <>
            <div aria-hidden className="fixed inset-0 z-40 bg-black/50" onClick={() => setShowSidebar(false)} />
            <div className="fixed inset-y-0 right-0 z-50 flex min-h-0 bg-paper shadow-xl" style={{ width: "min(88vw, 340px)" }}>
              <div className="h-full min-h-0 w-full">{panel}</div>
            </div>
          </>
        )
      ) : null}
    </div>
  );
}
