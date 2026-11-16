import { authClient } from "./lib/auth-client";
import { ChatProvider } from "./lib/chat-context";
import { Chat } from "./routes/chat/Chat";

/**
 * Session → chat-state bridge: waits for the shared control-plane session
 * (SSO via the gateway), then mounts the chat app with the resolved user.
 */
export function App() {
  const { data: session, isPending } = authClient.useSession();

  if (isPending || !session) return <div className="grid h-screen place-items-center text-sm text-muted-foreground">Loading…</div>;
  // No redirect when `session` is null: RequireTwoDbAuth (main.tsx) owns login, and bouncing to this app's own origin loops.
  return (
    <ChatProvider myUserId={session.user.id} myUserName={session.user.name ?? "you"}>
      <Chat />
    </ChatProvider>
  );
}
