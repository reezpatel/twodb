import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Code2, Download, Loader2, MonitorX, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import { assetUrl } from "@/lib/native";
import { Button } from "@/components/ui/button";

interface EditorStatus {
  state: "not_installed" | "unsupported" | "starting" | "ready" | "error";
  version?: string | null;
  detail?: string | null;
}

/** Editor tab: a code-server instance running on the session's runner,
 *  iframed through the server proxy. Not installed → install card (the runner
 *  auto-downloads the standalone tarball, no root needed). */
export function EditorScreen({ sessionId }: { sessionId: string }) {
  const [installing, setInstalling] = useState(false);

  const status = useQuery({
    queryKey: ["code-editor-status", sessionId],
    queryFn: () => api<EditorStatus>(`/api/code/sessions/${sessionId}/editor/status`),
    refetchInterval: (q) => (q.state.data?.state === "ready" ? false : installing ? 1500 : 4000),
    retry: false,
  });

  useEffect(() => {
    if (status.data?.state === "ready") setInstalling(false);
  }, [status.data?.state]);

  const install = async () => {
    setInstalling(true);
    try {
      await api(`/api/code/sessions/${sessionId}/editor/install`, { method: "POST" });
      void status.refetch();
    } catch {
      setInstalling(false);
      void status.refetch();
    }
  };

  const state = installing && status.data?.state !== "ready" ? "installing" : (status.data?.state ?? "starting");

  if (state === "ready") {
    return (
      <iframe
        // /editor-ws is tunneled to code-server's root socket (terminal + workbench);
        // everything else goes through the HTTP proxy under /editor/.
        src={assetUrl(`/api/code/sessions/${sessionId}/editor/`) ?? ""}
        className="h-full w-full border-0"
        title="Code editor"
        allow="clipboard-read; clipboard-write"
      />
    );
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <Code2 size={28} className="text-muted-foreground/50" />
      {state === "not_installed" && (
        <>
          <p className="text-sm font-medium">VS Code Server isn't installed on this runner</p>
          <p className="text-muted-foreground max-w-sm text-xs">
            The editor runs on the runner as a local <code>code-server</code> process — downloaded as a standalone tarball (~60MB, no admin rights
            needed) on first use.
          </p>
          <Button size="sm" onClick={() => void install()}>
            <Download size={13} /> Install on runner
          </Button>
        </>
      )}
      {state === "unsupported" && (
        <>
          <MonitorX size={22} className="text-muted-foreground/60" />
          <p className="text-sm font-medium">Editor not supported on this runner</p>
          <p className="text-muted-foreground max-w-sm text-xs">code-server has no native Windows build — use a Linux/macOS runner, or run the runner inside WSL.</p>
        </>
      )}
      {state === "installing" && (
        <>
          <Loader2 size={18} className="text-muted-foreground animate-spin" />
          <p className="text-sm">Installing VS Code Server on the runner…</p>
          <p className="text-muted-foreground text-xs">Downloading and unpacking — this can take a minute on slow connections.</p>
        </>
      )}
      {state === "starting" && (
        <>
          <Loader2 size={18} className="text-muted-foreground animate-spin" />
          <p className="text-sm">Starting editor…</p>
        </>
      )}
      {state === "error" && (
        <>
          <p className="text-sm font-medium">Editor unavailable</p>
          <p className="text-muted-foreground max-w-sm text-xs">{status.data?.detail ?? "unknown error"}</p>
          <Button size="sm" variant="outline" onClick={() => void status.refetch()}>
            <RefreshCw size={13} /> Retry
          </Button>
        </>
      )}
    </div>
  );
}
