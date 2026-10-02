import { Outlet, useNavigate, useParams } from "react-router";
import { ChatContext, useChatPanel } from "./chat/use-chat-panel";
import { Sidebar } from "./sidebar/sidebar";
import { Sidenav } from "./sidenav/sidenav";

export function CodeScene() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const chat = useChatPanel(sessionId ?? null);

  return (
    <ChatContext.Provider value={chat}>
      <div className="flex h-full min-h-0">
        <Sidenav selectedId={sessionId ?? null} onSelect={(id) => navigate(`/apps/code/${id}`)} activeStreaming={chat.streaming !== null} />
        <div className="flex min-w-0 flex-1 flex-col">
          {sessionId ? (
            <Outlet />
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-muted-foreground">Select a session on the left, or start a new one with +.</p>
            </div>
          )}
        </div>
        <Sidebar />
      </div>
    </ChatContext.Provider>
  );
}
