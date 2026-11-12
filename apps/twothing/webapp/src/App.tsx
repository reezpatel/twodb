import { authClient } from "./lib/auth-client";
import { Frame } from "./shell/Frame";
import { Routes } from "./shell/Routes";
import { ScanProvider } from "./scanner/ScanProvider";
import { Toaster } from "./ui/Toaster";

/**
 * Session gate → scanner provider → responsive frame → hash routes.
 * Unauthenticated visitors bounce to the control plane's login (SSO).
 */
export function App() {
  if (__TWOTHING_NO_AUTH__) return <Inner />;
  return <Gated />;
}

function Gated() {
  const { data: session, isPending } = authClient.useSession();
  if (isPending) return <div className="grid h-dvh place-items-center text-sm text-ink-muted">Loading…</div>;
  if (!session) {
    window.location.href = `${window.location.origin}/`;
    return null;
  }
  return <Inner />;
}

function Inner() {
  return (
    <ScanProvider>
      <Frame>
        <Routes />
      </Frame>
      <Toaster />
    </ScanProvider>
  );
}
