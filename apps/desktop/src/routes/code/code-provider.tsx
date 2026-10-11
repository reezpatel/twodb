import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router";
import { ChatContext, useChatPanel } from "./chat/use-chat-panel";
import { Sidenav } from "./sidenav/sidenav";

/** Code app state — one ChatPanel instance shared by the shell-rendered
 * sidenav and the content panels. Session id comes from the URL; this
 * provider renders above the route element so it parses the path itself. */
export function CodeProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  // /apps/code/:sessionId/...
  const sessionId = location.pathname.split("/")[3] ?? null;

  const chat = useChatPanel(sessionId || null);
  const selectSession = useMemo(() => (id: string) => navigate(`/apps/code/${id}`), [navigate]);

  const value = useMemo(() => ({ chat, selectSession, sessionId: sessionId ?? null }), [chat, selectSession, sessionId]);
  return (
    <ChatContext.Provider value={chat}>
      <CodeContext.Provider value={value}>{children}</CodeContext.Provider>
    </ChatContext.Provider>
  );
}

export const CodeContext = createContext<{
  chat: ReturnType<typeof useChatPanel>;
  selectSession: (id: string) => void;
  sessionId: string | null;
} | null>(null);

export function useCode() {
  const ctx = useContext(CodeContext);
  if (!ctx) throw new Error("useCode must be used within CodeProvider");
  return ctx;
}

/** The code sidebar (agent sessions by directory) — rendered by the app shell
 * (desktop column / mobile drawer). */
export function CodeSidenav() {
  const { chat, selectSession, sessionId } = useCode();

  return <Sidenav selectedId={sessionId} onSelect={selectSession} activeStreaming={chat.streaming !== null} />;
}
