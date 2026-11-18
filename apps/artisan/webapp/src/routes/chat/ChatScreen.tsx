import { ChatView } from "./ChatView.js";
import { AwayToggle } from "./partials/AwayToggle.js";
import { ExpandToggle } from "./partials/ExpandToggle.js";

/** An llm_chat session: just the conversation — no editor/terminal/git/plan panels (there is no runner). */
export function ChatScreen(props: { sessionId: string; title?: string; connected?: boolean }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex shrink-0 items-center gap-2 border-b border-outline bg-surface px-3 py-2">
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{props.title ?? "Chat"}</span>
        <span className="flex items-center gap-1.5 text-[10px] text-ink-muted" title={props.connected ? "Connected to the workspace" : "Reconnecting to the workspace"}>
          <span className={`inline-block size-1.5 rounded-full ${props.connected ? "bg-emerald-500" : "bg-red-400"}`} />
          {props.connected ? "live" : "reconnecting…"}
        </span>
        <AwayToggle />
        <ExpandToggle className="lg:hidden" />
      </header>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <ChatView sessionId={props.sessionId} noHeader plain />
      </div>
    </div>
  );
}
