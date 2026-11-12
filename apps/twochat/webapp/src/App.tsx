import { authClient } from "./lib/auth-client";
import { ChatProvider } from "./lib/chat-context";
import { Chat } from "./routes/chat/Chat";

/**
 * Session → chat-state bridge: waits for the shared control-plane session
 * (SSO via the gateway), then mounts the chat app with the resolved user.
 */
export function App() {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) return <div className="grid h-screen place-items-center text-sm text-muted-foreground">Loading…</div>;
  if (!session) {
    window.location.href = `${window.location.origin}/`;
    return null;
  }

  return (
    <ChatProvider myUserId={session.user.id} myUserName={session.user.name ?? "you"}>
      <Chat />
    </ChatProvider>
  );
}
