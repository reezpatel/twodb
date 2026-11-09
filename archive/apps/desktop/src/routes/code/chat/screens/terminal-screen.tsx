import { useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { RotateCw, TerminalSquare } from "lucide-react";
import { useSessionDirectory } from "../use-session-directory";
import { useRunnerTerminal } from "@/lib/use-runner-terminal";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";

type TerminalScope = "runner" | "directory" | "session";

function tmuxSessionName(scope: TerminalScope, sessionId: string, directoryId: string) {
  if (scope === "directory") return `twodb-${directoryId.slice(0, 8)}`;
  if (scope === "session") return `twodb-${sessionId.slice(0, 8)}`;
  return "twodb";
}

export function TerminalScreen() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { directory } = useSessionDirectory();
  const settings = useQuery({
    queryKey: ["code", "settings"],
    queryFn: () => api<{ terminalScope: TerminalScope }>("/api/code/settings"),
  });

  const directoryId = directory?.id ?? null;
  const runnerId = directory?.runnerId ?? null;
  const scope = settings.data?.terminalScope ?? "runner";
  const tmuxName = directory && sessionId ? tmuxSessionName(scope, sessionId, directory.id) : null;

  const { containerRef, dead, restart } = useRunnerTerminal(runnerId, { cwd: directory?.cwd ?? null, tmuxName });

  if (!directoryId) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2">
        <TerminalSquare size={28} className="text-muted-foreground/50" aria-hidden="true" />
        <p className="text-muted-foreground text-sm font-medium">No directory assigned</p>
        <p className="text-muted-foreground/70 max-w-xs text-center text-xs">
          Sessions get their directory at creation — start one with the + next to a directory in the sidebar.
        </p>
      </div>
    );
  }
  if (!directory) return null;

  return (
    <div className="relative flex h-full min-h-0 flex-col p-2">
      <div ref={containerRef} className="bg-muted min-h-0 flex-1 overflow-hidden rounded-lg border p-2" />
      {dead && (
        <Button size="icon" onClick={restart} title="Restart terminal" className="absolute right-4 bottom-4 h-9 w-9 rounded-full shadow-lg">
          <RotateCw size={15} />
        </Button>
      )}
    </div>
  );
}
