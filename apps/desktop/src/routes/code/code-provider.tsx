import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router";
import { ChatContext, useChatPanel } from "./chat/use-chat-panel";
import { Sidenav } from "./sidenav/sidenav";

/** Code app state — one ChatPanel instance shared by the shell-rendered
 * sidenav and the content panels. Session id comes from the URL; this
 * provider renders above the route element so it parses the path itself. */

/** Right-bar panels — the extra screens a session exposes. The route stays the
 * source of truth (`/apps/code/:sessionId/:panelId`) so panels deep-link. */
export type CodePanelId = "terminal" | "checkpoints" | "changes" | "canvas";

interface CodeState {
  chat: ReturnType<typeof useChatPanel>;
  selectSession: (id: string) => void;
  sessionId: string | null;
  /** Active right-bar panel (terminal/checkpoints/…) — null = default sections. */
  panel: CodePanelId | null;
  /** Whole right bar (sections or panel) visibility toggle. */
  rightBarVisible: boolean;
  toggleRightBar: () => void;
  closePanel: () => void;
}

export const CodeContext = createContext<CodeState | null>(null);

export function CodeProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  // /apps/code/:sessionId/:panelId
  const sessionId = location.pathname.split("/")[3] ?? null;
  const rawPanel = location.pathname.split("/")[4] ?? null;
  const panel = (["terminal", "checkpoints", "changes", "canvas"] as const).includes(rawPanel as CodePanelId) ? (rawPanel as CodePanelId) : null;

  const chat = useChatPanel(sessionId || null);
  const [rightBarVisible, setRightBarVisible] = useState(true);
  const selectSession = useMemo(() => (id: string) => navigate(`/apps/code/${id}`), [navigate]);
  const closePanel = useCallback(() => {
    if (sessionId) navigate(`/apps/code/${sessionId}`, { replace: true });
  }, [navigate, sessionId]);
  const toggleRightBar = useCallback(() => setRightBarVisible((v) => !v), []);

  const value = useMemo(
    () => ({ chat, selectSession, sessionId: sessionId ?? null, panel, rightBarVisible, toggleRightBar, closePanel }),
    [chat, selectSession, sessionId, panel, rightBarVisible, toggleRightBar, closePanel],
  );
  return (
    <ChatContext.Provider value={chat}>
      <CodeContext.Provider value={value}>{children}</CodeContext.Provider>
    </ChatContext.Provider>
  );
}

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