import { useState } from "react";
import { Loader2, Server } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SignInLayout } from "@/components/ui/sign-in-page";
import { getServerUrl, normalizeServerUrl, setServerUrl } from "@/lib/native";

/** Pings /api/health so a typo or an unreachable host fails here, not at
 *  sign-in. Any JSON reply from a twodb server counts (even "degraded"). */
async function probe(url: string): Promise<string | null> {
  try {
    const res = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(8000) });
    const body = (await res.json().catch(() => null)) as { checks?: unknown } | null;
    return body && typeof body === "object" ? null : `${url} doesn't look like a twodb server`;
  } catch {
    return `Couldn't reach ${url}`;
  }
}

/** Native first launch (and "Change server"): pick the twodb server this
 *  bundled app talks to. Reloads on success so the auth client + caches start
 *  fresh against it. */
export function ConnectServer() {
  const [value, setValue] = useState(getServerUrl() ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const connect = async () => {
    const url = normalizeServerUrl(value);
    if (!url) return setError("Enter a server address, e.g. app.twodb.io");
    setBusy(true);
    setError(null);
    const problem = await probe(url);
    setBusy(false);
    if (problem) return setError(problem);
    setServerUrl(url);
    window.location.assign("/login");
  };

  return (
    <SignInLayout>
      <div className="mb-8">
        <Server className="text-muted-foreground mb-4 size-8" aria-hidden="true" />
        <h1 className="text-foreground mb-2 text-3xl font-medium">Connect to twodb</h1>
        <p className="text-muted-foreground">Enter the address of your twodb server.</p>
      </div>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void connect();
        }}
      >
        <div className="flex flex-col gap-3">
          <Label htmlFor="server">Server address</Label>
          <Input
            id="server"
            autoFocus
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            inputMode="url"
            placeholder="app.twodb.io"
            className="px-4 py-3"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>
        {error && (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" className="w-full py-3" disabled={busy}>
          {busy && <Loader2 className="animate-spin" />}
          Connect
        </Button>
      </form>
    </SignInLayout>
  );
}

/** "Connected to <server> · Change" — shown on the auth screens of native builds. */
export function ServerSwitch() {
  const server = getServerUrl();
  if (!server) return null;
  return (
    <p className="text-muted-foreground mt-8 flex items-center justify-center gap-1.5 text-xs">
      <Server size={12} aria-hidden="true" />
      <span className="truncate">{new URL(server).host}</span>
      <span aria-hidden="true">·</span>
      <button
        type="button"
        className="text-primary font-medium hover:underline"
        onClick={() => {
          setServerUrl(null);
          window.location.assign("/");
        }}
      >
        Change server
      </button>
    </p>
  );
}
