import { ChatPanel } from "./chat/chat-panel";
import { useChatPanel } from "./chat/use-chat-panel";
import { Editor } from "./editor/editor";
import { Header } from "./header/header";
import { Sidebar } from "./sidebar/sidebar";
import { Sidenav } from "./sidenav/sidenav";
import { useCodeScene } from "./use-code-scene";

export function CodeScene() {
  const { selectedSessionId, selectSession, view, setView } = useCodeScene();
  const chat = useChatPanel(selectedSessionId);

  return (
    <div className="flex h-full flex-col">
      <Header view={view} onViewChange={setView} />
      <div className="flex min-h-0 flex-1">
        <Sidenav selectedId={selectedSessionId} onSelect={selectSession} activeStreaming={chat.streaming !== null} />
        <div className="flex min-w-0 flex-1 flex-col">{view === "chat" ? <ChatPanel sessionId={selectedSessionId} chat={chat} /> : <Editor />}</div>
        <Sidebar />
      </div>
    </div>
  );
}
