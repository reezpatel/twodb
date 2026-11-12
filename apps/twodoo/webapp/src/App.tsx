import { authClient } from "./lib/auth-client";
import { TwoDooProvider } from "./routes/twodoo/hooks/useTwoDoo";
import { TwoDoo } from "./routes/twodoo/TwoDoo";

/**
 * Session → TwoDoo bridge: waits for the shared control-plane session (SSO
 * via the gateway), then mounts the task app with the resolved user.
 */
export function App() {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) return <div className="grid h-screen place-items-center text-sm text-muted-ink">Loading…</div>;
  if (!session) {
    window.location.href = `${window.location.origin}/`;
    return null;
  }

  return (
    <TwoDooProvider>
      <TwoDoo />
    </TwoDooProvider>
  );
}
