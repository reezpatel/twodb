import { useState } from "react";
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
  const side = useSessionSide(props.sessionId);

  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center gap-1.5 border-b border-outline bg-surface px-3 py-2">
          <SessionTabs active={tab} onChange={setTab} />
          <div className="mx-1.5 h-4 w-px bg-outline" />
          <span className="truncate text-[13px] font-medium">{props.title ?? props.sessionId.slice(-8)}</span>
        </header>
        <div className="min-h-0 flex-1">
          {tab === "chat" ? <ChatView sessionId={props.sessionId} noHeader /> : null}
          {tab === "editor" ? <EditorScreen sessionId={props.sessionId} /> : null}
          {tab === "terminal" ? <TerminalScreen sessionId={props.sessionId} /> : null}
          {tab === "checkpoints" ? <CheckpointsScreen sessionId={props.sessionId} /> : null}
        </div>
      </div>
      <SessionSidebar plan={side.plan} children={side.children} git={side.git} onOpenChild={props.onOpenChild} />
    </div>
  );
}
