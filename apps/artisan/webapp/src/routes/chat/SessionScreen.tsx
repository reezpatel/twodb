import { useState } from "react";
import { PanelRightClose, PanelRightOpen } from "lucide-react";
import { useResizableWidth } from "../../lib/useResizableWidth.js";
import { ChatView } from "./ChatView.js";
import { EditorScreen } from "./EditorScreen.js";
import { TerminalScreen } from "./TerminalScreen.js";
import { CheckpointsScreen } from "./CheckpointsScreen.js";
import { SessionTabs, type SessionTabId } from "./partials/SessionTabs.js";
import { SessionSidebar } from "./partials/SessionSidebar.js";
import { useSessionSide } from "./hooks/useSessionSide.js";

/**
 * One session's full workspace: legacy-style header (title + Chat/Editor/
 * Terminal/Checkpoints tabs + new-thread/compact actions), tab content, and
 * the right sidebar (Subagents, Plan, Git). The chat footer is part of the
 * chat tab and always pins to the bottom of the column.
 */
export function SessionScreen(props: { sessionId: string; onOpenChild: (sessionId: string) => void; title?: string }) {
  const [tab, setTab] = useState<SessionTabId>("chat");
  const [showSidebar, setShowSidebar] = useState(true);
  const side = useSessionSide(props.sessionId);
  const right = useResizableWidth("artisan.sidebar.right", 288, 200, 480);

  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center gap-1.5 border-b border-outline bg-surface px-3 py-2">
          <SessionTabs active={tab} onChange={setTab} />
          <div className="mx-1.5 h-4 w-px bg-outline" />
          <span className="truncate text-[13px] font-medium">{props.title ?? props.sessionId.slice(-8)}</span>
          <button
            type="button"
            aria-label={showSidebar ? "Hide sidebar" : "Show sidebar"}
            title={showSidebar ? "Hide sidebar" : "Show sidebar"}
            className="ml-auto rounded-md p-1 text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
            onClick={() => setShowSidebar((v) => !v)}
          >
            {showSidebar ? <PanelRightClose className="size-4" /> : <PanelRightOpen className="size-4" />}
          </button>
        </header>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {tab === "chat" ? <ChatView sessionId={props.sessionId} noHeader /> : null}
          {tab === "editor" ? <EditorScreen sessionId={props.sessionId} /> : null}
          {tab === "terminal" ? <TerminalScreen sessionId={props.sessionId} /> : null}
          {tab === "checkpoints" ? <CheckpointsScreen sessionId={props.sessionId} /> : null}
        </div>
      </div>
      {showSidebar ? (
        <div className="flex h-full min-h-0 shrink-0" style={{ width: right.width }}>
          <right.Handle edge="right" />
          <div className="h-full min-h-0 w-full">
            <SessionSidebar plan={side.plan} children={side.children} git={side.git} jobs={side.jobs} busy={side.busy} onCommit={side.commit} onOpenChild={props.onOpenChild} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
