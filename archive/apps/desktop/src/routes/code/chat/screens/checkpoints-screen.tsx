import { useState } from "react";
import { useParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { History, Loader2, Trash2, Undo2 } from "lucide-react";
import { useSessionDirectory } from "../use-session-directory";
import { useGitStatus } from "../../directories/use-git-status";
import { GitInitCard } from "./git-init-card";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Checkpoint {
  id: string;
  label: string | null;
  commitSha: string;
  createdAt: string;
}

const ERRORS: Record<string, string> = {
  runner_offline: "Runner is offline — start it and try again.",
  directory_missing: "This directory no longer exists on the runner.",
  checkpoint_failed: "Could not capture the checkpoint on the runner.",
  restore_failed: "Could not restore the checkpoint on the runner.",
};

export function CheckpointsScreen() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { directory, directoryId, isPending } = useSessionDirectory();
  const [label, setLabel] = useState("");

  const qc = useQueryClient();
  const git = useGitStatus(directoryId);

  const checkpoints = useQuery({
    queryKey: ["code", "sessions", sessionId, "checkpoints"],
    queryFn: () => api<Checkpoint[]>(`/api/code/sessions/${sessionId}/checkpoints`),
    enabled: !!directoryId && git.data?.git === true,
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["code", "sessions", sessionId, "checkpoints"] });
    void qc.invalidateQueries({ queryKey: ["code", "directories", directoryId, "git"] });
  };

  const create = useMutation({
    mutationFn: () => api(`/api/code/sessions/${sessionId}/checkpoints`, { method: "POST", body: JSON.stringify({ label: label.trim() || null }) }),
    onSuccess: () => {
      setLabel("");
      invalidate();
    },
  });
  const restore = useMutation({
    mutationFn: (id: string) => api(`/api/code/checkpoints/${id}/restore`, { method: "POST" }),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/api/code/checkpoints/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });

  if (isPending) return null;

  if (!directoryId) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2">
        <History size={28} className="text-muted-foreground/50" aria-hidden="true" />
        <p className="text-muted-foreground text-sm font-medium">No directory assigned</p>
        <p className="text-muted-foreground/70 max-w-xs text-center text-xs">
          Sessions get their directory at creation — start one with the + next to a directory in the sidebar.
        </p>
      </div>
    );
  }

  if (git.isError) {
    const message = (git.error as Error).message;
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-destructive text-sm">
          {message === "runner_offline"
            ? "Runner is offline — start it and try again."
            : message === "directory_missing"
              ? "This directory no longer exists on the runner."
              : "Could not read git status."}
        </p>
      </div>
    );
  }

  if (!git.data) return null;
  if (!git.data.git) return <GitInitCard directoryId={directoryId} cwd={directory?.cwd ?? ""} />;

  const actionError = (create.error ?? restore.error ?? remove.error) as Error | null;

  return (
    <div className="mx-auto flex h-full w-full max-w-2xl flex-col gap-3 overflow-y-auto p-4">
      <div className="flex items-center gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium">Checkpoints</p>
          <p className="text-muted-foreground truncate text-xs">
            <span className="font-mono">{git.data.branch ?? "detached"}</span> · {git.data.dirtyFiles ?? 0} uncommitted files
            {git.data.origin ? (
              <>
                {" · "}
                <span className="font-mono">{git.data.origin}</span>
              </>
            ) : null}
          </p>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <Input placeholder="Label (optional)" value={label} onChange={(e) => setLabel(e.target.value)} className="h-8 w-44" />
          <Button size="sm" onClick={() => create.mutate()} disabled={create.isPending}>
            {create.isPending ? <Loader2 size={14} className="animate-spin" /> : <History size={14} />}
            Checkpoint
          </Button>
        </div>
      </div>

      {actionError && <p className="text-destructive text-xs">{ERRORS[actionError.message] ?? actionError.message}</p>}

      <div className="overflow-hidden rounded-lg border">
        {checkpoints.isPending ? (
          <div className="text-muted-foreground flex items-center gap-2 px-3 py-3 text-sm">
            <Loader2 size={14} className="animate-spin" /> loading…
          </div>
        ) : (checkpoints.data ?? []).length === 0 ? (
          <div className="text-muted-foreground px-3 py-6 text-center text-sm">No checkpoints yet — capture one before an agent run.</div>
        ) : (
          <div className="divide-y">
            {(checkpoints.data ?? []).map((cp) => (
              <div key={cp.id} className="flex items-center gap-3 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{cp.label ?? "Checkpoint"}</p>
                  <p className="text-muted-foreground text-xs font-mono">
                    {cp.commitSha.slice(0, 7)} · {new Date(cp.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="ml-auto flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={restore.isPending}
                    onClick={() => {
                      if (window.confirm("Restore the working tree to this checkpoint? Uncommitted changes made after it will be overwritten.")) {
                        restore.mutate(cp.id);
                      }
                    }}
                  >
                    <Undo2 size={13} /> Restore
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    title="Delete checkpoint"
                    disabled={remove.isPending}
                    onClick={() => {
                      if (window.confirm("Delete this checkpoint?")) remove.mutate(cp.id);
                    }}
                  >
                    <Trash2 size={13} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-muted-foreground/70 text-[11px]">
        Checkpoints are git snapshots on hidden refs — restoring rewrites uncommitted files back; branches and HEAD stay untouched.
      </p>
    </div>
  );
}
