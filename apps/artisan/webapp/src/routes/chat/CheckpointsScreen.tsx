import { useState } from "react";
import { History, Plus } from "lucide-react";
import { useSessionSide } from "./hooks/useSessionSide.js";
import { SideSection, CheckpointRow } from "./partials/SidePanel.js";

/** Checkpoints tab: git-ref snapshots of the session directory. */
export function CheckpointsScreen(props: { sessionId: string }) {
  const side = useSessionSide(props.sessionId);
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const git = side.git;

  const create = async () => {
    setError(null);
    try {
      await side.createCheckpoint(label.trim());
      setLabel("");
    } catch {
      setError("checkpoint failed — is the directory a git repo? (git init first)");
    }
  };

  if (git && git.git === false) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-ink-muted">
        <History className="size-7 opacity-50" />
        <p className="text-[13px] font-medium">Not a git repository</p>
        <p className="max-w-xs text-center text-[11px]">Checkpoints snapshot the session directory via hidden git refs. Run `git init` in the terminal tab first.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-outline px-3 py-2">
        <input
          value={label}
          placeholder="checkpoint label (optional)"
          className="h-8 flex-1 rounded-md border border-outline bg-paper px-2.5 text-[12px] outline-none"
          onChange={(e) => setLabel(e.target.value)}
        />
        <button
          type="button"
          disabled={side.busy}
          onClick={() => void create()}
          className="flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-[12px] font-medium text-primary-foreground disabled:opacity-40"
        >
          <Plus className="size-3.5" />
          Checkpoint
        </button>
      </div>
      {error ? <p className="px-3 py-1.5 text-[11px] text-destructive">{error}</p> : null}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {side.checkpoints.map((cp) => (
          <div key={cp.id} className="border-b border-outline px-3 py-2 last:border-b-0">
            <div className="flex items-center gap-2">
              <span className="text-[13px]">{cp.label ?? "checkpoint"}</span>
              <span className="font-mono text-[10px] text-ink-muted">{cp.commitSha.slice(0, 10)}</span>
              <span className="ml-auto text-[10px] text-ink-muted">{new Date(cp.createdAt).toLocaleString()}</span>
            </div>
            <div className="mt-1 flex gap-2">
              <button
                type="button"
                className="rounded border border-outline px-2 py-0.5 text-[11px] hover:bg-surface-muted"
                onClick={() => void side.restoreCheckpoint(cp.id)}
              >
                Restore
              </button>
              <button
                type="button"
                className="rounded border border-outline px-2 py-0.5 text-[11px] text-destructive hover:bg-surface-muted"
                onClick={() => void side.deleteCheckpoint(cp.id)}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
        {side.checkpoints.length === 0 ? (
          <p className="p-6 text-center text-[12px] text-ink-muted">No checkpoints yet — capture one before risky changes.</p>
        ) : null}
      </div>
    </div>
  );
}

export { SideSection, CheckpointRow };
