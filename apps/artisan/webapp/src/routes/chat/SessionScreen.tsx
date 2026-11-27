import { useEffect, useRef, useState } from "react";
import { PanelRightClose, PanelRightOpen } from "lucide-react";
import { useLargeViewport } from "@twodb/blocks";
import { useResizableWidth } from "../../lib/useResizableWidth.js";
import { ChatView } from "./ChatView.js";
import { EditorScreen } from "./EditorScreen.js";
import { TerminalScreen } from "./TerminalScreen.js";
import { CheckpointsScreen } from "./CheckpointsScreen.js";
import { InspectorScreen } from "./InspectorScreen.js";
import { ChangesScreen } from "./ChangesScreen.js";
import { CanvasScreen } from "./CanvasScreen.js";
import { ExpandToggle } from "./partials/ExpandToggle.js";
import { SessionTabs, type SessionTabId } from "./partials/SessionTabs.js";
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
  const [tab, setTab] = useState<SessionTabId>("chat");
  const isLarge = useLargeViewport();
  // Docked on lg+ (open by default); on mobile it is a slide-over sheet, hidden until toggled.
  const [showSidebar, setShowSidebar] = useState(isLarge);
  // Canvas replaces the right sidebar content (with an X to return); on small
  // viewports there is no docked sidebar, so canvas falls back to a full view.
  const [sidebarView, setSidebarView] = useState<"default" | "canvas">("default");
  useEffect(() => {
    setShowSidebar(isLarge);
  }, [isLarge, props.sessionId]);

  // footer shortcuts (terminal button) request a tab switch
  useEffect(() => {
    const onOpen = (e: Event) => {
      const t = (e as CustomEvent<SessionTabId | "canvas">).detail;
      if (t === "canvas") {
        // Docked sidebar on lg+; a full-view overlay on small screens.
        setSidebarView("canvas");
        if (isLarge) setShowSidebar(true);
        return;
      }
      if (t === "terminal" || t === "editor" || t === "changes" || t === "chat" || t === "checkpoints" || t === "inspector") setTab(t);
    };
    window.addEventListener("artisan:open-tab", onOpen);
    return () => window.removeEventListener("artisan:open-tab", onOpen);
  }, [isLarge]);
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
  const right = useResizableWidth("artisan.sidebar.right", 288, 200, maxRight);
  const [, forceRender] = useState(0);
  useEffect(() => {
    const onResize = () => forceRender((n) => n + 1);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const rightWidth = Math.min(right.width, maxRight());

  const panel =
    sidebarView === "canvas" ? (
      <CanvasScreen sessionId={props.sessionId} onClose={() => setSidebarView("default")} />
    ) : (
      <SessionSidebar
        sessionId={props.sessionId}
        model={side.model}
        prs={prs}
        plan={side.plan}
        children={side.children}
        git={side.git}
        jobs={side.jobs}
        busy={side.busy}
        onRefreshGit={side.refresh}
        onOpenCanvas={() => setSidebarView("canvas")}
        onOpenChild={(id) => {
          if (!isLarge) setShowSidebar(false);
          props.onOpenChild(id);
        }}
      />
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
        {/* Small viewports have no docked sidebar — canvas opens as a full view. */}
        {!isLarge && sidebarView === "canvas" ? (
          <div className="absolute inset-0 z-30 bg-paper">
            <CanvasScreen sessionId={props.sessionId} onClose={() => setSidebarView("default")} />
          </div>
        ) : null}
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
