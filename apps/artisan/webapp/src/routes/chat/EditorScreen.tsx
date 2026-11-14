import { useCallback, useEffect, useState } from "react";
import { Code2, Download, MonitorX, Loader2 } from "lucide-react";

type EditorState = "starting" | "not_installed" | "installing" | "idle" | "ready" | "unsupported" | "error";

interface EditorStatus {
  state: EditorState;
  bytes?: number;
  total?: number;
  port?: number;
}

/**
 * Editor tab: a code-server instance running on the session's runner, iframed
 * through artisan's HTTP proxy (like the legacy app). Not installed → install
 * card (the runner downloads the standalone tarball, no root needed).
 */
export function EditorScreen(props: { sessionId: string }) {
  const [status, setStatus] = useState<EditorStatus>({ state: "starting" });
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/artisan-api/sessions/${props.sessionId}/editor/status`, { credentials: "include" });
      if (res.ok) setStatus((await res.json()) as EditorStatus);
    } catch {
      /* offline */
    }
  }, [props.sessionId]);

  useEffect(() => {
    void refresh();
    const t = setInterval(() => {
      setStatus((s) => (s.state === "ready" ? s : s));
      void refresh();
    }, status.state === "installing" ? 1500 : 4000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh, status.state]);

  // Once idle (installed but not running), auto-start.
  useEffect(() => {
    if (status.state !== "idle") return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/artisan-api/sessions/${props.sessionId}/editor/start`, { method: "POST", credentials: "include" });
        if (res.ok) {
          const body = (await res.json()) as { ok?: boolean };
          if (body.ok && !cancelled) setStatus({ state: "ready", port: 8443 });
          else if (!cancelled) setStatus({ state: "error" });
        } else if (!cancelled) setStatus({ state: "error" });
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status.state, props.sessionId]);

  const install = async () => {
    setStatus((s) => ({ ...s, state: "installing" }));
    try {
      await fetch(`/artisan-api/sessions/${props.sessionId}/editor/install`, { method: "POST", credentials: "include" });
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (status.state === "ready") {
    return (
      <iframe
        src={`/artisan-api/sessions/${props.sessionId}/editor/?folder=${encodeURIComponent("/")}`}
        className="h-full w-full border-0"
        title="Code editor"
        allow="clipboard-read; clipboard-write"
      />
    );
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <Code2 size={28} className="text-ink-muted/50" />
      {status.state === "not_installed" ? (
        <>
          <p className="text-sm font-medium">VS Code Server isn't installed on this runner</p>
          <p className="max-w-sm text-xs text-ink-muted">
            The editor runs on the runner as a local <code>code-server</code> process — downloaded as a standalone
            tarball (~60MB, no admin rights needed) on first use.
          </p>
          <button
            type="button"
            onClick={() => void install()}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[13px] font-medium text-primary-foreground"
          >
            <Download size={13} /> Install on runner
          </button>
        </>
      ) : status.state === "installing" || status.state === "idle" || status.state === "starting" ? (
        <>
          <Loader2 size={20} className="animate-spin text-ink-muted" />
          <p className="text-sm text-ink-muted">
            {status.state === "installing" ? "Installing code-server…" : "Starting code-server…"}
          </p>
        </>
      ) : status.state === "unsupported" ? (
        <>
          <MonitorX size={22} className="text-ink-muted/60" />
          <p className="text-sm font-medium">Editor not supported on this runner</p>
          <p className="max-w-sm text-xs text-ink-muted">code-server needs a Linux/macOS runner.</p>
        </>
      ) : (
        <>
          <p className="text-sm font-medium text-destructive">Editor failed to start</p>
          {error ? <p className="max-w-sm text-xs text-ink-muted">{error}</p> : null}
          <button type="button" onClick={() => void refresh()} className="text-[13px] text-info hover:underline">Retry</button>
        </>
      )}
    </div>
  );
}
